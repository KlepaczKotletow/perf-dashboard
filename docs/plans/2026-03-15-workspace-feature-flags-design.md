# Workspace Feature Flags: Departments & Career Framework

**Date:** 2026-03-15
**Status:** Approved

## Problem

Different companies structure their teams differently. Some use departments (Finance, Operations) as their primary org unit. Some use a career framework (functions with levels and competency scorecards) as their primary structure. Many use both. The app needs to adapt to all three configurations without becoming complex for customers who only need one.

## Decision

- **Departments** and **Career Framework (Functions)** are independent, toggleable features.
- At least one must always be on.
- Both default to `true` for existing workspaces — zero disruption.
- Brand-new workspaces start with `use_career_framework = false` and configure during onboarding.
- "Functions" naming stays as-is throughout the UI.

## Section 1 — Data Model

### DB migration

Add two columns to the `workspaces` table:

```sql
ALTER TABLE workspaces
  ADD COLUMN use_departments boolean NOT NULL DEFAULT true,
  ADD COLUMN use_career_framework boolean NOT NULL DEFAULT true,
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
```

- `use_departments` — controls department field on users, Departments nav, department column in directory, Set Department bulk action
- `use_career_framework` — controls Functions nav, competency scorecards, levels, Set Function & Level bulk action
- `onboarding_completed` — gates the onboarding wizard (shows once, never again)

**Existing workspaces:** both flags `true`, `onboarding_completed = true` → no change in behaviour.
**New workspaces:** `use_departments = true`, `use_career_framework = false`, `onboarding_completed = false` → onboarding wizard runs on first login.

### Propagation

`getUserWorkspace()` in `src/lib/supabase-server.ts` already reads the workspaces row. Extend it to also return:

```ts
{
  useDepartments: boolean,
  useCareerFramework: boolean,
  onboardingCompleted: boolean,
}
```

No extra DB queries — the workspaces row is already fetched. Every server layout/page receives the flags through `getUserWorkspace()` and passes them as props.

## Section 2 — Settings UI

### New page: `/dashboard/settings/general`

Admin-only. Two toggle rows:

| Toggle | Label | Disable condition |
|--------|-------|-------------------|
| `use_departments` | "Track team members by department (Finance, Operations…)" | Only if `use_career_framework` is on |
| `use_career_framework` | "Enable job functions, levels and competency scorecards" | Only if `use_departments` is on |

Each toggle shows a warning on disable:
> "This will hide all [department/function] data from the UI. Your data is preserved and will reappear if you re-enable it."

Add "General" to the Settings section in the sidebar nav (admin only).

### Conditional UI changes when flags toggle

**`use_career_framework = false`:**
- Functions nav item hidden
- Competency scorecard hidden in reviews
- Set Function & Level removed from bulk actions
- Level column hidden in directory

**`use_departments = false`:**
- Departments nav item hidden
- Department column hidden in directory
- Set Department removed from bulk actions

## Section 3 — Onboarding Flow

### Route: `/onboarding`

Shown once to admins on first login (`onboarding_completed = false`). A clean centered wizard.

**Step 1 — Welcome**
- Workspace name (pre-filled from Slack)
- Optional: logo upload (skip for now)

**Step 2 — Structure**
*"How do you organise your team?"*

Three cards:

| Option | Sets |
|--------|------|
| **Departments only** — "Finance, Operations, Marketing…" | `use_departments=true`, `use_career_framework=false` |
| **Career Framework** — "Job functions with levels and competency scorecards" | `use_departments=false`, `use_career_framework=true` |
| **Both** — "Departments for org structure + functions for career development" | both `true` |

**Step 3 — Done**
"You're all set. You can change this any time in Settings → General."
→ Sets `onboarding_completed = true` → redirect to `/dashboard`

Skipping onboarding (close/ESC) sets both flags `true` and `onboarding_completed = true`.

## Out of Scope

- Logo upload in onboarding (future)
- Per-user flag overrides (always workspace-level)
- Turning both flags off simultaneously (UI prevents it)
