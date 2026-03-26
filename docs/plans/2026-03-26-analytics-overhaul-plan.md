# Analytics Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the analytics tab with RLS tenant isolation on all tables, configurable tenure buckets, enhanced current-cycle breakdowns, past-cycles comparison tab, heatmap fixes (manager dimension, dynamic scale-based colors), export (PDF/CSV), and narrative descriptions on all charts.

**Architecture:** Server-side data fetching in Next.js server components with Supabase RLS as the security boundary. Client components for interactive filters, tabs, and export triggers. Tenure buckets stored per workspace, configurable in settings.

**Tech Stack:** Next.js 14 (App Router), Supabase (Postgres + RLS), TypeScript, Tailwind CSS, shadcn/ui, recharts, Vitest

**Design doc:** `docs/plans/2026-03-26-analytics-overhaul-design.md`

---

## Task 1: RLS Tenant Isolation on All Core Tables

This is the #1 priority. Every table with `workspace_id` gets RLS policies.

**Files:**
- Create: `supabase/migrations/20260326_rls_all_tables.sql`

**Step 1: Write the RLS migration**

```sql
-- ============================================================
-- RLS policies for ALL core tables
-- Uses auth_workspace_id() which reads workspace_id from JWT
-- ============================================================

-- 1. workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation_select" ON public.workspaces;
CREATE POLICY "workspace_isolation_select" ON public.workspaces
  FOR SELECT USING (id = auth_workspace_id());
DROP POLICY IF EXISTS "workspace_isolation_update" ON public.workspaces;
CREATE POLICY "workspace_isolation_update" ON public.workspaces
  FOR UPDATE USING (id = auth_workspace_id())
  WITH CHECK (id = auth_workspace_id());

-- 2. users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_workspace_select" ON public.users;
CREATE POLICY "users_workspace_select" ON public.users
  FOR SELECT USING (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "users_workspace_insert" ON public.users;
CREATE POLICY "users_workspace_insert" ON public.users
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "users_workspace_update" ON public.users;
CREATE POLICY "users_workspace_update" ON public.users
  FOR UPDATE USING (workspace_id = auth_workspace_id())
  WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "users_workspace_delete" ON public.users;
CREATE POLICY "users_workspace_delete" ON public.users
  FOR DELETE USING (workspace_id = auth_workspace_id());

-- 3. performance_cycles
ALTER TABLE public.performance_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cycles_workspace_select" ON public.performance_cycles;
CREATE POLICY "cycles_workspace_select" ON public.performance_cycles
  FOR SELECT USING (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "cycles_workspace_insert" ON public.performance_cycles;
CREATE POLICY "cycles_workspace_insert" ON public.performance_cycles
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "cycles_workspace_update" ON public.performance_cycles;
CREATE POLICY "cycles_workspace_update" ON public.performance_cycles
  FOR UPDATE USING (workspace_id = auth_workspace_id())
  WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "cycles_workspace_delete" ON public.performance_cycles;
CREATE POLICY "cycles_workspace_delete" ON public.performance_cycles
  FOR DELETE USING (workspace_id = auth_workspace_id());

-- 4. competencies
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competencies_workspace_select" ON public.competencies;
CREATE POLICY "competencies_workspace_select" ON public.competencies
  FOR SELECT USING (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "competencies_workspace_insert" ON public.competencies;
CREATE POLICY "competencies_workspace_insert" ON public.competencies
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "competencies_workspace_update" ON public.competencies;
CREATE POLICY "competencies_workspace_update" ON public.competencies
  FOR UPDATE USING (workspace_id = auth_workspace_id())
  WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "competencies_workspace_delete" ON public.competencies;
CREATE POLICY "competencies_workspace_delete" ON public.competencies
  FOR DELETE USING (workspace_id = auth_workspace_id());

-- 5. goals
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "goals_workspace_select" ON public.goals;
CREATE POLICY "goals_workspace_select" ON public.goals
  FOR SELECT USING (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "goals_workspace_insert" ON public.goals;
CREATE POLICY "goals_workspace_insert" ON public.goals
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "goals_workspace_update" ON public.goals;
CREATE POLICY "goals_workspace_update" ON public.goals
  FOR UPDATE USING (workspace_id = auth_workspace_id())
  WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "goals_workspace_delete" ON public.goals;
CREATE POLICY "goals_workspace_delete" ON public.goals
  FOR DELETE USING (workspace_id = auth_workspace_id());

-- 6. levels
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "levels_workspace_select" ON public.levels;
CREATE POLICY "levels_workspace_select" ON public.levels
  FOR SELECT USING (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "levels_workspace_insert" ON public.levels;
CREATE POLICY "levels_workspace_insert" ON public.levels
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "levels_workspace_update" ON public.levels;
CREATE POLICY "levels_workspace_update" ON public.levels
  FOR UPDATE USING (workspace_id = auth_workspace_id())
  WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "levels_workspace_delete" ON public.levels;
CREATE POLICY "levels_workspace_delete" ON public.levels
  FOR DELETE USING (workspace_id = auth_workspace_id());

-- 7. job_families
ALTER TABLE public.job_families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_families_workspace_select" ON public.job_families;
CREATE POLICY "job_families_workspace_select" ON public.job_families
  FOR SELECT USING (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "job_families_workspace_insert" ON public.job_families;
CREATE POLICY "job_families_workspace_insert" ON public.job_families
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "job_families_workspace_update" ON public.job_families;
CREATE POLICY "job_families_workspace_update" ON public.job_families
  FOR UPDATE USING (workspace_id = auth_workspace_id())
  WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "job_families_workspace_delete" ON public.job_families;
CREATE POLICY "job_families_workspace_delete" ON public.job_families
  FOR DELETE USING (workspace_id = auth_workspace_id());

-- 8. subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_workspace_select" ON public.subscriptions;
CREATE POLICY "subscriptions_workspace_select" ON public.subscriptions
  FOR SELECT USING (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS "subscriptions_workspace_update" ON public.subscriptions;
CREATE POLICY "subscriptions_workspace_update" ON public.subscriptions
  FOR UPDATE USING (workspace_id = auth_workspace_id())
  WITH CHECK (workspace_id = auth_workspace_id());

-- 9. review_responses (no workspace_id — scope via review_assignments join)
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "responses_workspace_select" ON public.review_responses;
CREATE POLICY "responses_workspace_select" ON public.review_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.review_assignments ra
      JOIN public.performance_cycles pc ON pc.id = ra.cycle_id
      WHERE ra.id = review_responses.assignment_id
        AND pc.workspace_id = auth_workspace_id()
    )
  );
DROP POLICY IF EXISTS "responses_workspace_insert" ON public.review_responses;
CREATE POLICY "responses_workspace_insert" ON public.review_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.review_assignments ra
      JOIN public.performance_cycles pc ON pc.id = ra.cycle_id
      WHERE ra.id = review_responses.assignment_id
        AND pc.workspace_id = auth_workspace_id()
    )
  );
DROP POLICY IF EXISTS "responses_workspace_update" ON public.review_responses;
CREATE POLICY "responses_workspace_update" ON public.review_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.review_assignments ra
      JOIN public.performance_cycles pc ON pc.id = ra.cycle_id
      WHERE ra.id = review_responses.assignment_id
        AND pc.workspace_id = auth_workspace_id()
    )
  );
```

**Step 2: Apply the migration**

Use Supabase MCP `apply_migration` tool with name `rls_all_tables` and the SQL above.

**Step 3: Verify RLS is active**

Run SQL: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
Expected: All core tables show `rowsecurity = true`.

**Step 4: Verify existing app still works**

Start the dev server, navigate to dashboard. Verify team page, analytics page, and settings all load correctly. The `.eq("workspace_id", ...)` filters remain as defense-in-depth.

**Step 5: Commit**

```bash
git add supabase/migrations/20260326_rls_all_tables.sql
git commit -m "security: add RLS tenant isolation to all core tables"
```

---

## Task 2: Rename `hire_date` to `start_date`

**Files:**
- Create: `supabase/migrations/20260326_rename_hire_date.sql`
- Modify: `src/lib/types.ts` — line with `hire_date` field in User type
- Modify: `src/app/dashboard/team/import/page.tsx` — line 346 mapping `hire_date`
- Modify: `src/app/dashboard/analytics/page.tsx` — lines 44-52 `getTenureBucket` references
- Modify: `src/app/dashboard/team/team-list.tsx` — any `hire_date` references
- Modify: `src/app/dashboard/team/[id]/edit/page.tsx` — any `hire_date` references
- Modify: `src/app/dashboard/team/[id]/page.tsx` — any `hire_date` references

**Step 1: Write the migration**

```sql
ALTER TABLE public.users RENAME COLUMN hire_date TO start_date;
```

**Step 2: Apply the migration**

Use Supabase MCP `apply_migration` with name `rename_hire_date_to_start_date`.

**Step 3: Update TypeScript types**

In `src/lib/types.ts`, find the User interface and change `hire_date` to `start_date`.

**Step 4: Update all code references**

Search for all occurrences of `hire_date` across the codebase and replace with `start_date`. Key files:
- `src/app/dashboard/team/import/page.tsx` line 346: change `hire_date: row.start_date` to `start_date: row.start_date`
- `src/app/dashboard/analytics/page.tsx` line 45: change `hireDate` parameter name to `startDate`
- `src/app/dashboard/team/team-list.tsx`: update any `hire_date` references
- `src/app/dashboard/team/[id]/edit/page.tsx`: update any `hire_date` references
- `src/app/dashboard/team/[id]/page.tsx`: update any `hire_date` references

**Step 5: Verify the app compiles**

Run: `npx next build` or start dev server and check for TypeScript errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename hire_date to start_date across DB and codebase"
```

---

## Task 3: Configurable Tenure Buckets — Database

**Files:**
- Create: `supabase/migrations/20260326_tenure_buckets.sql`

**Step 1: Write the migration**

```sql
-- Tenure buckets table
CREATE TABLE public.tenure_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  min_months INTEGER NOT NULL DEFAULT 0,
  max_months INTEGER, -- NULL means unbounded (e.g., "10yr+")
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for workspace lookups
CREATE INDEX idx_tenure_buckets_workspace ON public.tenure_buckets(workspace_id, sort_order);

-- RLS
ALTER TABLE public.tenure_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenure_buckets_workspace_select" ON public.tenure_buckets
  FOR SELECT USING (workspace_id = auth_workspace_id());
CREATE POLICY "tenure_buckets_workspace_insert" ON public.tenure_buckets
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
CREATE POLICY "tenure_buckets_workspace_update" ON public.tenure_buckets
  FOR UPDATE USING (workspace_id = auth_workspace_id())
  WITH CHECK (workspace_id = auth_workspace_id());
CREATE POLICY "tenure_buckets_workspace_delete" ON public.tenure_buckets
  FOR DELETE USING (workspace_id = auth_workspace_id());

-- Seed default buckets for all existing workspaces
INSERT INTO public.tenure_buckets (workspace_id, label, min_months, max_months, sort_order)
SELECT w.id, bucket.label, bucket.min_months, bucket.max_months, bucket.sort_order
FROM public.workspaces w
CROSS JOIN (VALUES
  ('< 1 year',   0,   12, 0),
  ('1–2 years', 12,   24, 1),
  ('2–5 years', 24,   60, 2),
  ('5–10 years', 60, 120, 3),
  ('10+ years', 120, NULL, 4)
) AS bucket(label, min_months, max_months, sort_order);

-- Function to seed defaults for new workspaces (call from app code on workspace creation)
CREATE OR REPLACE FUNCTION public.seed_default_tenure_buckets(ws_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.tenure_buckets (workspace_id, label, min_months, max_months, sort_order)
  VALUES
    (ws_id, '< 1 year',   0,   12, 0),
    (ws_id, '1–2 years', 12,   24, 1),
    (ws_id, '2–5 years', 24,   60, 2),
    (ws_id, '5–10 years', 60, 120, 3),
    (ws_id, '10+ years', 120, NULL, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Apply the migration**

Use Supabase MCP `apply_migration` with name `tenure_buckets`.

**Step 3: Verify data**

Run SQL: `SELECT * FROM tenure_buckets ORDER BY workspace_id, sort_order;`
Expected: 5 rows per workspace with correct bucket definitions.

**Step 4: Add TypeScript type**

In `src/lib/types.ts`, add:

```typescript
export interface TenureBucket {
  id: string;
  workspace_id: string;
  label: string;
  min_months: number;
  max_months: number | null;
  sort_order: number;
}
```

**Step 5: Commit**

```bash
git add supabase/migrations/20260326_tenure_buckets.sql src/lib/types.ts
git commit -m "feat: add configurable tenure buckets table with RLS and defaults"
```

---

## Task 4: Tenure Buckets — Settings UI

**Files:**
- Modify: `src/app/dashboard/settings/settings-client.tsx` — add tenure buckets section after Rating Scale card (~line 264)
- Modify: `src/app/dashboard/settings/page.tsx` — fetch tenure buckets and pass as prop

**Step 1: Update settings server page to fetch tenure buckets**

In `src/app/dashboard/settings/page.tsx`, after fetching workspace data, add a query:

```typescript
const { data: tenureBuckets } = await supabase
  .from("tenure_buckets")
  .select("*")
  .eq("workspace_id", workspace.id)
  .order("sort_order");
```

Pass `tenureBuckets` to `SettingsClient`.

**Step 2: Add tenure buckets UI to settings client**

In `src/app/dashboard/settings/settings-client.tsx`:

- Add `TenureBucket` to imports from types
- Add `tenureBuckets` to Props interface
- Add state: `const [buckets, setBuckets] = useState(workspace.tenureBuckets)`
- Add a new Card after the Rating Scale card with:
  - Title: "Tenure Buckets" with Clock icon
  - Description: "Define how employee tenure is grouped in analytics. Based on time since start date."
  - Editable list of buckets, each row showing: label input, min months input, max months input (empty = unbounded)
  - "Add bucket" button at bottom
  - Delete button (trash icon) per row
  - Reorder via sort_order
- Update `handleSave` to upsert tenure buckets:
  - Delete existing buckets for workspace
  - Insert all current buckets with correct sort_order

**Step 3: Verify in browser**

Navigate to Settings. See the new "Tenure Buckets" card. Edit a label, add a bucket, remove one, save. Verify data persists on page reload.

**Step 4: Commit**

```bash
git add src/app/dashboard/settings/settings-client.tsx src/app/dashboard/settings/page.tsx
git commit -m "feat: add tenure buckets configuration UI in workspace settings"
```

---

## Task 5: Update Heatmap to Use Configurable Tenure Buckets

**Files:**
- Modify: `src/app/dashboard/analytics/page.tsx` — lines 44-52 (remove `getTenureBucket`), lines 397-493 (heatmap data function)

**Step 1: Fetch tenure buckets in heatmap data function**

In `getHeatmapData()` (~line 397), add a query for `tenure_buckets` ordered by `sort_order`.

**Step 2: Replace hardcoded getTenureBucket**

Remove the `getTenureBucket()` function (lines 44-52). Replace with a function that takes `startDate` and `buckets[]` and returns the matching bucket label:

```typescript
function getEmployeeTenureBucket(
  startDate: string | null | undefined,
  buckets: TenureBucket[]
): string {
  if (!startDate) return "Not set";
  const ms = Date.now() - new Date(startDate).getTime();
  const months = ms / (1000 * 60 * 60 * 24 * 30.44);
  for (const b of buckets) {
    if (months >= b.min_months && (b.max_months === null || months < b.max_months)) {
      return b.label;
    }
  }
  return "Not set";
}
```

**Step 3: Update heatmap grouping logic**

In the tenure dimension case (~line 420), use `getEmployeeTenureBucket(u.start_date, tenureBuckets)` instead of `getTenureBucket(u.hire_date)`.

**Step 4: Verify heatmap**

Navigate to Analytics > Heatmap > select Tenure dimension. Verify employees are grouped by configured buckets, not showing "Unknown".

**Step 5: Commit**

```bash
git add src/app/dashboard/analytics/page.tsx
git commit -m "feat: heatmap uses configurable tenure buckets from DB"
```

---

## Task 6: Add Manager Dimension to Heatmap

**Files:**
- Modify: `src/app/dashboard/analytics/analytics-heatmap-dim-switcher.tsx` — add "manager" option
- Modify: `src/app/dashboard/analytics/page.tsx` — add manager grouping logic in heatmap

**Step 1: Add manager to dimension switcher**

In `analytics-heatmap-dim-switcher.tsx`, update the type and array:

```typescript
export type HeatmapDim = "role" | "department" | "level" | "tenure" | "manager";

const DIMS: { id: HeatmapDim; label: string }[] = [
  { id: "role", label: "Role" },
  { id: "department", label: "Department" },
  { id: "level", label: "Level" },
  { id: "tenure", label: "Tenure" },
  { id: "manager", label: "Manager" },
];
```

**Step 2: Add manager grouping in heatmap data**

In `getHeatmapData()` in `page.tsx`, add a case for `dim === "manager"`:

```typescript
case "manager": {
  // Find the manager name from the users list
  const mgr = allUsers.find((m) => m.id === u.manager_id);
  return mgr ? mgr.slack_name : "No manager";
}
```

**Step 3: Update HeatmapTypes in page.tsx**

Update the type union at ~line 16 to include `"manager"`.

**Step 4: Verify in browser**

Navigate to Analytics > Heatmap > select Manager dimension. Verify columns show manager names with correct competency averages.

**Step 5: Commit**

```bash
git add src/app/dashboard/analytics/analytics-heatmap-dim-switcher.tsx src/app/dashboard/analytics/page.tsx
git commit -m "feat: add manager dimension to analytics heatmap"
```

---

## Task 7: Dynamic Heatmap Colors Based on Rating Scale

**Files:**
- Modify: `src/app/dashboard/analytics/page.tsx` — replace `heatmapCellClass` function (lines 55-61)
- Create: `src/components/charts/heatmap-colors.ts` — dynamic color generation utility

**Step 1: Create color utility**

Create `src/components/charts/heatmap-colors.ts`:

```typescript
// Color stops from red (low) to emerald (high)
const COLOR_STOPS = [
  { bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300" },
  { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-yellow-100 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-300" },
  { bg: "bg-lime-100 dark:bg-lime-950/40", text: "text-lime-700 dark:text-lime-300" },
  { bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-700 dark:text-green-300" },
  { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300" },
];

export interface RatingScale {
  min: number;
  max: number;
  labels: Record<string, string>;
}

export function getHeatmapColor(avg: number | null, scale: RatingScale): string {
  if (avg === null) return "";
  const range = scale.max - scale.min;
  const normalized = (avg - scale.min) / range; // 0 to 1
  const idx = Math.min(
    COLOR_STOPS.length - 1,
    Math.max(0, Math.round(normalized * (COLOR_STOPS.length - 1)))
  );
  return COLOR_STOPS[idx].bg;
}

export function getHeatmapLegend(scale: RatingScale) {
  const points: { value: number; label: string; color: string }[] = [];
  for (let v = scale.min; v <= scale.max; v++) {
    const normalized = (v - scale.min) / (scale.max - scale.min);
    const idx = Math.min(
      COLOR_STOPS.length - 1,
      Math.max(0, Math.round(normalized * (COLOR_STOPS.length - 1)))
    );
    points.push({
      value: v,
      label: scale.labels[String(v)] || String(v),
      color: COLOR_STOPS[idx].bg,
    });
  }
  return points;
}
```

**Step 2: Update heatmap rendering in page.tsx**

Replace `heatmapCellClass()` with `getHeatmapColor(avg, workspace.ratingScale)`. Add a legend row below the heatmap using `getHeatmapLegend()`.

**Step 3: Pass ratingScale to heatmap section**

The workspace data from `getUserWorkspace()` already includes `ratingScale`. Use it in the heatmap rendering section.

**Step 4: Verify in browser**

Navigate to Analytics > Heatmap. Verify cells use the dynamic color scale. Check that a 5-point scale shows 5 distinct colors in the legend and a 3-point scale shows 3.

**Step 5: Commit**

```bash
git add src/components/charts/heatmap-colors.ts src/app/dashboard/analytics/page.tsx
git commit -m "feat: dynamic heatmap colors based on workspace rating scale"
```

---

## Task 8: Narrative Descriptions on All Existing Charts & KPIs

**Files:**
- Modify: `src/app/dashboard/analytics/page.tsx` — add subtitles to all KPI cards and chart sections
- Modify: `src/app/dashboard/analytics/analytics-charts.tsx` — add subtitle props
- Modify: `src/app/dashboard/analytics/analytics-trends.tsx` — add subtitle

**Step 1: Add subtitles to KPI cards in page.tsx**

In the Overview tab section (~line 575-630), add a `<p className="text-xs text-muted-foreground">` under each KPI card title:

| KPI | Subtitle |
|-----|----------|
| Overall Rating | Average rating across all competencies for the selected cycle |
| Completion Rate | Percentage of assigned reviews that have been submitted |
| Total Ratings | Number of individual competency ratings submitted |
| Participants | Number of employees with at least one review assignment |
| Active Cycles | Number of cycles currently in active or in-review status |

**Step 2: Add subtitles to chart components**

Update `analytics-charts.tsx` to accept and render subtitles for each chart section. Add a `descriptions` prop or inline the descriptions:

| Chart | Subtitle |
|-------|----------|
| Rating Distribution | How ratings are spread across the scale for the selected cycle |
| By Function | Average rating per job function — identify strengths and development areas across disciplines |
| By Department | Average rating per department for the selected cycle |
| Competency Breakdown | Average rating for each competency — showing organisational strengths and gaps |
| Goal Progress | Distribution of goal tracking statuses across the organisation |

**Step 3: Add subtitles to trends**

Update `analytics-trends.tsx` to show:
- Rating Trend: "How average ratings have changed across recent cycles"
- Completion Trend: "How review completion rates have changed across recent cycles"

**Step 4: Add subtitle to heatmap section**

In the heatmap tab section of `page.tsx`, add:
- Title: "Competency Heatmap"
- Subtitle: "Average ratings across competencies, grouped by the selected dimension. Colors reflect your rating scale."

**Step 5: Verify all subtitles render**

Navigate through Overview and Heatmap tabs. Every chart and KPI should have a visible subtitle.

**Step 6: Commit**

```bash
git add src/app/dashboard/analytics/page.tsx src/app/dashboard/analytics/analytics-charts.tsx src/app/dashboard/analytics/analytics-trends.tsx
git commit -m "feat: add narrative descriptions to all analytics charts and KPIs"
```

---

## Task 9: Enhanced Current Cycle — Breakdown Charts

**Files:**
- Modify: `src/app/dashboard/analytics/page.tsx` — add department/function breakdown data to `getAnalyticsData()`
- Create: `src/app/dashboard/analytics/analytics-breakdowns.tsx` — new component for breakdown bar charts

**Step 1: Compute breakdown data server-side**

In `getAnalyticsData()` (~line 95), add computation for:

```typescript
// Completion rate by department
const completionByDepartment: { name: string; value: number }[] = [];
const deptGroups = new Map<string, { completed: number; total: number }>();
for (const a of filteredAssignments) {
  const emp = usersById.get(a.employee_id);
  const dept = emp?.department || "Unknown";
  const g = deptGroups.get(dept) || { completed: 0, total: 0 };
  g.total++;
  if (a.status === "completed") g.completed++;
  deptGroups.set(dept, g);
}
for (const [name, g] of deptGroups) {
  completionByDepartment.push({ name, value: Math.round((g.completed / g.total) * 100) });
}

// Same pattern for: completionByFunction, avgRatingByDepartment, avgRatingByFunction
```

Return these in the analytics data object.

**Step 2: Create breakdown charts component**

Create `src/app/dashboard/analytics/analytics-breakdowns.tsx`:

```typescript
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface BreakdownChart {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
  unit: string; // "%" or ""
}

export function AnalyticsBreakdowns({ charts }: { charts: BreakdownChart[] }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {charts.map((chart) => (
        <div key={chart.title} className="space-y-2">
          <h3 className="text-sm font-semibold">{chart.title}</h3>
          <p className="text-xs text-muted-foreground">{chart.subtitle}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart.data} layout="vertical">
              <XAxis type="number" domain={chart.unit === "%" ? [0, 100] : undefined} />
              <YAxis type="category" dataKey="name" width={120} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Render breakdowns in Overview tab**

In `page.tsx`, add the breakdowns component after the existing charts, with these 4 charts:
- "Completion Rate by Department" / "Percentage of reviews submitted by employees in each department"
- "Completion Rate by Function" / "Percentage of reviews submitted per job function"
- "Avg Rating by Department" / "Average competency rating per department"
- "Avg Rating by Function" / "Average competency rating per job function"

**Step 4: Verify in browser**

Navigate to Analytics > Overview. See the 4 new breakdown charts with correct data and subtitles.

**Step 5: Commit**

```bash
git add src/app/dashboard/analytics/page.tsx src/app/dashboard/analytics/analytics-breakdowns.tsx
git commit -m "feat: add completion rate and avg rating breakdowns by department and function"
```

---

## Task 10: Past Cycles Comparison — New Tab

**Files:**
- Modify: `src/app/dashboard/analytics/analytics-tab-nav.tsx` — add "Cycles" tab
- Create: `src/app/dashboard/analytics/analytics-cycles.tsx` — cycles comparison client component
- Modify: `src/app/dashboard/analytics/page.tsx` — add `getCyclesComparisonData()` function and render tab

**Step 1: Add "Cycles" tab to navigator**

In `analytics-tab-nav.tsx`:

```typescript
type Tab = "overview" | "heatmap" | "cycles";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "heatmap", label: "Heatmap" },
  { id: "cycles", label: "Cycles" },
];
```

**Step 2: Create cycles comparison data function**

In `page.tsx`, add `getCyclesComparisonData(workspaceId, showAll)`:

```typescript
async function getCyclesComparisonData(workspaceId: string, showAll: boolean) {
  const supabase = await createClient();

  // Fetch cycles ordered by start_date desc
  let cyclesQ = supabase
    .from("performance_cycles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "in_review", "completed", "closed"])
    .order("start_date", { ascending: false });

  if (!showAll) {
    cyclesQ = cyclesQ.limit(4);
  }

  const { data: cycles } = await cyclesQ;
  if (!cycles?.length) return { cycles: [], byDepartment: [], byFunction: [], byManager: [] };

  // For each cycle, compute: completion rate, avg rating, participants
  // Also compute breakdowns by department, function, manager
  // ... (aggregate from review_assignments + review_responses joined to users)

  return { cycles: cycleRows, byDepartment, byFunction, byManager, topManagers, bottomManagers };
}
```

**Step 3: Create cycles comparison client component**

Create `src/app/dashboard/analytics/analytics-cycles.tsx`:

- Comparison table: rows = cycles, columns = name, status badge, dates, completion %, avg rating, participants
- "Show all cycles" button at bottom (triggers page reload with `?showAll=true`)
- Breakdown toggle: Department / Function / Manager tabs
- Manager view: dropdown to select manager + their team data across cycles
- Top 5 / Bottom 5 manager cards below the dropdown

Each section gets title + subtitle:
- "Cycle Comparison" / "Performance metrics across your last review cycles, including the current one"
- "By Department" / "Completion rates and average ratings broken down by department for each cycle"
- "By Function" / "Completion rates and average ratings broken down by job function for each cycle"
- "By Manager" / "Select a manager to see their team's performance across cycles"
- "Top Performers" / "Managers with the highest team completion rates in the current cycle"
- "Needs Attention" / "Managers with the lowest team completion rates in the current cycle"

**Step 4: Render in page.tsx**

Add conditional rendering for `activeTab === "cycles"` alongside the existing overview and heatmap sections.

**Step 5: Verify in browser**

Navigate to Analytics > Cycles tab. See comparison table with last 4 cycles. Click "Show all" to expand. Switch between Department/Function/Manager breakdowns. Select a manager from dropdown.

**Step 6: Commit**

```bash
git add src/app/dashboard/analytics/analytics-tab-nav.tsx src/app/dashboard/analytics/analytics-cycles.tsx src/app/dashboard/analytics/page.tsx
git commit -m "feat: add past cycles comparison tab with department/function/manager breakdowns"
```

---

## Task 11: Export — PDF & CSV

**Files:**
- Create: `src/app/api/analytics/export/route.ts` — API route for server-side export
- Create: `src/app/dashboard/analytics/analytics-export-button.tsx` — export button component
- Modify: `src/app/dashboard/analytics/page.tsx` — add export button to page header

**Step 1: Create export API route**

Create `src/app/api/analytics/export/route.ts`:

- Accept query params: `format` (pdf|csv), `cycleId`, `functionId`, `department`, `tab`
- Authenticate using `getUserWorkspace()` — ensures workspace scoping
- For CSV: query the same data as the analytics page, flatten into rows, return as `text/csv` with `Content-Disposition: attachment`
- For PDF: use the same data, generate HTML, convert to PDF using a lightweight library (or return HTML for client-side print)
- All queries go through RLS-protected Supabase client

CSV columns: `cycle_name, employee_name, department, function, manager, competency, rating, assignment_status`

**Step 2: Create export button component**

Create `src/app/dashboard/analytics/analytics-export-button.tsx`:

```typescript
"use client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";

export function AnalyticsExportButton({ searchParams }: { searchParams: Record<string, string> }) {
  const exportUrl = (format: string) => {
    const params = new URLSearchParams({ ...searchParams, format });
    return `/api/analytics/export?${params}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => window.open(exportUrl("csv"))}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.print()}>
          Export as PDF (Print)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 3: Add export button to page**

In `page.tsx`, add the export button next to the filter bar in the page header area.

**Step 4: Verify export works**

Click Export > CSV. Verify a `.csv` file downloads with correct columns and workspace-scoped data. Click Export > PDF. Verify the print dialog opens with the analytics page formatted for print.

**Step 5: Commit**

```bash
git add src/app/api/analytics/export/route.ts src/app/dashboard/analytics/analytics-export-button.tsx src/app/dashboard/analytics/page.tsx
git commit -m "feat: add CSV and PDF export for analytics data"
```

---

## Task 12: Final Verification & Security Audit

**Files:** None new — this is a verification task.

**Step 1: Verify RLS on all tables**

Run SQL:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
Expected: ALL tables show `rowsecurity = true`.

**Step 2: Test cross-tenant isolation**

If possible, verify that queries from one workspace cannot access another workspace's data. This can be tested by checking that the RLS policies properly filter.

**Step 3: Run the full app**

Navigate through all analytics tabs (Overview, Heatmap, Cycles). Verify:
- All charts have titles + subtitles
- Heatmap tenure shows configured buckets (not "Unknown")
- Heatmap manager dimension works
- Heatmap colors match the rating scale
- Cycles tab shows last 4 cycles with correct data
- Manager dropdown and top/bottom 5 work
- Export CSV downloads correct data
- Settings page shows tenure buckets config

**Step 4: Run existing tests**

Run: `npx vitest run`
Expected: All existing tests pass.

**Step 5: Check for TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 6: Run security advisors**

Use Supabase MCP `get_advisors` with type "security" to check for any remaining issues.

**Step 7: Final commit**

If any fixes were needed during verification, commit them:

```bash
git commit -m "fix: address issues found during analytics overhaul verification"
```

---

## Summary of All Tasks

| # | Task | Key Deliverable |
|---|------|----------------|
| 1 | RLS Tenant Isolation | Migration: RLS on all tables |
| 2 | Rename hire_date → start_date | Migration + code updates |
| 3 | Tenure Buckets — Database | Migration: tenure_buckets table |
| 4 | Tenure Buckets — Settings UI | Settings page new card |
| 5 | Heatmap Uses Configurable Buckets | Remove hardcoded getTenureBucket |
| 6 | Manager Dimension in Heatmap | New dimension option |
| 7 | Dynamic Heatmap Colors | Color utility + legend |
| 8 | Narrative Descriptions | Subtitles on all charts/KPIs |
| 9 | Current Cycle Breakdowns | 4 new breakdown charts |
| 10 | Past Cycles Comparison Tab | New "Cycles" tab |
| 11 | Export PDF & CSV | API route + button |
| 12 | Final Verification | Security audit + testing |
