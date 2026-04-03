# Goals Overhaul — Design

**Date:** 2026-04-03
**Status:** Approved

## Problem

1. Goal detail page returns 404 due to empty-string workspace_id fallback
2. No delete action on goals (only duplicate)
3. Goals need to be tied to cycles with easy duplicate-to-next-cycle flow
4. Goal creation is a full page — should be a fast side panel
5. Goals lack a "direction" concept (increase/decrease/maintain above/below)
6. Need cascading goals (company → team → individual) that stay simple

## Industry Research

Reviewed Lattice, 15Five, Culture Amp, Leapsome, Perdoo, Weekdone. Key patterns:
- Goals default to a cycle but can be standalone (Lattice, Leapsome, Perdoo)
- Cascading is optional parent-child alignment, not forced hierarchy
- Side panel quick-create reduces friction (Lattice)
- Standard metric types: number, percentage, currency, binary
- Auto-rollup from child to parent goals is common
- Duplicate/copy goals across cycles is standard workflow

## Design

### 1. Fix 404 Bug

In `src/app/dashboard/goals/[id]/page.tsx`, add early validation:
```typescript
if (!workspace?.workspaceId) notFound();
```
Before any Supabase queries. Same pattern used in cycles pages.

### 2. New Column: `goal_direction`

Add `goal_direction` to the `goals` table:

| Value | Label | Example | Success Condition |
|-------|-------|---------|-------------------|
| `increase` | Increase to | Revenue $1M → $1.5M | current >= target |
| `decrease` | Decrease to | Churn 5% → 2% | current <= target |
| `above` | Maintain above | NPS stays above 50 | current >= target |
| `below` | Maintain below | Response time below 200ms | current <= target |

Type: `text NOT NULL DEFAULT 'increase'`

**Progress calculation by direction:**
- `increase`: `(current - start) / (target - start) * 100`
- `decrease`: `(start - current) / (start - target) * 100`
- `above`: 100 if current >= target, else 0 (flag as At Risk)
- `below`: 100 if current <= target, else 0 (flag as At Risk)

### 3. Side Panel Quick-Create

Replace the full-page goal creation with a slide-out Sheet panel from the goals list page.

**Always visible fields:**
- Goal title (required)
- Owner (required, defaults to current user)
- Direction selector: Increase to / Decrease to / Stay above / Stay below
- KPI target value + unit (e.g. "20" + "%")

**Collapsed "More options" section:**
- Cycle (dropdown of active cycles — auto-sets due_date to cycle end_date)
- Due date (auto-filled from cycle, overridable)
- Scope (company / team / individual, defaults to individual)
- Parent goal (search/select from existing goals)
- Baseline value (metric_start)
- Description
- Weight (default 1.0)

### 4. Duplicate to Next Cycle

Action available in goal row menu and detail page. Flow:

1. User clicks "Duplicate to Cycle"
2. Dialog shows: cycle selector (defaults to next available cycle), pre-filled title
3. On confirm, creates new goal with:
   - Copied: title, description, scope, parent_id, metric_unit, weight, goal_direction
   - New baseline: metric_start = previous goal's metric_current (carry forward)
   - Cleared: metric_current = null, progress = 0, tracking_status = null
   - Set: cycle_id = selected cycle, due_date = cycle's end_date, status = 'active'

### 5. Delete Action

Add "Delete" to the goal action menu (list page and detail page). Confirmation dialog:
- "Delete this goal? This cannot be undone."
- If goal has children: "This goal has X sub-goals. They will become standalone goals."

### 6. Cascading Goals (Parent-Child)

Uses existing `parent_id` column. No forced hierarchy.

**Auto-rollup:** When child goals update progress, parent goal's progress recalculates as weighted average of children:
```
parent_progress = sum(child_progress * child_weight) / sum(child_weight)
```

This happens client-side when viewing the parent, not via triggers.

**In the goals list:** Goals with children show an expand/collapse toggle (already exists in goals-client.tsx).

### 7. Goals List Improvements

- Delete action in row menu
- "Duplicate to Cycle" action in row menu
- Cycle filter as primary filter (prominent position)
- Direction indicator next to KPI values (↑ ↓ ≥ ≤)

## Schema Changes

One migration:
```sql
ALTER TABLE goals ADD COLUMN goal_direction text NOT NULL DEFAULT 'increase';
```

## Files Affected

- `src/app/dashboard/goals/[id]/page.tsx` — fix 404 bug
- `src/app/dashboard/goals/page.tsx` — add side panel trigger
- `src/app/dashboard/goals/goals-client.tsx` — side panel, delete action, duplicate-to-cycle, direction display
- `src/app/dashboard/goals/new/page.tsx` — may be removed or redirected (replaced by side panel)
- `src/app/dashboard/goals/[id]/goal-detail-client.tsx` — direction field, delete action, duplicate-to-cycle
- `src/lib/types.ts` — add GoalDirection type
- Supabase migration — add goal_direction column

## Non-Goals

- No OKR framework (using KPIs instead)
- No AI-powered goal suggestions (future consideration)
- No weekly check-in integration (separate feature)
- No goal approval workflow
