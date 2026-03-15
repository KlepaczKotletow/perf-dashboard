# Job Families UX Redesign

**Date:** 2026-03-14
**Status:** Approved

## Problem

1. Creating a job family and adding levels requires navigating to two separate pages — confusing and fragmented.
2. `department` is a free-text field, completely disconnected from the `job_families` table. A person can be "Engineering" in department but have a Finance-track level.
3. Assigning people to job families requires editing each person individually with no guidance on who's missing.
4. No visibility into how many people have no level assigned.

## Goals

- Creating a family + its levels should require zero page navigation.
- Every person's job family and level should be linked to real DB records.
- HR should see at a glance who is unassigned and fix it in as few clicks as possible.
- Hard-blocking is NOT required — warn clearly, but don't prevent anything.

## Design

### 1. Job Families page — fully inline, no sub-page

**File:** `src/app/dashboard/admin/job-families/page.tsx`

- Each family renders as a card showing its levels as pills inline.
- **Add level:** a small "+ Add level" button beneath the pills opens a tiny inline form (name + grade fields + Enter/Add). No navigation.
- **Rename family:** click pencil → inline edit in place → blur/Enter saves.
- **Delete level:** × icon on each pill (confirm if people are assigned to it).
- **Delete family:** trash icon on card header (confirm if levels have people).
- **New family:** "+ New Job Family" at the top expands an inline card form (name + optional description). No navigation.
- **The `/admin/job-families/[id]/levels` sub-page is removed.**

### 2. Team page — Unassigned banner + Level column

**File:** `src/app/dashboard/team/page.tsx`

- If `users.some(u => !u.level_id)`: render an amber banner at the top:
  > ⚠ **N people have no job level assigned** — their reviews won't have a competency baseline. [Show unassigned →]
- "Show unassigned →" applies a URL param `?filter=unassigned` that filters the team list.
- The team list `level` column already exists; ensure people without a level show "— Unassigned" in muted text.

**File:** `src/app/dashboard/team/team-list.tsx`

- Accept optional `filterUnassigned` boolean prop.
- When true, filter the displayed list to only users where `level === null`.

### 3. Edit person form — linked dropdowns

**File:** `src/app/dashboard/team/[id]/edit/page.tsx`

- Load `job_families` from DB (alongside levels, already loaded).
- Replace the `department` free-text field with a **Job Family** `<Select>` populated from `job_families`.
- The existing **Level** `<Select>` filters to only levels belonging to the selected job family. When job family changes, reset level to "".
- The `department` free-text field is kept but moved below, relabelled "Informal team / squad name (optional)".
- Saving writes `level_id` to DB (no schema change). Does not write `job_family_id` to `users` — the job family is derived from the level's `job_family_id` (already the case).

### 4. Remove the levels sub-page

- Delete `src/app/dashboard/admin/job-families/[id]/levels/page.tsx` and its folder.
- Any existing links to that page (the "Manage Levels →" link on the family card) are removed.

## Files Changed

| File | Change |
|------|--------|
| `src/app/dashboard/admin/job-families/page.tsx` | Full rewrite — inline level management, no navigation |
| `src/app/dashboard/admin/job-families/[id]/levels/page.tsx` | **Deleted** |
| `src/app/dashboard/team/page.tsx` | Add unassigned count + amber banner + filter param |
| `src/app/dashboard/team/team-list.tsx` | Accept filterUnassigned prop |
| `src/app/dashboard/team/[id]/edit/page.tsx` | Job Family select + filtered Level select |

## No DB Changes

- `job_families` and `levels` tables unchanged.
- `users.level_id` already the correct FK — job family is derived from it.
- `users.department` remains (kept as informal label).

## Verification

1. Create a new job family → levels appear inline, no sub-page navigation.
2. Add 3 levels to it without leaving the page.
3. Team page: user without level_id shows amber banner.
4. "Show unassigned" filters list to only those people.
5. Edit person: selecting "Engineering" job family filters levels to Engineering only.
6. Saving reflects immediately in team list level column.
7. `npx tsc --noEmit` → clean.
8. `npm run build` → clean.
