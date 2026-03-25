# Nami Deadline Reminders & Soft Close — Design

**Date:** 2026-03-25
**Status:** Approved

## Problem Statement

Employees miss review deadlines because proactive messaging is insufficient. The current system sends reminders every 3+ days without being anchored to the actual deadline. Managers aren't proactively warned about their reports' pending reviews. When the deadline passes, there's no clear "overdue" communication or soft-close behavior.

## Competitor Research Summary

All major competitors (Lattice, Culture Amp, 15Five, Leapsome, Deel, PerformYard, BambooHR, Workday) use **soft deadlines** — reviews stay open after the deadline, admin manually closes. Best practice reminder schedule: 7 days, 3 days, 1 day before. Manager notification at deadline or post-deadline. Escalation tiers: employee → manager → HR/admin.

## Design

### 1. Employee Reminder Schedule (Nami Slack DMs)

| When | Event Type | Message Tone |
|------|-----------|-------------|
| Cycle launch | `nami_initial` | **Already exists.** "A new review cycle has started..." |
| 7 days before deadline | `nami_reminder_7d` | Informational. "Due in 7 days. Here's your link." |
| 3 days before deadline | `nami_reminder_3d` | Nudge. "Due in 3 days. Don't leave it to the last minute." |
| 1 day before deadline | `nami_reminder_1d` | Urgent. "Last call! Due tomorrow." |
| 1 day after deadline | `nami_overdue` | Overdue. "Now overdue. Please complete ASAP." |

- Each event fires **at most once** per user per assignment (dedup via `notification_log`)
- Only sent to users with **incomplete** assignments
- Replaces the current `reminder_1/2/3` every-3-days ladder with deadline-anchored schedule
- Includes Block Kit button linking directly to the review form

### 2. Manager Notifications (Nami Slack DMs)

| When | Event Type | Content |
|------|-----------|---------|
| 1 day before deadline | `nami_mgr_warning` | "Heads up — {names} haven't completed their reviews yet. Deadline is tomorrow." |
| 1 day after deadline | `nami_mgr_overdue` | "{names}'s reviews are now overdue." |

**Consolidated DMs:** If a manager has multiple direct reports with outstanding reviews, Nami sends a **single DM listing all of them** (not one per report):

> "Heads up — 3 of your direct reports haven't completed their reviews:
> - Anna Kowalska (self-review, due yesterday)
> - Jan Nowak (self-review, due yesterday)
> - Maria Wiśniewska (upward feedback, due yesterday)"

### 3. Soft Close Behavior

- **Reviews stay open** after the deadline — employees can still submit
- **UI shows overdue state** — "Overdue" in red on the Performance tab (already works via `isPast(dueDate)`)
- **Admin manually closes** — when cycle status → "closed", submissions are blocked (existing logic)
- **No auto-close** — cycle stays in "active" until admin closes

### 4. Technical Approach

**Modify:** `supabase/functions/nami-bot/index.ts` — replace the current `handleReminders()` logic

**Current logic:** Counts existing reminders, sends `reminder_1/2/3` every 3+ days, then escalates.

**New logic:**
1. Query all active cycles with `review_deadline`
2. For each incomplete assignment, calculate `daysUntilDeadline`
3. Based on `daysUntilDeadline`, determine which event types should have fired by now
4. Check `notification_log` for which have already been sent
5. Send any that are due but haven't been sent yet
6. For manager DMs: group outstanding reports by manager, send consolidated DM

**Deadline calculation:**
```
daysUntilDeadline = differenceInDays(reviewDeadline, now)

if daysUntilDeadline <= 7 → nami_reminder_7d should exist
if daysUntilDeadline <= 3 → nami_reminder_3d should exist
if daysUntilDeadline <= 1 → nami_reminder_1d should exist
if daysUntilDeadline < 0  → nami_overdue should exist

For managers:
if daysUntilDeadline <= 1 → nami_mgr_warning should exist
if daysUntilDeadline < 0  → nami_mgr_overdue should exist
```

**No database changes needed** — uses existing `notification_log` table with new event type strings.

**No new edge functions needed** — modifies existing `nami-bot` function.

## Success Criteria

1. Employees receive 4 deadline-anchored DMs from Nami (7d, 3d, 1d, overdue)
2. Managers receive 2 DMs (1d warning + overdue alert) with consolidated lists
3. Reviews stay open after deadline (soft close)
4. No duplicate messages (dedup via notification_log)
5. Existing kickoff DM (`nami_initial`) continues working unchanged
