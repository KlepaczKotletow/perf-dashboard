# Nami Bot — Conversational Slack Performance Management Bot

**Date:** 2026-03-23
**Status:** Approved

## Overview

Nami is a Slack bot that proactively messages employees via DM to collect performance reviews, upward feedback, and survey responses through an interactive conversational flow using buttons (for ratings) and free-text input (for qualitative feedback). Inspired by Albert (cybersecurity training bot), Nami walks each participant through their review step-by-step in a warm, encouraging tone.

## Architecture — Option B (Dedicated Edge Function)

### New Edge Functions

1. **`nami-bot`** — Outbound messaging engine
   - Triggered by: webhook from dashboard (cycle/survey launch) + daily cron (reminders)
   - Responsibilities: initial DMs, reminder ladder, manager escalation, final warnings
   - Reads cycle config, competencies, questions, survey config per workspace from DB
   - Populates `conversation_states` for each participant session

2. **`slack-interactivity` (extended)** — Inbound handler for Nami interactions
   - Handles rating button presses in Nami DM conversations
   - Handles "Remind me later", "Skip", "Submit", "Edit a section" buttons
   - Saves responses to `review_responses` / `survey_responses`
   - Updates `conversation_states` progression

3. **`slack-events` (extended)** — Inbound handler for free-text DM replies
   - Detects when a user types a reply in a Nami DM conversation
   - Looks up active `conversation_states` for that user
   - Saves the text as a comment/response, advances to next step

### DB Schema Changes

```sql
-- Track reminder count per notification
ALTER TABLE notification_log ADD COLUMN reminder_count integer DEFAULT 0;

-- Nami scheduling on cycles
ALTER TABLE performance_cycles ADD COLUMN nami_send_at timestamptz;  -- null = send now
ALTER TABLE performance_cycles ADD COLUMN nami_confirmed boolean DEFAULT false;

-- Nami scheduling on surveys
ALTER TABLE surveys ADD COLUMN nami_send_at timestamptz;
ALTER TABLE surveys ADD COLUMN nami_confirmed boolean DEFAULT false;

-- Extend conversation_states for flow type
-- (already has assignment_id, review_role, phase, ratings, text_responses, etc.)
-- Add:
ALTER TABLE conversation_states ADD COLUMN flow_type text DEFAULT 'review';  -- 'review' | 'survey'
ALTER TABLE conversation_states ADD COLUMN survey_id uuid REFERENCES surveys(id);
ALTER TABLE conversation_states ADD COLUMN survey_answers jsonb DEFAULT '{}';
```

## Conversation Flows

### Tone
Warm & encouraging. Light emoji use. First-name basis. Examples:
- "Hey Sarah! Time for your Q1 review — shouldn't take long!"
- "Nice! Any comments on your communication this quarter?"
- "Almost done! Here's your summary:"

### All messages are fully dynamic
Every competency name, question prompt, survey question, scale, and label is pulled from the database per workspace. Nami never hardcodes client-specific content.

### Flow 1: Self-Review (Employee)

1. **Opening**: Greets by name, mentions cycle name, asks "Ready?"
   - Buttons: [Let's go] [Remind me later]
2. **Competencies**: One at a time, shows competency name + description
   - Buttons: [1 - Needs improvement] [2] [3 - Meets expectations] [4] [5 - Exceptional]
3. **Comment per competency**: "Any comments?" + [Skip] button, or user types
4. **Text questions**: One at a time, user types answer
5. **Summary**: Shows all ratings + comments, asks to confirm
   - Buttons: [Submit] [Edit a section]
6. **Completion**: "All done! Your self-review has been submitted."
   - Saves to `review_responses` with `reviewer_role = 'self'`
   - Marks `review_assignments.status = 'completed'` (for self)
   - Triggers notification to manager: "Sarah completed her self-review"

### Flow 2: Manager Review

1. **Context message**: Self-assessment avg, last cycle rating, goals summary
2. **Opening**: Same pattern, "Time to review [Employee] for [Cycle]"
3. **Competencies + comments + text questions + summary + submit**
   - Saves to `review_responses` with `reviewer_role = 'manager'`
   - Marks `review_assignments.status = 'completed'`
   - Triggers completion milestone if all reviews for employee are done

### Flow 3: Upward Feedback (Direct Report → Manager)

1. **Opening**: Mentions confidentiality, names the manager being reviewed
2. **Competencies + comments + text questions + summary + submit**
   - Saves to `review_responses` with `reviewer_role = 'upward'`
   - Marks `review_assignments.status = 'completed'` (for upward assignment)

### Flow 4: Survey / 360

1. **Opening**: Survey name, question count, estimated time
2. **Questions one at a time**: Rating scales as buttons, text as free-type, select as buttons
3. **Summary + submit**
   - Saves to `survey_responses` with answers JSON
   - Marks `survey_participants.status = 'completed'`

### "Remind me later"
Nami replies: "No problem! I'll check back tomorrow." Counts as 1 toward the 3-reminder limit.

## Reminder Ladder

| Timing | Event | Recipient |
|--------|-------|-----------|
| D+0 | Cycle launched & confirmed | Employee / reviewer |
| D+3 | Reminder 1 | Employee / reviewer |
| D+6 | Reminder 2 | Employee / reviewer |
| D+9 | Reminder 3 | Employee / reviewer |
| After 3rd | Escalation | Manager of that person |
| D-1 before deadline | Final warning | Both employee AND manager |

Tracked via `notification_log` with `event_type`:
- `nami_initial`, `nami_reminder_1`, `nami_reminder_2`, `nami_reminder_3`
- `nami_escalation_manager`, `nami_final_warning`

Daily cron checks: for each incomplete assignment, what's the last event_type sent + days since → decides what fires next.

## Dashboard Changes

### Cycle Launch Confirmation Modal
When admin clicks "Launch":
- Shows count of who will be messaged (employees, managers, direct reports)
- Options: [Send now] [Schedule for: date/time picker]
- Must confirm before Nami fires
- Sets `nami_confirmed = true` and optionally `nami_send_at`

### Survey Launch — Same pattern
Confirmation + send now/schedule.

### Nami Status Tracker (new section on cycle detail page)
- Table showing each participant: name, role (self/manager/upward), status, reminder count
- Visual indicators: green (done), yellow (in progress), red (overdue/escalated)
- Filterable by status

### Review Data Display
No changes needed — Nami writes to the same `review_responses` and `survey_responses` tables. All existing dashboard views (calibration, individual detail, survey analytics) work as-is.

## Data Integrity

All Nami-collected data flows into existing tables:
- **Competency ratings** → `review_responses.rating` + `review_responses.comment`
- **Text questions** → `review_responses` with `competency_id = null`, comment = answer
- **Survey answers** → `survey_responses.answers` (JSON)
- **Assignment status** → `review_assignments.status`
- **Survey participant status** → `survey_participants.status`

The dashboard reads from these tables — no display changes required for review data.
