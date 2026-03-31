# Easy-Use Templates — Design Document

**Date:** 2026-03-31
**Status:** Approved

## Problem

Cycle profiles, review templates, and goal templates exist in the Templates page but they don't save users meaningful work. Cycle profiles send users through a 5-step wizard. Review templates and goal templates just have "View" links with no action. Templates should mean less work, not more.

## Solution

Apply the same one-click "Use Template" UX from function templates to all remaining template types:

- **Cycle Profiles** → new `CycleImportDialog` — name + dates → creates draft cycle instantly
- **Review Templates** → "Use Template" smart link → pre-selects the template in the new-cycle wizard
- **Goal Templates** → "Use Template" smart link → pre-fills the new goal form

No new DB tables. No schema changes.

---

## Part 1: Cycle Profiles — CycleImportDialog

### What changes

Replace the `CycleProfileCard` "Use in Wizard" link with a **"Use Template"** button that opens a `CycleImportDialog`.

### Dialog contents

1. **Preview panel** — cycle type badge, description, competency categories, linked review template name
2. **Cycle Name input** — pre-filled with the template name (editable)
3. **Start Date + End Date** — date pickers (required)
4. **"Create Draft" button** — creates the cycle and redirects

### What gets created

Single insert into `performance_cycles`:
```
name, description, type, status: "draft", start_date, end_date, workspace_id, created_by
```

No phases, no questions, no employees — the cycle detail page handles all of that. User lands on the draft and can add people and launch when ready.

### Error handling

- Name is required
- Start date required, end date required, end must be after start
- On error: show inline error, stay in dialog
- On success: redirect to `/dashboard/cycles/<id>`

---

## Part 2: Review Templates — Smart Link

### What changes

Each `ReviewTemplateRow` gets a **"Use Template"** button (in addition to the existing "View" link). It links to:
```
/dashboard/cycles/new?reviewTemplate=<templateId>
```

### New-cycle wizard changes

In `src/app/dashboard/cycles/new/page.tsx`, the wizard already loads templates and has a template dropdown in Step 3. We add:

- On load, read `searchParams.get("reviewTemplate")`
- If present, auto-select that template in Step 3 (set `templateApplied` state)
- Advance the wizard to Step 3 so the user sees it applied (or show a toast/indicator)

The user still configures dates and people (Steps 1–2) but questions are pre-set.

---

## Part 3: Goal Templates — Smart Link

### What changes

Each goal template card gets a **"Use Template"** button linking to:
```
/dashboard/goals/new?templateId=<templateId>
```

### New-goal page changes

In `src/app/dashboard/goals/new/page.tsx`, on load:

- Read `searchParams.get("templateId")`
- If present, fetch that template from the `templates` table (client-side)
- Pre-fill: `title`, `scope`, `metric_start`, `metric_target`, `metric_unit`
- User just fills in the `[brackets]` and saves

The existing hardcoded quick-pick strip stays as-is (it's a different UX — quick picks are a top-of-page strip, template links come from the Templates page).

---

## Files Changed

### New files
- `src/app/dashboard/templates/cycle-import-dialog.tsx` — new dialog component

### Modified files
- `src/app/dashboard/templates/templates-client.tsx`
  - `CycleProfileCard`: replace "Use in Wizard" link with button opening `CycleImportDialog`
  - `ReviewTemplateRow`: add "Use Template" button → `?reviewTemplate=<id>` link
  - Goal templates section: add "Use Template" button → `?templateId=<id>` link
- `src/app/dashboard/cycles/new/page.tsx`
  - Read `?reviewTemplate=<id>` param on load, auto-apply the template
- `src/app/dashboard/goals/new/page.tsx`
  - Read `?templateId=<id>` param on load, fetch + pre-fill the form

---

## Edge Cases

- **Cycle name already exists**: No duplicate check needed — cycles are identified by ID, not name. Duplicates are fine.
- **Review template not found** (param is stale): Silently ignore, wizard loads normally.
- **Goal template not found**: Silently ignore, form loads empty as normal.
- **No dates set in cycle dialog**: Validate before submit — show inline error.
- **User edits pre-filled goal title**: They should — `[brackets]` are placeholders.
