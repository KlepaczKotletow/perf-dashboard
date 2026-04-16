# Enhanced Manager Review Context + Security Hardening

**Date:** 2026-03-28
**Status:** Approved

## Problem

The landing page promises rich manager context before reviews (self-assessment avg, goals with status, previous cycle data, competency expectations). The current bot shows basic context (self-assessment avg, previous overall rating, goals count) but is missing:

1. **Competency matrix expectations** — what rating is expected for each competency at the employee's level
2. **Per-competency previous ratings** — how the employee scored on each competency last cycle
3. **Goal status breakdown** — not just count but on-track/at-risk/achieved split
4. **Employee level/title context** — so the manager knows what role expectations apply

Additionally, a security audit revealed critical authorization gaps that must be fixed.

## Design

### Part 1: Enriched Manager DM Opening Message

**Current message format:**
```
Hey Manager! :wave:
It's time to review Alex for Q1 Review.
:calendar: Deadline: March 31

:bar_chart: Quick context:
- Self-Assessment avg: :star: 4.2/5
- Previous cycle rating: :star: 3.8/5
- Active goals: 3
```

**New message format:**
```
Hey Manager! :wave:
It's time to review Alex for Q1 Review.
:calendar: Deadline: March 31

:bar_chart: Quick context:
- Self-Assessment avg: :star: 4.2/5
- Previous cycle: :star: 3.8/5
- Active goals: 3 (2 on track · 1 at risk)

:clipboard: Senior Operations Manager expectations:
- Communication — target: 4/5 (prev: 3/5)
- Execution — target: 4/5 (prev: 4/5) :white_check_mark:
- Leadership — target: 3/5 (prev: 3/5) :white_check_mark:
- Problem Solving — target: 4/5 (no prior data)

[Start review]  [Remind me later]
```

**Rules:**
- Cap competency list at 5 items; show "and X more in the review form..." if more
- Show checkmark when previous rating >= expected level
- Show "(no prior data)" when no previous cycle rating exists for that competency
- If employee has no `level_id` or no `level_competencies` exist, skip the entire competency section
- If no previous cycle exists at all, skip `prev:` annotations but still show targets
- All data scoped to `workspace_id` for tenant isolation

### Part 2: Data Model Changes

**No schema changes needed.** All required data exists:

| Data Point | Source Table | Key Columns |
|---|---|---|
| Employee level & title | `users` JOIN `levels` | `users.level_id` → `levels.name` |
| Competency expectations | `level_competencies` | `level_id`, `competency_id`, `expected_level` |
| Competency names | `competencies` | `id`, `name` |
| Previous cycle per-competency ratings | `review_responses` via `review_assignments` | `rating`, `competency_id`, `reviewer_role='manager'` |
| Goal status breakdown | `goals` | `employee_id`, `status` |

### Part 3: Code Changes

#### A. `getManagerContext()` in `nami-bot/index.ts`

Extend the existing function to:

1. Accept `workspaceId` parameter (security fix)
2. Verify cycle belongs to workspace before querying
3. Fetch employee's level name via `users` → `levels` join
4. Fetch `level_competencies` with `expected_level` + competency names, filtered by `workspace_id`
5. Fetch previous cycle's per-competency manager ratings:
   - Find most recent completed assignment for employee (excluding current cycle)
   - Query `review_responses` for that assignment where `reviewer_role = 'manager'`
   - Build a map of `competency_id → rating`
6. Fetch goal status counts grouped by status field

**Extended context interface:**
```typescript
interface ManagerContext {
  selfAvg?: number;
  prevRating?: number;
  goalsCount?: number;
  goalsByStatus?: Record<string, number>;  // NEW: { on_track: 2, at_risk: 1 }
  levelName?: string;                       // NEW: "Senior Operations Manager"
  competencyExpectations?: Array<{          // NEW
    name: string;
    expectedLevel: number;
    prevRating?: number;  // manager's rating from previous cycle
  }>;
}
```

#### B. `buildManagerReviewOpening()` in `nami-blocks.ts`

Update to accept and render:
- Goal status breakdown string: "3 (2 on track · 1 at risk)"
- Competency expectations section with level name header
- Per-competency lines with target, prev rating, and checkmark indicator
- Overflow handling for >5 competencies

#### C. Callers in `nami-bot/index.ts`

Update `handleCycleLaunch()` to pass `workspaceId` to `getManagerContext()`.

### Part 4: Security Hardening

#### Fix 1: Manager Authorization Check

**File:** `slack-interactivity/index.ts`
**Location:** `nami_start_review`, `start_dm_review`, `open_cycle_review` action handlers

Before allowing a user to open a review form with role "manager":
```
if reviewRole === "manager" AND user.id !== assignment.manager_id:
  → return ephemeral error "You are not authorized to review this employee."
```

Current code defaults to `reviewRole = "manager"` for any user who isn't the employee or an upward reviewer. This must be fixed to reject unauthorized users.

#### Fix 2: Workspace Isolation in getManagerContext()

**File:** `nami-bot/index.ts`

Add `workspaceId` parameter. Before any data queries:
1. Verify the cycle belongs to the workspace
2. Filter `level_competencies` by `workspace_id`
3. Filter goals by workspace (through employee relationship)

#### Fix 3: Reviewer Validation for All Assignment Types

**File:** `slack-interactivity/index.ts`

For each assignment type, validate the correct user:
- `standard` → `user.id === assignment.manager_id` for manager role, `user.id === assignment.employee_id` for self
- `upward` → `user.id === assignment.reviewer_id`
- `peer` → `user.id === assignment.reviewer_id`
- If no role matches → reject with ephemeral error

### Part 5: What Already Works (No Changes Needed)

- **Modal expected levels:** `buildReviewForm()` already shows `" - expected: X/5"` per competency in the Slack modal labels
- **Duplicate submission prevention:** Existing check queries `review_responses` before allowing submit
- **30-minute edit window:** Enforced with timestamp deadline, properly blocks late edits
- **Dashboard sync:** Review responses write directly to the same tables the dashboard reads
- **Notification deduplication:** `notification_log` table prevents duplicate sends

## Files to Modify

1. `supabase/functions/nami-bot/index.ts` — extend `getManagerContext()`, update callers
2. `supabase/functions/_shared/nami-blocks.ts` — update `buildManagerReviewOpening()`
3. `supabase/functions/slack-interactivity/index.ts` — add authorization checks

## Testing Plan

1. **Happy path:** Launch a cycle with a manager who has a direct report with level_competencies defined and a previous completed cycle → verify enriched context message
2. **No level:** Employee without level_id → verify competency section is hidden
3. **No previous cycle:** First-time review → verify "no prior data" labels
4. **No level_competencies:** Level exists but no competencies mapped → verify section hidden
5. **Authorization:** Non-manager clicks manager review button → verify rejection
6. **Cross-workspace:** Verify context queries don't leak data across workspaces
7. **Edit flow:** Submit review, edit within 30 min, verify dashboard reflects latest
8. **Overflow:** Employee with >5 competencies → verify "and X more..." truncation
