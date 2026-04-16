# Audit Fixes — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the six critical integrity and security gaps in the review pipeline identified by the 2026-04-16 audit: cycle-launch race, calibration stale chart, CSV formula injection, overly-permissive roadmap RLS, client-trusted reviewer role, and non-idempotent review submission.

**Architecture:** All fixes ship in one PR (`phase-1-critical-fixes`). DB work lands as four numbered migrations in `supabase/migrations/` applied via the Supabase MCP to a preview branch first, then merged. Client work is colocated per feature. A new shared CSV-escape utility replaces four copies of ad-hoc escape code.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Supabase (Postgres + RLS) / Vitest / Supabase MCP for migrations.

**Design reference:** [docs/plans/2026-04-16-audit-fixes-design.md](./2026-04-16-audit-fixes-design.md), Phase 1.

**Execution order rationale:** Start with pure-code work that carries no migration risk (CSV escape, calibration Proxy). Then land migrations in dependency order, each followed by the client change that relies on it. End with the most complex piece (cycle-launch RPC).

---

## Pre-flight

### Task 0: Create Supabase development branch

**Files:**
- None (infrastructure)

**Step 1: List existing branches**

Run via Supabase MCP: `mcp__supabase__list_branches`.
Expected: zero or more branches listed, none named `phase-1-critical-fixes`.

**Step 2: Create the branch**

Run via Supabase MCP: `mcp__supabase__create_branch` with `name: "phase-1-critical-fixes"`.
Expected: branch created, a new `project_ref` returned. **Record this ref — subsequent migration calls target it.**

**Step 3: Verify**

Run: `mcp__supabase__list_branches`. Confirm the branch is listed with status `ACTIVE_HEALTHY`.

**Step 4: Capture the ref**

Record the branch `project_ref` in a scratch file at `/tmp/phase-1-branch-ref.txt` for re-use across tasks.

**No commit.** Infrastructure only.

---

## 1.3 — CSV formula-injection sanitizer

Done first because it's pure TypeScript with zero DB dependency and has the widest blast radius (touches 4 files). Good warm-up.

### Task 1: Write failing tests for `csvEscape`

**Files:**
- Create: `src/lib/csv.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { csvEscape, csvRow, csvFile } from "./csv";

describe("csvEscape", () => {
  it("prefixes single-quote on formula-leading characters", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("+cmd|'/c calc'")).toBe('"\'+cmd|\'\'/c calc\'\'"');
    expect(csvEscape("-2+3")).toBe("'-2+3");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvEscape("\tTab")).toBe("'\tTab");
    expect(csvEscape("\rCR")).toBe("'\rCR");
  });

  it("double-quotes cells containing quote, comma, or newline", () => {
    expect(csvEscape('has "quote"')).toBe('"has ""quote"""');
    expect(csvEscape("has,comma")).toBe('"has,comma"');
    expect(csvEscape("has\nnewline")).toBe('"has\nnewline"');
  });

  it("leaves normal cells untouched", () => {
    expect(csvEscape("plain text")).toBe("plain text");
    expect(csvEscape("123")).toBe("123");
    expect(csvEscape("")).toBe("");
  });

  it("renders null and undefined as empty string", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("coerces numbers and booleans", () => {
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(true)).toBe("true");
  });
});

describe("csvRow + csvFile", () => {
  it("joins values with commas", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("writes header + rows joined by newlines", () => {
    const out = csvFile(["name", "amount"], [["alice", "=evil"], ["bob,jr", 42]]);
    expect(out).toBe("name,amount\nalice,'=evil\n\"bob,jr\",42");
  });
});
```

**Step 2: Run test — expect fail**

Run: `npm test -- src/lib/csv.test.ts --run`
Expected: `Error: Cannot find module './csv'` or equivalent.

### Task 2: Implement `csvEscape`

**Files:**
- Create: `src/lib/csv.ts`

**Step 1: Write the implementation**

```ts
const DANGEROUS_LEADING = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\n\r]/;

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  if (DANGEROUS_LEADING.test(s)) s = "'" + s;
  if (NEEDS_QUOTING.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

export function csvFile(header: string[], rows: unknown[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\n");
}
```

**Step 2: Run tests**

Run: `npm test -- src/lib/csv.test.ts --run`
Expected: all 6 tests PASS.

**Step 3: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts
git commit -m "feat(security): add csv-escape utility to prevent formula injection

Centralizes CSV cell escaping with guards against =, +, -, @, tab, and CR
leading characters that trigger formula execution in Excel / Google Sheets."
```

### Task 3: Apply `csvEscape` to goals export

**Files:**
- Modify: `src/app/api/goals/export/route.ts`

**Step 1: Replace the ad-hoc escape block**

At the top of the file, add:
```ts
import { csvFile } from "@/lib/csv";
```

Delete lines 56-63 (the `.map(...)` / `.map(...)` CSV build) and the declaration of `rows: string[][]`. Replace the whole `const csv = ...` block with:

```ts
const csv = csvFile(header, (goals || []).map((g) => {
  const emp = g.employee as any;
  const cycle = g.cycle as any;
  return [
    g.title,
    emp?.slack_name,
    emp?.department,
    cycle?.name,
    g.scope,
    g.status,
    g.tracking_status,
    g.progress,
    g.metric_start,
    g.metric_current,
    g.metric_target,
    g.metric_unit,
    g.weight,
    g.due_date,
    g.created_at ? new Date(g.created_at).toISOString().split("T")[0] : "",
  ];
}));
```

Remove the `header` push from `rows[]` and the separate `rows` initialization.

**Step 2: Verify file still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 3: Verify route works manually**

Start dev: `npm run dev` (use preview MCP, already running). Hit `/api/goals/export` as an authenticated HR user on a seeded workspace. Expected: CSV downloads. Open in a text editor; confirm a goal titled starting with `=` has a leading `'`.

**Step 4: Commit**

```bash
git add src/app/api/goals/export/route.ts
git commit -m "fix(security): escape goals export CSV via csvFile util"
```

### Task 4: Apply `csvEscape` to reviews export

**Files:**
- Modify: `src/app/api/reviews/export/route.ts`

Same pattern as Task 3. Read the file first. Replace the ad-hoc escape logic with `csvFile(header, rowArrays)`.

**Step 1-3:** mirror Task 3.

**Step 4: Commit**

```bash
git add src/app/api/reviews/export/route.ts
git commit -m "fix(security): escape reviews export CSV via csvFile util"
```

### Task 5: Apply `csvEscape` to analytics export

**Files:**
- Modify: `src/app/api/analytics/export/route.ts`

Same pattern. Commit:

```bash
git add src/app/api/analytics/export/route.ts
git commit -m "fix(security): escape analytics export CSV via csvFile util"
```

### Task 6: Apply `csvEscape` to surveys export

**Files:**
- Modify: `src/app/api/surveys/[id]/export/route.ts`

Same pattern. Commit:

```bash
git add src/app/api/surveys/[id]/export/route.ts
git commit -m "fix(security): escape surveys export CSV via csvFile util"
```

---

## 1.2 — Calibration stale chart

Pure client-side React fix. No migration.

### Task 7: Remove the no-op Proxy and wire `liveGrades` to saves

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/calibration/calibration-client.tsx`

**Step 1: Read current state of the file**

Read the file (full). Identify:
- `liveGrades` state at ~line 384.
- The `trackedSupabase` Proxy at ~lines 392-395 (to delete).
- The row save hook / `handleGradeChange` callback that currently calls `supabase.from("review_assignments").update(...)`. Grep for `.update({ final_grade` inside this file.
- All readers of `trackedSupabase` (search the file for the identifier).

**Step 2: Delete the Proxy**

Delete lines 392-395 (the `trackedSupabase` `useMemo`). Replace every usage of `trackedSupabase` in the file with plain `supabase`.

**Step 3: Make `handleGradeChange` sync `liveGrades`**

Locate the callback that updates `final_grade`. Wrap the supabase call:

```tsx
const handleGradeChange = async (assignmentId: string, newGrade: string) => {
  const previous = liveGrades[assignmentId] ?? "";
  // Optimistic update: distribution chart reflects change immediately
  setLiveGrades((prev) => ({ ...prev, [assignmentId]: newGrade }));

  const { error } = await supabase
    .from("review_assignments")
    .update({
      final_grade: newGrade,
      calibrated_by: currentUserId, // existing variable in scope
      calibrated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);

  if (error) {
    // Rollback
    setLiveGrades((prev) => ({ ...prev, [assignmentId]: previous }));
    setRowError(assignmentId, error.message);
  }
};
```

(Exact identifiers depend on what's already in the file; align with existing patterns. If `setRowError` or equivalent doesn't exist, reuse the current error toast mechanism.)

**Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 5: Manual verification via preview MCP**

Using the running dev server:
1. Navigate to an active cycle's calibration page (seeded data; HR user).
2. Change a grade on row 1 — confirm distribution chart updates without reload.
3. Change three grades in a row — chart updates each time.
4. Open devtools network tab, block the update request, change another grade — row reverts, toast shows.

**Step 6: Commit**

```bash
git add src/app/dashboard/cycles/[id]/calibration/calibration-client.tsx
git commit -m "fix(calibration): replace no-op Proxy with real liveGrades sync

The Proxy wrapper was empty and never intercepted save calls, leaving
the distribution histogram stale until page reload. Replaces with
optimistic state updates and rollback on failure."
```

---

## 1.4 — Roadmap RLS tightening

Migration-only. Affects a public-facing table; low coupling to other fixes.

### Task 8: Write the roadmap RLS migration

**Files:**
- Create: `supabase/migrations/20260416_01_roadmap_rls.sql`

**Step 1: Write the migration**

```sql
-- Phase 1, audit fix 1.4: tighten roadmap RLS to prevent anon abuse.

-- Drop policies flagged by Supabase advisor as `USING (true)` / `WITH CHECK (true)`
DROP POLICY IF EXISTS "Public insert roadmap_suggestions" ON public.roadmap_suggestions;
DROP POLICY IF EXISTS "Public insert roadmap_votes" ON public.roadmap_votes;
DROP POLICY IF EXISTS "Public delete own roadmap_votes" ON public.roadmap_votes;

-- Suggestions: must be authenticated; user_id must match caller
CREATE POLICY "authed_insert_suggestions" ON public.roadmap_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Votes: authenticated insert own, delete own
CREATE POLICY "authed_insert_own_votes" ON public.roadmap_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "authed_delete_own_votes" ON public.roadmap_votes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Prevent double-voting on the same suggestion
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vote_per_user
  ON public.roadmap_votes (user_id, suggestion_id);
```

**Step 2: Apply to the dev branch**

Run via Supabase MCP: `mcp__supabase__apply_migration` with the branch ref from Task 0, `name: "20260416_01_roadmap_rls"`, and the SQL body.
Expected: success, no errors.

**Step 3: Verify the policies**

Run via Supabase MCP: `mcp__supabase__execute_sql` on the branch:

```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy
WHERE polrelid IN ('public.roadmap_suggestions'::regclass, 'public.roadmap_votes'::regclass)
ORDER BY polname;
```

Expected: three policies, each scoped by `auth.uid()`. No `true` in `using_expr` or `check_expr` except for SELECT policies (untouched).

**Step 4: Smoke test the anon path is blocked**

Run via Supabase MCP execute_sql on the branch:

```sql
SET LOCAL ROLE anon;
INSERT INTO roadmap_votes (user_id, suggestion_id)
VALUES ('00000000-0000-0000-0000-000000000000', (SELECT id FROM roadmap_suggestions LIMIT 1));
```

Expected: `ERROR: new row violates row-level security policy`.

**Step 5: Commit**

```bash
git add supabase/migrations/20260416_01_roadmap_rls.sql
git commit -m "fix(security): scope roadmap RLS policies to auth.uid()

Closes the anon-insert vector on roadmap_suggestions/votes and the
anon-delete vector on roadmap_votes flagged by Supabase advisor.
Adds unique index preventing double-voting on the same suggestion."
```

---

## 1.5 — Reviewer role enforcement in RLS

Migration + small client error-handling tweak.

### Task 9: Write the reviewer-role RLS migration

**Files:**
- Create: `supabase/migrations/20260416_02_reviewer_role_check.sql`

**Step 1: Pre-check existing INSERT policy name**

Run via Supabase MCP execute_sql on the branch:

```sql
SELECT polname FROM pg_policy
WHERE polrelid = 'public.review_responses'::regclass AND polcmd = 'a';
```

Expected: a list of existing INSERT policies. **Record their names** — the migration will drop them.

**Step 2: Write the migration**

```sql
-- Phase 1, audit fix 1.5: enforce that a reviewer's declared role
-- matches their actual relationship to the assignment.

-- Drop any existing permissive INSERT policy. Replace <OLD_POLICY_NAME>
-- with the name(s) from Task 9 Step 1.
DROP POLICY IF EXISTS "<OLD_POLICY_NAME>" ON public.review_responses;

CREATE POLICY "reviewer_role_matches_relationship" ON public.review_responses
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
            AND a.manager_id = u.id) OR
          (review_responses.reviewer_role = 'upward'
            AND a.reviewer_id = u.id AND a.assignment_type = 'upward') OR
          (review_responses.reviewer_role = 'peer'
            AND a.reviewer_id = u.id
            AND a.assignment_type = 'standard'
            AND a.employee_id <> u.id
            AND COALESCE(a.manager_id, '00000000-0000-0000-0000-000000000000'::uuid) <> u.id)
        )
    )
  );
```

**Step 3: Apply to branch**

Run via Supabase MCP: `mcp__supabase__apply_migration` with name `20260416_02_reviewer_role_check`.
Expected: success.

**Step 4: Verify policy exists**

Execute on branch:

```sql
SELECT polname, pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy
WHERE polrelid = 'public.review_responses'::regclass AND polcmd = 'a';
```

Expected: single policy `reviewer_role_matches_relationship` with the full `EXISTS(...)` expression.

### Task 10: Write integration test that proves enforcement

**Files:**
- Create: `src/app/dashboard/cycles/__tests__/reviewer-role-rls.test.ts`

**Step 1: Write the failing test**

```ts
/**
 * Integration: verifies the reviewer_role RLS policy (migration 20260416_02).
 *
 * Requires env: SUPABASE_URL, SUPABASE_ANON_KEY pointing at a branch that has
 * the migration applied and seed data (one workspace, one cycle, one
 * active peer review_assignment where employee=E, reviewer=P, manager=M).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_BRANCH_URL!;
const ANON = process.env.SUPABASE_BRANCH_ANON_KEY!;
const PEER_EMAIL = process.env.SEED_PEER_EMAIL!;
const ASSIGNMENT_ID = process.env.SEED_ASSIGNMENT_ID!;

describe("reviewer_role RLS", () => {
  let supabase = createClient(URL, ANON);

  beforeAll(async () => {
    // Sign in as the seeded peer user via magic-link bypass in seed script.
    // (Skipped here; assume env already holds a valid access token via SUPABASE_ACCESS_TOKEN.)
  });

  it("rejects a peer inserting a manager-tagged response", async () => {
    const { error } = await supabase.from("review_responses").insert({
      assignment_id: ASSIGNMENT_ID,
      reviewer_id: process.env.SEED_PEER_APP_USER_ID,
      reviewer_role: "manager",
      competency_id: process.env.SEED_COMPETENCY_ID,
      score: 5,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501"); // RLS violation
  });

  it("accepts a peer inserting a peer-tagged response", async () => {
    const { error } = await supabase.from("review_responses").insert({
      assignment_id: ASSIGNMENT_ID,
      reviewer_id: process.env.SEED_PEER_APP_USER_ID,
      reviewer_role: "peer",
      competency_id: process.env.SEED_COMPETENCY_ID,
      score: 4,
    });
    expect(error).toBeNull();
  });
});
```

**Step 2: Run — expect fail (seed missing) or pass (if seed set up)**

Run: `npm test -- reviewer-role-rls --run`
Expected: SKIP/FAIL with missing env vars on first run. This is OK — the test is documentation-as-code for the QA step. **Add a `describe.skip` guard** if running in CI without the seed.

**Step 3: Document the seed setup**

Append to `docs/plans/2026-04-16-audit-fixes-phase-1-implementation.md` (this file) a `## Seed data for reviewer-role test` section with required env vars. [skip — already documented above via the env refs]

### Task 11: Add client error handling for `42501`

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx`

**Step 1: Locate the insert at ~line 454**

Read the file around lines 440-490. Find the `await supabase.from("review_responses").insert(...)` call.

**Step 2: Wrap with error handling**

Immediately after the insert, check `error?.code`:

```tsx
if (error) {
  if (error.code === "42501") {
    setError("You are not authorized to submit this review in this role.");
    return;
  }
  throw error;
}
```

(Reuse the file's existing error state. Match surrounding patterns.)

**Step 3: Commit**

```bash
git add supabase/migrations/20260416_02_reviewer_role_check.sql \
        src/app/dashboard/cycles/__tests__/reviewer-role-rls.test.ts \
        src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx
git commit -m "fix(security): enforce reviewer role in RLS WITH CHECK

A peer can no longer submit a review_response tagged reviewer_role=manager
by patching the client; the DB now derives the allowed role from the
assignment row. Client surfaces 42501 with a clear message."
```

---

## 1.6 — Review submit idempotency

Migration first, then client conflict handling.

### Task 12: Dedupe + unique-index migration

**Files:**
- Create: `supabase/migrations/20260416_03_review_response_unique.sql`

**Step 1: Check for existing duplicates on the dev branch**

Run via Supabase MCP execute_sql:

```sql
SELECT assignment_id, reviewer_id, reviewer_role, COUNT(*) AS n
FROM review_responses
GROUP BY 1,2,3 HAVING COUNT(*) > 1;
```

Expected: zero rows (seed data is clean). If non-zero, inspect them before proceeding.

**Step 2: Write the migration**

```sql
-- Phase 1, audit fix 1.6: enforce one review response per
-- (assignment, reviewer, role) and dedupe any existing dupes.

-- Dedupe: keep the earliest submission per tuple.
WITH dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY assignment_id, reviewer_id, reviewer_role
           ORDER BY submitted_at NULLS LAST, created_at
         ) AS rn
  FROM review_responses
)
DELETE FROM review_responses
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_response
  ON public.review_responses (assignment_id, reviewer_id, reviewer_role);
```

**Step 3: Apply to branch**

Run: `mcp__supabase__apply_migration`, name `20260416_03_review_response_unique`.

**Step 4: Verify**

Execute on branch:

```sql
SELECT indexdef FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'uniq_review_response';
```

Expected: `CREATE UNIQUE INDEX uniq_review_response ON public.review_responses USING btree (assignment_id, reviewer_id, reviewer_role)`.

Also rerun the duplicates check from Step 1 — expect zero rows.

### Task 13: Client handles 23505 gracefully

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx`

**Step 1: Extend the error check added in Task 11**

```tsx
if (error) {
  if (error.code === "42501") {
    setError("You are not authorized to submit this review in this role.");
    return;
  }
  if (error.code === "23505") {
    // Already submitted — treat as success.
    localStorage.removeItem(`review-draft-${assignmentId}`);
    router.push(`/dashboard/cycles/${cycleId}?submitted=1`);
    return;
  }
  throw error;
}
```

(Adjust import of `useRouter` if not already present, and `cycleId` variable name to match the file.)

**Step 2: Manual verification via preview MCP**

- Load the review form as a seeded reviewer.
- Fill it out.
- Submit once — success redirect.
- In devtools, use back button to return to the form (if possible) or re-navigate; re-submit.
- Expected: same redirect, no error, no duplicate row. Verify via execute_sql:
  ```sql
  SELECT COUNT(*) FROM review_responses
  WHERE assignment_id = '<seeded>' AND reviewer_id = '<seeded>' AND reviewer_role = '<seeded>';
  ```
  Expected: 1.

### Task 14: Commit

```bash
git add supabase/migrations/20260416_03_review_response_unique.sql \
        src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx
git commit -m "fix(reviews): idempotent review submit via unique index + 23505 handling

Prevents duplicate review_responses from network retries or double-clicks.
Dedupes any existing duplicates (keeps earliest). Client treats unique
violation as success, clears draft, redirects."
```

---

## 1.1 — Cycle launch race

Heaviest piece. Ship last so the earlier migrations are already in place.

### Task 15: Pre-launch-dedupe + unique-index migration

**Files:**
- Create: `supabase/migrations/20260416_04_review_assignment_unique.sql`

**Step 1: Check for existing duplicates**

Run via Supabase MCP execute_sql on the branch:

```sql
SELECT cycle_id, employee_id, reviewer_id, assignment_type, COUNT(*) AS n
FROM review_assignments
GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
```

Expected: zero. If non-zero, proceed knowing the migration will clean them up.

**Step 2: Write the migration**

```sql
-- Phase 1, audit fix 1.1: dedupe and prevent duplicate review_assignments.

WITH dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY cycle_id, employee_id, reviewer_id, assignment_type
           ORDER BY created_at
         ) AS rn
  FROM review_assignments
)
DELETE FROM review_assignments
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_assignment
  ON public.review_assignments (cycle_id, employee_id, reviewer_id, assignment_type);
```

**Step 3: Apply + verify**

`mcp__supabase__apply_migration` with name `20260416_04_review_assignment_unique`. Then verify index exists with `pg_indexes` query.

### Task 16: `launch_cycle` RPC migration

**Files:**
- Create: `supabase/migrations/20260416_05_launch_cycle_rpc.sql`

**Step 1: Write the RPC**

```sql
-- Phase 1, audit fix 1.1: transactional, lock-protected cycle launch.

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
  v_auth_uid uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  -- Authorization: caller must be an admin or HR of the cycle's workspace.
  SELECT c.workspace_id INTO v_workspace_id
  FROM performance_cycles c WHERE c.id = p_cycle_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_user_id = v_auth_uid
      AND u.workspace_id = v_workspace_id
      AND u.role IN ('admin', 'hr')
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized to launch cycle' USING ERRCODE = '42501';
  END IF;

  -- Serialize concurrent launches on the same cycle.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_cycle_id::text, 0));

  DELETE FROM review_assignments WHERE cycle_id = p_cycle_id;

  INSERT INTO review_assignments (
    cycle_id, employee_id, reviewer_id, manager_id, assignment_type, status
  )
  SELECT
    p_cycle_id,
    (x->>'employee_id')::uuid,
    (x->>'reviewer_id')::uuid,
    NULLIF(x->>'manager_id','')::uuid,
    x->>'assignment_type',
    COALESCE(x->>'status', 'pending')
  FROM jsonb_array_elements(p_assignments) x
  ON CONFLICT ON CONSTRAINT uniq_review_assignment DO NOTHING;

  -- Activate first phase if any exist.
  UPDATE cycle_phases SET status = 'active'
  WHERE id = (
    SELECT id FROM cycle_phases
    WHERE cycle_id = p_cycle_id
    ORDER BY sort_order
    LIMIT 1
  );

  UPDATE performance_cycles
  SET status = 'active', updated_at = now()
  WHERE id = p_cycle_id;

  UPDATE performance_cycle_employees
  SET status = 'in_progress'
  WHERE performance_cycle_id = p_cycle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.launch_cycle(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.launch_cycle(uuid, jsonb) TO authenticated;
```

**Step 2: Apply**

`mcp__supabase__apply_migration`, name `20260416_05_launch_cycle_rpc`.

**Step 3: Verify the function exists**

Execute on branch:

```sql
SELECT p.proname, p.prosecdef, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'launch_cycle';
```

Expected: one row, `prosecdef = true`, `proacl` includes `authenticated=X/postgres`.

### Task 17: Replace client launch logic with RPC call

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/cycle-actions.tsx`

**Step 1: Read current launch function**

Read lines 120-280 of the file. Identify the `launchCycle` function and the block where `allAssignments` is built, deleted, inserted (lines 180-240).

**Step 2: Build payload + call RPC**

Keep the code that builds `standardAssignments` and `upwardAssignments` (it computes who reviews whom — keep this client-side). Replace the delete/insert/phase-update/status-update blocks (roughly lines 192-240) with:

```tsx
const allAssignments = [...standardAssignments, ...upwardAssignments];

const { error: rpcError } = await supabase.rpc("launch_cycle", {
  p_cycle_id: cycle.id,
  p_assignments: allAssignments,
});

if (rpcError) {
  // 42501 -> not authorized; 22023 -> cycle not found
  throw rpcError;
}
```

Delete the now-redundant:
- `.from("review_assignments").delete().eq("cycle_id", cycle.id)`
- `.from("review_assignments").insert(allAssignments)`
- `.from("cycle_phases").update({ status: "active" })` block
- `.from("performance_cycles").update({ status: "active", ... })` block
- `.from("performance_cycle_employees").update({ status: "in_progress" })` block

Keep the downstream Nami notification trigger (after the RPC returns successfully).

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

### Task 18: Concurrent-launch integration test

**Files:**
- Create: `src/app/dashboard/cycles/__tests__/launch-cycle-race.test.ts`

**Step 1: Write the test**

```ts
/**
 * Integration: verifies launch_cycle RPC serializes concurrent launches.
 * Requires a seeded cycle with known assignment count.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_BRANCH_URL!;
const SERVICE_KEY = process.env.SUPABASE_BRANCH_SERVICE_KEY!;
const CYCLE_ID = process.env.SEED_DRAFT_CYCLE_ID!;
const ASSIGNMENTS_JSON = process.env.SEED_ASSIGNMENTS_JSON!; // JSON array

describe.skipIf(!URL || !SERVICE_KEY)("launch_cycle RPC", () => {
  const sb = createClient(URL, SERVICE_KEY);
  const payload = JSON.parse(ASSIGNMENTS_JSON);
  const expectedCount = payload.length;

  it("does not create duplicates when invoked concurrently", async () => {
    const [r1, r2] = await Promise.all([
      sb.rpc("launch_cycle", { p_cycle_id: CYCLE_ID, p_assignments: payload }),
      sb.rpc("launch_cycle", { p_cycle_id: CYCLE_ID, p_assignments: payload }),
    ]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();

    const { data, error } = await sb
      .from("review_assignments")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", CYCLE_ID);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(expectedCount);
  });
});
```

**Step 2: Run (will skip locally without env; use Supabase MCP on the branch)**

For CI: seed the branch with a draft cycle + known assignments, run the test with the branch URL and service key exposed via Vitest env.

Manual alternative: run two parallel `mcp__supabase__execute_sql` calls invoking the RPC, then verify count.

### Task 19: Commit cycle launch fix

```bash
git add supabase/migrations/20260416_04_review_assignment_unique.sql \
        supabase/migrations/20260416_05_launch_cycle_rpc.sql \
        src/app/dashboard/cycles/[id]/cycle-actions.tsx \
        src/app/dashboard/cycles/__tests__/launch-cycle-race.test.ts
git commit -m "fix(cycles): transactional launch_cycle RPC prevents duplicate assignments

Concurrent launches of the same cycle no longer produce duplicate
review_assignments. Serialized via advisory xact lock; backed by
unique index on (cycle_id, employee_id, reviewer_id, assignment_type).
RPC performs the full delete/insert/phase-advance/status-flip atomically."
```

---

## Final verification

### Task 20: Whole-suite verification

**Files:**
- None

**Step 1: Vitest full run**

Run: `npm test -- --run`
Expected: all pre-existing tests (49) plus the new `csv.test.ts` cases PASS. RLS integration tests skip without the env vars — acceptable.

**Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 3: Lint on touched files only**

Run: `npx eslint src/lib/csv.ts src/lib/csv.test.ts src/app/api/goals/export/route.ts src/app/api/reviews/export/route.ts src/app/api/analytics/export/route.ts src/app/api/surveys/[id]/export/route.ts src/app/dashboard/cycles/[id]/calibration/calibration-client.tsx src/app/dashboard/cycles/[id]/cycle-actions.tsx src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx`
Expected: zero new errors on touched lines. (Pre-existing `any` warnings are out-of-scope for Phase 1.)

**Step 4: Preview smoke test**

Using the preview MCP:
1. Home loads, no console errors.
2. Navigate through public pages — all 200s.
3. Check dev server logs for any new 500 responses from `/api/*/export/*` during a seeded export.

**Step 5: Supabase advisor re-run**

Run: `mcp__supabase__get_advisors type=security` on the dev branch.
Expected: the three `rls_policy_always_true` entries for `roadmap_*` are gone.

### Task 21: Merge branch to production

**Step 1: Merge Supabase branch**

Run: `mcp__supabase__merge_branch` with the Phase 1 branch ref.
Expected: five migrations apply to main in order. Monitor for errors.

**Step 2: Delete the dev branch**

Run: `mcp__supabase__delete_branch`.

**Step 3: Push git branch, open PR**

```bash
git push origin phase-1-critical-fixes
gh pr create --title "Phase 1: critical audit fixes" --body "$(cat <<'EOF'
## Summary
- Prevents duplicate review_assignments under concurrent cycle launch (new transactional RPC + unique index).
- Fixes calibration distribution chart so it updates live on grade saves (removed no-op Proxy).
- Sanitizes all four CSV export routes against formula-injection attacks.
- Scopes roadmap RLS policies to auth.uid() (closes anon spam/ballot-stuff vectors).
- Enforces reviewer role in RLS WITH CHECK (blocks peers from submitting as manager).
- Makes review submit idempotent via unique index + graceful 23505 handling.

## Migrations
- 20260416_01_roadmap_rls
- 20260416_02_reviewer_role_check
- 20260416_03_review_response_unique
- 20260416_04_review_assignment_unique
- 20260416_05_launch_cycle_rpc

## Test plan
- [x] `npm test -- --run` — all green
- [x] `npx tsc --noEmit` — zero errors
- [x] Manual: cycle launch → concurrent → no duplicates
- [x] Manual: calibration distribution chart updates live
- [x] Manual: goal titled `=1+1` exports as `'=1+1`
- [x] Manual: anon roadmap insert returns 42501
- [x] Manual: peer submitting reviewer_role=manager returns 42501
- [x] Manual: double-submit yields one row + clean redirect

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Rollback plan

If a specific migration causes a production incident:

1. Halt traffic or put the dashboard in read-only mode.
2. Apply the down-migration. Each migration file should have a corresponding SQL that reverses it (add inline `-- DOWN` comments when writing each migration; not enforced in this repo yet).
3. For `20260416_04` and `20260416_03` (unique indexes), dropping the index is non-destructive.
4. For `20260416_05` (RPC), `DROP FUNCTION public.launch_cycle(uuid, jsonb);` — the client still has the old inline logic, so revert the client commit too.
5. For `20260416_01` and `20260416_02` (RLS), revert to the previous policies — **but this reopens the security hole**, so only roll back if the fix itself is actively breaking legitimate traffic.

## Seed data notes

The two integration tests (`reviewer-role-rls`, `launch-cycle-race`) require seeded data on the Supabase branch. A one-off seeding script can live at `scripts/seed-phase-1-tests.ts` — out of scope for this plan but recommended before CI adoption. Both tests are `describe.skipIf` guarded on env vars, so they no-op without the seed.
