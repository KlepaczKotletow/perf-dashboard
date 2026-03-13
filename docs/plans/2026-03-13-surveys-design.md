# Surveys Feature Design

**Date:** 2026-03-13
**Status:** Approved
**Scope:** 360 reviews, Pulse surveys, eNPS — all Slack-native

---

## Overview

A unified survey engine allowing admin/HR to launch structured listening tools (360, Pulse, eNPS) directly from the dashboard. Participants receive Slack DMs and respond entirely within Slack. Results aggregate on the dashboard with anonymity enforced throughout.

Research basis:
- 360: anonymity doubles candour (McKinsey); min 3 raters per group; 7-point Likert; development tool only, never compensation
- Pulse: 5–15 questions max; anonymous always; closing the feedback loop drives sustained participation
- eNPS: single 0–10 question + one open follow-up; 2024 global benchmark ~20–27
- Slack delivery: 7–10× higher response rates vs email (Polly data)

---

## Architecture: Unified Survey Engine

One engine handles all three types via a `type` enum + `config JSONB`. No separate tables per type. New types addable without schema changes.

---

## Section 1 — Data Model

### `surveys`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
type          text NOT NULL  -- '360' | 'pulse' | 'enps'
name          text NOT NULL
status        text DEFAULT 'draft'  -- 'draft' | 'active' | 'closed'
config        jsonb NOT NULL DEFAULT '{}'
created_by    uuid REFERENCES users(id)
closes_at     timestamptz
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

**Config shapes:**
- **360**: `{ "questions": [{"id","type","label","competency_id?"}], "rater_groups": ["self","manager","peer","direct_report"], "min_raters_to_show": 3 }`
- **pulse**: `{ "questions": [{"id","type","label","options"?}] }`
- **eNPS**: `{ "follow_up": "What's the main reason for your score?" }`

Question types: `rating_7` (1–7 Likert), `text` (open), `single_select`, `multi_select`

### `survey_participants`
```sql
id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
survey_id         uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE
user_id           uuid NOT NULL REFERENCES users(id)   -- the rater/respondent
subject_user_id   uuid REFERENCES users(id)            -- 360 only: who they're rating
role              text  -- 'subject'|'self'|'manager'|'peer'|'direct_report'|'respondent'
status            text DEFAULT 'pending'  -- 'pending' | 'completed'
slack_message_ts  text  -- stored for reminder threading
completed_at      timestamptz
```

### `survey_responses`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
survey_id        uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE
participant_id   uuid NOT NULL REFERENCES survey_participants(id)
subject_user_id  uuid REFERENCES users(id)  -- 360 only
answers          jsonb NOT NULL DEFAULT '{}'  -- { question_id: value }
submitted_at     timestamptz DEFAULT now()
```

**YAGNI exclusions:** survey scheduling/recurrence, segment targeting, benchmark comparisons, custom type — all addable without schema changes.

---

## Section 2 — Dashboard UI

### Navigation
Add "Surveys" to the Organization section in sidebar (`ClipboardList` icon), visible to manager+.

### `/dashboard/surveys` — List page
- Full-width row list (same pattern as Cycles/Templates)
- Columns: Name / Type badge / Status badge / Response rate / Closes / Actions
- Type badge colours: 360=purple, Pulse=blue, eNPS=green
- Empty state with "Launch your first survey" CTA
- "+ New Survey" button top right

### Survey creation — 3-step wizard

**Step 1 — Pick type**
Three cards: 360 ("Multi-rater development feedback"), Pulse ("Quick team temperature check"), eNPS ("Would you recommend working here?")

**Step 2 — Configure** (type-specific)
- **360**: Name → subjects (multi-select from team directory) → rater groups (Self / Manager / Peers / Direct Reports checkboxes) → questions (add/reorder, 7-point scale or open text, optional competency tag) → deadline
- **Pulse**: Name → questions (same field builder pattern as `/feedback` form) → deadline
- **eNPS**: Name → follow-up question (pre-filled standard) → deadline

**Step 3 — Review & Launch**
Summary: type, participant count ("22 participants will receive a Slack DM"), closes date. "Launch" button triggers DMs.

### `/dashboard/surveys/[id]` — Detail/results page
- Header: name, type badge, status, "Close Survey" + "Send Reminder" buttons
- Response rate card: X of Y completed, progress bar
- **360 results**: table of subjects → click → gap chart (self vs peers vs manager per question, grouped by competency). Results hidden if < 3 raters in any group — shows "Waiting for more responses"
- **Pulse results**: bar chart per question showing % distribution
- **eNPS results**: score gauge (−100 to +100), promoter/passive/detractor donut, open text verbatims list

---

## Section 3 — Slack Integration

### New edge function: `survey-notifications`
Triggered by dashboard "Launch" and "Send Reminder" actions.

- Reads `survey_participants` for the survey
- Sends personalised DM per participant via `chat.postMessage`
- Stores `slack_message_ts` back to `survey_participants`
- Reminder: filters to `status = 'pending'` only, threads reply

**DM formats:**
- **360**: `"👋 [Name] has requested your feedback. Takes ~3 min."` + "Give Feedback" button
- **Pulse**: `"📊 [Survey name] — your team wants to hear from you."` + "Take Survey" button
- **eNPS**: inline 0–10 `static_select` + follow-up text input directly in DM (no modal)

### Updated: `slack-commands`
Add `/survey` command handler:
- Lists pending surveys for the user (same pattern as `/review`)
- Options: one per pending participation
- Selecting one opens the survey modal

### Updated: `slack-interactivity`
New callback IDs:
- `survey_modal_submit` — 360 + pulse: inserts `survey_responses`, updates participant status to `completed`
- `enps_submit` (block action) — handles inline eNPS response from DM

### Modal pagination
Research mandates <15 questions → fits in one Slack modal (100 block limit). No pagination needed.

---

## Implementation Tasks

1. DB migrations — `surveys`, `survey_participants`, `survey_responses` + RLS policies
2. `survey-notifications` edge function (new)
3. `slack-commands` — add `/survey` handler
4. `slack-interactivity` — add `survey_modal_submit` + `enps_submit` handlers
5. `/dashboard/surveys` list page + sidebar nav item
6. Survey creation wizard (3-step)
7. `/dashboard/surveys/[id]` detail + results page (gap chart, bar chart, eNPS gauge)
8. Deploy + end-to-end test
