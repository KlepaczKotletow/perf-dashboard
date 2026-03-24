# Cycle Creation Improvements Design

**Date:** 2026-03-24
**Status:** Approved

## Problem Statement

The cycle creation flow has validation gaps, Nami bot integration issues, and UX friction that can lead to broken review cycles, missed notifications, and user confusion.

## Key Gaps Identified

### Validation & Data Integrity
1. Can launch a cycle with 0 competencies/questions — Nami sends opening messages but reviews have nothing to rate
2. No future-date validation on Nami schedule — can schedule in the past
3. Review deadline can be set before start_date — no cross-field validation
4. No minimum employees check on launch
5. Deadline = end_date allowed with no distinction

### Nami Integration
6. Employees with no Slack ID silently skipped — no UI feedback
7. No retry mechanism if Slack API fails — notification_log rolled back but no recovery
8. Re-send blocked by unique constraint — partial failures can't be recovered
9. Notification log uses fuzzy LIKE query — could match wrong cycles

### UX
10. Single long form — easy to miss sections
11. Phase dates auto-calculated but not shown
12. No draft auto-save
13. No summary screen before launch

## Design

### 1. Multi-Step Wizard (replaces single-page form)

5-step wizard with per-step validation. User can navigate back freely. Draft auto-saves on step transitions.

**Step 1 — Cycle Basics & Dates**
- Fields: name (required), type (dropdown), description (optional)
- Dates: start_date, end_date, review_deadline
- Validation:
  - start_date < end_date (required)
  - review_deadline must be between start_date and end_date (if set)
  - All dates must be in the future for new cycles
- Phase timeline: horizontal visual bar showing 6 phases distributed proportionally
- "Save Draft" available (only name required)

**Step 2 — People**
- Employee multi-select (same as today)
- Manager assignments preview table after selection
- Warning badges for employees missing Slack IDs
- Minimum 1 employee required to proceed to next step

**Step 3 — Review Questions**
- Competency selector + custom text questions (same fields as today)
- Minimum 1 question or competency required to proceed
- Preview of what Nami will ask participants

**Step 4 — Nami Bot Configuration**
- Send mode: "Send now" vs "Schedule for later"
- Schedule date validated to be in the future
- Notification preview breakdown:
  - X self-review prompts
  - Y manager review prompts
  - Z upward feedback prompts
  - W employees skipped (no Slack ID) — expandable list
- "Skip Nami" option stays

**Step 5 — Review & Launch**
- Full summary card for each step
- Each section editable (click to jump back to that step)
- "Launch Cycle" and "Save as Draft" buttons
- Launch disabled until all validations pass

### 2. Draft Auto-Save

- On every step transition, auto-save current state to `performance_cycles` as draft
- Use existing draft status — no schema change needed
- Store wizard step progress in `performance_cycles.description` or a new `metadata` JSONB column
- When user returns to a draft cycle, resume at last completed step
- Debounced auto-save (2s after last field change) within each step

### 3. Validation Fixes

| Rule | Step | Implementation |
|------|------|---------------|
| start_date < end_date | 1 | Inline error, block next |
| deadline between start/end | 1 | Inline error, block next |
| All dates in future (new cycles) | 1 | Inline error, block next |
| Min 1 employee enrolled | 2 | Block next step |
| Min 1 question/competency | 3 | Block next step |
| Nami schedule in future | 4 | Inline error if past datetime |
| Warn missing Slack IDs | 2+4 | Yellow warning, non-blocking |

### 4. Nami Integration Fixes

**Fix 1 — Exact notification log queries**
- Replace `reference_id.like.%${id}%` with `reference_id.eq.${id}` in cycle detail page
- Use `cycle_id::assignment_id` as reference_id format for per-assignment tracking

**Fix 2 — Smart re-send**
- Re-send button checks which users have no notification_log entry
- Sends only to missed users
- Returns breakdown: sent / already notified / skipped (no Slack)

**Fix 3 — Missing Slack ID visibility**
- Cycle detail page shows "No Slack" badge per employee
- Nami bot returns `skipped_user_ids` in response
- Wizard Step 4 shows warning with list of affected employees

**Fix 4 — Error recovery**
- Nami bot continues sending to remaining users if one fails
- Failed sends logged with error details
- Cycle detail page shows per-user status: sent / failed / skipped / pending
- "Retry failed" button for individual users

### 5. Cycle Detail Page Improvements

- Nami notification status table with per-user delivery status
- "Missing Slack" badges on employee rows
- Re-send button targets only users who haven't been notified
- Phase timeline visualization matching the creation wizard

## Schema Changes

### New column on `performance_cycles`:
- `wizard_metadata` (JSONB, nullable) — stores wizard step progress, auto-save state

### No other schema changes needed — all existing columns support the design.

## Files to Modify

### Frontend
- `src/app/dashboard/cycles/new/page.tsx` — full rewrite to wizard
- `src/app/dashboard/cycles/[id]/page.tsx` — Nami status improvements
- `src/app/dashboard/cycles/[id]/cycle-actions.tsx` — validation + re-send logic

### Backend (Edge Functions)
- `supabase/functions/nami-bot/index.ts` — error recovery, skipped user tracking
- `supabase/functions/_shared/nami-blocks.ts` — no changes needed

### Database
- Migration: add `wizard_metadata` JSONB column to `performance_cycles`

## Success Criteria

1. Cannot launch a cycle without at least 1 employee AND 1 question/competency
2. All date validations enforced inline with clear error messages
3. Missing Slack IDs surfaced in UI before launch
4. Nami re-send only targets users who haven't been notified
5. Partial Slack failures don't block other notifications
6. Wizard auto-saves draft state on step transitions
7. Full summary screen before launch
