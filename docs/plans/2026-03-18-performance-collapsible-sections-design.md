# Performance Page — Collapsible Sections

**Date:** 2026-03-18
**Status:** Approved

## What We're Building

Named, collapsible sections within both tabs of the Performance page, grouping items by review type so users can scan and focus.

## Data Reality (verified against DB)

- `assignment_type` values: `standard`, `upward` only — no peer/360 in DB
- `performance_cycles.type` values: `quarterly`, `annual`
- `continuous_feedback` table exists but has 0 rows — excluded (YAGNI)

## To Do Tab — 3 Sections

| Section | Data source | Default state |
|---|---|---|
| **Self-Review** | `pendingSelfReviews` (standard, employee = me, self not submitted) | Open if count > 0 |
| **Reviews to Give** | `sortedManagerReviews` (standard, manager = me) | Open if pending count > 0 |
| **Upward Feedback** | `sortedUpwardReviews` (upward, reviewer = me) | Open if pending count > 0 |

- Badge shows **pending count** when > 0
- When all done in a section: badge shows "All done" in green, section **collapsed by default**
- When a section is entirely empty: show a subtle inline note ("No upward feedback assigned") — do NOT hide section

## Results Tab — 2 Sections

| Section | Data source | Default state |
|---|---|---|
| **Annual Reviews** | `sortedMyAssignments` where `cycle.type === "annual"` | Open if any exist |
| **Quarterly Reviews** | `sortedMyAssignments` where `cycle.type === "quarterly"` | Open if any exist |

- Empty sections (no cycles of that type): **hidden entirely**
- If all my assignments have no `cycle.type` (null/unknown): fallback single section "Performance Reviews"

## Architecture

**New component:** `CollapsibleSection` client component — thin wrapper that accepts server-rendered `children` as ReactNode. This follows Next.js composition pattern: server renders the card content, client handles the toggle state.

```tsx
// src/app/dashboard/performance/collapsible-section.tsx
"use client"
interface Props {
  title: string
  pendingCount?: number   // shows amber badge if > 0
  allDone?: boolean       // shows green "All done" badge
  defaultOpen?: boolean
  children: React.ReactNode
}
```

**Toggle UX:**
- Chevron rotates 180° when collapsed (CSS transition)
- Section title + badge + chevron are the clickable area (full-width header)
- Smooth height transition (max-height or CSS grid trick for animation)

**No changes to data fetching** — all queries stay in `page.tsx` server component. Only the rendering layer changes.

## Files

- Create: `src/app/dashboard/performance/collapsible-section.tsx`
- Modify: `src/app/dashboard/performance/page.tsx` — wrap card groups in `<CollapsibleSection>`, split Results by cycle type
