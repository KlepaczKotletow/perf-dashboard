# Sprint 6: Collaboration-Graph Peer Nomination (the Moat)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace silent peer-feedback assignment with a real nomination flow that **suggests peers automatically** based on the employee's actual collaboration graph: Slack channel co-presence, kudos sent/received, prior cycle reviewer relationships, plus optional GitHub/Jira connectors. Confirm.com markets ONA-style nomination as enterprise-only — we ship it for SMB. This is the durable competitive moat.

**Architecture:**
- **Phase 1 (this sprint):** Slack-signal-only graph. We have all the data already: kudos table, conversation_states, slack_user_id mapping, prior cycles. No new external integrations.
- **Phase 2 (later):** Add GitHub PR co-reviewers, Jira ticket collaborators via OAuth connectors.
- **Three layers:**
  1. **Graph builder (offline):** weekly cron computes a `collaboration_score` per (subject, candidate) pair. Stored in `collaboration_edges` table.
  2. **Nomination phase (per cycle):** when peer_review phase opens, Nami DMs each enrolled employee with their top 5 suggested peers as buttons. Employee confirms or replaces.
  3. **Manager approval:** manager gets a single Slack message summarizing pending nominations across their direct reports; one tap = approve all, or click into a modal to override.

**Tech Stack:**
- Postgres (graph stored as edges with scores)
- Existing Slack edge functions (modal-based confirm flow)
- pg_cron weekly recompute job
- Vitest for graph-builder math

**Out of scope this sprint:**
- GitHub/Jira/Linear connectors — Phase 2.
- Anonymous-with-proxy follow-up.
- Peer-review submission UX (already in Slack via existing modal).

---

## Pre-flight

```bash
git checkout main && git pull
git checkout -b sprint-6-peer-graph
npm test
```

---

## Track A: Schema for the collaboration graph

### Task 1: Migration — `collaboration_edges` table

**Files:**
- Create: `supabase/migrations/20260801_01_collaboration_edges.sql`

**Why:** Store pairwise scores. Subject = the employee being reviewed. Candidate = potential peer reviewer. Score = composite of Slack-channel overlap, kudos exchanged, prior peer-review pairing.

```sql
create table if not exists collaboration_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  subject_id uuid not null references users(id) on delete cascade,
  candidate_id uuid not null references users(id) on delete cascade,
  -- Component scores (each 0..1)
  slack_channel_overlap numeric(4,3) not null default 0,    -- shared channels / max possible
  kudos_score numeric(4,3) not null default 0,              -- bidirectional kudos in last 180d
  prior_peer_score numeric(4,3) not null default 0,         -- prior peer-review pairings
  conversation_score numeric(4,3) not null default 0,       -- DMs/threads (if available)
  -- Composite — weights tunable via workspace setting
  composite_score numeric(5,3) not null,
  -- Provenance
  computed_at timestamptz not null default now(),
  source_window_days int not null default 180,
  unique (workspace_id, subject_id, candidate_id),
  check (subject_id != candidate_id)
);

create index if not exists collab_edges_subject_idx on collaboration_edges(subject_id, composite_score desc);

alter table collaboration_edges enable row level security;
create policy "collab_edges_select_workspace"
  on collaboration_edges for select to authenticated
  using (workspace_id = (select workspace_id from users where id = auth.uid()));
revoke all on collaboration_edges from anon, public;
grant select on collaboration_edges to authenticated;
```

**Apply, commit:**

```bash
supabase db reset
git add supabase/migrations/20260801_01_collaboration_edges.sql
git commit -m "feat(graph): collaboration_edges table"
```

---

### Task 2: Migration — `cycle_peer_nominations` table

```sql
-- One row per (subject employee, proposed peer) per cycle. Lifecycle:
-- 'suggested' (algorithmic) → 'nominated' (employee confirmed) → 'approved' (manager approved) → 'declined'/'replaced'

create table if not exists cycle_peer_nominations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  cycle_id uuid not null references performance_cycles(id) on delete cascade,
  subject_id uuid not null references users(id) on delete cascade,
  peer_id uuid not null references users(id) on delete cascade,
  status text not null default 'suggested' check (status in ('suggested', 'nominated', 'approved', 'declined', 'replaced')),
  -- Suggestion provenance
  suggested_score numeric(5,3),
  suggested_basis text,                      -- e.g. "Shared 5 channels, exchanged 3 kudos"
  -- State transitions
  nominated_at timestamptz,
  approved_by uuid references users(id),
  approved_at timestamptz,
  declined_reason text,
  -- Audit
  created_at timestamptz not null default now(),
  unique (cycle_id, subject_id, peer_id),
  check (subject_id != peer_id)
);

create index if not exists peer_nominations_cycle_idx on cycle_peer_nominations(cycle_id, status);
create index if not exists peer_nominations_subject_idx on cycle_peer_nominations(subject_id, cycle_id);

alter table cycle_peer_nominations enable row level security;
create policy "peer_nominations_select_workspace"
  on cycle_peer_nominations for select to authenticated
  using (workspace_id = (select workspace_id from users where id = auth.uid()));
revoke all on cycle_peer_nominations from anon, public;
grant select on cycle_peer_nominations to authenticated;
```

**Commit:**

```bash
supabase db reset
git add supabase/migrations/20260801_02_cycle_peer_nominations.sql
git commit -m "feat(graph): cycle_peer_nominations table"
```

---

## Track B: Graph builder

### Task 3: Pure scoring helper

**Files:**
- Create: `src/lib/collaboration/score.ts`
- Create: `src/lib/collaboration/__tests__/score.test.ts`

**Step 1: Test**

```typescript
import { describe, it, expect } from "vitest";
import { computeComposite, ScoreComponents, normalizeChannelOverlap } from "../score";

describe("computeComposite", () => {
  it("zero components -> zero score", () => {
    expect(computeComposite({ slack_channel_overlap: 0, kudos_score: 0, prior_peer_score: 0, conversation_score: 0 })).toBe(0);
  });
  it("max components -> 1", () => {
    expect(computeComposite({ slack_channel_overlap: 1, kudos_score: 1, prior_peer_score: 1, conversation_score: 1 })).toBeCloseTo(1, 3);
  });
  it("kudos has higher weight than channel overlap", () => {
    const a = computeComposite({ slack_channel_overlap: 1, kudos_score: 0, prior_peer_score: 0, conversation_score: 0 });
    const b = computeComposite({ slack_channel_overlap: 0, kudos_score: 1, prior_peer_score: 0, conversation_score: 0 });
    expect(b).toBeGreaterThan(a);
  });
});

describe("normalizeChannelOverlap", () => {
  it("returns 0 when subject is in 0 channels", () => {
    expect(normalizeChannelOverlap(0, 0)).toBe(0);
  });
  it("returns 1 when fully overlapping (shared == subject channels)", () => {
    expect(normalizeChannelOverlap(5, 5)).toBe(1);
  });
  it("scales linearly", () => {
    expect(normalizeChannelOverlap(3, 6)).toBe(0.5);
  });
});
```

**Step 2: Implement**

```typescript
// src/lib/collaboration/score.ts

export interface ScoreComponents {
  slack_channel_overlap: number;
  kudos_score: number;
  prior_peer_score: number;
  conversation_score: number;
}

const WEIGHTS = {
  slack_channel_overlap: 0.20,
  kudos_score: 0.40,
  prior_peer_score: 0.15,
  conversation_score: 0.25,
};

export function computeComposite(c: ScoreComponents): number {
  return (
    c.slack_channel_overlap * WEIGHTS.slack_channel_overlap +
    c.kudos_score * WEIGHTS.kudos_score +
    c.prior_peer_score * WEIGHTS.prior_peer_score +
    c.conversation_score * WEIGHTS.conversation_score
  );
}

export function normalizeChannelOverlap(shared: number, subjectTotal: number): number {
  if (subjectTotal === 0) return 0;
  return Math.min(1, shared / subjectTotal);
}

// Saturating curve for kudos counts: 0 → 0, 1 → 0.4, 5 → 0.85, 10+ → 1
export function normalizeKudosCount(count: number): number {
  return 1 - Math.exp(-count / 4);
}
```

**Step 3: Tests pass, commit**

```bash
npm test -- collaboration/score
git add src/lib/collaboration/
git commit -m "feat(graph): pure scoring helpers with unit tests"
```

---

### Task 4: Graph builder edge function

**Files:**
- Create: `supabase/functions/build-collaboration-graph/index.ts`
- Create: `supabase/functions/build-collaboration-graph/__tests__/build.test.ts`

**Why:** Runs weekly. For each workspace, recomputes edges for every (subject, candidate) where they have any connection signal in the last 180 days.

**Step 1: Implement**

```typescript
// supabase/functions/build-collaboration-graph/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface KudosRow { from_user_id: string; to_user_id: string; created_at: string; }
interface ChannelMembershipRow { user_id: string; channel_id: string; }
interface PriorPeerRow { reviewer_id: string; subject_id: string; }

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Auth: must be CRON_SECRET
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("forbidden", { status: 403 });
  }

  const { data: workspaces } = await supabase.from("workspaces").select("id");
  let totalEdges = 0;
  for (const ws of workspaces || []) {
    totalEdges += await buildForWorkspace(supabase, ws.id);
  }

  return new Response(JSON.stringify({ workspaces: workspaces?.length, total_edges: totalEdges }));
});

async function buildForWorkspace(supabase: any, workspaceId: string): Promise<number> {
  const since = new Date(Date.now() - 180 * 86400 * 1000).toISOString();

  // 1. All users in workspace
  const { data: users } = await supabase.from("users").select("id, slack_user_id").eq("workspace_id", workspaceId);
  if (!users?.length) return 0;
  const userIds = new Set(users.map((u: any) => u.id));

  // 2. Kudos in window — both directions count
  const { data: kudos } = await supabase
    .from("continuous_feedback")
    .select("from_user_id, to_user_id, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", since);

  const kudosMap = new Map<string, number>(); // "subject|candidate" -> count
  for (const k of kudos || []) {
    if (!userIds.has(k.from_user_id) || !userIds.has(k.to_user_id)) continue;
    const a = `${k.from_user_id}|${k.to_user_id}`;
    const b = `${k.to_user_id}|${k.from_user_id}`;
    kudosMap.set(a, (kudosMap.get(a) ?? 0) + 1);
    kudosMap.set(b, (kudosMap.get(b) ?? 0) + 1);
  }

  // 3. Slack channel overlap — requires the workspace to have channel_memberships table.
  //    If you don't have one yet, populate it via a one-time `conversations.members`
  //    sync (Slack API). For now, assume it exists.
  const { data: memberships } = await supabase
    .from("slack_channel_memberships")
    .select("user_id, channel_id")
    .eq("workspace_id", workspaceId);

  const userChannels = new Map<string, Set<string>>();
  for (const m of memberships || []) {
    if (!userIds.has(m.user_id)) continue;
    if (!userChannels.has(m.user_id)) userChannels.set(m.user_id, new Set());
    userChannels.get(m.user_id)!.add(m.channel_id);
  }

  // 4. Prior peer-review pairings (last 365d): if reviewer reviewed subject in any closed cycle, that's signal
  const { data: priorPeers } = await supabase
    .from("review_assignments")
    .select("reviewer_id, employee_id, cycle:performance_cycles!inner(workspace_id, status, end_date)")
    .eq("cycle.workspace_id", workspaceId)
    .eq("cycle.status", "completed")
    .eq("assignment_type", "upward")  // upward + peer types where applicable
    .gte("cycle.end_date", new Date(Date.now() - 365 * 86400 * 1000).toISOString());

  const priorPeerSet = new Set<string>();
  for (const p of priorPeers || []) {
    if (p.reviewer_id) priorPeerSet.add(`${p.employee_id}|${p.reviewer_id}`);
  }

  // 5. Compute edges. Iterate each pair once (skip self, skip duplicates by ordering).
  const edges: any[] = [];
  for (const subject of users) {
    for (const candidate of users) {
      if (subject.id === candidate.id) continue;

      const subjectChans = userChannels.get(subject.id) ?? new Set();
      const candChans = userChannels.get(candidate.id) ?? new Set();
      let shared = 0;
      for (const c of subjectChans) if (candChans.has(c)) shared++;

      const slack_channel_overlap = subjectChans.size === 0 ? 0 : Math.min(1, shared / subjectChans.size);
      const kudosCount = kudosMap.get(`${subject.id}|${candidate.id}`) ?? 0;
      const kudos_score = 1 - Math.exp(-kudosCount / 4);
      const prior_peer_score = priorPeerSet.has(`${subject.id}|${candidate.id}`) ? 1 : 0;
      const conversation_score = 0; // Phase 2 — DM thread density

      const composite =
        slack_channel_overlap * 0.20 +
        kudos_score * 0.40 +
        prior_peer_score * 0.15 +
        conversation_score * 0.25;

      // Skip noise — only persist edges with at least minimal signal
      if (composite < 0.05) continue;

      edges.push({
        workspace_id: workspaceId,
        subject_id: subject.id,
        candidate_id: candidate.id,
        slack_channel_overlap,
        kudos_score,
        prior_peer_score,
        conversation_score,
        composite_score: composite,
      });
    }
  }

  // 6. Upsert
  if (edges.length > 0) {
    // Replace strategy: delete then insert (workspace-scoped)
    await supabase.from("collaboration_edges").delete().eq("workspace_id", workspaceId);
    // Batch insert (Postgres has a parameter limit; chunk if huge)
    const CHUNK = 500;
    for (let i = 0; i < edges.length; i += CHUNK) {
      await supabase.from("collaboration_edges").insert(edges.slice(i, i + CHUNK));
    }
  }
  return edges.length;
}
```

**Step 2: Schedule via existing cron pattern (or pg_cron call)**

```sql
-- supabase/migrations/20260801_03_collab_graph_cron.sql
select cron.schedule(
  'build_collaboration_graph_weekly',
  '0 3 * * 0',  -- Sunday 03:00 UTC
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'collab_graph_url'),
    headers := jsonb_build_object('authorization', concat('Bearer ', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))),
    body := '{}'::jsonb
  )$$
);
```

**Step 3: Smoke test the function locally**

```bash
supabase functions serve build-collaboration-graph
curl -X POST http://localhost:54321/functions/v1/build-collaboration-graph \
  -H "authorization: Bearer LOCAL_CRON_SECRET"
```
Expected: returns `{workspaces, total_edges}`.

**Step 4: Commit**

```bash
git add supabase/functions/build-collaboration-graph/ supabase/migrations/20260801_03_collab_graph_cron.sql
git commit -m "feat(graph): weekly collaboration graph builder"
```

---

### Task 5: One-time Slack channel sync (for the `slack_channel_memberships` table referenced above)

**Files:**
- Create: `supabase/migrations/20260801_04_slack_channel_memberships.sql`
- Create: `supabase/functions/sync-slack-channels/index.ts`

**Why:** The graph builder above assumes a `slack_channel_memberships` table. Build it.

**Step 1: Schema**

```sql
create table if not exists slack_channel_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  channel_id text not null,
  channel_name text,
  is_archived boolean not null default false,
  is_private boolean not null default false,
  synced_at timestamptz not null default now(),
  unique (workspace_id, user_id, channel_id)
);

create index if not exists scm_user_idx on slack_channel_memberships(workspace_id, user_id);
```

**Step 2: Sync function (paginates Slack `conversations.list` + `conversations.members`)**

```typescript
// supabase/functions/sync-slack-channels/index.ts
// For each workspace, list public channels (and private the bot is in),
// fetch members, upsert into slack_channel_memberships.

// Slack API: conversations.list(types=public_channel,private_channel, limit=200)
//            conversations.members(channel=C123, limit=200) per channel
// Note: bot must have channels:read + groups:read scopes; we already do for slack-events.
```

(Skeleton — flesh out per Slack API conventions; pattern mirrors existing `slack-oauth` token usage.)

**Step 3: Schedule weekly (run before graph builder)**

```sql
select cron.schedule(
  'sync_slack_channels_weekly',
  '0 2 * * 0',  -- Sunday 02:00 UTC, 1h before graph builder
  $$select net.http_post(...)$$
);
```

**Commit:**

```bash
git add supabase/functions/sync-slack-channels/ supabase/migrations/20260801_04_slack_channel_memberships.sql
git commit -m "feat(graph): slack channel membership sync"
```

---

## Track C: Nomination flow in Slack

### Task 6: RPC — `seed_peer_nominations_for_cycle`

**Files:**
- Create: `supabase/migrations/20260801_05_seed_peer_nominations.sql`

**Why:** When peer_review phase becomes active, seed `cycle_peer_nominations` rows from the top-K edges for each enrolled employee.

```sql
create or replace function seed_peer_nominations_for_cycle(p_cycle_id uuid, p_top_k int default 5)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_workspace_id uuid;
  v_inserted int := 0;
begin
  select workspace_id into v_workspace_id from performance_cycles where id = p_cycle_id;

  insert into cycle_peer_nominations (workspace_id, cycle_id, subject_id, peer_id, status, suggested_score, suggested_basis)
  select v_workspace_id, p_cycle_id, e.subject_id, e.candidate_id, 'suggested', e.composite_score,
         format('Slack channels: %s · kudos: %s · prior peer: %s',
                round(e.slack_channel_overlap::numeric, 2),
                round(e.kudos_score::numeric, 2),
                round(e.prior_peer_score::numeric, 2))
  from (
    select
      ce.subject_id, ce.candidate_id, ce.composite_score, ce.slack_channel_overlap, ce.kudos_score, ce.prior_peer_score,
      row_number() over (partition by ce.subject_id order by ce.composite_score desc) as rn
    from collaboration_edges ce
    where ce.workspace_id = v_workspace_id
      and ce.subject_id in (
        select pce.employee_id from performance_cycle_employees pce
        where pce.performance_cycle_id = p_cycle_id
      )
      and ce.candidate_id in (
        select pce.employee_id from performance_cycle_employees pce
        where pce.performance_cycle_id = p_cycle_id
      )
  ) e
  where e.rn <= p_top_k
  on conflict (cycle_id, subject_id, peer_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function seed_peer_nominations_for_cycle(uuid, int) from public, anon;
grant execute on function seed_peer_nominations_for_cycle(uuid, int) to authenticated;
```

**Step 2: Hook seeding into phase progression**

Modify `progress_cycle_phases` (existing RPC) to call `seed_peer_nominations_for_cycle(cycle_id)` whenever the `peer_review` phase transitions to `active`. This is a one-line addition where `status` changes to `active`.

**Commit:**

```bash
supabase db reset
git add supabase/migrations/20260801_05_seed_peer_nominations.sql
git commit -m "feat(nominations): seed top-K from collaboration graph on phase open"
```

---

### Task 7: Slack DM — "Confirm your peers" interactive message

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`

**Step 1: New action `notify_peer_nominations`**

Triggered by the phase-progression cron when peer_review opens. For each enrolled employee, fetch their `suggested` nominations + DM them a Block Kit message:

```typescript
async function buildPeerNominationDM(supabase: any, subjectId: string, cycleId: string) {
  const { data: noms } = await supabase
    .from("cycle_peer_nominations")
    .select("id, peer:users!cycle_peer_nominations_peer_id_fkey(id, slack_name), suggested_basis, suggested_score")
    .eq("subject_id", subjectId)
    .eq("cycle_id", cycleId)
    .eq("status", "suggested")
    .order("suggested_score", { ascending: false });

  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: "Pick your peers for this review", emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: "Based on who you actually worked with this period, we suggest these peers. Confirm them, or replace any that don't fit." } },
    { type: "divider" },
  ];

  for (const n of noms || []) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*${(n as any).peer?.slack_name}*\n_${n.suggested_basis}_` },
      accessory: {
        type: "overflow",
        action_id: `peer_nom_${n.id}`,
        options: [
          { text: { type: "plain_text", text: "Keep" }, value: `keep_${n.id}` },
          { text: { type: "plain_text", text: "Replace…" }, value: `replace_${n.id}` },
          { text: { type: "plain_text", text: "Remove" }, value: `remove_${n.id}` },
        ],
      },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      { type: "button", text: { type: "plain_text", text: "✅ Confirm all" }, style: "primary", action_id: "confirm_all_peers", value: cycleId },
      { type: "button", text: { type: "plain_text", text: "Add another peer" }, action_id: "add_peer", value: cycleId },
    ],
  });

  return blocks;
}
```

**Step 2: Send the DM via existing slack_send_queue**

When `seed_peer_nominations_for_cycle` runs (or right after), enqueue one `notify_peer_nominations` job per enrolled employee.

**Step 3: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(nominations): Slack DM with suggested peers and overflow actions"
```

---

### Task 8: Action handlers in `slack-interactivity`

**Files:**
- Modify: `supabase/functions/slack-interactivity/index.ts`

**Step 1: Handle each action**

```typescript
// peer_nom_<id> overflow: keep / replace / remove
if (action?.action_id?.startsWith("peer_nom_")) {
  const nomId = action.action_id.replace("peer_nom_", "");
  const choice = action.selected_option.value.split("_")[0]; // "keep" | "replace" | "remove"

  if (choice === "keep") {
    await dbExec(`update cycle_peer_nominations set status='nominated', nominated_at=now() where id=$1`, [nomId]);
  } else if (choice === "remove") {
    await dbExec(`update cycle_peer_nominations set status='declined' where id=$1`, [nomId]);
  } else if (choice === "replace") {
    // open a user picker modal scoped to the workspace
    await slackApi(botToken, "views.open", {
      trigger_id: payload.trigger_id,
      view: { /* user_select modal with callback_id=replace_peer + private_metadata={nomId} */ },
    });
  }
  return new Response("", { status: 200 });
}

// confirm_all_peers
if (action?.action_id === "confirm_all_peers") {
  const cycleId = action.value;
  const subjectId = await lookupAppUserBySlackId(payload.user.id);
  await dbExec(`
    update cycle_peer_nominations set status='nominated', nominated_at=now()
    where cycle_id=$1 and subject_id=$2 and status='suggested'`, [cycleId, subjectId]);
  // Replace the original message with a "✅ Confirmed — your manager will approve next" success block
  return json({ replace_original: true, blocks: [{ type: "section", text: { type: "mrkdwn", text: "✅ Confirmed. Your manager will review and approve." } }] });
}
```

**Step 2: Handle the `replace_peer` modal submission** — write the new peer_id, update existing row to `replaced`, insert new row as `nominated`.

**Step 3: Commit**

```bash
git add supabase/functions/slack-interactivity/index.ts
git commit -m "feat(nominations): handle keep/replace/remove + confirm-all"
```

---

### Task 9: Manager approval message + handler

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`
- Modify: `supabase/functions/slack-interactivity/index.ts`

**Step 1: When all of a manager's reports have `nominated` rows (no more `suggested`), DM the manager a single roll-up**

```typescript
// "5 of your reports nominated their peers. Approve all?
// [Approve all] [Review individually]"
```

**Step 2: "Approve all" handler bulk-updates `status='approved', approved_by=manager_id`**

**Step 3: "Review individually" opens a modal listing each report's nominations as expandable sections**

**Step 4: Commit**

```bash
git add supabase/functions/nami-bot/ supabase/functions/slack-interactivity/
git commit -m "feat(nominations): manager approval flow"
```

---

### Task 10: Auto-create `review_assignments` when a nomination is approved

**Files:**
- Create: `supabase/migrations/20260801_06_nomination_to_assignment_trigger.sql`

```sql
-- When status flips to 'approved', create a peer review_assignment.
create or replace function nomination_to_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into review_assignments (cycle_id, employee_id, reviewer_id, manager_id, assignment_type, status)
    values (new.cycle_id, new.subject_id, new.peer_id, null, 'peer', 'pending')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists nomination_approved_trg on cycle_peer_nominations;
create trigger nomination_approved_trg
  after update on cycle_peer_nominations
  for each row execute function nomination_to_assignment();
```

(Note: requires `assignment_type = 'peer'` to be allowed by the existing check constraint. If it isn't, also alter the constraint.)

**Commit:**

```bash
supabase db reset
git add supabase/migrations/20260801_06_nomination_to_assignment_trigger.sql
git commit -m "feat(nominations): auto-create peer review_assignment on approval"
```

---

## Track D: Web view

### Task 11: HR-facing nominations dashboard

**Files:**
- Create: `src/app/dashboard/cycles/[id]/peer-nominations/page.tsx`

**What it shows:**
- A table grouped by employee
- Each row: subject, suggested peers (chips with hover-tip showing basis), status, manager-approval state
- Filter by status: suggested / nominated / approved / declined
- Bulk-approve button for HR override

(Build matches existing dashboard patterns — server component, fetch nominations + employees, render shadcn/ui Table.)

**Commit:**

```bash
git add src/app/dashboard/cycles/[id]/peer-nominations/
git commit -m "feat(nominations): HR dashboard for peer nominations"
```

---

## Track E: Verify + ship

### Task 12: End-to-end manual run

1. Seed test workspace with: ~15 users in 3 channels each (overlap), some kudos exchanged, 1 prior completed cycle.
2. Trigger `build-collaboration-graph` manually → confirm `collaboration_edges` populated with reasonable scores (top edge between two people who shared a channel + sent kudos should be > 0.3).
3. Launch a new cycle including all 15 users.
4. Wait until peer_review phase activates (or manually fire `progress_cycle_phases`) → confirm `cycle_peer_nominations` rows seeded.
5. Confirm Slack DMs land for each subject with their top 5 suggested peers + `_basis_` line.
6. As an employee, click overflow → "Replace…" → pick someone else → confirm row updates.
7. Click "Confirm all" → message replaces with success.
8. Once all subjects confirm, manager DM lands → click "Approve all" → confirm `review_assignments` rows created with `assignment_type='peer'`.
9. Open peer-review submission flow as one of the approved peers → confirm modal opens.

### Task 13: PR

```bash
git push -u origin sprint-6-peer-graph
gh pr create --title "Sprint 6: Collaboration-graph peer nomination"
```

**Rollout:**
- Ship behind `workspaces.peer_graph_enabled` flag, default false.
- Internal team workspace flips on first; verify `collaboration_edges` quality manually.
- Customer rollout: workspace-by-workspace after we have confidence in the score weights.

---

## Notes

- **Score weights are the dial.** The 0.20/0.40/0.15/0.25 split is a starting point. After 3-4 customer cycles, instrument: when an employee replaces a suggested peer, log which signals they had → use this to retune. Don't try to perfect the score before ship.
- **Channel overlap is noisy.** A person in `#general` + `#random` shares those channels with everyone — score gets diluted. Consider exempting "default" channels (>50% of workspace members) in a v2.
- **Privacy:** the suggestion DM tells the subject what we know (`Slack channels: 0.43`), which is fine because they know they're in those channels. Don't reveal candidate-side data to subjects ("Bob mentioned you 3 times" — don't say that).
- **Data-volume estimate:** for a 200-person workspace, edges = 200 × 200 = 40,000 candidate pairs, but ~60% will fall below the 0.05 threshold and not be persisted. Expect ~15,000 rows. Recompute weekly is fine performance-wise.
- **Phase 2 connectors** (GitHub PR co-reviewers, Jira ticket overlap, Linear ticket assignees): each adds a new column `<source>_score` to `collaboration_edges`, a new component to the composite, and a sync function. Don't try to build all in Phase 1 — Slack signal alone covers ~80% of value for SMB.
- **Failure mode:** if `collaboration_edges` is empty for a workspace (e.g., never synced), `seed_peer_nominations_for_cycle` returns 0. Fall back to manual nomination (employee picks any colleague from a user-picker modal). Don't auto-assign random peers — that's worse than nothing.

## Estimated time

| Track | Hours |
|---|---|
| A: Schema | 3 |
| B: Graph builder + Slack sync | 12 |
| C: Slack nomination flow | 12 |
| D: Web dashboard | 4 |
| E: Verify + ship | 5 |
| **Total** | **~36h** = roughly 1.5 sprints — split across two if needed |
