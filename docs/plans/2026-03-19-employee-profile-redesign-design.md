# Employee Profile Page — Redesign Design

**Date:** 2026-03-19
**Status:** Approved
**Scope:** `src/app/dashboard/team/[id]/page.tsx` + `profile-tabs.tsx`

---

## Goal

Replace the sparse tabbed layout (Overview / Reviews / Feedback / Competencies / Goals) with a single, rich, scrollable page that gives managers and HR a full picture of an employee at a glance — and gives employees a clear, permission-gated view of their own data.

---

## Current State

- **Header** — small avatar, name, job title, scattered badges, email. Functional but flat.
- **ProfileTabs** — 5 tabs, each containing a card. Most tabs show either a long list or a blank empty state. No scannable layout. Switching tabs to find information feels empty and slow.
- **Permission** — `canSeeAllRatings` hides numeric ratings from non-managers. No field on `continuous_feedback` to control employee visibility of individual feedback items.

---

## New Layout — Single Scrollable Page

Tabs are removed entirely. All content lives on one page, vertically stacked, with clear section headings. Managers see everything; employees see a filtered subset.

### 1. Header

- Large avatar (80 px, initials)
- Name (bold, 2xl), job title below
- Row of chips: department, level/function with grade (e.g. "Engineering — L3 (Senior)"), role badge
- "Reports to [Name]" as a clickable link to their profile
- Mailto link for email
- **Edit** button top-right — HR/above only
- Back arrow to `/dashboard/team`

### 2. KPI Strip

Four tiles in a row (same visual style as analytics KPI tiles):

| Tile | Manager/HR sees | Employee (own) sees |
|---|---|---|
| Overall Rating | Actual avg rating (e.g. 4.2/5) | Value only if any cycle has `grades_released = true` |
| Reviews | Total count | Total count |
| Feedback | Total count of all feedback | Count of `shared_with_employee = true` only |
| Goals | Count + "X on track" sub-label | Same |

### 3. At-a-Glance Row (2-column, md+)

**Left — Latest Review card**
- Cycle name, start date, manager name, status badge
- If manager or `grades_released`: show overall rating and final grade
- CTA: no link needed (reviews are already in the list below)
- Empty state: "No reviews yet — reviews appear when a performance cycle is launched"

**Right — Goals Snapshot card**
- Active goals only (status ≠ completed/cancelled), up to 3
- Each row: goal title, tracking status badge, progress bar, % label
- "View all N goals ↓" scrolls to the Full Goals section
- Empty state: "No active goals"

### 4. Competency Highlights *(manager/above only — section hidden for others)*

- Full-width card, title "Competencies"
- All competencies sorted by avg rating descending
- Each row: competency name, category chip, 5-star visual, numeric avg, "based on N reviews" sub-label
- If `skillAverages` is empty: tasteful empty state ("No competency data yet — ratings appear after reviews are submitted")
- Employees never see this section (not locked, just absent from the DOM)

### 5. Feedback Feed *(permission-gated)*

- Card title "Feedback"
- **Manager/HR**: all `continuous_feedback` records, newest first
- **Employee (own profile)**: only items where `shared_with_employee = true`
- Each row: sender (or "Anonymous"), type badge (Praise / Constructive / General), message, date
- Max 20 items (already limited by existing query)
- Empty state varies by viewer role

### 6. All Reviews

- Full-width card, title "Performance Reviews"
- Existing row design (cycle name, manager, date, status badge, rating/grade if visible)
- Sorted newest first
- Empty state: "No reviews yet"

### 7. Direct Reports *(only rendered if `directReports.length > 0`)*

- Chip-style links: avatar initials + name + job title
- Same design as today's Overview tab
- No empty state needed — section is conditionally omitted

### 8. All Goals *(anchor for "View all goals ↓" link from At-a-Glance)*

- Full list of goals with progress bars, tracking badges, due dates, metric values
- Sorted: active first (by tracking_status), then completed/cancelled
- Empty state: "No goals assigned yet"

---

## Permission Model Summary

| Section | Manager / HR | Employee (own profile) | Other users |
|---|---|---|---|
| Header | Full | Full | Full |
| KPI — Overall Rating | Always | Only if grades_released | Only if grades_released |
| KPI — Feedback count | All feedback count | `shared_with_employee` count | Not visible (not own profile) |
| Competency Highlights | Visible | **Hidden** | **Hidden** |
| Feedback Feed | All items | `shared_with_employee = true` only | Not visible |
| Reviews | All, with ratings/grades | Own reviews, ratings if grades_released | Own reviews only |
| Goals | Full | Full | Own goals only |
| Direct Reports | Visible if has reports | Visible if has reports | Visible if has reports |

> "Other users" viewing someone else's profile: they see the header, KPI strip (no rating), reviews without ratings, goals, direct reports. No feedback, no competencies. This is unchanged from current behaviour — the page doesn't redirect non-managers away.

---

## DB Migration Required

Add a visibility flag to `continuous_feedback`:

```sql
ALTER TABLE continuous_feedback
  ADD COLUMN shared_with_employee boolean NOT NULL DEFAULT false;
```

- Default `false` means existing feedback is private by default (safe).
- HR can toggle this per-item via the edit flow (future work).
- The Slack `/feedback` command can expose an opt-in in a future iteration.

---

## Files Changed

| File | Action |
|---|---|
| `src/app/dashboard/team/[id]/page.tsx` | **Rewrite** — new scrollable layout, new data fetch for `shared_with_employee` |
| `src/app/dashboard/team/[id]/profile-tabs.tsx` | **Delete** — replaced by inline sections in `page.tsx` |
| Supabase migration | **New** — add `shared_with_employee` column |

All existing data queries (`getEmployeeDetails`) remain structurally the same. The `continuousFeedback` query gains a `.eq("shared_with_employee", true)` branch for non-manager viewers. The `isViewingOwnProfile` flag is derived by comparing the page `id` param to `workspace.user_id`.

---

## Out of Scope

- Editing individual feedback items to toggle `shared_with_employee` (future)
- Slack `/feedback` command opt-in for sharing (future)
- Comment/annotation threads on reviews (future)
