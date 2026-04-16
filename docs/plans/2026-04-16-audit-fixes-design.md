# Audit Fixes — Phased Design

**Date:** 2026-04-16
**Status:** Design approved. Phase 1 ready for implementation.
**Scope:** Fix findings from the comprehensive in-app audit (2026-04-16). Stripe/billing fixes deferred per product.

---

## Guiding principles

- **Risk reduction per unit of effort.** Earlier phases close higher-impact bugs first.
- **One PR per phase, where feasible.** Each phase is designed to be independently shippable and independently revertible.
- **Migrations are always reversible.** Every schema change ships with a tested down-migration.
- **Verification before claiming done.** Each fix lists the verification step that must pass.
- **No new features.** This plan is exclusively remediation; feature work happens outside it.

## Phase map

| # | Phase | Core concern | Depends on |
|---|---|---|---|
| 1 | Critical integrity & security | Stop data corruption and close exploitable holes in the review pipeline | — |
| 2 | Remaining security, privacy, auth | Post-hoc workspace checks, localStorage scoping, private-feedback policy, auth hardening | 1 |
| 3 | Governance & data-model correctness | Score descriptor editor, rating-scale versioning, goal audit trail, soft-deletes | 1 |
| 4 | Scale & performance | Analytics aggregation, export streaming, calibration batch, Supabase advisor cleanup | — (parallel to 2/3) |
| 5 | Slack integration completeness | Scope validation, web→Slack sync, deactivation, home-tab refresh, rating-scale DM fix | 3 |
| 6 | UIUX polish & code hygiene | Survey builder, manager dashboard, confirmation modals, env validation, `any` cleanup | — |

**Explicitly out of scope:** Stripe webhook handler, landing-page polish, any new feature work.

---

# Phase 1 — Critical integrity & security

**Goal:** stop every known data-corruption path and close the exploitable holes in the review pipeline. One PR.

## 1.1 Cycle launch race → RPC + unique index

**Problem:** [src/app/dashboard/cycles/[id]/cycle-actions.tsx:193-207](../../src/app/dashboard/cycles/[id]/cycle-actions.tsx) deletes all `review_assignments` then inserts the new set. Two admins launching within milliseconds = duplicate assignments. No unique constraint catches it.

**Fix:**
1. **Migration** `2026-04-16_01_cycle_launch_rpc.sql`:
   - Dedupe existing rows (keep earliest `created_at` per tuple).
   - `CREATE UNIQUE INDEX uniq_review_assignment ON review_assignments (cycle_id, employee_id, reviewer_id, assignment_type);`
   - Create RPC `launch_cycle(p_cycle_id uuid, p_assignments jsonb)`:
     - `SECURITY DEFINER`, grantable to `authenticated`.
     - Acquires `pg_advisory_xact_lock(hashtext(p_cycle_id::text))` for the transaction.
     - Deletes existing assignments for the cycle, inserts from `p_assignments` with `ON CONFLICT DO NOTHING`, flips `performance_cycles.status = 'active'` and sets `launched_at`.
     - Wrapped `GRANT EXECUTE` to `authenticated` role.
     - Internal permission check: only workspace admins/HR of the cycle's workspace can launch.

2. **Client** [cycle-actions.tsx:193-207](../../src/app/dashboard/cycles/[id]/cycle-actions.tsx): replace raw delete+insert with `supabase.rpc('launch_cycle', { p_cycle_id, p_assignments })`. Preserve Nami notification trigger downstream.

**Verification:**
- Integration test: spawn two concurrent `rpc('launch_cycle')` calls via `Promise.all` on a 10-employee draft cycle. Assert `review_assignments` count == 10.
- Manual: launch → verify cycle active; launch again (if feature flag allows re-launch) → verify no duplicates.

**Rollback:** down migration drops RPC and unique index; dedupe is non-reversible (that's fine — dupes were bugs).

---

## 1.2 Calibration stale chart → remove no-op Proxy

**Problem:** [src/app/dashboard/cycles/[id]/calibration/calibration-client.tsx:392-395](../../src/app/dashboard/cycles/[id]/calibration/calibration-client.tsx) wraps `supabase` in `new Proxy(supabase, {})` — the empty handler proxies nothing. `liveGrades` never syncs, so the distribution chart stays at initial state while row cells update.

**Fix:**
1. Delete the Proxy wrapper and any code paths that used it.
2. Promote `liveGrades` state ownership into the calibration client. Shape: `Record<assignmentId, grade | null>`, seeded from SSR.
3. `handleGradeChange(assignmentId, newGrade)`:
   - **Optimistic:** `setLiveGrades(prev => ({ ...prev, [assignmentId]: newGrade }))`.
   - Call `supabase.from('review_assignments').update({ final_grade, calibrated_by, calibrated_at }).eq('id', assignmentId)`.
   - **On error:** restore previous value, surface a row-level toast.
4. Distribution chart component consumes `liveGrades` via prop drilling (already the case for row cells).

**Verification:**
- Manual: change 3 grades quickly — confirm the histogram on the right updates live without reload.
- Manual: temporarily kill network mid-change — row reverts, toast appears.

**Rollback:** trivial — git revert.

---

## 1.3 CSV formula injection → shared `csvEscape` util

**Problem:** All four export routes (analytics, reviews, goals, surveys/[id]) emit raw values. A goal titled `=HYPERLINK("http://evil", "click")` becomes a phishing payload on open in Excel/Google Sheets.

**Fix:**
1. New `src/lib/csv.ts`:
   ```ts
   const DANGEROUS_LEADING = /^[=+\-@\t\r]/;
   export function csvEscape(value: unknown): string {
     if (value === null || value === undefined) return "";
     let s = String(value);
     if (DANGEROUS_LEADING.test(s)) s = "'" + s;
     if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
     return s;
   }
   export function csvRow(values: unknown[]): string {
     return values.map(csvEscape).join(",");
   }
   export function csvFile(header: string[], rows: unknown[][]): string {
     return [csvRow(header), ...rows.map(csvRow)].join("\n");
   }
   ```
2. Replace ad-hoc string concatenation in:
   - [src/app/api/analytics/export/route.ts](../../src/app/api/analytics/export/route.ts)
   - [src/app/api/reviews/export/route.ts](../../src/app/api/reviews/export/route.ts)
   - [src/app/api/goals/export/route.ts](../../src/app/api/goals/export/route.ts)
   - [src/app/api/surveys/[id]/export/route.ts](../../src/app/api/surveys/[id]/export/route.ts)

**Verification:**
- Vitest unit coverage of `csvEscape`: `=1+1`, `@func()`, `+cmd`, `-formula`, `\tTab`, embedded quotes, commas, newlines, null, undefined, numeric, boolean.
- Manual: export a goal titled `=HYPERLINK("x","y")` → open CSV in Excel → confirm literal string, no execution.

**Rollback:** revert commit; no migration.

---

## 1.4 Roadmap RLS → scope to `auth.uid()`

**Problem:** Supabase advisor flagged three policies using `(true)`:
- `roadmap_suggestions` INSERT — anon can spam suggestions.
- `roadmap_votes` INSERT — anon can stuff votes.
- `roadmap_votes` DELETE — anyone can delete others' votes.

**Fix:**
1. **Migration** `2026-04-16_02_roadmap_rls.sql`:
   ```sql
   DROP POLICY IF EXISTS "Public insert roadmap_suggestions" ON roadmap_suggestions;
   DROP POLICY IF EXISTS "Public insert roadmap_votes" ON roadmap_votes;
   DROP POLICY IF EXISTS "Public delete own roadmap_votes" ON roadmap_votes;

   CREATE POLICY "authed_insert_suggestions" ON roadmap_suggestions
     FOR INSERT TO authenticated
     WITH CHECK (user_id = (SELECT auth.uid()));

   CREATE POLICY "authed_insert_own_votes" ON roadmap_votes
     FOR INSERT TO authenticated
     WITH CHECK (user_id = (SELECT auth.uid()));

   CREATE POLICY "delete_own_votes" ON roadmap_votes
     FOR DELETE TO authenticated
     USING (user_id = (SELECT auth.uid()));

   CREATE UNIQUE INDEX IF NOT EXISTS uniq_vote_per_user
     ON roadmap_votes (user_id, suggestion_id);
   ```
2. Client already passes `user_id` from session; no client change unless roadmap UI currently supports anonymous voting (check `src/app/roadmap/`).

**Verification:**
- Anon-key curl `POST /rest/v1/roadmap_votes` → expect `42501`.
- Authed user: vote once OK, vote again on same suggestion → `23505` surfaced gracefully.
- Authed user A cannot delete user B's vote.

**Rollback:** down migration restores prior policies. Note: this will re-open the hole, so only roll back if something critical breaks.

---

## 1.5 Reviewer role enforcement → RLS `WITH CHECK`

**Problem:** [src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx:382-388](../../src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx) derives `reviewer_role` in JS and inserts at :454. A peer can patch `currentUser.id` in devtools and submit as `'manager'`. Grade aggregation then credits a peer rating as a manager rating.

**Fix:**
1. **Migration** `2026-04-16_03_reviewer_role_check.sql`:
   ```sql
   DROP POLICY IF EXISTS "reviewer_insert_response" ON review_responses;

   CREATE POLICY "reviewer_role_matches_relationship" ON review_responses
     FOR INSERT TO authenticated
     WITH CHECK (
       EXISTS (
         SELECT 1
         FROM review_assignments a
         JOIN users u ON u.auth_user_id = (SELECT auth.uid())
         WHERE a.id = review_responses.assignment_id
           AND review_responses.reviewer_id = u.id
           AND (
             (review_responses.reviewer_role = 'self'
               AND a.employee_id = u.id) OR
             (review_responses.reviewer_role = 'manager'
               AND a.manager_id  = u.id) OR
             (review_responses.reviewer_role = 'upward'
               AND a.reviewer_id = u.id AND a.assignment_type = 'upward') OR
             (review_responses.reviewer_role = 'peer'
               AND a.reviewer_id = u.id AND a.assignment_type = 'standard'
               AND a.employee_id <> u.id AND COALESCE(a.manager_id,'00000000-0000-0000-0000-000000000000'::uuid) <> u.id)
           )
       )
     );
   ```
2. **Client:** no functional change; `getReviewerRole()` in [page.tsx:382](../../src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx) still picks the role — the DB now enforces correctness. Add catch for `42501` → show "You are not authorized to submit this review as this role."

**Verification:**
- Integration test: impersonate a peer, attempt `INSERT reviewer_role = 'manager'` → assert `42501`.
- Manual: open review as manager → submits fine. Open same assignment URL as another user with no relationship → denied.

**Rollback:** down migration removes new policy. Re-exposes the hole, so only roll back under serious incident.

---

## 1.6 Review submit idempotency → unique index + conflict handling

**Problem:** No unique constraint on `(assignment_id, reviewer_id, reviewer_role)`. Network retry = duplicate responses = double-counted in calibration and analytics.

**Fix:**
1. **Migration** `2026-04-16_04_review_response_unique.sql`:
   ```sql
   WITH dupes AS (
     SELECT assignment_id, reviewer_id, reviewer_role,
            array_agg(id ORDER BY submitted_at NULLS LAST, created_at) AS ids
     FROM review_responses
     GROUP BY 1,2,3 HAVING COUNT(*) > 1
   )
   DELETE FROM review_responses
   WHERE id IN (SELECT unnest(ids[2:]) FROM dupes);

   CREATE UNIQUE INDEX uniq_review_response
     ON review_responses (assignment_id, reviewer_id, reviewer_role);
   ```
2. **Client** [page.tsx:454](../../src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx): wrap the insert in a try/catch. On `23505`, clear the localStorage draft and redirect to success with a toast "Your review was already submitted."

**Verification:**
- Integration test: double-submit same response via Supabase client → one row, second throws 23505, client handles gracefully.
- Manual: submit → throttle network → click submit again → verify one row + clean redirect.

**Rollback:** down migration drops the unique index. Re-dedupe is not required since we keep the earliest in step 1.

---

## Phase 1 deliverables

- 4 migrations (01 cycle launch, 02 roadmap RLS, 03 reviewer role, 04 review uniqueness).
- 2 client file changes (`cycle-actions.tsx`, review `page.tsx`).
- 1 new file (`src/lib/csv.ts`) + 4 export routes updated.
- 1 calibration client file change (`calibration-client.tsx`).
- Vitest suites for `csv.ts` and reviewer-role enforcement.
- Manual test checklist (8 scenarios).

Exit criteria: all migrations applied on a dev Supabase branch; all tests green; ESLint clean on touched files; staging smoke test of full cycle launch → review → calibrate flow passes.

---

# Phase 2 — Remaining security, privacy, auth

**Goal:** close the non-critical-but-still-exploitable gaps. One PR.

## 2.1 Workspace check → push into RLS
**Problem:** [review/[assignmentId]/page.tsx:91-124](../../src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx) loads the assignment first, then compares workspaces in JS. Cross-workspace data briefly materializes in React state.
**Fix:** Ensure `review_assignments` SELECT policy filters by `workspace_id = (SELECT workspace_id FROM users WHERE auth_user_id = auth.uid())`. Audit every page that loads by id: cycles/[id], reviews/[id], goals/[id], templates/[id], team/[id]. Drop client-side workspace checks that become redundant.
**Verification:** with a crafted URL for another workspace's assignment, expect `PGRST116` (no rows), not a rendered form.

## 2.2 localStorage drafts → scope by user + clear on logout
**Problem:** `review-draft-${assignmentId}` is cross-user on shared devices.
**Fix:**
- Key becomes `review-draft-${assignmentId}-${currentUser.id}`.
- On successful submit: `localStorage.removeItem(...)`.
- On Supabase `SIGNED_OUT` event: iterate `localStorage` and drop any `review-draft-*` keys.
- Same treatment for any other `-draft-` keys found across the app (grep for `localStorage.setItem`).
**Verification:** user A writes a draft, logs out, user B logs in, opens same URL → blank form.

## 2.3 Private feedback policy — decide semantics, then enforce
**Problem:** [feedback/page.tsx:96-104](../../src/app/dashboard/feedback/page.tsx) shows all direct-reports' feedback to their manager regardless of `shared_with_employee = false`.
**Fix (requires product call):**
- **Option A (strictest):** filter `shared_with_employee = true OR sender_id = currentUser.id` for manager-of queries. Private feedback is truly private.
- **Option B (status quo, clearly labeled):** keep the data, add a visible `Lock` badge on each row whose `shared_with_employee = false`, plus a help-text explaining "Managers see all feedback for their direct reports; the shared flag only controls whether the recipient sees it."
- Either choice needs a matching RLS update so the DB policy agrees with the UI.
**Verification:** for option A, manager queries return only shared rows; for option B, badges render on every private row with correct count.

## 2.4 Supabase Auth: enable leaked-password protection
**Problem:** Advisor flagged `auth_leaked_password_protection` disabled.
**Fix:** Dashboard toggle (no migration). Document in `docs/operations/supabase-auth-settings.md`.
**Verification:** signup with a known-pwned password (`password123`) → rejected by Supabase.

## 2.5 Collapse overlapping permissive RLS policies
**Problem:** Advisor flagged multiple permissive policies on `cycle_questions`, `departments`, `feedback_form_configs`, `review_assignments`, `surveys`, `users`. Each query runs every policy.
**Fix:** For each table, combine the overlapping policies into one OR'd policy per `(role, action)` pair. Preserves semantics, cuts per-row overhead.
**Verification:** advisor re-run shows zero `multiple_permissive_policies` warnings.

## 2.6 Phase lock on review submit
**Problem:** [review/[assignmentId]/page.tsx:127-133](../../src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx) only checks cycle status, not phase.
**Fix:** Before insert, fetch `cycle_phases` for the current cycle, find the one matching the reviewer role's expected phase (`self_assessment`, `peer_review`, `manager_review`), and verify `status = 'active'`. If not, block submit with a clear message. Also enforce in the RLS policy from 1.5 by joining to `cycle_phases`.
**Verification:** admin closes the peer-review phase mid-form → next submit attempt fails cleanly.

## Phase 2 deliverables
5 migrations or policy edits + 2-3 client changes. Small but high-confidence win on the security posture.

---

# Phase 3 — Governance & data-model correctness

**Goal:** make the system usable by a real customer doing real reviews, where compliance and retention matter. One PR, possibly split into 3a (DB + backend) and 3b (UI).

## 3.1 Score descriptor editor
**Problem:** `competency_score_descriptors` has schema but no HR-facing editor. The table stays empty; review forms show blank behavioral text. This is the single biggest "feature" gap.
**Fix:**
- New route `src/app/dashboard/competencies/[id]/descriptors/page.tsx` + client component.
- Table: rows = score values (1..max_scale), columns = editable textarea for descriptor text.
- Save via upsert on `(competency_id, score_value)` tuple.
- Link from each competency detail page.
- Permission: HR+ only.
**Verification:** edit descriptors for a competency; open a review form for that competency; verify text renders in the behaviors panel.

## 3.2 Rating scale versioning
**Problem:** changing `workspace.rating_scale` retroactively relabels historical reviews.
**Fix:**
- Migration: new table `rating_scales (id, workspace_id, min, max, labels jsonb, created_at, archived_at)`.
- Add `rating_scale_id` FK on `performance_cycles` (nullable for now) and stamp on cycle launch (Phase 1's `launch_cycle` RPC gains one line).
- Analytics / heatmap / review form all read the scale via the cycle's `rating_scale_id` rather than live workspace state.
- Settings UI: changing scale creates a new `rating_scales` row, sets it as the workspace's `active_rating_scale_id`. Old rows remain for historical cycles.
**Verification:** launch a cycle with scale 1-5, change workspace scale to 1-7, open the old cycle's analytics → still shows 1-5 labels.

## 3.3 Goal progress audit trail
**Problem:** [goals-client.tsx:644-649](../../src/app/dashboard/goals/goals-client.tsx) edits `metric_current` with no history.
**Fix:**
- Migration: new table `goal_progress_events (id, goal_id, actor_user_id, old_current, new_current, old_status, new_status, note, created_at)`.
- DB trigger on `goals` UPDATE populates the table when `metric_current` or `status` changes.
- Goal detail page gets a "History" section showing the timeline.
**Verification:** edit progress 3 times; open goal detail → see three entries with timestamps and actor names.

## 3.4 Admin hard-deletes → soft-deletes
**Problem:** deleting a `level`, `department`, `job_family`, or `function` orphans referencing users/competencies silently.
**Fix:**
- Add `archived_at timestamptz` to each of: `levels`, `departments`, `job_families`, `functions`.
- Delete UI becomes "Archive" — sets `archived_at = now()`, excludes from lists by default, shows an "Archived" filter tab.
- List queries add `WHERE archived_at IS NULL` by default.
- Hard-delete remains available as a destructive "Remove permanently" action, but gated by a dependency check (refuse if any row in `users`/`competencies`/etc. still points to this row).
**Verification:** archive a level with users → users retain the reference, list excludes it; try hard-delete same level → blocked with clear message listing dependents.

## 3.5 Audit log for sensitive actions
**Problem:** no audit trail for grade release, calibration overrides, role changes.
**Fix:**
- Migration: `audit_log (id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata jsonb, created_at)`.
- Write log rows from: grade release flow (cycle-actions.tsx), calibration grade save, user role change (admin/team/[id]/edit).
- Admin-only route `src/app/dashboard/admin/audit/page.tsx` displays a filterable timeline.
**Verification:** release grades on a cycle, change a user's role, edit a calibration grade → all three events appear in the audit log.

## Phase 3 deliverables
4 migrations, 1 DB trigger, 1 new config route, 2 new list pages (audit log, archived items), modifications to 5-6 existing pages.

---

# Phase 4 — Scale & performance

**Goal:** hold up at 500+ users. Can run parallel to Phases 2-3. One PR.

## 4.1 Analytics pre-aggregation
**Problem:** [analytics/page.tsx:104-177](../../src/app/dashboard/analytics/page.tsx) pulls unbounded rows.
**Fix:**
- SQL views: `v_analytics_heatmap`, `v_analytics_rating_distribution`, `v_analytics_completion` — all `GROUP BY` workspace_id + filter dims. Define as `SECURITY INVOKER` so RLS applies.
- Page switches to `select()` from the views with `.eq('workspace_id', ...)` and filter predicates.
- Keep the ability to fall back to raw rows for the "drill-down" case.
**Verification:** bench with a seeded 500-user / 3-cycle workspace; heatmap renders in <300ms.

## 4.2 Export route streaming
**Problem:** 100k-row exports OOM.
**Fix:** rewrite exports as `ReadableStream`-backed Response bodies. Enqueue header, then cursor through rows with `.range()` iteration, encode to CSV per-row, enqueue and flush.
**Verification:** generate 50k test rows, export, monitor memory — steady-state <100MB.

## 4.3 Calibration UX for scale
**Problem:** per-row saves, no keyboard nav, 50-way horizontal scroll.
**Fix:**
- Batch save: queue changes in local state, show an unobtrusive "Save all (N)" button; POST as an RPC `update_calibration_grades(jsonb)` that applies in one transaction.
- Optimistic UI with rollback on error.
- Keyboard: arrow up/down to move row, `1..5` to pick grade, Enter to save.
- Pagination: 20 rows per page with "assign all visible to X" bulk action.
- Replace `title=` tooltips on competency bars with accessible popovers.
**Verification:** calibrate 50 employees in one session; a11y audit passes basic keyboard navigation.

## 4.4 Competency matrix memoization
**Problem:** 400+ `EditableCell`s re-render on every edit.
**Fix:** wrap `EditableCell` in `React.memo` with `(prev, next) => prev.value === next.value && prev.rowId === next.rowId && prev.colId === next.colId`.
**Verification:** React Profiler shows single-cell commits on edit, not whole-table.

## 4.5 CSV import chunking + resumability
**Problem:** single invoke for 500+ rows can timeout.
**Fix:**
- Client splits into 50-row chunks, POSTs sequentially, shows progress.
- Server stores `import_jobs (id, workspace_id, total, done, status, error_rows jsonb)`; client polls.
- Manager resolution: first pass creates all users with null manager_id, second pass updates manager_id once all emails are known.
**Verification:** import a 500-row CSV with circular manager refs; completion in <2 minutes; retry after network interruption continues from last committed chunk.

## 4.6 Supabase advisor cleanup
- Wrap `auth.<fn>()` → `(SELECT auth.<fn>())` on all `competency_score_descriptors` policies (3 policies).
- Add indexes on `survey_participants.workspace_id`, `survey_responses.workspace_id`.
- Drop 19 unused indexes after confirming with `pg_stat_user_indexes.idx_scan = 0` for 30 days.
- Switch Auth DB connection strategy to percentage-based.
**Verification:** re-run advisor — all `auth_rls_initplan`, `unindexed_foreign_keys`, `unused_index`, `auth_db_connections_absolute` cleared.

## Phase 4 deliverables
3-4 migrations, 1 RPC, 1 new streaming API route pattern, 2 client UX rewrites (calibration, CSV import). The heaviest phase; ship in isolation.

---

# Phase 5 — Slack integration completeness

**Goal:** deliver on the "native Slack" selling point. Depends on Phase 3 (rating scale versioning).

## 5.1 Rating scale in Slack DMs
**Fix:** [supabase/functions/nami-bot/index.ts:1317](../../supabase/functions/nami-bot/index.ts) reads `ratingMax` from the cycle's `rating_scale_id` (Phase 3.2 made this possible).

## 5.2 OAuth scope validation on install
**Fix:** [slack-oauth/index.ts:140](../../supabase/functions/slack-oauth/index.ts) compares `tokenData.scope` against a required-scopes list. On mismatch, show an install-error page with clear remediation.

## 5.3 Web-originated feedback → Slack DM trigger
**Fix:** Postgres trigger on `continuous_feedback` INSERT → `NOTIFY` a listening edge function (or direct `pg_net` call to the `nami-bot` function) → bot sends DM.

## 5.4 Post-launch reviewer notification
**Fix:** When a reviewer is added to an already-active cycle (admin edits participants), fire the Nami notification path for the newly-added rows only. Gate on `review_assignments.notified_at IS NULL`.

## 5.5 Deactivation handling
**Fix:** On Slack `team_leave`, soft-close (`status = 'cancelled'` + a `cancellation_reason`) any open `review_assignments` involving the user. DM the manager with a summary of what was closed.

## 5.6 Home tab refresh on goal/review changes
**Fix:** After `continuous_feedback`, `goals`, or `review_assignments` writes, trigger `views.publish` for affected users via the bot's app-home path. Dedup with a short-lived in-memory cache to avoid hammering.

## 5.7 Bulk send retry queue
**Fix:** `pg_cron`-driven retry worker processing a `slack_send_queue` table. Exponential backoff. Replaces the current "fail-and-rollback" behavior for cycle launches on large orgs.

## 5.8 Conversation state TTL
**Fix:** Add `expires_at` column; cron job expires rows older than 7 days; resume flow checks expiry.

## 5.9 Slack→dashboard magic-link auth
**Fix:** new edge function `dashboard-link` issues a short-lived (2 min) signed token bound to `user_id + target_path`. All Slack-embedded links include `?t=<token>`; `/api/auth/slack-link` consumes it and sets a session.

## 5.10 Rate-limit retry cap + error messaging
**Fix:** remove the 30s cap at [slack-api.ts:28-34](../../supabase/functions/_shared/slack-api.ts); honor `Retry-After` up to 120s. Improve modal error copy to disambiguate token/permission/server issues.

## Phase 5 deliverables
Slack-side is largely backend; client changes are minor. Each sub-item is independently revertible. Ship as one batch PR but stage rollouts: 5.1-5.5 (correctness) → 5.6-5.10 (quality).

---

# Phase 6 — UIUX polish & code hygiene

**Goal:** clean up the remaining rough edges. One PR per subsection.

## 6.1 Survey builder responsive
- [surveys/new/page.tsx:807](../../src/app/dashboard/surveys/new/page.tsx): `hidden lg:block` → `hidden md:block` on the guidance panel.
- Add field-level validation (per-question error state, not just a generic banner).
- Responsive input padding and font sizing below `md:`.

## 6.2 Manager dashboard column ratio
- [dashboard/page.tsx:422-632](../../src/app/dashboard/page.tsx): swap so pending-reviews list gets the 2/3 column, stats sidebar gets 1/3.
- Add skeleton loaders per card so slow queries don't blank the page.
- Replace dot-progress bar in onboarding with a single horizontal progress bar.

## 6.3 Confirmation modals for destructive-ish actions
- Review submit gains a "confirm & submit" modal showing the filled ratings summary.
- Archive actions in Phase 3.4 also get confirms.

## 6.4 Consistency sweep
- One canonical link-button pattern: use `<Button variant="link">` everywhere, remove ad-hoc `<a className="text-xs text-primary...">` anchors.
- Card padding token in Tailwind config; apply across dashboard.
- Icon-only buttons gain `aria-label` (grep `<Link><Icon /></Link>` and `<Button>[icon]</Button>`).
- Setup progress: use checkmark in all three circles' completed state, step number only for pending.
- Sidebar active state: match on `pathname.startsWith('/dashboard/settings')` pattern.

## 6.5 Employee dashboard empty state
- For users with no reports and no active assignments: show a card with CTA buttons to write kudos, update a goal, view own profile.

## 6.6 Error boundaries
- Wrap each dashboard widget in a reusable `<ErrorBoundary>` that falls back to a small "this widget failed" card without crashing the page.

## 6.7 Env validation
- New `src/lib/env.ts` using Zod. Validate on module load. Export typed `env` object.
- Replace all `process.env.X!` with `env.X`.

## 6.8 Type any cleanup (triage)
- Priority 1: `supabase/functions/slack-interactivity/index.ts` (80+ any)
- Priority 2: `src/app/dashboard/analytics/page.tsx` (64 any)
- Priority 3: `src/app/dashboard/competencies/competencies-client.tsx` (48 any)
- Use Supabase `generate_typescript_types` + hand-refine.

## 6.9 Remove console.log debug output
- 44 files. Replace with a thin logger that noop's in production.

## 6.10 Delete stray parent lockfile
- `rm /Users/filipnowakowski/package-lock.json` (confirm with user first — not ours to delete unilaterally).

## Phase 6 deliverables
Spread across ~15 small commits, bundleable into 2-3 PRs by theme. Lowest risk phase.

---

# Appendix A — Tracking table

| Phase | Item | Effort | Reversible | Owner | Status |
|---|---|---|---|---|---|
| 1 | Cycle launch RPC + unique idx | M | ✓ | — | Designed |
| 1 | Calibration Proxy fix | S | ✓ | — | Designed |
| 1 | CSV escape util + 4 routes | S | ✓ | — | Designed |
| 1 | Roadmap RLS tightening | S | ✓ | — | Designed |
| 1 | Reviewer role RLS | M | ✓ | — | Designed |
| 1 | Review response unique idx | S | ✓ | — | Designed |
| 2 | Workspace check → RLS | M | ✓ | — | Designed |
| 2 | localStorage scoping | S | ✓ | — | Designed |
| 2 | Private feedback policy | S | ✓ | — | Needs product call |
| 2 | Leaked-password toggle | XS | ✓ | — | Designed |
| 2 | Permissive-policy consolidation | M | ✓ | — | Designed |
| 2 | Phase lock on submit | S | ✓ | — | Designed |
| 3 | Score descriptor editor | M | ✓ | — | Designed |
| 3 | Rating scale versioning | L | ✓ | — | Designed |
| 3 | Goal audit trail | M | ✓ | — | Designed |
| 3 | Soft-deletes on admin entities | M | ✓ | — | Designed |
| 3 | Audit log table + page | M | ✓ | — | Designed |
| 4 | Analytics SQL views | M | ✓ | — | Designed |
| 4 | Export streaming | M | ✓ | — | Designed |
| 4 | Calibration batch + kbd | L | ✓ | — | Designed |
| 4 | Matrix memoization | S | ✓ | — | Designed |
| 4 | CSV import chunking | L | ✓ | — | Designed |
| 4 | Advisor cleanup | S | ✓ | — | Designed |
| 5 | Rating scale in Slack DMs | S | ✓ | — | Blocked on 3.2 |
| 5 | OAuth scope validation | S | ✓ | — | Designed |
| 5 | Web feedback→Slack trigger | M | ✓ | — | Designed |
| 5 | Post-launch notifications | S | ✓ | — | Designed |
| 5 | Deactivation handling | M | ✓ | — | Designed |
| 5 | Home tab refresh | M | ✓ | — | Designed |
| 5 | Bulk send retry queue | L | ✓ | — | Designed |
| 5 | Conversation state TTL | S | ✓ | — | Designed |
| 5 | Slack→dashboard magic link | M | ✓ | — | Designed |
| 5 | Rate-limit + error msgs | S | ✓ | — | Designed |
| 6 | Survey builder responsive | S | ✓ | — | Designed |
| 6 | Manager dashboard ratio | S | ✓ | — | Designed |
| 6 | Submit confirmation modals | S | ✓ | — | Designed |
| 6 | Consistency sweep | M | ✓ | — | Designed |
| 6 | Employee empty state | S | ✓ | — | Designed |
| 6 | Error boundaries | S | ✓ | — | Designed |
| 6 | Env validation (Zod) | S | ✓ | — | Designed |
| 6 | `any` cleanup (3 hotspots) | L | ✓ | — | Designed |
| 6 | Console.log strip | S | ✓ | — | Designed |
| 6 | Delete stray lockfile | XS | ✓ | — | Needs confirm |

Sizing: XS <1h, S 1-4h, M 1-2 days, L 2-5 days of focused work.

---

# Appendix B — Explicitly excluded

- **Stripe webhook / billing** — deferred. Note: per-seat billing does not work until this ships.
- **Landing page UX** — audit scope limited to in-app surface.
- **Net-new features** — this plan is remediation only.

---

# Next step

Execute Phase 1. An implementation plan with file-level task breakdown will be produced via the `writing-plans` skill immediately following approval of this design.
