# Performance Heatmap — Design

**Date:** 2026-03-19
**Status:** Approved
**Scope:** `src/app/dashboard/analytics/page.tsx` — new "Heatmap" tab, no new pages or routes
**Reference:** Leapsome survey heatmap — competency rows × group columns, color-coded cells

---

## Goal

Add a Leapsome-style performance heatmap to the Analytics page that shows average review ratings grouped by a selectable dimension (Role, Department, Level, Tenure). Each cell shows the average rating and sample size so managers and HR can spot skill gaps and outliers across the org.

---

## Location

New **"Heatmap"** tab added to the existing Analytics page tab bar. No new pages, no new routes. Tab state and filters stored in URL search params (`?heatmap_dim=role&heatmap_cycle=all`) for shareability.

---

## Layout

- **Dimension switcher** — pill toggle top-right of tab: `Role · Department · Level · Tenure`. Default: Role.
- **Cycle filter** — dropdown to scope data to a specific review cycle or "All time".
- **Full-width table** — scrollable horizontally when many columns exist.

---

## Heatmap Table

**Rows:** One per competency (e.g. "Communication", "Execution", "Leadership"). Final **"Overall"** row shows cross-competency average per group.

**Columns:** One per value in the selected dimension (e.g. each distinct role). First **"All"** column shows org-wide average for that competency. Row headers (competency names) are sticky on horizontal scroll.

**Cells:** Two-line display:
- Primary: average rating (`4.2`) — large
- Secondary: review count (`n=14`) — small, grey/muted

**Cell color tinting by score:**
| Score | Color |
|---|---|
| ≥ 4.5 | Emerald tint |
| 3.5 – 4.4 | Primary/blue tint |
| 2.5 – 3.4 | Amber tint |
| < 2.5 | Red tint |
| No data (n=0) | Muted, shows `—` |

Color intensity scales with distance from 3.0 so weak signals don't look alarming.

---

## Data Model

**Query:** Server component query on `review_responses` joined to `review_assignments → users` (for dimension values) and `competencies`. Groups by `competency_id + dimension_value`, aggregates `avg(rating)` and `count(*)`. Filtered by selected cycle if not "All time".

**Tenure bucketing:** Computed in-memory from `users.hire_date` into four buckets: `< 1yr`, `1–2yr`, `2–5yr`, `5yr+`.

**No new npm dependencies** — table is plain HTML `<table>` with Tailwind classes.

---

## Permissions

- Visible to `isManagerOrAbove` only (same gate as ratings elsewhere in Analytics)
- Employees see the Heatmap tab but receive a "You don't have access to this view" message
- Data is aggregate-only — no individual scores exposed

**Empty state:** If a cycle has no review responses, the table shows: *"No performance data for this period."*

---

## What Does NOT Change

- Existing Analytics tabs and their content — untouched
- Data fetching architecture — new query added alongside existing ones
- Permission model — reuses `isManagerOrAbove` already computed on the page
- No new pages, no new routes, no new npm packages

---

## Files Changed

| File | Action |
|---|---|
| `src/app/dashboard/analytics/page.tsx` | Add Heatmap tab, dimension switcher, cycle filter, heatmap query, table component |

One file. No new files (table is inline JSX within the page component).
