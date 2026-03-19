# Performance Heatmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Heatmap" tab to the Analytics page showing average competency ratings grouped by role (or dept/level/tenure), with colour-coded cells and sample-size counts.

**Architecture:** URL-param-based tab switching (`?tab=heatmap`) keeps the page a pure server component with no client-side data fetching. A new `getHeatmapData()` server function fetches review_responses joined to competencies and users, aggregates in memory, and returns a typed `HeatmapData` struct. A small `AnalyticsTabNav` client component drives tab switching by writing to the URL. The heatmap table is inline JSX in page.tsx — no new files, no new npm packages.

**Tech Stack:** Next.js 15 App Router server component, Supabase JS client, shadcn/ui (Card, CardContent), Tailwind CSS, TypeScript

---

### Task 1: Add tab navigation (Overview ↔ Heatmap)

**Files:**
- Create: `src/app/dashboard/analytics/analytics-tab-nav.tsx`
- Modify: `src/app/dashboard/analytics/page.tsx` (read `tab` param, wrap existing sections, add heatmap placeholder)

**Context:** The analytics page is currently a flat scrollable page — no tabs exist. We're adding URL-based tabs so the server component can conditionally render content. `tab=overview` (default) shows everything that's there now. `tab=heatmap` will show the heatmap (stub for now, real data in Task 3).

**Step 1: Create `AnalyticsTabNav` client component**

Create `src/app/dashboard/analytics/analytics-tab-nav.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "heatmap";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "heatmap", label: "Heatmap" },
];

interface AnalyticsTabNavProps {
  activeTab: Tab;
}

export function AnalyticsTabNav({ activeTab }: AnalyticsTabNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const switchTab = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      // Reset heatmap-specific params when leaving heatmap
      if (tab === "overview") {
        params.delete("heatmap_dim");
      }
      router.push(`/dashboard/analytics?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => switchTab(t.id)}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            activeTab === t.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Update page.tsx to read `tab` param and render tab nav**

In `src/app/dashboard/analytics/page.tsx`:

a) Add `Grid3X3` is already imported. Also add `AnalyticsTabNav` import:
```tsx
import { AnalyticsTabNav } from "./analytics-tab-nav";
```

b) Add `tab` and `heatmap_dim` to the searchParams destructure:
```tsx
// Change:
searchParams: Promise<{ cycleId?: string; functionId?: string; department?: string }>;
// To:
searchParams: Promise<{ cycleId?: string; functionId?: string; department?: string; tab?: string; heatmap_dim?: string }>;
```

c) After `const params = await searchParams;`, add:
```tsx
const activeTab = (params.tab === "heatmap" ? "heatmap" : "overview") as "overview" | "heatmap";
```

d) In the JSX, insert `<AnalyticsTabNav>` between the header and the filter bar:
```tsx
{/* Header */}
<div>
  <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
  <p className="text-sm text-muted-foreground mt-1">
    Performance insights for {workspace?.workspaceName || "your workspace"}
  </p>
</div>

{/* Tab nav */}
<AnalyticsTabNav activeTab={activeTab} />

{/* Filter bar */}
<AnalyticsFilterBar ... />
```

e) Wrap ALL existing content after the filter bar (KPI tiles, empty state, charts, ranking, trends) in:
```tsx
{activeTab === "overview" && (
  <>
    {/* KPI tiles */}
    ...
    {/* Empty state */}
    ...
    {/* Charts */}
    ...
    {/* Performance Ranking */}
    ...
    {/* Trends */}
    ...
  </>
)}
```

f) After the overview block, add the heatmap stub:
```tsx
{activeTab === "heatmap" && (
  <Card className="border-border/60">
    <CardContent className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Heatmap coming in next step…</p>
    </CardContent>
  </Card>
)}
```

**Step 3: Verify the build compiles**

Run:
```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully` — no TypeScript errors.

**Step 4: Commit**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/analytics/analytics-tab-nav.tsx src/app/dashboard/analytics/page.tsx
git commit -m "feat: add Overview/Heatmap tab nav to analytics page"
```

---

### Task 2: Heatmap data query

**Files:**
- Modify: `src/app/dashboard/analytics/page.tsx` (add helpers + `getHeatmapData` function, pass data to page)

**Context:** We need a server-side function that:
1. Fetches `review_responses` with competency name + reviewer's employee ID (via `review_assignments`)
2. Fetches `users` with role, department, level name, and hire_date
3. Filters by `cycleId` if set
4. Aggregates into `HeatmapData` struct indexed by `competencyName::groupValue`

**Step 1: Add types and helpers at the top of page.tsx (after existing types)**

Add after the `FilterParams` interface:

```tsx
// ─── Heatmap types ────────────────────────────────────────────────────────────

type HeatmapDim = "role" | "department" | "level" | "tenure";

interface HeatmapCell {
  sum: number;
  count: number;
}

interface HeatmapData {
  competencies: string[];          // sorted alphabetically
  groups: string[];                // sorted alphabetically
  cells: Record<string, HeatmapCell>;           // key: `${comp}::${group}`
  overallByGroup: Record<string, HeatmapCell>;  // "Overall" row
  overallByComp: Record<string, HeatmapCell>;   // "All" column
  grandTotal: HeatmapCell;
}

// ─── Heatmap helpers ──────────────────────────────────────────────────────────

function getTenureBucket(hireDate: string | null | undefined): string {
  if (!hireDate) return "Unknown";
  const ms = Date.now() - new Date(hireDate).getTime();
  const years = ms / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) return "< 1yr";
  if (years < 2) return "1–2yr";
  if (years < 5) return "2–5yr";
  return "5yr+";
}

function heatmapCellClass(avg: number | null): string {
  if (avg === null) return "";
  if (avg >= 4.5) return "bg-emerald-50 dark:bg-emerald-950/40";
  if (avg >= 3.5) return "bg-primary/5 dark:bg-primary/10";
  if (avg >= 2.5) return "bg-amber-50 dark:bg-amber-950/40";
  return "bg-red-50 dark:bg-red-950/40";
}
```

**Step 2: Add `getHeatmapData` function after `getTrendsData`**

```tsx
async function getHeatmapData(filters: FilterParams, dim: HeatmapDim): Promise<HeatmapData> {
  const supabase = await createServerSupabaseClient();

  // 1. Fetch users with dimension fields
  const { data: usersRaw } = await supabase
    .from("users")
    .select("id, role, department, hire_date, level:levels!users_level_id_fkey(name)");

  const userMap = new Map(
    (usersRaw || []).map((u: any) => {
      let groupValue: string;
      if (dim === "role") groupValue = u.role || "Unknown";
      else if (dim === "department") groupValue = u.department || "Unknown";
      else if (dim === "level") groupValue = (u.level as any)?.name || "Unknown";
      else groupValue = getTenureBucket(u.hire_date);
      return [u.id as string, groupValue];
    })
  );

  // 2. Fetch responses with competency name and assignment employee_id
  let responsesQuery = supabase
    .from("review_responses")
    .select("rating, competency:competencies(name), assignment:review_assignments!inner(employee_id, cycle_id)")
    .not("rating", "is", null);

  // Note: PostgREST doesn't support filtering on nested table directly; filter in memory
  const { data: responsesRaw } = await responsesQuery;

  const responses = (responsesRaw || []).filter((r: any) => {
    if (filters.cycleId && (r.assignment as any)?.cycle_id !== filters.cycleId) return false;
    const empId = (r.assignment as any)?.employee_id;
    if (!empId) return false;
    return userMap.has(empId);
  });

  // 3. Aggregate
  const cells: Record<string, HeatmapCell> = {};
  const overallByGroup: Record<string, HeatmapCell> = {};
  const overallByComp: Record<string, HeatmapCell> = {};
  const grandTotal: HeatmapCell = { sum: 0, count: 0 };
  const competencySet = new Set<string>();
  const groupSet = new Set<string>();

  function accumulate(cell: HeatmapCell, rating: number) {
    cell.sum += rating;
    cell.count += 1;
  }

  for (const r of responses) {
    const comp = (r.competency as any)?.name as string | undefined;
    const empId = (r.assignment as any)?.employee_id as string;
    const group = userMap.get(empId);
    const rating = r.rating as number;

    if (!comp || !group) continue;

    competencySet.add(comp);
    groupSet.add(group);

    const cellKey = `${comp}::${group}`;
    if (!cells[cellKey]) cells[cellKey] = { sum: 0, count: 0 };
    accumulate(cells[cellKey], rating);

    if (!overallByGroup[group]) overallByGroup[group] = { sum: 0, count: 0 };
    accumulate(overallByGroup[group], rating);

    if (!overallByComp[comp]) overallByComp[comp] = { sum: 0, count: 0 };
    accumulate(overallByComp[comp], rating);

    accumulate(grandTotal, rating);
  }

  return {
    competencies: [...competencySet].sort(),
    groups: [...groupSet].sort(),
    cells,
    overallByGroup,
    overallByComp,
    grandTotal,
  };
}
```

**Step 3: Read `heatmap_dim` in the page function and call `getHeatmapData`**

In the `AnalyticsPage` function, after reading `params`:

```tsx
const heatmapDim = (["role", "department", "level", "tenure"].includes(params.heatmap_dim || "")
  ? params.heatmap_dim
  : "role") as HeatmapDim;
```

Add `getHeatmapData` to the `Promise.all`:
```tsx
const [filterOptions, analytics, trends, heatmapData] = await Promise.all([
  getFilterOptions(),
  getAnalyticsData(filters),
  getTrendsData({ functionId: filters.functionId, department: filters.department }),
  getHeatmapData(filters, heatmapDim),
]);
```

**Step 4: Verify build**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`

**Step 5: Commit**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/analytics/page.tsx
git commit -m "feat: add getHeatmapData server function for competency heatmap"
```

---

### Task 3: Build the heatmap table UI

**Files:**
- Create: `src/app/dashboard/analytics/analytics-heatmap-dim-switcher.tsx`
- Modify: `src/app/dashboard/analytics/page.tsx` (replace stub with full heatmap JSX)

**Context:** The heatmap stub from Task 1 (`{activeTab === "heatmap" && ...}`) is replaced with the real table. A small `AnalyticsHeatmapDimSwitcher` client component lets the user toggle Role / Department / Level / Tenure by writing `heatmap_dim` to the URL. The table itself is inline JSX in page.tsx.

**Step 1: Create `AnalyticsHeatmapDimSwitcher` client component**

Create `src/app/dashboard/analytics/analytics-heatmap-dim-switcher.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

type HeatmapDim = "role" | "department" | "level" | "tenure";

const DIMS: { id: HeatmapDim; label: string }[] = [
  { id: "role", label: "Role" },
  { id: "department", label: "Department" },
  { id: "level", label: "Level" },
  { id: "tenure", label: "Tenure" },
];

interface Props {
  activeDim: HeatmapDim;
}

export function AnalyticsHeatmapDimSwitcher({ activeDim }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const switchDim = useCallback(
    (dim: HeatmapDim) => {
      const params = new URLSearchParams(searchParams.toString());
      if (dim === "role") {
        params.delete("heatmap_dim");
      } else {
        params.set("heatmap_dim", dim);
      }
      router.push(`/dashboard/analytics?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit">
      {DIMS.map((d) => (
        <button
          key={d.id}
          onClick={() => switchDim(d.id)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
            activeDim === d.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Add the import to page.tsx**

```tsx
import { AnalyticsHeatmapDimSwitcher } from "./analytics-heatmap-dim-switcher";
```

**Step 3: Replace the heatmap stub in page.tsx with the full table**

Replace:
```tsx
{activeTab === "heatmap" && (
  <Card className="border-border/60">
    <CardContent className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Heatmap coming in next step…</p>
    </CardContent>
  </Card>
)}
```

With:
```tsx
{activeTab === "heatmap" && (
  <Card className="border-border/60">
    <div className="px-6 pt-6 pb-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">Competency Heatmap</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Average ratings per competency, grouped by {heatmapDim}
        </p>
      </div>
      <AnalyticsHeatmapDimSwitcher activeDim={heatmapDim} />
    </div>
    <CardContent className="px-0 pb-6">
      {heatmapData.competencies.length === 0 ? (
        <div className="py-16 text-center px-6">
          <p className="text-sm font-semibold text-foreground mb-1">No performance data for this period</p>
          <p className="text-sm text-muted-foreground">Complete a review cycle to populate the heatmap.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {/* Sticky competency column header */}
                <th className="sticky left-0 z-10 bg-background px-4 py-2 text-left text-xs font-medium text-muted-foreground w-48 min-w-48">
                  Competency
                </th>
                {/* "All" column */}
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground min-w-[80px]">
                  All
                </th>
                {/* Group columns */}
                {heatmapData.groups.map((group) => (
                  <th
                    key={group}
                    className="px-3 py-2 text-center text-xs font-medium text-muted-foreground min-w-[80px] max-w-[120px] truncate"
                    title={group}
                  >
                    {group}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.competencies.map((comp) => {
                const allCell = heatmapData.overallByComp[comp];
                const allAvg = allCell && allCell.count > 0 ? allCell.sum / allCell.count : null;
                return (
                  <tr key={comp} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                    {/* Competency name — sticky */}
                    <td className="sticky left-0 z-10 bg-background px-4 py-2.5 font-medium text-foreground">
                      {comp}
                    </td>
                    {/* "All" cell */}
                    <td className={`px-3 py-2.5 text-center ${heatmapCellClass(allAvg)}`}>
                      {allAvg !== null ? (
                        <>
                          <div className="font-semibold tabular-nums">{allAvg.toFixed(1)}</div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">n={allCell.count}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    {/* Group cells */}
                    {heatmapData.groups.map((group) => {
                      const cell = heatmapData.cells[`${comp}::${group}`];
                      const avg = cell && cell.count > 0 ? cell.sum / cell.count : null;
                      return (
                        <td
                          key={group}
                          className={`px-3 py-2.5 text-center ${heatmapCellClass(avg)}`}
                        >
                          {avg !== null ? (
                            <>
                              <div className="font-semibold tabular-nums">{avg.toFixed(1)}</div>
                              <div className="text-[10px] text-muted-foreground tabular-nums">n={cell.count}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Overall row */}
              <tr className="border-t-2 border-border/60 bg-muted/30 font-medium">
                <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2.5 font-semibold text-foreground">
                  Overall
                </td>
                {/* Grand total "All" cell */}
                <td className={`px-3 py-2.5 text-center ${heatmapCellClass(heatmapData.grandTotal.count > 0 ? heatmapData.grandTotal.sum / heatmapData.grandTotal.count : null)}`}>
                  {heatmapData.grandTotal.count > 0 ? (
                    <>
                      <div className="font-semibold tabular-nums">
                        {(heatmapData.grandTotal.sum / heatmapData.grandTotal.count).toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">n={heatmapData.grandTotal.count}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                {/* Overall per group */}
                {heatmapData.groups.map((group) => {
                  const cell = heatmapData.overallByGroup[group];
                  const avg = cell && cell.count > 0 ? cell.sum / cell.count : null;
                  return (
                    <td
                      key={group}
                      className={`px-3 py-2.5 text-center ${heatmapCellClass(avg)}`}
                    >
                      {avg !== null ? (
                        <>
                          <div className="font-semibold tabular-nums">{avg.toFixed(1)}</div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">n={cell.count}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

**Step 4: Verify build**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully` — zero TypeScript errors, zero lint errors.

**Step 5: Commit**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/analytics/analytics-heatmap-dim-switcher.tsx src/app/dashboard/analytics/page.tsx
git commit -m "feat: add competency heatmap table with dimension switcher to analytics"
```
