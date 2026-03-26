# Analytics Tab Overhaul — Design Document

**Date:** 2026-03-26
**Status:** Approved

## Problem

The analytics tab needs to be more powerful: real data from the database (not empty/unknown values), current cycle rates and ratings with dimensional breakdowns, historical cycle comparison, and configurable grouping. Tenant isolation must be enforced at the database level across all tables — this is the #1 priority.

## Design

### 1. RLS Tenant Isolation (Foundation)

Add Row-Level Security policies to ALL core tables with `workspace_id`. This is the prerequisite for everything else.

**Tables:**
- `users`, `performance_cycles`, `review_assignments`, `review_responses`, `competencies`, `goals`, `levels`, `job_families`, `subscriptions`, `workspaces`, `tenure_buckets` (new)

**Approach:**
- Each table gets `ENABLE ROW LEVEL SECURITY`
- SELECT/INSERT/UPDATE/DELETE policies scoped to `workspace_id = auth_workspace_id()`
- `review_responses` joins through `review_assignments` to resolve workspace scope
- Single migration applying all RLS policies
- Existing `.eq("workspace_id", ...)` query filters remain as defense-in-depth

### 2. Configurable Tenure Buckets

**Database changes:**
- New table `tenure_buckets`: `id`, `workspace_id`, `min_months` (inclusive), `max_months` (exclusive, null = unbounded), `label`, `sort_order`
- RLS policy on `tenure_buckets`
- Default seed buckets on workspace creation: 0–12mo, 12–24mo, 24–60mo, 60–120mo, 120mo+

**Rename `hire_date` → `start_date`:**
- Migration to rename the column in `users` table
- Update CSV import mapping (already uses `start_date` in CSV, currently maps to `hire_date`)
- Update all code references

**Settings UI:**
- New section in workspace settings: "Tenure Buckets"
- List of rows: label + min months + max months
- Add/remove/reorder buttons
- Only admin/HR can edit

**Analytics usage:**
- Heatmap tenure dimension reads bucket config from DB
- Groups employees by `start_date` against configured buckets
- Remove hardcoded `getTenureBucket()` function

### 3. Enhanced Current Cycle Analytics (Overview Tab)

**Existing KPI cards (keep):** completion rate, avg rating, total ratings, participants, active cycles

**New charts:**
- Completion Rate by Department — horizontal bar chart, % complete per department
- Completion Rate by Function — horizontal bar chart, % complete per job family
- Avg Rating by Department — bar chart (only when ratings exist)
- Avg Rating by Function — bar chart

**Filter behavior:** When a specific department is selected, "by department" charts hide and "by manager" breakdowns appear (drill-down).

**Every chart/KPI gets:**
- Title — clear, bold (e.g., "Completion Rate by Department")
- Subtitle — plain-language description (e.g., "Percentage of reviews submitted by employees in each department for the selected cycle")

### 4. Past Cycles Comparison (New "Cycles" Sub-tab)

**Default view:** Last 4 cycles (including current in-progress) in a comparison table.
- "Show all" button expands to full history
- Columns: cycle name, status badge, date range, completion rate %, avg rating, total participants

**Breakdowns (toggle):**
- By Department — rows become departments, one section per cycle
- By Function — rows become job families
- By Manager — filterable dropdown to select a manager, shows their team's data across cycles

**Manager view:**
- Dropdown to pick a manager
- Table: direct reports' completion rate + avg rating per cycle
- Top 5 / Bottom 5 managers cards ranked by completion rate (current cycle)

### 5. Heatmap Fixes

**Data fixes:**
- Tenure reads from configurable `tenure_buckets` table
- Employees with null `start_date` show "Not set" instead of "Unknown"

**New dimension — Manager:**
- Added to dimension switcher alongside role/department/level/tenure
- Columns = manager names, rows = competencies
- Cells = avg rating of manager's direct reports for that competency

**Color coding — dynamic, based on workspace rating scale:**
- Read `rating_scale` from `workspaces` table
- Generate color gradient with one distinct color per scale point:
  - 5-point: red → orange → amber → light green → emerald
  - 3-point: red → amber → emerald
  - 7-point: red → orange → amber → yellow → light green → green → emerald
- Dynamic gradient function based on scale size
- Fractional averages interpolate between nearest colors
- Legend shows all scale points with colors (and custom labels if configured)

**Narrative descriptions:**
- Title: "Competency Heatmap"
- Subtitle: "Average ratings across competencies, grouped by the selected dimension. Darker green indicates higher scores."

### 6. Export

**UI:** "Export" button top-right of analytics page, two options:
- **PDF** — visual report with KPI summary, all visible charts, comparison table, heatmap (respects current filters)
- **CSV** — flat data rows: cycle, employee, department, function, manager, competency, rating, completion status

**Tenant isolation:** PDF/CSV generation server-side, queries go through RLS-protected paths.

### 7. UX — Narrative Descriptions on All Charts

Every existing and new chart/KPI card gets title + subtitle:

| Chart | Subtitle |
|-------|----------|
| Completion Rate (KPI) | Percentage of assigned reviews that have been submitted |
| Overall Rating (KPI) | Average rating across all competencies for the selected cycle |
| Total Ratings (KPI) | Number of individual competency ratings submitted |
| Participants (KPI) | Number of employees with at least one review assignment |
| Rating Distribution | How ratings are spread across the scale for the selected cycle |
| By Function | Average rating per job function, helping identify strengths and development areas across disciplines |
| By Department | Average rating per department for the selected cycle |
| Competency Breakdown | Average rating for each competency, showing organizational strengths and gaps |
| Goal Progress | Distribution of goal tracking statuses across the organization |
| Performance Ranking | Employees ranked by average rating across all competencies, with performance tier |
| Rating Trend | How average ratings have changed across recent cycles |
| Completion Trend | How review completion rates have changed across recent cycles |

## Deferred to Future Phases

- 9-box calibration grid in analytics
- Engagement survey integration
- Industry benchmarking
- Predictive analytics / turnover risk
- NLP sentiment analysis on review text
- Auto-generated presentation decks
- DEIB analytics module
- Manager Effectiveness composite score

## Technical Notes

- All queries must include `.eq("workspace_id", workspaceId)` AND be backed by RLS
- `auth_workspace_id()` and `auth_user_id()` PostgreSQL functions already exist
- `rating_scale` field already exists on `workspaces` table
- CSV import already captures `start_date` → maps to `hire_date` (will become `start_date`)
- Charts use `recharts` library (already in project)
- Role-based access: analytics visible to manager+ roles (existing check)
