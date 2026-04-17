# Reliability Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate critical duplicate-submission races, broken Slack deep-links, and missed completion-alerts; strengthen UX around draft-vs-submitted state and data input hygiene.

**Architecture:**
- DB migrations for structural gaps (survey uniqueness, completion dedup flag, goals uniqueness, text length limits).
- Edge-function patches for Slack delivery correctness (authed deep-link helper, 429 requeue instead of burn-retry).
- Minimal UI copy tweaks (autosave wording) and validation (email regex) to remove ambiguity.
- All changes respect existing RLS + workspace scoping; no new user-facing surface area.
- Backwards-compatible: old Slack messages still reach the login page if the token mint fails, we just don't break anything that worked before.

**Tech Stack:** Supabase Postgres (`zhfvxfvmdlpdfgxrwtdn`) + Deno edge functions + Next.js (App Router) + React + shadcn/ui.

**Out of scope (deliberately deferred):**
- `M2` slack_send_audit_log table — observability improvement, not correctness.
- `M4` goal-status DM dedup — already exists (via `notification_log`), audit was wrong.
- Deprecated `cycle-notifications/launch` — already a no-op, no users affected.
- Large UX overhauls (survey length caps, bulk-action concurrency) — separate initiative.

**Execution model:**
- Each DB change goes through an explicit migration file + `apply_migration` MCP call.
- Each edge-function change is deployed via `deploy_edge_function` MCP, then smoke-tested by reading the deployed code back.
- Each frontend change is verified by `npm run build` (if fast) or `tsc --noEmit` on changed files; full browser verification only where behavior is observable.
- Commit after each task, small focused commits.

---

## Phase A — Critical correctness fixes

### Task A1: Uniqueness constraint on `survey_responses`

**Problem:** No DB guard against duplicate survey submissions. Soft status check at `supabase/functions/slack-interactivity/index.ts:1060` can race.

**Files:**
- Create: `supabase/migrations/20260417_05_survey_responses_unique.sql`

**Step 1: Check the live data shape first.**

Run via Supabase MCP `execute_sql`:
```sql
SELECT survey_id, participant_id, subject_user_id, COUNT(*)
FROM survey_responses
GROUP BY survey_id, participant_id, subject_user_id
HAVING COUNT(*) > 1;
```
Expected: zero rows. If any exist, stop and triage (data cleanup first — do not add the constraint over duplicate data).

**Step 2: Write the migration.**

```sql
-- 20260417_05_survey_responses_unique.sql
-- Prevent duplicate survey submissions for the same (survey, participant, subject)
-- tuple. The Slack `survey_modal_submit` handler previously relied on a soft
-- status check, which races when two tabs / a Slack retry both observe
-- status != 'completed' and both INSERT.
--
-- subject_user_id is part of the tuple because a single participant (peer
-- reviewer) can be asked to fill in the same survey for multiple subjects.
-- Partial-unique on nullable subject_user_id keeps pulse/eNPS responses
-- (where subject_user_id IS NULL) deduped per participant.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_survey_response_participant_subject
  ON public.survey_responses (survey_id, participant_id, subject_user_id)
  WHERE subject_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_survey_response_participant_nosubject
  ON public.survey_responses (survey_id, participant_id)
  WHERE subject_user_id IS NULL;
```

**Step 3: Apply via MCP and verify.**

Use `mcp__supabase__apply_migration` with name `survey_responses_unique`. Then verify:
```sql
SELECT indexname FROM pg_indexes
WHERE tablename='survey_responses' AND indexname LIKE 'uniq_survey_response%';
```
Expected: both index names appear.

**Step 4: Update the Slack handler to treat 23505 as "already submitted" (idempotent success).**

File: `supabase/functions/slack-interactivity/index.ts:1085-1095`.

Wrap the `dbInsert("survey_responses", ...)` in try/catch. On unique-violation (23505), fall through to the existing confirmation message and return `response_action: clear` — same UX as the soft-check branch at 1061-1067.

**Step 5: Redeploy the function.**

Use `mcp__supabase__deploy_edge_function` for `slack-interactivity`. Confirm the new file hash is returned.

**Step 6: Commit.**

```bash
git add supabase/migrations/20260417_05_survey_responses_unique.sql supabase/functions/slack-interactivity/index.ts
git commit -m "fix(db): unique constraint on survey_responses + 23505-idempotent Slack submit"
```

---

### Task A2: Authed deep-links in Slack messages

**Problem:** Slack messages with `${DASHBOARD_URL}/dashboard/...` drop users at the login wall. A `mint_dashboard_link_token` RPC exists but is not called from any outgoing message.

**Files:**
- Modify: `supabase/functions/_shared/slack-api.ts` — add `buildAuthedUrl` helper.
- Modify: `supabase/functions/slack-interactivity/index.ts:265, 295, 297` — wrap existing URLs.
- Modify: `supabase/functions/nami-bot/index.ts:1361` — wrap grade-release URL.
- Modify: `supabase/functions/cycle-notifications/index.ts:100, 120, 138, 203, 237` — wrap legacy URLs (still called from web UI for self_submitted path).

**Step 1: Verify the RPC signature.**

Already confirmed from `supabase/migrations/20260416_26_dashboard_link_tokens.sql`:
```
mint_dashboard_link_token(p_user_id uuid, p_target_path text, p_ttl_minutes int default 15) returns text
```
Granted to `service_role`, which is what edge functions use.

**Step 2: Write the helper in `supabase/functions/_shared/slack-api.ts`.**

Append:
```typescript
/**
 * Mint a short-lived token and build an authed dashboard URL.
 * Falls back to the raw URL if minting fails so a Slack send never
 * errors out just because the token service is unavailable — the user
 * will land at the login page in the worst case, which matches prior
 * behaviour and is never worse than silently failing to send.
 */
export async function buildAuthedUrl(
  supabase: any,
  dashboardUrl: string,
  userId: string | null,
  targetPath: string,
): Promise<string> {
  if (!userId) return `${dashboardUrl}${targetPath}`;
  try {
    const { data, error } = await supabase.rpc("mint_dashboard_link_token", {
      p_user_id: userId,
      p_target_path: targetPath,
      p_ttl_minutes: 60 * 24 * 7, // 7 days — Slack messages sit in inboxes
    });
    if (error || !data) return `${dashboardUrl}${targetPath}`;
    return `${dashboardUrl}${targetPath}?t=${encodeURIComponent(data)}`;
  } catch {
    return `${dashboardUrl}${targetPath}`;
  }
}
```

**Step 3: Wire into slack-interactivity completion alerts.**

`supabase/functions/slack-interactivity/index.ts` — `checkAndNotifyCompletion` (line 236). Each admin DM needs a per-admin token. Replace inline URL strings with `await buildAuthedUrl(supabase, DASHBOARD_URL, admin.id, \`/dashboard/cycles/${cycleId}\`)` etc. Make sure the function now pulls `admin.id` from the query (currently only fetches `slack_user_id`).

Adjust the admin query:
```typescript
const admins = await dbQuery("users", `workspace_id=eq.${wsId}&role=in.(admin,hr)&select=id,slack_user_id`);
```

**Step 4: Wire into nami-bot grade-release.**

`supabase/functions/nami-bot/index.ts:~1361` (`handleReleaseGrades`). Replace `${DASHBOARD_URL}/dashboard/performance` with `await buildAuthedUrl(supabase, DASHBOARD_URL, emp.id, '/dashboard/performance')`. Verify `emp.id` is in scope (the employee record is already fetched).

**Step 5: Wire into cycle-notifications (legacy paths still in use).**

`supabase/functions/cycle-notifications/index.ts` — lines 100, 120, 138, 203, 237. Each `sendSlackDM(... text ...)` call that includes a URL.

For each call site: resolve the recipient's app-user UUID (already in scope via the fetched record), mint the token, embed in the text. Keep the text copy identical otherwise.

**Step 6: Deploy all three edge functions.**

`mcp__supabase__deploy_edge_function` for each: `slack-interactivity`, `nami-bot`, `cycle-notifications`.

**Step 7: Smoke test via SQL.**

```sql
-- Confirm minting works from the edge-function role
SELECT mint_dashboard_link_token(
  (SELECT id FROM users LIMIT 1),
  '/dashboard/performance',
  60
);
```
Expected: a 32+ char token string.

**Step 8: Commit.**

```bash
git add supabase/functions/_shared/slack-api.ts \
        supabase/functions/slack-interactivity/index.ts \
        supabase/functions/nami-bot/index.ts \
        supabase/functions/cycle-notifications/index.ts
git commit -m "feat(slack): mint dashboard-link tokens for all outbound URLs"
```

---

### Task A3: Dedup guard on cycle-completion alerts

**Problem:** `checkAndNotifyCompletion` at `slack-interactivity/index.ts:236` has no guard. Two near-simultaneous last-submissions can both observe "all complete" and fire the alert twice.

**Files:**
- Create: `supabase/migrations/20260417_06_cycle_completion_notified.sql`
- Modify: `supabase/functions/slack-interactivity/index.ts:236-306`

**Step 1: Write the migration.**

```sql
-- 20260417_06_cycle_completion_notified.sql
-- Idempotency for "cycle complete" and "all reviews for $employee complete"
-- alerts. checkAndNotifyCompletion fires from every review submission; without
-- a DB-level flag, two concurrent submits both observe "everything done" and
-- fire the alert twice.

ALTER TABLE public.performance_cycles
  ADD COLUMN IF NOT EXISTS completion_notified_at timestamptz;

-- Per-employee completion alerts are tracked on review_assignments since
-- the trigger is "all assignments for THIS employee done".
ALTER TABLE public.review_assignments
  ADD COLUMN IF NOT EXISTS employee_completion_notified_at timestamptz;
```

Apply via `mcp__supabase__apply_migration`.

**Step 2: Verify columns landed.**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='performance_cycles'
  AND column_name='completion_notified_at';
```

**Step 3: Update `checkAndNotifyCompletion` to use the flags.**

In `supabase/functions/slack-interactivity/index.ts` around line 251 (per-employee branch) and line 275 (cycle branch):

For the per-employee branch, before sending:
```typescript
// Atomically claim the notification right: only the first concurrent caller gets to send.
const { data: claimed } = await supabase
  .from("review_assignments")
  .update({ employee_completion_notified_at: new Date().toISOString() })
  .eq("cycle_id", cycleId)
  .eq("employee_id", empId)
  .is("employee_completion_notified_at", null)
  .select("id");
// `claimed` returns the rows the update touched. If empty, another caller won.
if (!claimed || claimed.length === 0) return; // already notified
```

For the cycle branch:
```typescript
const { data: claimedCycle } = await supabase
  .from("performance_cycles")
  .update({ completion_notified_at: new Date().toISOString() })
  .eq("id", cycleId)
  .is("completion_notified_at", null)
  .select("id");
if (!claimedCycle || claimedCycle.length === 0) { /* already notified, skip */ }
```

Place the cycle-branch claim right before the admin fetch at line 284.

**Step 4: Rollback on send failure.**

If all admin sends fail, clear the flag so a future submit can retry. Minimal logic — if `slackApi` throws or all admins have `slack_user_id IS NULL`, UPDATE back to NULL.

**Step 5: Deploy & smoke test.**

`mcp__supabase__deploy_edge_function` for `slack-interactivity`. Then manually verify by simulating two concurrent "last-review" completions against a test cycle (optional, low-risk).

**Step 6: Commit.**

```bash
git add supabase/migrations/20260417_06_cycle_completion_notified.sql \
        supabase/functions/slack-interactivity/index.ts
git commit -m "fix(slack): atomic dedup guard on cycle + per-employee completion alerts"
```

---

## Phase B — High-priority reliability fixes

### Task B1: Clearer autosave vs submitted UX

**Problem:** Autosave UI says "Saved X ago" which can be read as "submitted". Users who leave without clicking Submit think their review is in.

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx:780-789` (status chip)

**Step 1: Change the copy.**

Replace the three branches:
```tsx
{autosaveStatus === "saving" && (
  <><Loader2 className="h-3 w-3 animate-spin" /><span>Saving draft…</span></>
)}
{autosaveStatus === "saved" && lastSaved && (
  <><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>Draft saved locally · click Submit to finalise</span></>
)}
{autosaveStatus === "idle" && !lastSaved && (
  <><Clock className="h-3 w-3" /><span>Your answers are saved as you type — Submit when done</span></>
)}
```

**Step 2: Add a beforeunload warning if there's an unsubmitted draft.**

After the autosave `useEffect` (around line 396):
```tsx
useEffect(() => {
  if (alreadySubmitted) return;
  const hasContent = competencies.some(c => c.rating !== null || c.comment) ||
                     textResponses.some(t => t.response.trim()) ||
                     overallComment.trim();
  if (!hasContent) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [competencies, textResponses, overallComment, alreadySubmitted]);
```

**Step 3: Type-check.**

Run: `cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit -p . 2>&1 | head -50`
Expected: no new errors on this file.

**Step 4: Commit.**

```bash
git add src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx
git commit -m "ux(review): clarify draft-vs-submitted autosave status + unsaved-change warning"
```

---

### Task B2: Requeue on Slack 429 instead of burn-retry

**Problem:** `supabase/functions/_shared/slack-api.ts:35-50` caps retry delay at 120s and consumes all 3 retries in-process. If Slack returns `Retry-After: 180`, we wait 120s, fail, burn all retries, and the job's `last_error` becomes permanent — no future drain re-sends.

**Files:**
- Modify: `supabase/functions/_shared/slack-api.ts` — expose a "rate-limited" signal instead of swallowing.
- Modify: `supabase/functions/nami-bot/index.ts` (`handleDrainSendQueue`) — on rate-limit signal, schedule a retry via `slack_send_queue.next_attempt_at`.

**Step 1: Add a sentinel error class.**

In `supabase/functions/_shared/slack-api.ts`, at the top:
```typescript
export class SlackRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Slack rate-limited, retry after ${retryAfterSeconds}s`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
```

**Step 2: After 1 in-process retry, throw the sentinel.**

Reduce `MAX_RETRIES` to 1 for the in-process retry (still handles transient 429s that resolve fast). Once exhausted, throw `SlackRateLimitError(retryAfter)` instead of recursing into failure.

**Step 3: Catch in the queue drainer.**

In `supabase/functions/nami-bot/index.ts` `handleDrainSendQueue` (around line 858-989), wrap each send in try/catch. On `SlackRateLimitError`:
```typescript
await supabase
  .from("slack_send_queue")
  .update({
    status: "pending",
    next_attempt_at: new Date(Date.now() + err.retryAfterSeconds * 1000).toISOString(),
    last_error: `rate-limited, retry after ${err.retryAfterSeconds}s`,
    // do NOT increment attempt counter — it wasn't a real failure
  })
  .eq("id", job.id);
continue; // move on
```

If the queue currently doesn't have `next_attempt_at`, check that first:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'slack_send_queue' AND column_name = 'next_attempt_at';
```
If absent, add it in a small migration.

**Step 4: Confirm `claim_slack_send_jobs` respects `next_attempt_at`.**

Read `supabase/migrations/20260416_20_slack_send_queue.sql` to verify the claim function filters `WHERE next_attempt_at IS NULL OR next_attempt_at <= now()`. If not, amend the claim RPC.

**Step 5: Deploy both edge functions.**

`mcp__supabase__deploy_edge_function` for `nami-bot`. The shared module is bundled per function so other callers pick up the new export automatically.

**Step 6: Commit.**

```bash
git add supabase/functions/_shared/slack-api.ts supabase/functions/nami-bot/index.ts supabase/migrations/20260417_07_slack_send_queue_next_attempt.sql
git commit -m "fix(slack): requeue jobs on 429 instead of burning retries"
```

---

### Task B3: Stronger email + manager validation in CSV import

**Problem:** `src/app/dashboard/team/import/page.tsx:281` only checks for `@`. Accepts `"a@b"`, `"@"`, `"a@"`. Manager-not-found is a warning, not an error — user imports 500 rows then wonders why managers aren't set.

**Files:**
- Modify: `src/app/dashboard/team/import/page.tsx` (validation block around line 271-312)

**Step 1: Replace the email check.**

Replace `!m.email.includes("@")` with a simple RFC-5322-pragmatic regex:
```typescript
// Pragmatic email regex. Mirrors HTML5 input[type=email] validation — good enough
// for "is this plausibly an email" without claiming to parse full RFC 5322.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ...inside the validator:
if (!m.email) {
  errors.push("Missing email");
} else if (!EMAIL_RE.test(m.email)) {
  errors.push("Invalid email format");
}
```

**Step 2: Upgrade manager-missing from warning to configurable severity.**

Keep it as a warning (the batch should still import; some customers import employees first, managers later). But in the "Validate" step UI, surface a clearer banner: "N rows have a manager listed who isn't in the system. Their manager_id won't be set — run a second import with those managers first, or link manually in Team Settings."

Search for where `realWarnings` is rendered (around line 417-419). Make sure `warn:manager_missing` surfaces prominently. If it already does, no change.

**Step 3: Type-check.**

Run: `npx tsc --noEmit -p .` on this file; expect clean.

**Step 4: Commit.**

```bash
git add src/app/dashboard/team/import/page.tsx
git commit -m "fix(import): tighten email validation; surface missing-manager warnings"
```

---

## Phase C — Medium cleanup (structural)

### Task C1: Unique constraint on `goals` (cycle_id, employee_id, title)

**Problem:** Double-click "Create Goal" or "Duplicate Goal" produces identical rows. No DB guard.

**Files:**
- Create: `supabase/migrations/20260417_08_goals_unique.sql`

**Step 1: Check for existing duplicates.**

```sql
SELECT cycle_id, employee_id, title, COUNT(*)
FROM goals
WHERE cycle_id IS NOT NULL
GROUP BY cycle_id, employee_id, title
HAVING COUNT(*) > 1;
```
If any exist, decide policy: keep newest? Merge? Flag to user before adding the constraint. Likely zero for current data; proceed.

**Step 2: Write migration.**

```sql
-- 20260417_08_goals_unique.sql
-- Block double-submitted goals (same title, cycle, employee). Partial index
-- because cycle_id is nullable for workspace-level goals not tied to a cycle.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_goal_per_cycle_employee_title
  ON public.goals (cycle_id, employee_id, title)
  WHERE cycle_id IS NOT NULL;
```

**Step 3: Handle 23505 in the client creation / duplication handlers.**

- `src/app/dashboard/goals/new/page.tsx` handleSubmit — on 23505, surface "A goal with this title already exists for this cycle" rather than a generic DB error.
- `src/app/dashboard/goals/[id]/goal-detail-client.tsx` handleDuplicate — append " (copy)" to the title so duplication doesn't race with itself.

**Step 4: Apply + deploy + commit.**

```bash
git add supabase/migrations/20260417_08_goals_unique.sql \
        src/app/dashboard/goals/new/page.tsx \
        src/app/dashboard/goals/[id]/goal-detail-client.tsx
git commit -m "fix(goals): unique (cycle, employee, title) + friendly duplicate-title errors"
```

---

### Task C2: Server-side length limits

**Problem:** No length caps on cycle name, review comment, goal title, job_title, department. 500-char names break layout; 10MB comments slow exports.

**Files:**
- Create: `supabase/migrations/20260417_09_text_length_limits.sql`
- Modify: UI `maxLength` attributes on the matching inputs.

**Step 1: Check existing data for overshoots.**

```sql
SELECT 'cycle_name' AS f, MAX(LENGTH(name)) FROM performance_cycles
UNION ALL SELECT 'goal_title', MAX(LENGTH(title)) FROM goals
UNION ALL SELECT 'user_job_title', MAX(LENGTH(job_title)) FROM users
UNION ALL SELECT 'user_department', MAX(LENGTH(department)) FROM users;
```

If max exceeds proposed limit, truncate before the constraint or raise the limit. Proposed limits:
- cycle name: 120
- goal title: 200
- job_title: 120
- department: 120
- review comment: 5000

**Step 2: Migration with CHECK constraints.**

```sql
-- 20260417_09_text_length_limits.sql
ALTER TABLE public.performance_cycles
  ADD CONSTRAINT chk_performance_cycles_name_len
  CHECK (LENGTH(name) <= 120) NOT VALID;
ALTER TABLE public.performance_cycles VALIDATE CONSTRAINT chk_performance_cycles_name_len;

ALTER TABLE public.goals
  ADD CONSTRAINT chk_goals_title_len
  CHECK (LENGTH(title) <= 200) NOT VALID;
ALTER TABLE public.goals VALIDATE CONSTRAINT chk_goals_title_len;

ALTER TABLE public.users
  ADD CONSTRAINT chk_users_job_title_len
  CHECK (job_title IS NULL OR LENGTH(job_title) <= 120) NOT VALID,
  ADD CONSTRAINT chk_users_department_len
  CHECK (department IS NULL OR LENGTH(department) <= 120) NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT chk_users_job_title_len;
ALTER TABLE public.users VALIDATE CONSTRAINT chk_users_department_len;

ALTER TABLE public.review_responses
  ADD CONSTRAINT chk_review_responses_comment_len
  CHECK (comment IS NULL OR LENGTH(comment) <= 5000) NOT VALID;
ALTER TABLE public.review_responses VALIDATE CONSTRAINT chk_review_responses_comment_len;
```

`NOT VALID` then `VALIDATE` keeps the migration fast and surfaces any existing violators as a single VALIDATE error we can triage.

**Step 3: Add `maxLength` to the matching UI inputs.**

Minimum set:
- `src/app/dashboard/cycles/new/page.tsx` name input → `maxLength={120}`
- `src/app/dashboard/goals/new/page.tsx` title → `maxLength={200}`
- `src/app/dashboard/team/[id]/edit/page.tsx` job_title, department → `maxLength={120}`
- `src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx` comment textareas → `maxLength={5000}`

**Step 4: Apply + commit.**

```bash
git add supabase/migrations/20260417_09_text_length_limits.sql \
        src/app/dashboard/cycles/new/page.tsx \
        src/app/dashboard/goals/new/page.tsx \
        src/app/dashboard/team/[id]/edit/page.tsx \
        src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx
git commit -m "fix(db,ui): length limits on cycle/goal/user/review text fields"
```

---

### Task C3: Validate manager presence on cycle launch

**Problem:** `launch_cycle` RPC happily creates a `manager_review` assignment with `reviewer_id=NULL` when the employee has no manager. Phase opens but nobody can submit.

**Files:**
- Modify: `supabase/migrations/20260417_10_launch_cycle_manager_check.sql`

**Step 1: Decide policy with the user.**

Options:
- A. Block launch with an error listing employees without managers (safer, admin must fix first).
- B. Auto-skip manager_review assignments for manager-less employees (silent skip — risky).

**Default choice (A).** Admin gets a clear "These employees have no manager — assign one or remove them from the cycle before launching." Document in the migration header.

**Step 2: Write migration + update RPC.**

```sql
-- 20260417_10_launch_cycle_manager_check.sql
CREATE OR REPLACE FUNCTION public.launch_cycle(
  p_cycle_id uuid,
  p_assignments jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_caller_user_id uuid;
  v_missing_mgr_count int;
BEGIN
  -- ... existing auth/lock logic unchanged ...

  -- Validate: any 'manager' assignment must have a non-null reviewer_id OR
  -- the employee must have manager_id set. If we see an assignment where
  -- type='manager' and both reviewer_id is null AND the employee has no
  -- manager_id, refuse the launch.
  SELECT COUNT(*) INTO v_missing_mgr_count
  FROM jsonb_array_elements(p_assignments) x
  JOIN users u ON u.id = (x->>'employee_id')::uuid
  WHERE COALESCE(x->>'assignment_type','standard') = 'manager'
    AND NULLIF(x->>'reviewer_id','') IS NULL
    AND u.manager_id IS NULL;

  IF v_missing_mgr_count > 0 THEN
    RAISE EXCEPTION 'Cannot launch: % employees have no manager assigned. Set managers in Team Settings first.', v_missing_mgr_count
      USING ERRCODE = '23514';
  END IF;

  -- ... rest of existing body unchanged ...
END;
$$;
```

Keep the rest of the function (lock, delete-and-insert, ON CONFLICT, cycle activation) byte-identical. Double-check by reading the current RPC and diffing.

**Step 3: Client-side pre-check.**

In `src/app/dashboard/cycles/new/page.tsx` (the launch step), before calling the RPC:
- Query employees missing `manager_id` from the selected set.
- If any exist, show a blocking dialog with their names — don't even call the RPC.

**Step 4: Apply + test.**

```sql
-- Smoke test: call launch_cycle with an assignment that has no manager
-- against a test cycle and verify the specific 23514 error surfaces.
```

**Step 5: Commit.**

```bash
git add supabase/migrations/20260417_10_launch_cycle_manager_check.sql \
        src/app/dashboard/cycles/new/page.tsx
git commit -m "fix(cycles): block launch when manager_review employees have no manager"
```

---

## Final verification

### Task F1: Run full build + type-check

**Step 1:**
```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit -p . 2>&1 | tail -30
```
Expected: no new type errors from the touched files. Pre-existing errors are out of scope.

**Step 2:**
```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npm run build 2>&1 | tail -30
```
Expected: build succeeds.

### Task F2: Migration list sanity

```sql
SELECT version FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260417%'
ORDER BY version;
```
Expected: all new `05`, `06`, `07`, `08`, `09`, `10` migrations show up plus the pre-existing `01`–`04`.

### Task F3: Post-run audit

Re-run the three critical verification SQL checks:
```sql
-- 1. Survey uniqueness
SELECT indexname FROM pg_indexes WHERE tablename='survey_responses' AND indexname LIKE 'uniq_%';
-- expected: 2 rows

-- 2. Cycle dedup flag
SELECT column_name FROM information_schema.columns
WHERE table_name='performance_cycles' AND column_name='completion_notified_at';
-- expected: 1 row

-- 3. Goals uniqueness
SELECT indexname FROM pg_indexes WHERE tablename='goals' AND indexname='uniq_goal_per_cycle_employee_title';
-- expected: 1 row
```

---

## Execution order and checkpoints

1. **Phase A (A1, A2, A3)** — ship together; these are the only ship-blockers.
   - Stop after Phase A and run a sanity check. Show the user the 3 critical smoke-test results. Confirm before moving on.
2. **Phase B (B1, B2, B3)** — ship together; UX + reliability.
3. **Phase C (C1, C2, C3)** — ship together; structural hardening.

Each phase leaves the app strictly more robust than before — partial execution is safe to stop at any phase boundary.
