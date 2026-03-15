# Directory: Functions & Departments — Design

**Date:** 2026-03-15
**Status:** Approved

---

## Problem

1. The team directory bulk actions have no "Set Function" option. Function is only assignable implicitly by picking a level from a flat list — making it hard to discover and hard to use when many levels exist across many functions.
2. Departments are free-text strings scraped from user records. There's no master list, no management UI, and no guard against typos creating duplicate department names.

---

## Feature 1 — Set Function & Level (bulk action)

### What changes

The existing **"Set Level"** item in the bulk action dropdown is replaced with **"Set Function & Level"**. This triggers a two-step chained select UI:

1. **Function select** — dropdown listing all job families (functions) for the workspace.
2. **Level select** — appears immediately after a function is chosen; shows only the levels belonging to that function.

On Apply, `level_id` is written to the selected users (same as today). No DB schema change required.

### Behaviour details

- If a function has no levels yet, the level select shows a disabled "No levels configured" state and Apply is disabled.
- The action label in the confirmation pill reads: `Set Function & Level → Operations / Senior Manager`.
- The old flat level list is completely removed from this action.

---

## Feature 2 — Departments admin page

### DB schema

New table: `departments`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| workspace_id | uuid | FK → workspaces, NOT NULL |
| name | text | NOT NULL |
| created_at | timestamptz | default now() |

Unique constraint on `(workspace_id, name)`.

The `users.department` column stays as a plain `text` string (no FK). This avoids cascading constraints and keeps the Slack import unaffected.

### Migration

On page load (server component), if no rows exist in `departments` for this workspace, seed the table with all unique non-null `department` strings currently on users.

### Admin page: `/dashboard/admin/departments`

- Single-panel layout.
- Lists all departments with member count badge (count of users with matching department string).
- Inline rename on click — propagates by running `UPDATE users SET department = 'New' WHERE department = 'Old' AND workspace_id = $1`, then renames the departments row.
- Delete on hover — confirmation shows member count; on confirm sets `users.department = NULL` for affected users, then deletes the row.
- "+ Add Department" button at top — inline input appended to list, Enter to save.
- Navigation: "Departments" added under Admin in sidebar, alongside "Functions".

### Bulk action update

The **"Set Department"** bulk action dropdown now loads options from the `departments` table instead of scraping unique strings from users. The free-text "New dept..." input is removed. Departments must be created in the admin page first.

---

## Out of Scope

- Assigning a function to a user independently of a level (would require `job_family_id` on users — deferred)
- Department hierarchy / parent departments
- Merging departments via the admin UI (can be done via rename)
