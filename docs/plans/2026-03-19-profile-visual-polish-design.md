# Employee Profile — Visual Polish Design

**Date:** 2026-03-19
**Status:** Approved
**Scope:** `src/app/dashboard/team/[id]/page.tsx` — visual overhaul only, no structural or data changes
**Reference:** Revolut People (people.revolut.com) — clear hierarchy, bold hero moments, circular indicators, inline metadata

---

## Goal

Make the employee profile page feel like a real product rather than a dashboard template. The current page uses 4 equal-weight KPI tiles, badge clusters, flat progress bars, and border-on-every-row styling that makes it look AI-generated. The redesign keeps the light theme and the same 8-section structure but applies Revolut-style visual thinking: one dominant hero moment, inline metadata, circular progress, colored grade statements, and less visual noise throughout.

---

## Changes

### 1. Header Banner

**Before:** Plain white area, `h-16 w-16` avatar, `text-2xl` name, row of separate badges (role, dept, level), separate email span.

**After:**
- Outer wrapper: `rounded-xl bg-primary/[0.04] p-6` — subtle tinted panel, no card border
- Avatar: `h-24 w-24` (96px), same initials style
- Name: `text-3xl font-bold tracking-tight`
- Job title: `text-base text-muted-foreground` directly below name
- Metadata line: single `text-sm text-muted-foreground` line, dot-separated: `{department} · {levelLabel} · {role}` — replaces the badge cluster entirely
- Reports-to: own small line below metadata
- Email: own small line with mailto link and Mail icon
- Edit button: top-right, unchanged

No `Badge` components in the header at all.

---

### 2. Performance Hero Card (replaces 4 KPI tiles)

**Before:** Four identical `Card` tiles — Overall Rating, Reviews, Feedback, Goals — all equal weight, generic template feel.

**After:** One wide card (`bg-card border-border/60 rounded-xl p-6`) with a horizontal layout:

**Left — Circular ring:**
- SVG donut ring, 80px diameter, `strokeWidth=8`
- `stroke-dasharray` and `stroke-dashoffset` computed from `(rating / 5) * circumference`
- Rating number (`overallAvg`) large in the center (`text-2xl font-bold`)
- "Overall" label below in `text-xs text-muted-foreground`
- If no rating: ring shows as empty (muted stroke), center shows "—"
- Ring color: `hsl(var(--primary))`

**Right — Grade + stats:**
- Grade label (`latestReview?.final_grade`) rendered **large and colored**:
  - Exceeding / Outstanding → `text-emerald-600`
  - Performing / Meeting → `text-primary`
  - Developing → `text-amber-600`
  - Below / Needs improvement → `text-red-600`
  - No grade → omit entirely
- Grade text: `text-2xl font-bold`
- Below grade: three inline stat pills separated by `·`:
  - `{reviewAssignments.length} reviews`
  - `{onTrackGoals.length}/{activeGoals.length} goals on track`
  - `{showFeedbackSection ? continuousFeedback.length : "—"} feedback`
- Stats: `text-sm text-muted-foreground`

Permission unchanged: `showRating` gates the ring value; grade only shown if `canSeeAllRatings || grades_released`.

---

### 3. Goals — Circular Micro-Indicators

**Before:** Full-width flat progress bar (colored div inside muted container) + percentage text.

**After:** Small SVG donut (32px, `strokeWidth=4`) showing `progress%` filled, same color logic (emerald/amber/red by tracking status). Percentage text `text-xs` sits to the right of the donut. The flat bar is removed entirely.

Applied in both:
- At-a-Glance "Active Goals" snapshot card
- Full Goals list (section 7)

---

### 4. Reviews List

**Before:** Each row is a `flex justify-between` div with a left block (cycle name + manager) and right block (rating + badges), all bordered.

**After:**
- Row border → `hover:bg-muted/30 rounded-lg transition-colors` (remove `border border-border/60` per row)
- Left: quarter/period chip extracted from `cycle.start_date` — format as `Q3 '24` — rendered as a small `rounded-md bg-muted px-2 py-1 text-xs font-mono font-medium` pill, fixed width, left-aligned
- Middle: cycle name (`font-medium`) + manager name (`text-xs text-muted-foreground`)
- Right: grade label **colored and bold** (`text-sm font-semibold text-emerald-600` etc.) — same color map as hero card. Status badge becomes `text-[10px]` secondary underneath the grade.

---

### 5. Typography + Borders Throughout

**Section titles:**
- `text-lg font-semibold` (up from `text-base`)
- Remove the icon prefix from section titles where it adds no meaning — keep only for Feedback (MessageSquare) and Competencies (Star) where the icon is genuinely useful

**Inner rows (Competency, Feedback, Direct Reports):**
- Remove `border border-border/60` from every inner row
- Replace with `hover:bg-muted/30 rounded-lg transition-colors px-3 py-2`
- Section card itself keeps its border (`border-border/60`) — only inner rows lose theirs

**Uppercase tracking-wide labels:**
- Keep only in the Hero Card stats line
- Remove from "OVERALL RATING", "REVIEWS", "FEEDBACK", "GOALS" tile labels (those tiles no longer exist)
- Section `CardTitle` elements: normal case, not uppercase

---

## What Does NOT Change

- Data fetching — zero changes to `getEmployeeDetails`, queries, permission logic
- Section order and presence — all 8 sections remain, same conditional rendering
- shadcn/ui components — `Card`, `Badge`, `Button`, `Avatar` still used
- No new npm dependencies — SVG rings are inline JSX, no chart library needed
- Permission model — `canSeeAllRatings`, `showFeedbackSection`, `showRating` unchanged

---

## Files Changed

| File | Action |
|---|---|
| `src/app/dashboard/team/[id]/page.tsx` | Visual edits — header, hero card, circular indicators, review rows, typography |

One file. No new files.
