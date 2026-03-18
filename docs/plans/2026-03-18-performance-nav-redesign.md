# Performance Nav Redesign

**Date:** 2026-03-18
**Status:** Approved

## Problem

The current "My Reviews" nav item mixes two fundamentally different user roles on one page:
- Reviews *about you* (you as reviewee — your results)
- Reviews *you need to give* (you as reviewer — manager, peer, upward)

This is confusing. Users expect "My Reviews" to be about them, not a combined inbox + history.

## Solution

Replace "My Reviews" with **"Performance"** — a single nav item with two tabs:

### Tab 1: Results
- Your performance history across all cycles
- Self-assessments, manager review outcomes, ratings, final grades
- Read-only; sorted newest first, completed cycles faded

### Tab 2: To Do
- All pending review actions assigned to you
- Covers: self-reviews, manager reviews (standard quarterly/annual), 360 peer reviews, upward feedback
- Active tasks shown first; completed tasks shown below a divider
- When empty: friendly empty state ("No pending reviews")

## Competitor Basis
- **Lattice**: Tasks page (Active/Closed) + Profile page for history
- **Workday**: My Tasks inbox + Profile > Performance tab
- **Culture Amp**: Home (outstanding) + Performance > Reviews (history)
- **Revolut People**: Dashboard pending tasks widget + per-cycle history

## Nav Changes

| Before | After |
|---|---|
| Personal > My Reviews | Personal > Performance |

The "Reviews to Give" section currently inside My Reviews page becomes the **To Do** tab.
The "My Performance" section currently inside My Reviews page becomes the **Results** tab.
Upward feedback (currently shown as a third section) moves into the **To Do** tab since it's an action to complete.

## Scope

- `src/app/dashboard/layout.tsx` — rename nav item
- `src/app/dashboard/my-reviews/page.tsx` — restructure into two-tab layout
- Route stays at `/dashboard/my-reviews` (or rename to `/dashboard/performance`)
- No DB changes needed — data fetching logic stays the same, just reorganised into tabs
