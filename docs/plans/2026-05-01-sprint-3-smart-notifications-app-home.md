# Sprint 3: Smart Notifications (Digest + Snooze) + App Home Tab Polish

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the firehose of per-event Slack DMs with an opt-in daily digest. Add a snooze button on every Nami DM. Enhance the existing App Home tab so it's a true "what do I owe today" control center. Solves the universal #1 complaint across every competitor: notification overload.

**Architecture:**
- **User notification preferences** stored on `users.notification_prefs` (jsonb): `{ mode: 'realtime' | 'digest', digest_hour: 9, digest_timezone: 'Europe/Warsaw', snoozed_until: null }`
- **Digest cron** runs hourly via existing pg_cron infrastructure; for each user whose `digest_hour == current_hour_in_their_tz`, emit a single rolled-up DM consolidating all pending tasks/reminders.
- **Realtime mode** keeps existing per-event DMs (the default during rollout).
- **Snooze** button on every DM: `Snooze 4h | Snooze 24h | Snooze until done`. Sets `notification_prefs.snoozed_until`. The send-queue worker checks this before delivering anything except critical (final-warning, grade-release).
- **App Home enhancements:** add tabs/sections for *Today*, *This week*, *Recent feedback*, *Settings* (snooze toggle + digest hour). The existing buildHomeBlocks function is extended.

**Tech Stack:**
- Existing `nami-bot` Edge Function + `slack-events` (App Home handler)
- Existing pg_cron + `slack_send_queue` infrastructure
- Existing Block Kit message builders

**Out of scope:** Email digest (Slack only). Multiple per-channel preferences (digest is global per user). Per-channel mute (use Slack's native).

---

## Pre-flight

### Task 0: Branch + baseline

```bash
git checkout main && git pull
git checkout -b sprint-3-smart-notifications
npm test
```

---

## Track A: Schema for notification preferences

### Task 1: Migration — `notification_prefs` on `users`

**Files:**
- Create: `supabase/migrations/20260601_01_user_notification_prefs.sql`

**Step 1: Migration**

```sql
-- User-level notification preferences. Default is realtime (existing behavior)
-- so this rollout is non-breaking. Users opt into digest via Slack home tab.
alter table users
  add column if not exists notification_prefs jsonb not null default jsonb_build_object(
    'mode', 'realtime',
    'digest_hour', 9,
    'digest_timezone', 'UTC',
    'snoozed_until', null
  );

-- Validation constraint to keep shape sane
alter table users
  add constraint users_notification_prefs_shape
  check (
    (notification_prefs->>'mode') in ('realtime', 'digest', 'critical_only')
    and ((notification_prefs->>'digest_hour')::int) between 0 and 23
  );

create index if not exists users_digest_hour_idx
  on users (((notification_prefs->>'digest_hour')::int))
  where (notification_prefs->>'mode') = 'digest';

comment on column users.notification_prefs is
  'Slack notification preferences: { mode, digest_hour (0-23), digest_timezone, snoozed_until ISO timestamp }';
```

**Step 2: Apply + verify**

```bash
supabase db reset
supabase db execute "select column_name, column_default from information_schema.columns where table_name='users' and column_name='notification_prefs';"
```

**Step 3: Regenerate types**

```bash
npx supabase gen types typescript --project-id zhfvxfvmdlpdfgxrwtdn > src/types/database.ts
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260601_01_user_notification_prefs.sql src/types/database.ts
git commit -m "feat(notifications): per-user notification_prefs with mode + snooze"
```

---

### Task 2: RPC — `set_notification_prefs`

**Files:**
- Create: `supabase/migrations/20260601_02_set_notification_prefs_rpc.sql`

**Step 1:**

```sql
create or replace function set_notification_prefs(
  p_mode text default null,
  p_digest_hour int default null,
  p_digest_timezone text default null,
  p_snoozed_until timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current jsonb;
begin
  if v_user_id is null then raise exception 'Not authenticated' using errcode='42501'; end if;

  select notification_prefs into v_current from users where id = v_user_id;

  if p_mode is not null then v_current := jsonb_set(v_current, '{mode}', to_jsonb(p_mode), true); end if;
  if p_digest_hour is not null then v_current := jsonb_set(v_current, '{digest_hour}', to_jsonb(p_digest_hour), true); end if;
  if p_digest_timezone is not null then v_current := jsonb_set(v_current, '{digest_timezone}', to_jsonb(p_digest_timezone), true); end if;
  -- snoozed_until: pass null to clear, or a timestamptz to set
  v_current := jsonb_set(v_current, '{snoozed_until}',
    case when p_snoozed_until is null then 'null'::jsonb else to_jsonb(p_snoozed_until) end,
    true);

  update users set notification_prefs = v_current where id = v_user_id;
  return v_current;
end;
$$;

revoke all on function set_notification_prefs(text, int, text, timestamptz) from public, anon;
grant execute on function set_notification_prefs(text, int, text, timestamptz) to authenticated;
```

**Step 2: Apply + commit**

```bash
supabase db reset
git add supabase/migrations/20260601_02_set_notification_prefs_rpc.sql
git commit -m "feat(notifications): RPC to update prefs and snooze"
```

---

## Track B: Snooze + critical-only filter on the send queue

### Task 3: Add `priority` column to `slack_send_queue` (if missing)

**Files:**
- Create: `supabase/migrations/20260601_03_send_queue_priority.sql`
- (Maybe modify: existing send-queue migration)

**Step 1: Check what exists**

```bash
grep -n "priority\|critical" supabase/migrations/20260416_20_slack_send_queue.sql
```

If priority column exists, skip to Task 4. Otherwise:

**Step 2: Add column**

```sql
-- Priority levels for the Slack send queue. 'critical' bypasses snooze and
-- digest mode (e.g. final warnings, grade releases). 'normal' respects user prefs.
alter table slack_send_queue
  add column if not exists priority text not null default 'normal'
  check (priority in ('critical', 'normal'));

create index if not exists slack_send_queue_priority_due_idx
  on slack_send_queue (priority, send_at)
  where status = 'pending';
```

**Step 3: Apply, commit**

```bash
supabase db reset
git add supabase/migrations/20260601_03_send_queue_priority.sql
git commit -m "feat(notifications): priority column on slack_send_queue"
```

---

### Task 4: Pure helper — `shouldDeliverNow`

**Files:**
- Create: `supabase/functions/_shared/notification-rules.ts`
- Create: `supabase/functions/_shared/__tests__/notification-rules.test.ts`

**Step 1: Failing test**

```typescript
import { describe, it, expect } from "vitest";
import { shouldDeliverNow, NotificationPrefs } from "../notification-rules";

describe("shouldDeliverNow", () => {
  const baseline: NotificationPrefs = {
    mode: "realtime",
    digest_hour: 9,
    digest_timezone: "UTC",
    snoozed_until: null,
  };
  const now = new Date("2026-06-15T13:00:00Z");

  it("delivers normal-priority in realtime mode", () => {
    expect(shouldDeliverNow(baseline, "normal", now)).toBe(true);
  });

  it("blocks normal in digest mode (will be rolled up)", () => {
    expect(shouldDeliverNow({ ...baseline, mode: "digest" }, "normal", now)).toBe(false);
  });

  it("blocks normal when snoozed", () => {
    expect(shouldDeliverNow({ ...baseline, snoozed_until: "2026-06-15T15:00:00Z" }, "normal", now)).toBe(false);
  });

  it("delivers normal once snooze passes", () => {
    expect(shouldDeliverNow({ ...baseline, snoozed_until: "2026-06-15T12:00:00Z" }, "normal", now)).toBe(true);
  });

  it("ALWAYS delivers critical regardless of mode/snooze", () => {
    expect(shouldDeliverNow({ ...baseline, mode: "digest", snoozed_until: "2030-01-01T00:00:00Z" }, "critical", now)).toBe(true);
  });

  it("critical_only blocks normal but allows critical", () => {
    expect(shouldDeliverNow({ ...baseline, mode: "critical_only" }, "normal", now)).toBe(false);
    expect(shouldDeliverNow({ ...baseline, mode: "critical_only" }, "critical", now)).toBe(true);
  });
});
```

**Step 2: Implement**

```typescript
// supabase/functions/_shared/notification-rules.ts

export interface NotificationPrefs {
  mode: "realtime" | "digest" | "critical_only";
  digest_hour: number;
  digest_timezone: string;
  snoozed_until: string | null;
}

export type Priority = "normal" | "critical";

export function shouldDeliverNow(
  prefs: NotificationPrefs,
  priority: Priority,
  now: Date = new Date(),
): boolean {
  if (priority === "critical") return true;

  if (prefs.mode === "digest") return false;
  if (prefs.mode === "critical_only") return false;

  if (prefs.snoozed_until) {
    const until = new Date(prefs.snoozed_until);
    if (until > now) return false;
  }

  return true;
}

export function snoozeWindowEnd(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}
```

**Step 3: Test passes, commit**

```bash
npm test -- notification-rules
git add supabase/functions/_shared/notification-rules.ts supabase/functions/_shared/__tests__/notification-rules.test.ts
git commit -m "feat(notifications): pure rules helper for delivery decisions"
```

---

### Task 5: Wire `shouldDeliverNow` into the send-queue drain loop

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts` (look for the queue draining around line 2096)

**Step 1: Locate the drain loop**

```bash
grep -n "drain_send_queue\|send_queue\|pending.*queue" supabase/functions/nami-bot/index.ts | head
```

**Step 2: For each job, check user prefs before sending**

```typescript
// Inside the drain loop, before invoking sendSlackMessageWithRetry:

const { data: recipient } = await supabase
  .from("users")
  .select("notification_prefs")
  .eq("id", job.user_id)
  .single();

const prefs = recipient?.notification_prefs ?? { mode: "realtime", snoozed_until: null };
const priority = job.priority === "critical" ? "critical" : "normal";

if (!shouldDeliverNow(prefs, priority, new Date())) {
  // Mark as deferred — digest cron will pick it up
  await supabase
    .from("slack_send_queue")
    .update({ status: "deferred", deferred_reason: prefs.mode === "digest" ? "digest" : "snoozed" })
    .eq("id", job.id);
  continue;
}
```

Add `deferred` to the `status` enum check if needed.

**Step 3: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(notifications): respect user prefs and snooze in send-queue drain"
```

---

### Task 6: Mark which message types are critical

**Files:**
- Modify: every place that enqueues messages — search for inserts into `slack_send_queue`

```bash
grep -n "slack_send_queue\b\|insert.*slack_send_queue" supabase/functions/ -r | head -20
```

**Step 1: Audit and tag**

For each enqueue site, set `priority: "critical"` for:
- Final-warning escalation (last-tier)
- Grade release notification
- Cycle launch DM (initial — users need to know it exists)

Default everything else to `"normal"`.

**Step 2: Commit**

```bash
git add supabase/functions/
git commit -m "chore(notifications): tag critical message types"
```

---

## Track C: Digest cron

### Task 7: SQL function `enqueue_pending_digests`

**Files:**
- Create: `supabase/migrations/20260601_04_digest_enqueue.sql`

**Why:** Every hour, find users whose digest_hour matches the current local hour (using their digest_timezone), and enqueue a digest job for each.

**Step 1: Migration**

```sql
-- enqueue_pending_digests: called hourly by pg_cron. Selects users in digest mode
-- whose digest_hour is the current hour in their timezone, and inserts one
-- 'send_digest' job per user into slack_send_queue.

create or replace function enqueue_pending_digests()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
begin
  with eligible as (
    select u.id, u.slack_user_id, u.workspace_id
    from users u
    where (u.notification_prefs->>'mode') = 'digest'
      and u.slack_user_id is not null
      and extract(hour from (now() at time zone (u.notification_prefs->>'digest_timezone')))::int
          = (u.notification_prefs->>'digest_hour')::int
      and not exists (
        -- Don't double-enqueue if a digest job is already pending today
        select 1 from slack_send_queue q
        where q.user_id = u.id
          and q.action = 'send_digest'
          and q.created_at > now() - interval '23 hours'
      )
  ),
  inserted as (
    insert into slack_send_queue (user_id, workspace_id, action, payload, send_at, status, priority)
    select id, workspace_id, 'send_digest', '{}'::jsonb, now(), 'pending', 'normal'
    from eligible
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

-- Schedule hourly via pg_cron (assumes pg_cron set up)
select cron.schedule(
  'enqueue_pending_digests_hourly',
  '0 * * * *',
  $$select public.enqueue_pending_digests()$$
);
```

**Step 2: Apply + verify**

```bash
supabase db reset
supabase db execute "select * from cron.job where jobname='enqueue_pending_digests_hourly';"
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260601_04_digest_enqueue.sql
git commit -m "feat(notifications): hourly digest enqueue cron"
```

---

### Task 8: `send_digest` action handler in `nami-bot`

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`

**Step 1: Add an action branch in the queue drain**

Locate the `if (job.action === "send_cycle_dm")` chain (around line 1860+). Add:

```typescript
} else if (job.action === "send_digest") {
  result = await sendDigestForUser(supabase, botToken, job.user_id);
}
```

**Step 2: Implement `sendDigestForUser`**

```typescript
async function sendDigestForUser(supabase: any, botToken: string, userId: string) {
  // 1. Fetch the user
  const { data: user } = await supabase
    .from("users")
    .select("id, slack_user_id, workspace_id, slack_name")
    .eq("id", userId)
    .single();
  if (!user?.slack_user_id) return { ok: false, error: "no_slack_user" };

  // 2. Find all currently-pending tasks for this user
  const [pendingReviews, pendingSelf, deferredMessages] = await Promise.all([
    supabase.from("review_assignments")
      .select("id, cycle_id, employee:users!review_assignments_employee_id_fkey(slack_name), cycle:performance_cycles(name, end_date)")
      .eq("manager_id", userId).eq("status", "pending"),
    supabase.from("review_assignments")
      .select("id, cycle_id, cycle:performance_cycles(name, end_date)")
      .eq("employee_id", userId).eq("status", "pending"),
    supabase.from("slack_send_queue")
      .select("id, action, payload")
      .eq("user_id", userId)
      .eq("status", "deferred")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // 3. If nothing pending, skip the digest (don't send empty)
  const totalItems = (pendingReviews.data?.length ?? 0) +
                     (pendingSelf.data?.length ?? 0) +
                     (deferredMessages.data?.length ?? 0);
  if (totalItems === 0) return { ok: true, skipped: true };

  // 4. Build a single digest message
  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: `☀️ Your daily Nami digest`, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `Good morning ${user.slack_name ?? "there"}! Here's what needs your attention.` } },
  ];

  if ((pendingReviews.data?.length ?? 0) > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*📋 ${pendingReviews.data!.length} review${pendingReviews.data!.length > 1 ? "s" : ""} to write*` } });
    for (const r of pendingReviews.data!.slice(0, 5)) {
      const emp = (r as any).employee?.slack_name ?? "?";
      const cycle = (r as any).cycle?.name ?? "Review";
      blocks.push({ type: "section", text: { type: "mrkdwn", text: `• ${emp} — _${cycle}_` } });
    }
  }

  if ((pendingSelf.data?.length ?? 0) > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*✍️ ${pendingSelf.data!.length} self-assessment${pendingSelf.data!.length > 1 ? "s" : ""} due*` } });
    for (const r of pendingSelf.data!.slice(0, 3)) {
      const cycle = (r as any).cycle?.name ?? "Review";
      blocks.push({ type: "section", text: { type: "mrkdwn", text: `• ${cycle}` } });
    }
  }

  blocks.push({
    type: "actions",
    elements: [
      { type: "button", text: { type: "plain_text", text: "Open dashboard" }, url: `${DASHBOARD_URL}/dashboard/performance`, action_id: "open_dashboard" },
      { type: "button", text: { type: "plain_text", text: "Snooze 4h" }, action_id: "snooze_4h", value: "4" },
      { type: "button", text: { type: "plain_text", text: "Switch to realtime" }, action_id: "switch_to_realtime", style: "danger" },
    ],
  });

  // 5. Send and mark all deferred messages as resolved
  await sendSlackMessageWithRetry(botToken, user.slack_user_id, "Your daily Nami digest", blocks);
  if (deferredMessages.data?.length) {
    await supabase.from("slack_send_queue")
      .update({ status: "delivered", delivered_at: new Date().toISOString(), delivered_via: "digest" })
      .in("id", deferredMessages.data.map((d: any) => d.id));
  }

  return { ok: true };
}
```

**Step 3: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(notifications): send_digest action consolidates deferred items"
```

---

## Track D: Snooze + preference UI in App Home

### Task 9: Add snooze buttons to existing Nami DMs

**Files:**
- Modify: `supabase/functions/_shared/messages.ts` (or wherever message builders live — search for `buildSelfReviewOpening`)

**Step 1: Add a reusable footer function**

```typescript
export function snoozeFooter(): any {
  return {
    type: "actions",
    elements: [
      { type: "button", text: { type: "plain_text", text: "💤 Snooze 4h" }, action_id: "snooze_4h", value: "4" },
      { type: "button", text: { type: "plain_text", text: "💤 Snooze until tomorrow" }, action_id: "snooze_24h", value: "24" },
      { type: "button", text: { type: "plain_text", text: "🔕 Pause until I'm done" }, action_id: "snooze_until_done", value: "until_done" },
    ],
  };
}
```

**Step 2: Append `snoozeFooter()` to every reminder/escalation builder** (NOT to opening DMs — those should be hard to miss). Audit:

```bash
grep -n "buildDeadline\|buildManagerEscalation\|buildFinalWarning\|buildReminder" supabase/functions/_shared/messages.ts | head
```

For each function, add `blocks.push(snoozeFooter())` before returning. **Don't add to `buildFinalWarning`** — final warning is critical and shouldn't be snoozable.

**Step 3: Commit**

```bash
git add supabase/functions/_shared/messages.ts
git commit -m "feat(notifications): snooze buttons on reminders and manager escalations"
```

---

### Task 10: Handle snooze actions in `slack-interactivity`

**Files:**
- Modify: `supabase/functions/slack-interactivity/index.ts`

**Step 1: Add action handler**

Find the action_id dispatch chain (~line 1528). Add:

```typescript
if (action?.action_id?.startsWith("snooze_")) {
  const hours = action.action_id === "snooze_4h" ? 4
              : action.action_id === "snooze_24h" ? 24
              : null; // until_done = null indefinite

  const { data: appUser } = await dbQuery("users", `slack_user_id=eq.${payload.user.id}&select=id&limit=1`);
  if (!appUser?.[0]?.id) return json({ text: "User not found" });

  const snoozeUntil = hours
    ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year = "until_done"

  await dbExec(`update users set notification_prefs = jsonb_set(notification_prefs, '{snoozed_until}', to_jsonb($1::text), true) where id = $2`, [snoozeUntil, appUser[0].id]);

  return json({
    response_type: "ephemeral",
    replace_original: false,
    text: hours ? `Snoozed for ${hours}h. We'll only ping you for critical updates.` : "Paused. Open Nami's home tab to resume.",
  });
}
```

**Step 2: Add `switch_to_realtime` and `switch_to_digest` action handlers** — same pattern, but call `set_notification_prefs` RPC.

**Step 3: Commit**

```bash
git add supabase/functions/slack-interactivity/index.ts
git commit -m "feat(notifications): handle snooze and mode-switch actions"
```

---

### Task 11: Settings section on App Home tab

**Files:**
- Modify: `supabase/functions/slack-events/index.ts` (`buildHomeBlocks` function around line 75)

**Step 1: Append a Settings section**

```typescript
// At the end of buildHomeBlocks, before the return:
const { data: prefsRow } = await supabase.from("users").select("notification_prefs").eq("id", userId).single();
const prefs = prefsRow?.notification_prefs ?? { mode: "realtime", digest_hour: 9, snoozed_until: null };

blocks.push(divider());
blocks.push(header("⚙️ Notification settings"));

const modeText = prefs.mode === "digest"
  ? `Digest mode at ${String(prefs.digest_hour).padStart(2, "0")}:00 ${prefs.digest_timezone}`
  : prefs.mode === "critical_only" ? "Critical only"
  : "Realtime";
blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Current:* ${modeText}` } });

if (prefs.snoozed_until && new Date(prefs.snoozed_until) > new Date()) {
  blocks.push({ type: "section", text: { type: "mrkdwn", text: `_Snoozed until ${new Date(prefs.snoozed_until).toLocaleString()}_` } });
}

blocks.push({
  type: "actions",
  elements: [
    { type: "static_select", action_id: "set_mode",
      placeholder: { type: "plain_text", text: "Notification mode" },
      options: [
        { text: { type: "plain_text", text: "Realtime (each event)" }, value: "realtime" },
        { text: { type: "plain_text", text: "Daily digest" }, value: "digest" },
        { text: { type: "plain_text", text: "Critical only" }, value: "critical_only" },
      ],
      initial_option: { text: { type: "plain_text", text: modeText }, value: prefs.mode },
    },
    ...(prefs.snoozed_until && new Date(prefs.snoozed_until) > new Date()
      ? [{ type: "button", text: { type: "plain_text", text: "Wake me up" }, action_id: "clear_snooze", style: "primary" }]
      : []),
  ],
});
```

**Step 2: Add `set_mode` and `clear_snooze` handlers in `slack-interactivity`**

For `set_mode`: read `action.selected_option.value`, call `set_notification_prefs(p_mode := value)`. If switched to `digest`, immediately re-publish home tab so the digest_hour picker appears.

For `clear_snooze`: call `set_notification_prefs(p_snoozed_until := null)`.

**Step 3: Commit**

```bash
git add supabase/functions/slack-events/index.ts supabase/functions/slack-interactivity/index.ts
git commit -m "feat(notifications): notification-prefs panel in app home"
```

---

### Task 12: "Today" + "This week" sections on App Home

**Files:**
- Modify: `supabase/functions/slack-events/index.ts`

**Step 1: Restructure `buildHomeBlocks`**

Replace the linear list with two named sections:

```typescript
// "Today" = pending tasks whose phase end_date <= now() + 24h
// "This week" = pending tasks whose phase end_date <= now() + 7 days

const today = new Date(); today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today.getTime() + 86400000);
const weekEnd = new Date(today.getTime() + 7 * 86400000);

// (For each pending review/self-assessment, look at the cycle's active phase
// end_date — Sprint 1 made these editable. Bucket into 'today', 'week', 'later'.)
```

**Step 2: Show counts in section headers**

```typescript
blocks.push(header(`🔥 Today (${todayCount})`));
// ...items...
blocks.push(header(`📅 This week (${weekCount})`));
```

**Step 3: Commit**

```bash
git add supabase/functions/slack-events/index.ts
git commit -m "feat(notifications): bucket app home tasks by today/week/later"
```

---

## Track E: Verify + roll out

### Task 13: Manual + automated testing

```bash
supabase db reset
supabase functions serve nami-bot slack-events slack-interactivity
npm run dev
```

Walk through:
1. Open Slack DM with Nami bot. Open app home → see new Settings section with mode selector.
2. Switch to "Daily digest" at hour 09.
3. Trigger a fake reminder via `nami-bot` action — confirm the message is enqueued to `slack_send_queue` with `status = pending`, then on drain becomes `status = deferred`.
4. Wait for the next hour boundary (or call `enqueue_pending_digests()` manually). Confirm a `send_digest` job is enqueued.
5. Drain the queue → digest message lands in DMs with consolidated content. Deferred items become `status = delivered`, `delivered_via = digest`.
6. Click "Snooze 4h" on a non-critical reminder DM → ephemeral confirmation.
7. Try to send another non-critical message → it's deferred until snooze expires.
8. Send a `final_warning` (critical) → it bypasses the snooze and arrives immediately.
9. App home Settings → click "Wake me up" → snooze cleared.

### Task 14: Vitest test for the digest builder

**Files:**
- Create: `supabase/functions/nami-bot/__tests__/send-digest.test.ts`

Build a thin unit test for `sendDigestForUser` that mocks Supabase and asserts the block structure (header, sections, actions row). Skip if integration tests are too heavy here — Block Kit shape can be validated visually.

### Task 15: PR + rollout

```bash
git push -u origin sprint-3-smart-notifications
gh pr create --title "Sprint 3: Smart notifications (digest + snooze) + App Home polish" --body "..."
```

**Rollout plan:**
1. Merge with default mode = `realtime` (everyone unaffected).
2. Internal team flips own pref to `digest` for two weeks. Iterate on digest copy.
3. Announce in product changelog. Add an in-app banner: "Tired of pings? Try daily digest in Slack → Nami → Home tab."
4. Monitor `slack_send_queue.status` distribution to confirm digest mode is rolling up correctly.

---

## Notes

- **Don't make digest the default.** Realtime users can be loud-supporters; flipping the default would break their workflow.
- **Critical priority is sacred.** If you find yourself adding `priority: "critical"` to a 5th message type, push back. Today's list: opening DM, final warning, grade release. That's it.
- **Time-zone math:** Postgres `timezone` function on a tz string + a timestamptz works correctly for the digest hour comparison. Test with `Europe/Warsaw` and `America/Los_Angeles` users to confirm.
- **App Home publish is rate-limited** — Slack docs say 100 publishes/hour/workspace. We rebuild the full home tab on every settings change; for large workspaces, batch-debounce if logs show throttling.
- **Don't echo state into messages.** When the user clicks "Snooze 4h", reply with an ephemeral confirmation — don't `update_view` on the original message. Original messages persist in DM history; we want the snooze decision recorded once in `notification_prefs`.

## Estimated time

| Track | Hours |
|---|---|
| A: Schema + RPC | 4 |
| B: Snooze + filter | 6 |
| C: Digest cron | 6 |
| D: App Home + buttons | 8 |
| E: Verify + ship | 4 |
| **Total** | **~28h** |
