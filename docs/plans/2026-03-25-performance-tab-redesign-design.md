# Performance Tab Redesign — "Your Performance Journey"

**Date:** 2026-03-25
**Status:** Approved

## Problem Statement

The Performance tab is seen by every employee regardless of role, yet it currently buries results at the bottom, lacks historical comparison, and doesn't create an emotional connection to one's growth trajectory. Three core needs are underserved:

1. **My results** — employees want to see their performance ratings/grades prominently
2. **My pending tasks** — employees need to know what reviews they still owe
3. **My history** — employees want to see past cycle performance, not just the current one

## Competitor Research Summary

| Platform | Key Pattern | Takeaway |
|----------|-------------|----------|
| Culture Amp | Task-first homepage with split-screen review (questions + past feedback reference panel) | Outstanding tasks with due dates on home screen; past self-reflections shown alongside current review |
| Lattice | Unified dashboard consolidating feedback, goals, one-on-ones; continuous feedback loop | Reduce navigation clicks; contextual integration connecting personal→team→company goals |
| 15Five | Lightweight weekly check-ins; centralized goals/recognition/one-on-ones | Most intuitive; requires minimal training; purpose-built for performance |
| PerformYard | Cycle progress tracking on dashboards; searchable feedback with tagging | AI-powered summaries; flexible goal categorization; clean task organization |
| BambooHR | HRIS-first with bolted-on performance | Example of what NOT to do — PM feels like an afterthought |
| Workday | Enterprise-grade with In Progress / Completed review tabs | Heavyweight but thorough; good navigation between review states |

### Best Practices Identified
- **Task urgency front and center** with deadlines and action buttons (Culture Amp)
- **Past performance accessible alongside current work** (Culture Amp reference panel)
- **Visual progress tracking** through cycle phases (Lattice stepper)
- **Ratings visible at a glance** without drilling down (all competitors)
- **Reduce clicks** — consolidate related info (Lattice design philosophy)

## Design Decision

**Approach: Expandable Cycle Journal with Inline Actions**

The page shows all cycles as a vertical stack of cards (newest first). Each card is collapsed by default showing a summary line. Clicking expands to full detail. Cycles with pending tasks auto-expand.

## Page Structure

### 1. Page Header + Performance Summary Hero

```
┌─────────────────────────────────────────────────────────┐
│  Performance                                             │
│  Your performance journey across review cycles           │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  6 Cycles    │  │  4.2 ★       │  │  Latest:     │  │
│  │  completed   │  │  avg rating  │  │  "Exceeds"   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- Three stat cards: cycles completed, average rating, latest grade
- Only shown if employee has ≥1 completed cycle with released grades
- If no history, show just the title/subtitle

### 2. Cycle Cards — Collapsed View

Each cycle renders as a collapsed card with a single summary row:

**Active cycle (with pending tasks):**
```
┌─────────────────────────────────────────────────────────┐
│ 🟢 Q1 2025 Performance Review   ACTIVE  ⚠️ 2 due   ▼  │
└─────────────────────────────────────────────────────────┘
```

**Completed cycle (grades released):**
```
┌─────────────────────────────────────────────────────────┐
│ ✅ Q4 2024 Performance Review   COMPLETED  ★4.3 "Exceeds" ▶ │
└─────────────────────────────────────────────────────────┘
```

**Completed cycle (grades not yet released):**
```
┌─────────────────────────────────────────────────────────┐
│ ✅ Q3 2024 Performance Review   COMPLETED  Pending results ▶ │
└─────────────────────────────────────────────────────────┘
```

**Visual cues:**
- Left border color: blue/primary for active, green for completed, amber if overdue tasks
- Status badge (ACTIVE, COMPLETED, IN REVIEW)
- Rating + grade shown inline for completed cycles with released grades
- Pending task count with warning icon for active cycles
- Chevron (▼ expanded, ▶ collapsed)

**Auto-expand rules:**
- Any cycle with pending tasks (action required) auto-expands on page load
- If no pending tasks exist, the most recent cycle auto-expands
- User can expand/collapse any card by clicking the header

### 3. Active Cycle Card — Expanded View

```
┌─────────────────────────────────────────────────────────┐
│ 🟢 Q1 2025 Performance Review   ACTIVE  ⚠️ 2 due   ▼  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Progress                                                │
│  ● Goal Setting  ● Self-Review  ○ Peer Review  ○ Mgr   │
│    Done           Due Mar 20     Mar 25          Apr 5   │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  ⚠️ Action Required (2)                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ⬜ Complete your self-review    Due Mar 20  [Start]│  │
│  │ ⬜ Review: Anna Kowalska       Due Mar 25  [Start]│  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ✅ Completed                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ✅ Upward feedback: Jan Nowak            [View]    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ★ Your Results                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Grades not yet released for this cycle.            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Sub-sections within the active cycle card:**

1. **Progress Stepper** — horizontal step indicator showing cycle phases with real deadlines from `cycle_phases` table. Steps: Goal Setting → Self-Review → Peer Review → Manager Review → Calibration → Results. Colored dots: green=done, blue=active, gray=pending, red=overdue.

2. **Action Required** — amber-themed section. Shows all pending assignments (self-review, manager reviews, upward feedback) with:
   - Task description
   - Due date (red if overdue)
   - Direct CTA button (Start / Continue)
   - Count badge in section header

3. **Completed** — green-themed, muted section. Shows submitted assignments with [View] links. Collapsed if empty.

4. **Your Results** — blue/star-themed section. Shows:
   - Placeholder text if grades not released
   - Once released: overall rating (stars), grade label, competency breakdown, manager feedback preview, peer feedback preview

### 4. Past Cycle Card — Expanded View

```
┌─────────────────────────────────────────────────────────┐
│ ✅ Q4 2024 Performance Review  COMPLETED  ★4.3 "Exceeds" ▼ │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ★ Your Results                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Overall Rating: ★★★★☆ 4.3                          │  │
│  │ Grade: "Exceeds Expectations"                       │  │
│  │                                                     │  │
│  │ Competency Breakdown:                               │  │
│  │   Communication      ★★★★★ 5.0                    │  │
│  │   Technical Skills   ★★★★☆ 4.0                    │  │
│  │   Leadership         ★★★★☆ 4.0                    │  │
│  │                                                     │  │
│  │ Manager Feedback:                                   │  │
│  │ "Strong quarter, especially on the..."      [More]  │  │
│  │                                                     │  │
│  │ Peer Feedback (2):                                  │  │
│  │ "Great collaboration on the..."             [More]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  📋 Your Submissions                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ✅ Self-review submitted Dec 15          [View]     │  │
│  │ ✅ Reviewed: Anna Kowalska               [View]     │  │
│  │ ✅ Upward: Jan Nowak                     [View]     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Past cycle expanded sections:**

1. **Your Results** (primary section) — overall rating, grade, competency breakdown with individual ratings, manager feedback preview, peer feedback count with previews
2. **Your Submissions** — what the employee submitted during this cycle (self-review, reviews given, upward feedback) with [View] links

### 5. Role-Aware Behavior

The page adapts based on user role:

- **All employees**: See their own assignments, their received ratings, and their submission history
- **Managers**: Additionally see manager review assignments in the "Action Required" section. Also see their direct reports' ratings in the "Your Results" section (or a separate sub-section "Team Results" if applicable)
- **HR+**: See all combined ratings as before

### 6. Empty States

- **No cycles at all**: "No performance cycles have been created yet. Check back when your organization starts a review cycle."
- **No pending tasks**: The "Action Required" section simply doesn't appear within the card
- **No results yet**: "Grades not yet released for this cycle."
- **No feedback received**: "No feedback received yet for this cycle."

## Technical Notes

### Data Requirements (already available)
- `review_assignments` — pending/completed tasks per cycle
- `performance_cycles` — cycle metadata and status
- `cycle_phases` — progress stepper data
- `review_responses` — received ratings and feedback
- `competencies` — competency breakdown labels

### New UI Components Needed
- `CycleCard` — expandable card component with collapsed/expanded states
- `PerformanceSummaryHero` — stat cards for header
- `ResultsSection` — rating display with competency breakdown
- Reuse existing `ProgressStepper` (move inside card)

### State Management
- URL param `?cycle=<id>` can still be used to deep-link to a specific expanded cycle
- Expand/collapse state managed client-side
- Auto-expand logic: cycles with pending tasks > most recent cycle

## Success Criteria

1. Employee can see ALL their cycles at a glance on page load
2. Pending tasks are immediately visible (auto-expanded) with clear deadlines and CTAs
3. Past cycle ratings/grades are visible without clicking (on the collapsed card header)
4. Expanding any past cycle shows full results with competency breakdown and feedback
5. The page tells a "growth story" — you can see your trajectory across cycles
