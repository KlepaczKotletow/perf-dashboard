# Sprint 5: Staged Grade Release + Edit-After-Launch

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Two HR-power features that no incumbent does well today.
1. **Staged grade release:** instead of one global `grades_released` toggle, HR can release grades to subsets — by department, by manager-vs-employee, or scheduled (release Mon to Engineering, Wed to Sales). Each release is auditable.
2. **Edit-after-launch:** HR can add/remove/edit cycle questions after the cycle is live, with a clear audit trail and warnings when changes affect already-submitted responses.

(Note: save-as-draft already exists in our codebase — `wizard_metadata` jsonb on `performance_cycles`. We'll spot-fix any rough edges, but the core work is staged release + edit-after-launch.)

**Architecture:**
- **Replace** `cycles.grades_released boolean` with a per-assignment `released_at timestamptz` and a per-cycle `release_policy jsonb` describing the staging plan. Backward-compat: derive `grades_released` as `release_policy is not null and exists(released_at)`.
- **Release "rules"** are stored as a list: each rule names a target cohort + a release_at timestamp. A scheduled cron applies them. HR can release manually before any rule's time.
- **Edit-after-launch** is gated by question status: questions that have at least one submitted response can have their `prompt` text edited (audit logged) but not their `question_type` or `competency_id`. Questions with no responses can be deleted. New questions can be added freely.

**Tech Stack:**
- Existing pg_cron + cron-style runner pattern
- New `cycle_release_rules` + `cycle_question_audit` tables
- Deno edge function trigger to fire Slack DMs on each staged release
- shadcn/ui Sheet for the release scheduler UI

**Out of scope:** Differential question visibility per cohort. Re-run a closed cycle. Replace the entire question set after cycle launch (only edit/add/remove).

---

## Pre-flight

```bash
git checkout main && git pull
git checkout -b sprint-5-staged-release
npm test
```

---

## Track A: Per-assignment release semantics

### Task 1: Migration — `released_at` on `review_assignments`

**Files:**
- Create: `supabase/migrations/20260701_01_review_assignments_released_at.sql`

**Step 1: Migration**

```sql
-- Per-assignment release timestamp. NULL = not released to the employee.
-- Staged release (Sprint 5) sets these in batches; legacy "release everything"
-- (handleReleaseGrades) sets them all in one update.

alter table review_assignments
  add column if not exists released_at timestamptz;

create index if not exists review_assignments_released_idx
  on review_assignments(cycle_id, released_at)
  where released_at is not null;

comment on column review_assignments.released_at is
  'Timestamp when this employee''s grade was released to them. NULL = not yet released. Replaces the cycle-level grades_released boolean for staged-release support.';

-- Backfill existing released cycles: stamp every assignment with released_at = now() if its cycle has grades_released=true.
update review_assignments ra
set released_at = now()
from performance_cycles pc
where ra.cycle_id = pc.id
  and pc.grades_released = true
  and ra.released_at is null;
```

**Apply, commit:**

```bash
supabase db reset
git add supabase/migrations/20260701_01_review_assignments_released_at.sql
git commit -m "feat(release): per-assignment released_at column with backfill"
```

---

### Task 2: Migration — `cycle_release_rules` table

**Files:**
- Create: `supabase/migrations/20260701_02_cycle_release_rules.sql`

```sql
create table if not exists cycle_release_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  cycle_id uuid not null references performance_cycles(id) on delete cascade,
  -- Targeting
  target_kind text not null check (target_kind in ('department', 'manager_first', 'all', 'individual')),
  target_value text,                    -- department name, OR null for 'manager_first'/'all', OR list of user_ids serialised for 'individual'
  -- Audience: 'manager' = release to the manager only (so they can debrief);
  --          'employee' = release to the employee directly.
  audience text not null check (audience in ('manager', 'employee')),
  -- When to fire
  release_at timestamptz not null,
  -- Lifecycle
  status text not null default 'pending' check (status in ('pending', 'fired', 'canceled')),
  fired_at timestamptz,
  fired_count int,
  -- Audit
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  -- Optional Slack notification flag
  notify_via_slack boolean not null default true
);

create index if not exists release_rules_pending_idx
  on cycle_release_rules(release_at)
  where status = 'pending';

alter table cycle_release_rules enable row level security;

create policy "release_rules_workspace"
  on cycle_release_rules for select to authenticated
  using (workspace_id = (select workspace_id from users where id = auth.uid()));

revoke all on cycle_release_rules from anon, public;
grant select on cycle_release_rules to authenticated;
-- inserts/updates only via RPC
```

**Commit:**

```bash
supabase db reset
git add supabase/migrations/20260701_02_cycle_release_rules.sql
git commit -m "feat(release): cycle_release_rules table"
```

---

### Task 3: RPC — `schedule_release_rule`

**Files:**
- Create: `supabase/migrations/20260701_03_schedule_release_rule.sql`

```sql
create or replace function schedule_release_rule(
  p_cycle_id uuid,
  p_target_kind text,
  p_target_value text,
  p_audience text,
  p_release_at timestamptz,
  p_notify_via_slack boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_user_role text;
  v_rule_id uuid;
begin
  select workspace_id into v_workspace_id from performance_cycles where id = p_cycle_id;
  if v_workspace_id is null then raise exception 'Cycle not found' using errcode='42704'; end if;

  select role into v_user_role from users where id = v_user_id;
  if v_user_role not in ('hr', 'admin', 'owner') then
    raise exception 'Insufficient role' using errcode='42501';
  end if;

  insert into cycle_release_rules (
    workspace_id, cycle_id, target_kind, target_value, audience, release_at, notify_via_slack, created_by
  ) values (
    v_workspace_id, p_cycle_id, p_target_kind, p_target_value, p_audience, p_release_at, p_notify_via_slack, v_user_id
  ) returning id into v_rule_id;

  return v_rule_id;
end;
$$;

revoke all on function schedule_release_rule(uuid, text, text, text, timestamptz, boolean) from public, anon;
grant execute on function schedule_release_rule(uuid, text, text, text, timestamptz, boolean) to authenticated;
```

**Commit:**

```bash
supabase db reset
git add supabase/migrations/20260701_03_schedule_release_rule.sql
git commit -m "feat(release): RPC to schedule release rules"
```

---

### Task 4: RPC — `apply_release_rule` (worker, callable by cron or manually)

**Files:**
- Create: `supabase/migrations/20260701_04_apply_release_rule.sql`

```sql
create or replace function apply_release_rule(p_rule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_count int := 0;
begin
  select * into v_rule from cycle_release_rules where id = p_rule_id and status = 'pending' for update;
  if v_rule is null then
    return jsonb_build_object('error', 'rule_not_found_or_already_fired');
  end if;

  -- Find target assignments based on target_kind
  with targets as (
    select ra.id from review_assignments ra
    join users u on u.id = ra.employee_id
    where ra.cycle_id = v_rule.cycle_id
      and ra.released_at is null
      and ra.assignment_type = 'standard'
      and ra.final_grade is not null  -- can't release un-graded ones
      and case v_rule.target_kind
        when 'all' then true
        when 'department' then u.department = v_rule.target_value
        when 'manager_first' then false  -- handled separately below
        when 'individual' then ra.employee_id::text = any(string_to_array(v_rule.target_value, ','))
        else false
      end
  )
  update review_assignments
  set released_at = now()
  where id in (select id from targets);
  get diagnostics v_count = row_count;

  -- Mark rule as fired
  update cycle_release_rules
  set status = 'fired', fired_at = now(), fired_count = v_count
  where id = p_rule_id;

  -- Enqueue Slack notifications via slack_send_queue (audience-aware)
  if v_rule.notify_via_slack then
    insert into slack_send_queue (workspace_id, user_id, action, payload, send_at, status, priority)
    select v_rule.workspace_id,
           case when v_rule.audience = 'manager' then ra.manager_id else ra.employee_id end,
           'send_grade_release',
           jsonb_build_object('assignment_id', ra.id, 'audience', v_rule.audience),
           now(), 'pending', 'critical'
    from review_assignments ra
    where ra.cycle_id = v_rule.cycle_id
      and ra.released_at >= v_rule.fired_at -- just-released rows
      and (case when v_rule.audience = 'manager' then ra.manager_id else ra.employee_id end) is not null;
  end if;

  return jsonb_build_object('fired_count', v_count, 'rule_id', p_rule_id);
end;
$$;

revoke all on function apply_release_rule(uuid) from public, anon;
grant execute on function apply_release_rule(uuid) to authenticated;
```

**Step 2: Schedule pg_cron to run pending rules every minute**

```sql
create or replace function run_pending_release_rules() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_rule_id uuid;
  v_total int := 0;
begin
  for v_rule_id in
    select id from cycle_release_rules
    where status = 'pending' and release_at <= now()
    order by release_at asc
    limit 50
  loop
    perform apply_release_rule(v_rule_id);
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

select cron.schedule('run_pending_release_rules', '* * * * *', $$select public.run_pending_release_rules()$$);
```

**Commit:**

```bash
supabase db reset
git add supabase/migrations/20260701_04_apply_release_rule.sql
git commit -m "feat(release): apply_release_rule worker + minute cron"
```

---

## Track B: Release scheduler UI

### Task 5: `<ReleaseScheduler>` component

**Files:**
- Create: `src/app/dashboard/cycles/[id]/release-scheduler.tsx`

**Why:** Replaces the binary "Release Grades" button with a richer UI. Shows: who's already calibrated, breakdown by department, proposed staging timeline, and a confirm step that creates `cycle_release_rules`.

**Step 1: Implement (sketch — flesh out per design system)**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

interface DraftRule {
  target_kind: "all" | "department" | "manager_first" | "individual";
  target_value: string;
  audience: "manager" | "employee";
  release_at: Date;
  notify_via_slack: boolean;
}

export function ReleaseScheduler({
  cycleId,
  open,
  onClose,
  departments,
  calibratedCount,
  totalCount,
}: {
  cycleId: string;
  open: boolean;
  onClose: () => void;
  departments: string[];
  calibratedCount: number;
  totalCount: number;
}) {
  const [rules, setRules] = useState<DraftRule[]>([
    { target_kind: "all", target_value: "", audience: "manager", release_at: new Date(), notify_via_slack: true },
  ]);
  const [saving, setSaving] = useState(false);

  function addRule() {
    setRules((r) => [...r, { target_kind: "department", target_value: departments[0] ?? "", audience: "employee", release_at: new Date(Date.now() + 86400000), notify_via_slack: true }]);
  }

  async function save() {
    setSaving(true);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    for (const r of rules) {
      await supabase.rpc("schedule_release_rule", {
        p_cycle_id: cycleId,
        p_target_kind: r.target_kind,
        p_target_value: r.target_value || null,
        p_audience: r.audience,
        p_release_at: r.release_at.toISOString(),
        p_notify_via_slack: r.notify_via_slack,
      });
    }
    setSaving(false);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Schedule grade release</SheetTitle>
        </SheetHeader>
        <div className="mt-3 flex items-center gap-3">
          <Badge variant="outline">Calibrated: {calibratedCount} / {totalCount}</Badge>
          {calibratedCount < totalCount && (
            <span className="text-xs text-amber-600">Only calibrated employees will be released.</span>
          )}
        </div>

        <div className="space-y-4 mt-6">
          {rules.map((r, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Rule {i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => setRules((arr) => arr.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target</Label>
                  <Select value={r.target_kind} onValueChange={(v: any) => setRules((arr) => arr.map((x, idx) => idx === i ? { ...x, target_kind: v } : x))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="department">By department</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {r.target_kind === "department" && (
                  <div>
                    <Label>Department</Label>
                    <Select value={r.target_value} onValueChange={(v) => setRules((arr) => arr.map((x, idx) => idx === i ? { ...x, target_value: v } : x))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div>
                <Label>Audience</Label>
                <Select value={r.audience} onValueChange={(v: any) => setRules((arr) => arr.map((x, idx) => idx === i ? { ...x, audience: v } : x))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager only (lets them debrief 1:1)</SelectItem>
                    <SelectItem value="employee">Employee directly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Release at</Label>
                <Input type="datetime-local"
                  value={r.release_at.toISOString().slice(0, 16)}
                  onChange={(e) => setRules((arr) => arr.map((x, idx) => idx === i ? { ...x, release_at: new Date(e.target.value) } : x))}
                />
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRule}><Plus className="h-3 w-3" /> Add rule</Button>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>Schedule release</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Wire into `cycle-actions.tsx`**

Find the existing "Release Grades" button. Replace it with:

```tsx
<Button onClick={() => setReleaseSchedulerOpen(true)}>Schedule release...</Button>
{/* Old "Release everyone now" still available as a one-click action — uses target_kind=all + release_at=now */}
```

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/[id]/release-scheduler.tsx src/app/dashboard/cycles/[id]/cycle-actions.tsx
git commit -m "feat(release): scheduler UI for staged grade release"
```

---

### Task 6: Pending rules + audit log on the cycle detail page

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/page.tsx`

**Step 1: Fetch pending + fired rules and render a panel**

```tsx
const { data: rules } = await supabase
  .from("cycle_release_rules")
  .select("id, target_kind, target_value, audience, release_at, status, fired_at, fired_count, created_by:users(slack_name)")
  .eq("cycle_id", cycle.id)
  .order("release_at", { ascending: true });

// Render in a Card titled "Release schedule"
```

**Step 2: Allow canceling a pending rule**

Add a tiny "Cancel" button on each pending row:

```tsx
async function cancelRule(id: string) {
  await supabase.from("cycle_release_rules").update({ status: "canceled" }).eq("id", id);
  router.refresh();
}
```

(Make sure RLS or RPC permits HR to cancel — easiest path is an RPC `cancel_release_rule(uuid)`.)

**Commit:**

```bash
git add src/app/dashboard/cycles/[id]/page.tsx
git commit -m "feat(release): release schedule panel on cycle detail"
```

---

### Task 7: Update Nami `send_grade_release` action to consume `released_at`

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`

**Step 1: Find `send_grade_release` handler**

```bash
grep -n "send_grade_release\|release_grades" supabase/functions/nami-bot/index.ts
```

**Step 2: Switch from "all enrolled" to "just-released since payload.fired_at"**

Use `assignment_id` from payload to send a tailored DM:
- audience=employee → "Your performance review for *{cycle name}* is now available. <link>"
- audience=manager → "Final grades for your team are now visible. Schedule a debrief 1:1: <link>"

**Commit:**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(release): per-rule Slack notifications via send_grade_release"
```

---

## Track C: Edit-after-launch

### Task 8: Migration — `cycle_question_audit` table

**Files:**
- Create: `supabase/migrations/20260701_05_cycle_question_audit.sql`

```sql
create table if not exists cycle_question_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  cycle_id uuid not null references performance_cycles(id) on delete cascade,
  question_id uuid references cycle_questions(id) on delete set null,
  action text not null check (action in ('added', 'removed', 'edited')),
  before_value jsonb,
  after_value jsonb,
  actor_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists cycle_question_audit_cycle_idx on cycle_question_audit(cycle_id, created_at desc);
alter table cycle_question_audit enable row level security;

create policy "cycle_question_audit_select"
  on cycle_question_audit for select to authenticated
  using (workspace_id = (select workspace_id from users where id = auth.uid()));
revoke all on cycle_question_audit from anon, public;
grant select on cycle_question_audit to authenticated;
```

**Commit:**

```bash
supabase db reset
git add supabase/migrations/20260701_05_cycle_question_audit.sql
git commit -m "feat(cycles): cycle_question_audit table"
```

---

### Task 9: RPC — `edit_cycle_question` (handles add/edit/remove with safety checks)

**Files:**
- Create: `supabase/migrations/20260701_06_edit_cycle_question.sql`

```sql
create or replace function edit_cycle_question(
  p_cycle_id uuid,
  p_action text,                            -- 'add', 'edit', 'remove'
  p_question_id uuid default null,
  p_question_type text default null,        -- 'competency' | 'text' (only for add)
  p_competency_id uuid default null,
  p_prompt text default null,
  p_required boolean default null,
  p_sort_order int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_user_role text;
  v_existing record;
  v_response_count int;
  v_new_id uuid;
begin
  select workspace_id into v_workspace_id from performance_cycles where id = p_cycle_id;
  if v_workspace_id is null then raise exception 'Cycle not found' using errcode='42704'; end if;

  select role into v_user_role from users where id = v_user_id;
  if v_user_role not in ('hr', 'admin', 'owner') then
    raise exception 'Insufficient role' using errcode='42501';
  end if;

  case p_action
    when 'add' then
      if p_question_type is null then raise exception 'p_question_type required for add' using errcode='22023'; end if;
      insert into cycle_questions (cycle_id, question_type, competency_id, prompt, required, sort_order)
      values (p_cycle_id, p_question_type, p_competency_id, p_prompt,
              coalesce(p_required, true),
              coalesce(p_sort_order, 999))
      returning id into v_new_id;
      insert into cycle_question_audit (workspace_id, cycle_id, question_id, action, after_value, actor_id)
      values (v_workspace_id, p_cycle_id, v_new_id, 'added',
              jsonb_build_object('question_type', p_question_type, 'competency_id', p_competency_id, 'prompt', p_prompt, 'required', p_required),
              v_user_id);
      return jsonb_build_object('action', 'added', 'question_id', v_new_id);

    when 'edit' then
      select * into v_existing from cycle_questions where id = p_question_id and cycle_id = p_cycle_id for update;
      if v_existing is null then raise exception 'Question not found' using errcode='42704'; end if;

      -- For edits to questions with submitted responses, only `prompt`/`required`/`sort_order` are mutable.
      -- question_type and competency_id are immutable to preserve response semantics.
      select count(*) into v_response_count
      from review_responses rr
      join review_assignments ra on ra.id = rr.assignment_id
      where ra.cycle_id = p_cycle_id
        and rr.question_id = p_question_id;

      update cycle_questions
      set
        prompt = coalesce(p_prompt, prompt),
        required = coalesce(p_required, required),
        sort_order = coalesce(p_sort_order, sort_order)
      where id = p_question_id;

      insert into cycle_question_audit (workspace_id, cycle_id, question_id, action, before_value, after_value, actor_id)
      values (v_workspace_id, p_cycle_id, p_question_id, 'edited',
              to_jsonb(v_existing),
              jsonb_build_object('prompt', p_prompt, 'required', p_required, 'sort_order', p_sort_order, 'response_count', v_response_count),
              v_user_id);

      return jsonb_build_object('action', 'edited', 'response_count', v_response_count);

    when 'remove' then
      select * into v_existing from cycle_questions where id = p_question_id and cycle_id = p_cycle_id for update;
      if v_existing is null then raise exception 'Question not found' using errcode='42704'; end if;

      select count(*) into v_response_count
      from review_responses rr where rr.question_id = p_question_id;
      if v_response_count > 0 then
        raise exception 'Cannot remove question with % submitted responses', v_response_count using errcode='23503';
      end if;

      delete from cycle_questions where id = p_question_id;
      insert into cycle_question_audit (workspace_id, cycle_id, question_id, action, before_value, actor_id)
      values (v_workspace_id, p_cycle_id, null, 'removed', to_jsonb(v_existing), v_user_id);

      return jsonb_build_object('action', 'removed');

    else raise exception 'Unknown p_action: %', p_action using errcode='22023';
  end case;
end;
$$;

revoke all on function edit_cycle_question(uuid, text, uuid, text, uuid, text, boolean, int) from public, anon;
grant execute on function edit_cycle_question(uuid, text, uuid, text, uuid, text, boolean, int) to authenticated;
```

**Commit:**

```bash
supabase db reset
git add supabase/migrations/20260701_06_edit_cycle_question.sql
git commit -m "feat(cycles): edit_cycle_question RPC with response-aware safety"
```

---

### Task 10: Tests for `edit_cycle_question`

**Files:**
- Create: `src/app/dashboard/cycles/__tests__/edit-cycle-question.test.ts`

Cover:
1. add a text question → row created, audit row written
2. edit prompt of an existing question → succeeds
3. attempt to remove a question with responses → fails with 23503
4. attempt edit by non-HR user → fails with 42501

(Implementation pattern matches Task 4 in Sprint 1.)

**Commit:**

```bash
git add src/app/dashboard/cycles/__tests__/edit-cycle-question.test.ts
git commit -m "test(cycles): edit_cycle_question safety checks"
```

---

### Task 11: Replace cycle questions UI with edit-aware version

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/cycle-questions.tsx`

**Step 1: Show, for each question, a "Used in N submitted responses" subline so HR knows the impact of editing.**

Query response counts:

```tsx
const { data: counts } = await supabase
  .from("review_responses")
  .select("question_id")
  .in("question_id", questions.map(q => q.id));
const countByQ = counts?.reduce((acc, r) => { acc[r.question_id] = (acc[r.question_id] ?? 0) + 1; return acc; }, {} as Record<string, number>) ?? {};
```

**Step 2: Add inline edit + delete buttons; wire to the new RPC**

```tsx
async function editPrompt(qid: string, newPrompt: string) {
  await supabase.rpc("edit_cycle_question", {
    p_cycle_id: cycle.id,
    p_action: "edit",
    p_question_id: qid,
    p_prompt: newPrompt,
  });
}
async function removeQuestion(qid: string) {
  const used = countByQ[qid] ?? 0;
  if (used > 0) {
    alert(`Can't remove — already used in ${used} submitted responses. You can edit the prompt instead.`);
    return;
  }
  if (!confirm("Remove this question?")) return;
  await supabase.rpc("edit_cycle_question", { p_cycle_id: cycle.id, p_action: "remove", p_question_id: qid });
}
```

**Step 3: Show audit log inline**

A small "View edits (12)" link that opens a popover listing the audit rows for this cycle.

**Commit:**

```bash
git add src/app/dashboard/cycles/[id]/cycle-questions.tsx
git commit -m "feat(cycles): edit-after-launch UI with response-count guards"
```

---

## Track D: Verification + ship

### Task 12: Manual run

1. Launch a test cycle with 8 employees across 2 departments.
2. Calibrate 6 of them (enough to release).
3. Open Release Scheduler → create 2 rules:
   - Engineering, audience=manager, release_at = now + 1 minute
   - Sales, audience=employee, release_at = now + 5 minutes
4. Watch `cycle_release_rules.status` transition from `pending` → `fired` after pg_cron runs.
5. Verify Slack DMs arrive in the right order (managers first, employees second).
6. Check `review_assignments.released_at` is stamped on the released subset, NULL on the others.
7. Edit a cycle question's prompt → confirm change persists, audit row written.
8. Try to delete a question that already has 5 responses → blocked with clear error.
9. Add a new question after launch → it appears in upcoming review modals.

### Task 13: PR

```bash
git push -u origin sprint-5-staged-release
gh pr create --title "Sprint 5: Staged grade release + edit-after-launch"
```

**Rollout:** Both features default-on (no flag). Migration backfills `released_at` for existing released cycles, so behavior is preserved.

---

## Notes

- **Don't drop `cycles.grades_released` yet.** Keep it as a derived/triggered column for backwards compat with the dashboard urgency banner. Drop in Sprint 6 once everything reads from `released_at`.
- **`target_kind = 'manager_first'` is reserved** — implement in a follow-up sprint where you cascade: manager release first, then employee release X hours later, automatically scheduled.
- **Edit-after-launch warns, doesn't block.** The bar is: if responses exist, mutability is restricted to safe fields. The UI should still warn HR even on safe edits ("This question has been answered by 12 people; changing the prompt may cause confusion.").
- **`cycle_question_audit` is not the same as `audit_log`.** The general audit log (`20260416_12_audit_log.sql`) is for cross-cutting events; this table is feature-specific so the cycle-detail UI can render fast targeted history without scanning the global log.
- **Race conditions:** two HRs editing the same question at the same time use `for update` lock in the RPC, so writes are serial. Last-write-wins. Audit captures both edits.

## Estimated time

| Track | Hours |
|---|---|
| A: Schema + RPCs | 6 |
| B: Scheduler UI | 8 |
| C: Edit-after-launch | 8 |
| D: Verify + ship | 4 |
| **Total** | **~26h** |
