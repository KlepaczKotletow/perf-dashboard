# Nav Simplification: Settings + Profile Dropdown Design

**Date:** 2026-03-18

## Overview

Simplify the sidebar navigation by removing the Departments toggle and admin tab, consolidating workspace settings, adding a profile page for all users, and replacing the static footer with a clickable dropdown (Linear/Notion pattern).

## Goals

- Remove the departments-vs-career-framework choice — it's not a meaningful decision for users and no competitor gates this
- Give every user access to a personal profile page via the sidebar footer
- Consolidate admin settings access into a clean footer dropdown
- Simplify onboarding — remove the confusing "how do you organise your team?" step

## What Changes

### 1. Sidebar Nav — Settings Section

Remove "General" and "Departments" nav items. Keep: Functions, Forms, Billing (all admin-only). No section label required if desired; items stay grouped below a divider.

Before:
```
Settings
  General
  Functions
  Departments
  Forms
  Billing
```

After:
```
  Functions
  Forms
  Billing
```

### 2. Footer — Dropdown on Click

The static footer (avatar + name + role badge + Sign Out button) becomes a single clickable row. Clicking opens a `Popover` above it with:

```
┌─────────────────────────┐
│  View Profile           │
│  Settings          ⚙    │  ← admin only
│  ─────────────────      │
│  Sign Out               │
└─────────────────────────┘
[Avatar]  [Name]  [Role]  [ChevronUp]
```

- Sign Out moves from its standalone button into the dropdown
- `ChevronUp` on the footer row hints it's interactive
- "Settings" item only shown to admins

### 3. Profile Page — `/dashboard/profile`

New page, accessible to all users. Contains:
- Display name (editable)
- Email (read-only, from auth)
- Role badge (read-only)
- Profile picture (placeholder for now — upload in future)

### 4. Settings Page — `/dashboard/settings`

Replaces `/dashboard/settings/general`. Admin-only. The `useDepartments` / `useCareerFramework` toggles are **removed**. Page contains workspace name (editable) as the primary setting. Acts as a hub — links to Billing and Forms remain as separate nav items.

### 5. Onboarding Simplification

Step 2 ("Departments only / Career Framework only / Both") is removed entirely. `finish()` now defaults both `use_departments` and `use_career_framework` to `true` for all new workspaces without asking. Onboarding goes: Welcome → Done.

## What Does NOT Change

- `departments` DB table — untouched, data preserved
- `department` field on users — untouched
- Directory always shows department data (`useDepartments` effectively always `true`)
- Bulk actions always show "Set Department"
- Functions admin page — untouched, this IS the performance framework
- Existing workspace feature flags in DB — existing rows unaffected

## Implications

| Area | Impact |
|---|---|
| Onboarding | Step 2 removed, cleaner 1-step flow |
| Directory | `useDepartments` prop hardcoded to `true`, no behaviour change |
| Bulk actions | `useDepartments` prop hardcoded to `true`, no behaviour change |
| General settings | Page content replaced (remove toggles, add workspace name) |
| Departments admin | Nav item removed, page can stay in codebase (dead route) or be deleted |
| Sign Out | Moves into footer dropdown — same action, different location |

## Competitors

Lattice, Leapsome, Rippling, Culture Amp — none of them toggle departments on/off. Departments are always present as an org-structure field. The career framework (functions/levels/competencies) is the differentiated feature and ships as a core capability, not a toggle.

Linear, Notion, Slack, GitHub all use the footer-dropdown pattern for profile + settings + sign out.

## Out of Scope

- Profile picture upload (placeholder only for now)
- Workspace logo
- Timezone / locale settings
- SSO configuration
