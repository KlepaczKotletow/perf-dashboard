# Analytics Page Redesign — Design Doc

**Date:** 2026-03-19
**Status:** Approved

---

## Problem

The current Analytics page has no filters — it shows a single flat view across all cycles, all time. Groupings use the raw `department` text field on users rather than the structured `job_families` / `levels` data. There is no cycle selector, no function/level breakdown, and no cross-cycle trend view.

## Goal

Rebuild Analytics into a cycle-scoped dashboard that matches how HR managers actually think. One cycle selector drives all tiles and charts. Stackable secondary filters (function, department) let admins drill into specific groups. A Trends section at the bottom always shows cross-cycle data — filling the gap that all major competitors (Lattice, Leapsome, Culture Amp) have failed to fill.

## Competitor Research Summary

- **All major tools** (Lattice, Culture Amp, Leapsome) use cycle as the primary filter for performance analytics.
- **Cross-cycle comparison** is the #1 unmet need across G2/Capterra reviews — everyone exports to Excel to compare cycles.
- **15Five** is the only tool supporting both cycle and date range filtering cleanly.
- **Top 5 tiles** HR managers want: completion rate, rating distribution, top performers by team, trend over time, breakdown by department + function.
- **Biggest pain points**: can't compare cycles side-by-side, filter logic is inflexible, analytics don't surface actionable insights automatically.

## Architecture Decision

**Option A — Cycle-scoped single page** (chosen).

One page. Cycle selector at the top drives all tiles and charts. Trends section at the bottom always shows cross-cycle data (ignores cycle filter). Cleaner than tabs, far simpler than a dashboard builder. Matches Lattice/Culture Amp model, extended with cross-cycle trends.

URL search params (`?cycleId=...&functionId=...&department=...`) make the filtered view shareable and bookmarkable. All data fetched server-side based on params.

---

## Design

### Filter Bar

Sticky bar below page header. Three controls, left-aligned:

```
[Cycle ▾ Q1 2026 Review]  [Function ▾ All]  [Department ▾ All]
```

- **Cycle** — lists all `performance_cycles` for this workspace, newest first. Default: most recent active or completed cycle. Includes "All cycles" option for org-wide view.
- **Function** — lists all `job_families` for this workspace (workspace-scoped). Default: "All functions".
- **Department** — distinct `department` values from `users` in this workspace. Default: "All departments".

All three stack with AND logic. Changing any filter re-renders all tiles and charts. Implemented as `<form>` with URL search params — no client-side state needed for the filter values themselves.

### KPI Tiles (5 cards)

All scoped to the active cycle + function + department filters.

| Tile | Value | Sub-label |
|---|---|---|
| Overall Rating | avg across all competencies | `X.X / 5` |
| Completion Rate | % of assignments completed | `N / N assignments` |
| Total Ratings | count of `review_responses` with rating | `review response ratings` |
| Participants | distinct employees in cycle | `employees in this cycle` |
| Active Cycles | count of cycles with status=active | `N total` |

### Charts (2×2 grid)

All scoped to active filters.

1. **Rating Distribution** — vertical bar chart, ratings 1–5, colour-coded (red→green). Surfaces calibration issues.
2. **By Function** — horizontal bar chart, avg rating per `job_family` name. Uses structured FK data, not raw text. Replaces the current "Department Performance" chart.
3. **By Department** — horizontal bar chart, avg rating per `users.department`. Kept alongside function.
4. **Competency Breakdown** — horizontal bar, top 8 competencies by avg rating.

### Performance Ranking Table

Existing table enhanced with two new columns: **Function** (from `job_families.name` via `users.level_id → levels.job_family_id`) and **Level** (from `levels.name`). Scoped to active filters. Sortable by rating column.

### Trends Section (cross-cycle, always visible)

Two line charts. Always show last 6 completed cycles regardless of cycle filter. Do respect Function and Department filters.

1. **Rating Trend** — avg overall rating per cycle over last 6 cycles.
2. **Completion Trend** — completion % per cycle over last 6 cycles.

Label: "Trends — last 6 cycles" with a note "(not affected by cycle filter)".

---

## Data Model Notes

- `job_families` — workspace-scoped (`workspace_id`), each org has its own. ✅ Already isolated.
- `levels` — belong to a `job_family`, workspace-scoped. ✅
- `users.level_id` → `levels.id` → `levels.job_family_id` → `job_families.id` — path to function for any user.
- `users.department` — raw text field, still used for department grouping.
- `performance_cycles` — workspace-scoped, has `type` (annual/quarterly) and `status`.
- `review_assignments` — links `cycle_id`, `employee_id`, `reviewer_id`, `status`.
- `review_responses` — links `assignment_id`, `competency_id`, `rating`.

**Query approach:** All analytics data fetched server-side in `getAnalyticsData(cycleId, functionId, department)`. Cycle filter applies a `.eq("cycle_id", cycleId)` on assignments/responses. Function filter joins through `users.level_id → levels.job_family_id`. Department filter applies `.eq("department", department)` on users.

---

## Out of Scope

- Dashboard builder / drag-and-drop tiles
- Date range filtering (secondary to cycle — not in v1)
- Engagement vs. performance correlation
- Calibration flagging (manager rating inflation alerts)
- Export to CSV/PDF
- Benchmarking against industry peers

These can be added in future iterations once the cycle-scoped foundation is solid.
