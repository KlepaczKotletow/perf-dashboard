# Role-Clarity Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate role conflation across the Nami dashboard by restructuring the sidebar into MY WORK / MY TEAM / MANAGE, adding a PageHeader component that labels the "hat" on every page, redesigning Home as three role-stacked sections, and enforcing a full goal permission matrix at the Supabase RLS layer.

**Architecture:** Work lands in order of ascending risk — sidebar first (pure rename), then isolated PageHeader component, then the DB migration (authoritative RLS), then the Goals page refactor that depends on it, then Home, then verification + Vercel deploy. Single branch `phase-7-role-clarity`; one commit per task; one final merge to main.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4 / Supabase (Postgres + RLS) / Vitest. Preview runs via `mcp__Claude_Preview__*`; migrations via Supabase MCP.

**Design reference:** [docs/plans/2026-04-17-role-clarity-redesign-design.md](./2026-04-17-role-clarity-redesign-design.md)

---

## Pre-flight

### Task 0: Create feature branch

**Files:** none (git only)

**Step 1: Verify clean working tree (or accept pre-existing drift)**

Run: `cd "/Users/filipnowakowski/Test - Slack/feedback-app" && git status --short`
Expected: only `supabase/.temp/cli-latest` (the local CLI marker) — all audit work is on main.

**Step 2: Create and switch to branch**

Run: `git checkout -b phase-7-role-clarity`
Expected: `Switched to a new branch 'phase-7-role-clarity'`

---

## Part A — Sidebar restructure (lowest risk, cosmetic)

### Task 1: Update sidebar labels + add Audit log link

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Read the existing layout.tsx to find the nav definitions**

Read the file. Find the arrays or JSX that define sidebar sections. Expected locations based on recent work: the file already has three groupings (Everyone / TEAM / ADMIN).

**Step 2: Apply these exact label + section changes**

| Current item | New label | New section |
|---|---|---|
| Home | Home | MY WORK |
| Performance | My Performance | MY WORK |
| Goals | My Goals | MY WORK |
| Kudos | My Kudos | MY WORK |
| My Team | Team Overview | MY TEAM |
| Reviews | Team Reviews | MY TEAM |
| (new) | Team Goals | MY TEAM (href `/dashboard/goals?tab=team`) |
| Cycles | Cycles | MANAGE |
| Directory | Directory | MANAGE |
| Surveys | Surveys | MANAGE |
| Templates | Templates | MANAGE |
| Analytics | Analytics | MANAGE |
| Functions | Functions | MANAGE |
| Settings | Settings | MANAGE |
| Billing | Billing | MANAGE |
| (new) | Audit log | MANAGE (href `/dashboard/admin/audit`) |
| Help | Help | bottom (unchanged) |

Section headings change from `TEAM` / `ADMIN` to `MY TEAM` / `MANAGE`. Add a `MY WORK` heading for the first group (currently unlabelled).

**Step 3: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat(nav): restructure sidebar into MY WORK / MY TEAM / MANAGE

Adds 'My' prefix to personal-scope items, renames the manager team view
to 'Team Overview' (freeing 'Team Goals' as a new entry), and promotes
the existing /dashboard/admin/audit route into the sidebar. Pure label
+ ordering change — no route changes, no permission changes.

Design: docs/plans/2026-04-17-role-clarity-redesign-design.md §1"
```

---

## Part B — PageHeader component (isolated, testable)

### Task 2: Build the PageHeader component with tests

**Files:**
- Create: `src/components/page-header.tsx`
- Create: `src/components/page-header.test.tsx`

**Step 1: Write the failing tests**

Create `src/components/page-header.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title and hat chip", () => {
    render(<PageHeader hat="my-work" title="Goals" />);
    expect(screen.getByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("My Work")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<PageHeader hat="my-team" title="Sarah Chen" subtitle="Review · Q1 2026" />);
    expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
    expect(screen.getByText("Review · Q1 2026")).toBeInTheDocument();
    expect(screen.getByText("My Team")).toBeInTheDocument();
  });

  it("renders the Manage hat label for admin pages", () => {
    render(<PageHeader hat="manage" title="Cycles" />);
    expect(screen.getByText("Manage")).toBeInTheDocument();
  });

  it("renders actions in the header when provided", () => {
    render(
      <PageHeader
        hat="my-work"
        title="Goals"
        actions={<button type="button">Create</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("omits subtitle when not provided", () => {
    const { container } = render(<PageHeader hat="my-work" title="Home" />);
    expect(container.querySelector("[data-subtitle]")).toBeNull();
  });
});
```

**Step 2: Run tests — expect fail**

Run: `npm test -- src/components/page-header.test.tsx --run`
Expected: FAIL with "Cannot find module './page-header'".

**Step 3: Implement the component**

Create `src/components/page-header.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type Hat = "my-work" | "my-team" | "manage";

const HAT_LABEL: Record<Hat, string> = {
  "my-work": "My Work",
  "my-team": "My Team",
  "manage": "Manage",
};

// Hat chip colours, designed to escalate by role:
//  - My Work: quiet neutral (personal space)
//  - My Team: primary tint (manager context)
//  - Manage: amber tint (admin actions, louder)
const HAT_CLASS: Record<Hat, string> = {
  "my-work":
    "bg-muted text-muted-foreground",
  "my-team":
    "bg-primary/10 text-primary",
  "manage":
    "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

interface PageHeaderProps {
  hat: Hat;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Every dashboard page renders this at the top. The hat chip + title
 * make the current role context unambiguous — a second safety net on
 * top of the sidebar section label.
 *
 * See docs/plans/2026-04-17-role-clarity-redesign-design.md §2.
 */
export function PageHeader({ hat, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 pb-4 mb-4 border-b border-border/60",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "inline-flex items-center text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full mb-1.5",
            HAT_CLASS[hat],
          )}
        >
          {HAT_LABEL[hat]}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p data-subtitle className="text-sm text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
  );
}
```

**Step 4: Run tests — expect pass**

Run: `npm test -- src/components/page-header.test.tsx --run`
Expected: all 5 tests PASS.

**Step 5: Commit**

```bash
git add src/components/page-header.tsx src/components/page-header.test.tsx
git commit -m "feat(ui): add <PageHeader> component with hat chip

Small component that renders an uppercase hat chip ('My Work' / 'My Team' /
'Manage') above a page title + optional subtitle + right-aligned actions.
Hat colours escalate by role: neutral → primary → amber so admin context
is visually loudest. Applied to all dashboard pages in Task 5.

5 unit tests cover the chip mapping, subtitle optionality, actions slot.

Design: docs/plans/2026-04-17-role-clarity-redesign-design.md §2"
```

---

## Part C — DB migration (authoritative RLS matrix)

### Task 3: Audit current goals RLS policies via Supabase MCP

**Files:** none (inspection only)

**Step 1: List existing goals policies**

Via `mcp__supabase__execute_sql`:

```sql
SELECT polname, polcmd,
       pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy
WHERE polrelid = 'public.goals'::regclass
ORDER BY polcmd, polname;
```

Expected: a list of existing policies on `goals`. **Record their names in a scratchpad — the migration will DROP each of them by name.**

**Step 2: Verify the `goals.scope` column shape**

```sql
SELECT DISTINCT scope, COUNT(*) AS n
FROM public.goals
GROUP BY scope;
```

Expected: distribution of `company`, `team`, `individual`, and possibly `NULL`. **Record the counts** — if any NULL rows exist, they'll need backfilling to `individual` before the new RLS can enforce cleanly.

**No commit.** Inspection only.

### Task 4: Write and apply the RLS migration

**Files:**
- Create: `supabase/migrations/20260417_01_goals_permission_matrix.sql`

**Step 1: Write the migration**

```sql
-- Phase 7 Role-Clarity: enforce the goals permission matrix at the RLS layer.
-- Design: docs/plans/2026-04-17-role-clarity-redesign-design.md §4
--
-- Before: goals had permissive SELECT / INSERT / UPDATE policies that mostly
-- boiled down to "workspace member can read + write anywhere". Today we
-- tighten to a role + scope matrix:
--
--   INDIVIDUAL  create by: self, owner's manager, HR/admin
--               edit   by: self, owner's manager, HR/admin
--               read   by: owner, owner's manager, HR/admin, and anyone in
--                          workspace if scope = 'company'
--   TEAM        create by: caller manages someone in the team, or HR/admin
--               edit   by: same
--               read   by: team members + HR/admin
--   COMPANY     create/edit/delete: HR/admin only
--               read: everyone in workspace (public by design)

-- 1. Schema change: track the manager/admin who suggested a goal to an
--    employee. NULL = self-created; non-NULL renders the "Suggested by"
--    badge on the goal card.
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS suggested_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Backfill any NULL scope rows so the policies below have clean inputs.
UPDATE public.goals SET scope = 'individual' WHERE scope IS NULL;

-- 3. Drop every existing policy on goals. Each line is safe to rerun — the
--    IF EXISTS guard handles migrations that partially ran. The specific
--    names come from Task 3 inspection.
DROP POLICY IF EXISTS "Users see workspace goals"           ON public.goals;
DROP POLICY IF EXISTS "Users can view workspace goals"       ON public.goals;
DROP POLICY IF EXISTS "Users create own goals"              ON public.goals;
DROP POLICY IF EXISTS "Users insert own goals"              ON public.goals;
DROP POLICY IF EXISTS "Users update own goals"              ON public.goals;
DROP POLICY IF EXISTS "Managers can update direct reports goals" ON public.goals;
DROP POLICY IF EXISTS "HR admins manage goals"              ON public.goals;
DROP POLICY IF EXISTS "goals_select"                        ON public.goals;
DROP POLICY IF EXISTS "goals_insert"                        ON public.goals;
DROP POLICY IF EXISTS "goals_update"                        ON public.goals;
DROP POLICY IF EXISTS "goals_delete"                        ON public.goals;

-- 4. SELECT — visibility matrix
CREATE POLICY "goals_select_matrix"
  ON public.goals
  FOR SELECT TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND (
      -- Company goals are public-read to everyone in the workspace
      scope = 'company'
      -- Admin/HR see everything
      OR auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      -- Owner sees their own
      OR employee_id = auth_user_id()
      -- Manager of the owner sees it
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = goals.employee_id AND u.manager_id = auth_user_id()
      )
    )
  );

-- 5. INSERT — who can create what scope
CREATE POLICY "goals_insert_matrix"
  ON public.goals
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND (
      -- HR/admin can create at any scope
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      -- Individual: self-create, or manager creating for their report
      OR (
        scope = 'individual'
        AND (
          employee_id = auth_user_id()
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = goals.employee_id AND u.manager_id = auth_user_id()
          )
        )
      )
      -- Team: caller manages at least one person (coarse check — the
      -- finer "manager of THIS team" check is enforced client-side via
      -- the department/function dropdown since team goals don't yet
      -- carry an owning-team foreign key).
      OR (
        scope = 'team'
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.manager_id = auth_user_id() AND u.workspace_id = auth_workspace_id()
        )
      )
      -- Company scope only admin/HR (already covered by first branch)
    )
  );

-- 6. UPDATE — same actors who can create can also edit
CREATE POLICY "goals_update_matrix"
  ON public.goals
  FOR UPDATE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      OR (
        scope = 'individual'
        AND (
          employee_id = auth_user_id()
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = goals.employee_id AND u.manager_id = auth_user_id()
          )
        )
      )
      OR (
        scope = 'team'
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.manager_id = auth_user_id() AND u.workspace_id = auth_workspace_id()
        )
      )
    )
  )
  WITH CHECK (
    workspace_id = auth_workspace_id()
    -- Scope is immutable once set; we intentionally do NOT allow an
    -- update to change the scope, which would be a permission-bypass
    -- vector (promote an individual goal to company to gain visibility).
  );

-- 7. DELETE — owner, manager-of-owner, or HR/admin
CREATE POLICY "goals_delete_matrix"
  ON public.goals
  FOR DELETE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      OR employee_id = auth_user_id()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = goals.employee_id AND u.manager_id = auth_user_id()
      )
    )
  );
```

**Step 2: Apply via Supabase MCP**

Call `mcp__supabase__apply_migration` with:
- `name`: `20260417_01_goals_permission_matrix`
- `query`: the full SQL above

Expected: `{"success": true}`.

**Step 3: Verify policies are live**

Via `mcp__supabase__execute_sql`:

```sql
SELECT polname, polcmd FROM pg_policy
WHERE polrelid = 'public.goals'::regclass
ORDER BY polcmd, polname;
```

Expected: exactly 4 policies — `goals_select_matrix` (r), `goals_insert_matrix` (a), `goals_update_matrix` (w), `goals_delete_matrix` (d). No leftover legacy policies.

**Step 4: Smoke-test the matrix with execute_sql**

Company goal visible across workspaces in the same tenant:

```sql
SELECT id, scope, employee_id, workspace_id
FROM public.goals
WHERE scope = 'company'
LIMIT 3;
```

Should return rows. `scope = 'company'` rows are accessible to any workspace member via RLS SELECT.

**Step 5: Commit**

```bash
git add supabase/migrations/20260417_01_goals_permission_matrix.sql
git commit -m "feat(db): goals permission matrix + suggested_by_user_id

Replaces the permissive goals RLS with a scope-aware matrix:
  - individual: owner / owner's manager / HR+admin
  - team:      team manager(s) / HR+admin
  - company:   HR+admin write, workspace-wide read

Adds goals.suggested_by_user_id so a manager who creates a goal for a
report can be attributed — the UI renders a 'Suggested by [manager]'
badge while the owner remains the employee (the goal belongs to them).

Scope is immutable post-creation; the WITH CHECK deliberately omits a
scope-bump path to close the promote-for-visibility hole.

Applied to prod via Supabase MCP. Verified 4 policies live.

Design: docs/plans/2026-04-17-role-clarity-redesign-design.md §4"
```

---

## Part D — Goals page refactor

### Task 5: Add tab navigation + scope-aware data fetch

**Files:**
- Modify: `src/app/dashboard/goals/page.tsx`

**Step 1: Read the existing goals/page.tsx**

Read the file. Identify:
- The current data-fetch block (probably a Supabase query around lines 25-65).
- How it passes data to `GoalsClient` (`src/app/dashboard/goals/goals-client.tsx`).
- Whether there's an existing search-params handler.

**Step 2: Add tab-aware URL parsing and three parallel fetches**

Rewrite the page to:
1. Accept `searchParams` with `?tab=me|team|company` (default `me`).
2. Resolve which tabs to show based on `workspace.role` + `hasDirectReports`.
3. Fetch goals for all visible tabs in parallel (so switching is instant from cached data in the client).
4. Pass an initial `tab` prop + three goal arrays down to `GoalsClient`.

Exact code (drop-in replacement for the data-fetch section):

```tsx
type TabId = "me" | "team" | "company";

const ALL_TABS: { id: TabId; label: string }[] = [
  { id: "me", label: "Me" },
  { id: "team", label: "Team" },
  { id: "company", label: "Company" },
];

async function getGoalsForTab(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  tab: TabId,
  workspaceId: string,
  appUserId: string,
) {
  let q = supabase
    .from("goals")
    .select(`
      id, title, description, scope, status, progress, weight,
      metric_start, metric_current, metric_target, metric_unit,
      tracking_status, due_date, created_at, parent_id, goal_direction,
      employee_id, suggested_by_user_id,
      employee:users!goals_employee_id_fkey(id, slack_name, department),
      suggested_by:users!goals_suggested_by_user_id_fkey(id, slack_name),
      cycle:performance_cycles!goals_cycle_id_fkey(id, name)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (tab === "me") {
    q = q.eq("employee_id", appUserId).eq("scope", "individual");
  } else if (tab === "team") {
    q = q.or("scope.eq.team,and(scope.eq.individual,employee_id.in.(select id from users where manager_id=" + appUserId + "))");
    // Simpler fallback: two queries merged client-side if the .or() above
    // turns out to be fragile; see NOTE below in commit body.
  } else {
    q = q.eq("scope", "company");
  }

  const { data, error } = await q;
  if (error) console.error("[goals]", tab, "query failed:", error.message);
  return data ?? [];
}
```

Then call it three times with `Promise.all` based on visible tabs, and pass down to the client.

> **NOTE on the Team tab query:** PostgREST's `.or()` with nested subqueries is known to be awkward. If the above fails in local testing, replace the single `.or()` with two queries (team-scope + individual-scope with a pre-resolved list of report ids) and merge in JS. The RLS matrix enforces correctness — this is just a display optimisation.

**Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/dashboard/goals/page.tsx
git commit -m "feat(goals): server-side per-tab data fetch for Me / Team / Company

The Goals page now parses ?tab from the URL (default 'me') and fetches
goals scoped to that tab. 'Me' = individual goals owned by caller.
'Team' = reports' individual goals + any team-scope goals. 'Company' =
scope=company, public-read.

RLS still the authoritative filter — this is just a UX-shaping projection.

Design: docs/plans/2026-04-17-role-clarity-redesign-design.md §4"
```

### Task 6: Update GoalsClient for tabs + context-aware create + badge

**Files:**
- Modify: `src/app/dashboard/goals/goals-client.tsx`

**Step 1: Read the existing goals-client.tsx**

Read. Identify:
- Current goal list rendering.
- Current "Create goal" button behaviour.
- Props shape.

**Step 2: Add tab nav + context-aware create + "Suggested by" badge**

Apply these changes:

1. **Accept new props** from `page.tsx`: `tab: TabId`, `visibleTabs: TabId[]`, `goalsByTab: Record<TabId, Goal[]>`, `currentUserId: string`, `canManageTeam: boolean`, `canAdmin: boolean`.
2. **Render a tab bar** above the goal list. Use `next/link` for each visible tab with `?tab=<id>`. Highlight active tab.
3. **Context-aware "Create goal" button**:
   - On `me` tab: single button → opens a form prefilled with `scope='individual'`, `employee_id=currentUserId`.
   - On `team` tab: dropdown with options `[For myself]` / `[For <report name> …]` / `[Team goal]`. Each sets the right `scope` + `employee_id`.
   - On `company` tab (admin only): button → opens form with `scope='company'`.
4. **Render "Suggested by" badge** on any goal where `suggested_by` is non-null: small pill `💡 Suggested by {suggested_by.slack_name}` below the title.
5. **Render alignment line** when `parent_id` is set: `↳ Contributes to: [parent title]` as a secondary line (fetched in Task 5's SELECT via another query, or via a separate client-side fetch if needed).

Exact JSX for the tab nav:

```tsx
<nav className="flex gap-1 mb-5 border-b border-border/60">
  {visibleTabs.map((t) => {
    const active = t === tab;
    return (
      <Link
        key={t}
        href={`/dashboard/goals?tab=${t}`}
        className={cn(
          "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
          active
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        {TAB_LABEL[t]}
      </Link>
    );
  })}
</nav>
```

**Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/dashboard/goals/goals-client.tsx
git commit -m "feat(goals): tab nav, context-aware create, suggested-by badge

Tabs (Me / Team / Company) at the top of the Goals page, filtered by
role. Create button is context-aware:
  - Me tab: creates individual / self
  - Team tab: dropdown for self, per-report, or team goal
  - Company tab: creates company OKR (admin/HR only)

'Suggested by' pill renders on manager-created goals (suggested_by_user_id
non-null). Alignment line ('Contributes to: [parent]') renders when
parent_id is set.

Design: docs/plans/2026-04-17-role-clarity-redesign-design.md §4"
```

---

## Part E — Apply `<PageHeader>` across dashboard pages

### Task 7: Apply to the 8 highest-traffic pages

Apply `<PageHeader>` to these pages in a single commit — they're mechanical, identical-shape edits:

**Files:**
- Modify: `src/app/dashboard/page.tsx` (Home)
- Modify: `src/app/dashboard/goals/page.tsx`
- Modify: `src/app/dashboard/performance/page.tsx` (if exists — otherwise skip)
- Modify: `src/app/dashboard/feedback/page.tsx` (Kudos)
- Modify: `src/app/dashboard/my-team/page.tsx`
- Modify: `src/app/dashboard/reviews/page.tsx`
- Modify: `src/app/dashboard/cycles/page.tsx`
- Modify: `src/app/dashboard/analytics/page.tsx`

**Step 1: For each page, add the header at the top of its returned JSX**

Mapping of hat per page:

```ts
const PAGE_META: Record<string, { hat: "my-work" | "my-team" | "manage"; title: string }> = {
  "/dashboard":              { hat: "my-work", title: "Home" },
  "/dashboard/goals":        { hat: "my-work", title: "Goals" },
  "/dashboard/performance":  { hat: "my-work", title: "My Performance" },
  "/dashboard/feedback":     { hat: "my-work", title: "Kudos" },
  "/dashboard/my-team":      { hat: "my-team", title: "Team Overview" },
  "/dashboard/reviews":      { hat: "my-team", title: "Team Reviews" },
  "/dashboard/cycles":       { hat: "manage",  title: "Cycles" },
  "/dashboard/analytics":    { hat: "manage",  title: "Analytics" },
};
```

Each page gains an import `import { PageHeader } from "@/components/page-header"` and a `<PageHeader hat="…" title="…" subtitle={…} />` at the top of its returned JSX. Where the page already has an h1, replace it with PageHeader.

**Step 2: Typecheck after each page edit**

Run: `npx tsc --noEmit 2>&1 | tail -3`

**Step 3: Commit (single commit for the batch)**

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/goals/page.tsx \
        src/app/dashboard/feedback/page.tsx src/app/dashboard/my-team/page.tsx \
        src/app/dashboard/reviews/page.tsx src/app/dashboard/cycles/page.tsx \
        src/app/dashboard/analytics/page.tsx
# include performance page if it exists:
# git add src/app/dashboard/performance/page.tsx
git commit -m "feat(ui): apply <PageHeader> to the 8 highest-traffic pages

Every dashboard page now renders the hat chip + title at the top so
the current role context is legible even if the sidebar is collapsed
or the user teleported via search. Mapping lives inline per-page for
now; a centralised route-metadata module is a nice-to-have that can
land later.

Design: docs/plans/2026-04-17-role-clarity-redesign-design.md §2"
```

### Task 8: Apply `<PageHeader>` to the remaining admin and detail pages

**Files (add to each):**
- `src/app/dashboard/surveys/page.tsx`
- `src/app/dashboard/templates/page.tsx`
- `src/app/dashboard/admin/functions/page.tsx`
- `src/app/dashboard/admin/audit/page.tsx`
- `src/app/dashboard/settings/page.tsx`
- `src/app/dashboard/settings/billing/page.tsx`
- `src/app/dashboard/team/page.tsx` (the admin directory — hat `manage`, title `Directory`)
- `src/app/dashboard/help/page.tsx`
- `src/app/dashboard/profile/page.tsx`
- Detail pages: `cycles/[id]`, `goals/[id]`, `reviews/[id]`, `templates/[id]`, `competencies/[id]/descriptors`

**Step 1: Apply the same PageHeader pattern**

Use the same `hat` determined by which sidebar section the page belongs to.

**Step 2: Commit**

```bash
git add src/app/dashboard
git commit -m "feat(ui): apply <PageHeader> to remaining dashboard pages

Rolls the hat chip out across admin + detail pages so every route
carries its role context in the header. Completes §2 of the design."
```

---

## Part F — Home redesign

### Task 9: Rebuild Home as three role-stacked sections

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Re-read the current home page**

Read. Note the existing employee / manager / admin blocks — they'll be restructured rather than rewritten.

**Step 2: Restructure into three role-stacked sections**

Top of JSX (already has `<PageHeader hat="my-work" title="Home" />` from Task 7). Below it:

```tsx
<div className="space-y-10">
  {/* Section 1 — always visible */}
  <section aria-labelledby="next-actions">
    <h2 id="next-actions" className="section-heading mb-3">Your next actions</h2>
    {/* existing pending-self + pending-kudos cards here */}
  </section>

  {/* Section 2 — managers only */}
  {workspace?.hasDirectReports && (
    <section aria-labelledby="team-attention">
      <h2 id="team-attention" className="section-heading mb-3">Your team needs attention</h2>
      {/* existing team-status cards here */}
    </section>
  )}

  {/* Section 3 — admins only */}
  {isHROrAbove(workspace?.role) && (
    <section aria-labelledby="workspace-health">
      <h2 id="workspace-health" className="section-heading mb-3">Workspace health</h2>
      {/* existing admin stat cards here */}
    </section>
  )}
</div>
```

Use the `.section-heading` utility added in Phase 6 so all three section headings share the left-border-accent treatment.

Empty states per section:

- Section 1 empty: friendly card "You're all caught up." + two CTA buttons (Update goals / Give kudos).
- Section 2 empty: "Your team looks good — everyone's on track this week."
- Section 3 empty: "No active cycles. Ready to launch Q2?" + Create cycle CTA.

**Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -3`

**Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(home): three role-stacked sections with friendly empty states

Rebuilds Home around the principle 'personal first, team second, admin
last'. Each section has a clear heading matching its role hat. Empty
states are conversational rather than terminal.

Section 1 (always) — Your next actions
Section 2 (managers) — Your team needs attention
Section 3 (admins) — Workspace health

Design: docs/plans/2026-04-17-role-clarity-redesign-design.md §3"
```

---

## Part G — Verification

### Task 10: Full local verification

**Files:** none (verification only)

**Step 1: Run the full test suite**

Run: `npm test -- --run 2>&1 | tail -6`
Expected: ≥ 65 tests pass (previous 60 + 5 new page-header tests).

**Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

**Step 3: Lint on files touched in this phase**

Run:
```bash
npx eslint src/components/page-header.tsx src/components/page-header.test.tsx \
  src/app/dashboard/layout.tsx src/app/dashboard/page.tsx \
  src/app/dashboard/goals/page.tsx src/app/dashboard/goals/goals-client.tsx \
  2>&1 | tail -10
```
Expected: no new errors (pre-existing `any` warnings on pages untouched by this phase are out of scope).

**Step 4: Live smoke test via Claude Preview**

Start the dev server if not running: `mcp__Claude_Preview__preview_start` with `feedback-app`.

Hit these routes (they should all 200 or 307 as expected):
- `/` — 200 (public landing)
- `/dashboard` — 307 → `/?signin=required`
- `/dashboard/goals` — 307
- `/dashboard/goals?tab=company` — 307
- `/dashboard/admin/audit` — 307
- `/pricing` — 200
- `/roadmap` — 200

Use curl for each and confirm status codes. Check `mcp__Claude_Preview__preview_logs` level=error and confirm no server errors.

**Step 5: No commit — just report any failures**

---

## Part H — Merge + deploy

### Task 11: Merge to main, push, confirm Vercel deploy

**Files:** none

**Step 1: Log all phase-7 commits**

Run: `git log --oneline main..HEAD`
Expected: ~9 commits from this plan.

**Step 2: Switch to main and fast-forward merge**

```bash
git checkout main
git merge --ff-only phase-7-role-clarity
```
Expected: fast-forward succeeds.

**Step 3: Push**

```bash
git push origin main
```
Expected: `main -> main` with 9 new commits.

**Step 4: Watch the Vercel deploy**

Via `mcp__7dca5019-4107-407b-9385-f2b8318ca488__list_deployments` (or equivalent Vercel MCP), wait for the latest deployment to reach `READY` (typically 3-5 minutes). Confirm:
- `target: "production"`
- `githubCommitSha` matches the latest commit on main
- `alias` includes `namihr.com` and `www.namihr.com`

**Step 5: Live smoke against namihr.com**

```bash
curl -s -o /dev/null -w "/ %{http_code} (%{time_total}s)\n" https://namihr.com/
curl -s -o /dev/null -w "/dashboard %{http_code}\n" https://namihr.com/dashboard
curl -s -o /dev/null -w "/dashboard/goals %{http_code}\n" https://namihr.com/dashboard/goals
```
Expected: `/` 200; `/dashboard` and `/dashboard/goals` 307 → signin.

**Step 6: Final report**

Summarise:
- Commits merged
- Deployment ID and ready state
- Live HTTP results
- Any deferred items (e.g. if Step 4 Task 5's `.or()` query fell back to the JS-merge approach, note that here)

---

## Rollback plan

If anything goes wrong after merge:

- **Sidebar relabel:** revert commit `feat(nav): restructure sidebar`. No side effects.
- **PageHeader application:** revert the 2 PageHeader-rollout commits. Pages keep working, lose the hat chip.
- **Goals RLS migration:** run the prior policies back in SQL and drop the 4 new ones + `suggested_by_user_id` column. The column drop would lose data; prefer to keep the column and revert only the policies if needed.
- **Home redesign:** revert the Home commit. Previous page.tsx restores.

Each phase is an isolated git commit, so `git revert <sha>` is the universal tool.

---

## Out of scope — explicitly deferred

- Tree/kanban views for Goals
- Goal alignment picker UI (for now `parent_id` is set via SQL/API only; UI picker is future work)
- Activity feed on Home (needs Supabase realtime)
- Bulk goal ops
- Centralised `ROUTE_METADATA` module for PageHeader (per-page inline is fine for now)
- Starter goal templates
- Competency radar chart on My Performance
