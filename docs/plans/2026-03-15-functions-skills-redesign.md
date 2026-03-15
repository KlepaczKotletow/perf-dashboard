# Functions & Skills Framework Redesign

**Date:** 2026-03-15
**Status:** Approved — ready for implementation

---

## Problem

The current setup is split across two disconnected pages:

1. `/dashboard/admin/job-families` — manages "job families" (now: functions) and their levels
2. `/dashboard/competencies` — manages competencies globally + a matrix tab to set expected proficiency per level

The mental model is fragmented. An admin setting up "Operations" must visit two different pages, understand two different UIs, and mentally connect the dots themselves. Terminology ("job families", "competencies") is abstract. The matrix tab is buried and visually cluttered.

---

## Goal

One unified page where an admin can:
- Create and manage **functions** (Operations, Engineering, Sales, etc.)
- Define **levels** within each function (Junior, Mid, Senior, Lead)
- Add **skills** specific to that function
- Set the **expected proficiency (1–5)** for each skill × level combination

During a review, the manager sees the expected score for the person's level highlighted alongside their actual rating — making gaps immediately visible.

---

## Design

### Structure & Navigation

- **New page:** `/dashboard/admin/functions` replaces both `/dashboard/admin/job-families` and `/dashboard/competencies`
- **Nav change:** "Job Families" renamed to "Functions" in the Admin section; "Competencies" nav item removed
- **Redirect:** `/dashboard/competencies` → `/dashboard/admin/functions`
- **Layout:** Full-height split — left sidebar (function list) + right content panel

```
┌─────────────────────────────────────────────────────┐
│  Functions                              [+ Function] │
├──────────────┬──────────────────────────────────────┤
│ Operations   │  Operations                    [⋯]   │
│ Engineering  │  ─────────────────────────────────── │
│ Sales        │  Levels:                             │
│              │  [Junior]  [Mid]  [Senior]  [+ Add]  │
│              │                                      │
│              │  SKILLS                [+ Add skill] │
│              │                                      │
│              │  Problem Solving  │ Jr │ Mid │ Sr    │
│              │  ─────────────────┼────┼─────┼───── │
│              │  Communication    │ 2  │  3  │  4   │
│              │  Data Analysis    │  – │  2  │  3   │
│              │                                      │
│ [+ Function] │                                      │
└──────────────┴──────────────────────────────────────┘
```

### Left Sidebar

- Lists all functions with member count badge
- Selected function is highlighted
- Inline "+ Function" form at bottom: name input → Enter to save, Escape to cancel
- Empty state if no functions: "Create your first function to get started"

### Right Panel — Function Detail

**Header:**
- Function name — click to edit inline (Enter/Escape to confirm/cancel)
- Optional description below — click to edit inline
- Member count ("5 people") shown as muted text
- `⋯` dropdown menu: Rename, Delete (with confirmation if members assigned)

**Levels row:**
- Pills: `[Junior]  [Mid]  [Senior]  [+ Add level]`
- Click pill to rename inline; hover shows `×` to delete (warns if people assigned)
- Enter/Escape to confirm/cancel rename
- `+ Add level` opens inline input at end of pills row

**Scorecard table:**

| SKILL | Junior | Mid | Senior |
|---|---|---|---|
| Problem Solving | `[2]` | `[3]` | `[4]` |
| Communication | `[2]` | `[3]` | `[4]` |
| Data Analysis | `–` | `[2]` | `[3]` |

- Each score badge is clickable → opens 1–5 inline picker (existing `InlinePicker` component)
- `–` = not expected at this level; clicking sets a score
- Row hover shows `×` to remove skill from this function
- Skill name is clickable to expand/collapse a description row beneath it
- `+ Add skill to [Function]` button below table → inline form: name input + optional description, Enter/Escape

**Core skills section (below function-specific skills):**
- Collapsible section: "Core skills (all functions)"
- Shows global skills (`job_family_id = NULL`) — their expected scores can also be set per level here
- Core skills are not deletable from within a function view (they live globally)

**Empty state (no function selected):**
- Right panel shows: "Select a function to configure it, or create your first one →"

### Inline Interactions — Summary

| Action | Trigger | Confirm | Cancel |
|---|---|---|---|
| Create function | Click `+ Function` | Enter | Escape |
| Rename function | Click name | Enter / click away | Escape |
| Add level | Click `+ Add level` | Enter | Escape |
| Rename level | Click level pill | Enter / click away | Escape |
| Delete level | Hover pill → click `×` | Confirm dialog if members | — |
| Add skill | Click `+ Add skill` | Enter / click Save | Escape |
| Set expected score | Click score badge | Click number in picker | Click outside |
| Remove skill from function | Hover row → click `×` | Confirm dialog | — |

---

## Data Model

### Migration Required

Add `job_family_id` FK to `competencies` table:

```sql
ALTER TABLE competencies
ADD COLUMN job_family_id uuid REFERENCES job_families(id) ON DELETE CASCADE;
```

### Semantics

| `job_family_id` | Meaning |
|---|---|
| `NULL` | Core / global — visible in all functions |
| set to a function ID | Belongs to that function only |

### Existing Data

All existing competencies keep `job_family_id = NULL` → they automatically become core/global competencies. No data migration needed. Nothing breaks.

### Unchanged Tables

- `job_families` — unchanged (renamed "Functions" in UI only)
- `levels` — unchanged
- `level_competencies` — unchanged (stores expected score per level × skill)

---

## Files Affected

### New / Replaced
- `src/app/dashboard/admin/functions/page.tsx` — new server component (replaces job-families page)
- `src/app/dashboard/admin/functions/functions-client.tsx` — new client component (split-panel UI)

### Modified
- `src/app/dashboard/admin/job-families/page.tsx` → redirect to `/dashboard/admin/functions`
- `src/app/dashboard/competencies/page.tsx` → redirect to `/dashboard/admin/functions`
- Sidebar nav component → rename "Job Families" to "Functions", remove "Competencies" item
- `src/app/dashboard/team/[id]/edit/page.tsx` → update any references to job families terminology

### Deleted
- `src/app/dashboard/competencies/` — entire directory (after redirect in place)
- `src/app/dashboard/admin/job-families/` — entire directory (after redirect in place)

### DB
- Supabase migration: `add_job_family_id_to_competencies`

---

## Review Integration (future)

When a manager rates a direct report during a review cycle:
- Fetch the person's function + level from `users.level_id → levels.job_family_id`
- Load all skills for that function (`competencies WHERE job_family_id = X OR job_family_id IS NULL`)
- Load expected scores for their specific level from `level_competencies`
- Display: skill name, expected score (highlighted), actual rating input (1–5)
- Flag below-expected scores visually (amber/red indicator)

This is out of scope for this implementation task but the data model supports it fully.
