# Overdue Cycle Management — Design

**Date:** 2026-04-03
**Status:** Approved
**Approach:** Computed "Overdue" display status (no DB enum change)

## Problem

Active cycles remain marked as "Active" (green badge) even after their end date passes. HR/admins have no clear signal that action is needed — they must remember to check, manually mark completed, and release grades. Missing reviews are not surfaced.

## Industry Research

Reviewed Lattice, 15Five, Culture Amp, BambooHR, and Leapsome. Key patterns:
- **Soft deadlines are universal** — no tool hard-locks submissions when a deadline passes
- **Results release is always a deliberate admin action** — never automatic
- **Completion dashboards** surface who's behind with filters and per-person status
- **Locking is manual** and separate from deadlines; both 15Five and Leapsome allow unlocking

## Design

### 1. Computed Display Status

The DB `status` column is unchanged. "Overdue" is computed in the UI:

| Condition | Display | Badge Color |
|-----------|---------|-------------|
| `status === 'draft'` | Draft | zinc |
| `status === 'active' && end_date >= now` | Active | green/emerald |
| `status === 'active' && end_date < now && !grades_released` | Overdue | amber |
| `grades_released === true` | Completed | sky |
| `status === 'closed'` | Closed | zinc |

A single helper `getCycleDisplayStatus(cycle)` in `src/lib/status.ts` centralizes this logic.

### 2. Cycles List Page — Overdue Summary

When a cycle displays as "Overdue", the list row shows a one-line summary beneath the title:

> **Q1 2026 Review** — `Overdue` badge
> 4/12 self-reviews missing · 1/12 manager reviews missing · Grades not released

- Overdue cycles sort to the top of the list
- Missing counts are **clickable** — expand inline to show names (see section 7)

### 3. Cycle Detail Page — Action Required Banner

When overdue, a prominent amber banner replaces the normal header area:

> **This cycle is past its end date.** 3 self-reviews and 1 manager review are still pending. You can remind participants or close the cycle and release grades.
>
> `[Remind via Nami]` `[Close Cycle]` `[Release Grades]`

### 4. Phase Deadline Behavior (Soft Lock)

When a phase deadline passes:
- Participants see a warning banner: "This phase's deadline has passed. Your submission may still be accepted."
- They **can still submit** — no hard lock
- The phase shows as "Overdue" in the phase timeline on the detail page
- Nami continues sending escalating reminders for incomplete reviews

### 5. Manual Cycle Close

When HR/admin clicks "Close Cycle":
- Confirmation dialog shows:
  - "Close this cycle? Participants will no longer be able to submit reviews."
  - Count of missing submissions so HR makes an informed decision
- After closing: `status` → `closed`, all submission forms become read-only
- Grades can still be released after closing

### 6. Release Grades Flow

When HR/admin clicks "Release Grades":
- Confirmation dialog with:
  - Summary: "12 participants · 10 completed · 2 missing"
  - Checkbox: **"Notify employees via Slack"** (checked by default)
  - Confirm button: "Release Grades"
- On confirm: sets `grades_released: true`
- If notification checkbox checked: Nami DMs each employee with their grade/rating
- Display status flips to "Completed" (sky badge)

### 7. Missing Reviews Breakdown (Clickable)

On both the list page summary and the detail page banner, the "X self-reviews missing" and "X manager reviews missing" counts are **clickable**. Clicking expands an inline section (not a modal) showing:

**Self-reviews missing (4):**
- Sarah Chen — no submission
- Mike Torres — no submission
- Lisa Park — draft saved, not submitted
- James Wu — no submission

**Manager reviews missing (1):**
- Alex Kim (manager: David Lee) — not started

Each row has a "Remind" button to ping the individual via Nami DM.

### 8. Nami DM on Grade Release

When HR opts to notify via Slack:

> **Your Q1 2026 review results are ready**
> Overall rating: 4.2/5
> View your full review in the dashboard: [link]

### 9. Submission Lock After Cycle Close

When `status === 'closed'`:
- Review submission forms show a read-only banner: "This cycle has been closed."
- API-level enforcement: reject new review_response inserts/updates for closed cycles
- HR/admin can reopen if needed (sets `status` back to `active`)

## Files Affected

- `src/lib/status.ts` — new `getCycleDisplayStatus()` helper
- `src/app/dashboard/cycles/page.tsx` — overdue badge, summary row, sorting, clickable missing counts
- `src/app/dashboard/cycles/[id]/page.tsx` — action required banner, missing breakdown
- `src/app/dashboard/cycles/[id]/cycle-actions.tsx` — release grades dialog with notification checkbox, close cycle dialog with missing count
- `src/app/dashboard/reviews/[id]/page.tsx` — soft lock warning banner, read-only after close
- `supabase/functions/nami-bot/index.ts` — grade release notification action
- RLS policies — enforce no writes to review_responses when cycle is closed

## Non-Goals

- No automatic status transitions (no cron jobs)
- No hard-lock on phase deadlines
- No automatic grade release
- No new DB columns or enum changes (overdue is computed)
