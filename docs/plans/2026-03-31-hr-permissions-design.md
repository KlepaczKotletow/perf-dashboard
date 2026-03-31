# HR Permissions — Design Document

**Date:** 2026-03-31
**Status:** Approved

## Problem

HR users are currently blocked from Settings, Functions, and Forms — all locked behind admin-only guards. This forces admins to handle people-ops config (competency functions, review forms, workspace settings) that HR should own. Only Billing and role management should remain admin-only.

## Solution

Extend the nav sidebar and page-level guards so that `hr` role can access Settings, Functions, and Forms. Billing and role changes stay admin-only.

## Permission Matrix (after)

| Feature | Employee | Manager | HR | Admin |
|---|---|---|---|---|
| Settings (workspace config) | ✗ | ✗ | ✅ | ✅ |
| Functions | ✗ | ✗ | ✅ | ✅ |
| Forms | ✗ | ✗ | ✅ | ✅ |
| Billing | ✗ | ✗ | ✗ | ✅ |
| Change user roles | ✗ | ✗ | ✗ | ✅ |

## What Changes

### 1. Nav sidebar — `src/app/dashboard/layout.tsx`

Add `requiresHR: boolean` to the nav item type alongside the existing `requiresAdmin`. Update the filter logic so `requiresHR` items are shown to `isHROrAbove` users.

Change these three nav items from `requiresAdmin: true` → `requiresHR: true`:
- Settings (`/dashboard/settings`)
- Functions (`/dashboard/admin/functions`)
- Forms (`/dashboard/settings/forms`)

Billing stays `requiresAdmin: true`.

### 2. Settings page guard — `src/app/dashboard/settings/page.tsx`

Change: `isAdminOrAbove` → `isHROrAbove`

### 3. Functions page guard — `src/app/dashboard/admin/functions/page.tsx`

Two guards on this page:
- Page access: already `isManagerOrAbove` (broader than needed, but fine — nav hides it from employees)
- `canEdit` flag: change from `isAdminOrAbove` → `isHROrAbove`

### 4. Forms page — `src/app/dashboard/settings/forms/page.tsx`

The form action already allows HR (line 508: `role !== "admin" && role !== "hr"`). The nav is the only thing blocking HR from reaching the page. No page-level guard change needed here — the nav fix handles it.

## What Does NOT Change

- `roles.ts` — `isHROrAbove` already exists, no new functions needed
- Billing page — stays `isAdmin` only
- User role management (team edit page) — stays `canManageUsers` (admin only)
- All other existing guards — untouched

## Files Modified

1. `src/app/dashboard/layout.tsx` — nav type + filter + 3 item flags
2. `src/app/dashboard/settings/page.tsx` — guard: `isAdminOrAbove` → `isHROrAbove`
3. `src/app/dashboard/admin/functions/page.tsx` — `canEdit`: `isAdminOrAbove` → `isHROrAbove`
