# Design: Notifications, Slack App Home Tab, Org Chart

**Date:** 2026-03-16
**Status:** Approved
**Approach:** Option B — Supabase Edge Functions for async work + Next.js for UI

---

## 1. Org Chart

### Goal
Add an org chart toggle to the existing Team Directory page (`/dashboard/team`).

### Implementation
- Add a toggle button (list icon / tree icon) to the Team Directory header
- Toggle state stored as `?view=chart` search param (shareable URL)
- When `view=chart`: render `<OrgChart>` component instead of `<TeamList>`
- When default: existing `<TeamList>` unchanged

### Data
- No new DB queries or migrations needed
- `users` already has `manager_id` — tree is built client-side
- Root nodes = users with `manager_id = null` or manager not in dataset
- Each node: avatar + name + job title
- Default: expand to depth 2, deeper nodes collapsed

### Files touched
- `src/app/dashboard/team/page.tsx` — pass `view` param, render toggle
- `src/app/dashboard/team/org-chart.tsx` — new component (tree renderer)

---

## 2. Notifications

### Goal
Send Slack DMs for three events:
- **A) Review assigned** — immediate, when admin activates a cycle
- **B) Deadline reminder** — scheduled, 7 days and 3 days before `review_deadline`
- **D) Goal status update** — immediate, when an employee's goal `tracking_status` changes, notify their manager

### New DB Table: `notification_log`
```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL, -- 'review_assigned' | 'cycle_deadline_reminder' | 'goal_status_update'
  reference_id TEXT NOT NULL, -- cycle_id / assignment_id / goal_id
  sent_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX ON notification_log(workspace_id, user_id, event_type, reference_id);
```

### Immediate Notifications (Server Actions)
- **Cycle activation** (`cycle-actions.tsx` or new server action):
  - On cycle status → `active`: fetch all `review_assignments` for cycle
  - For each reviewer: send `chat.postMessage` DM using workspace `bot_token`
  - Insert into `notification_log` (skip if already sent)
- **Goal tracking status change** (goal update server action):
  - When `tracking_status` changes on a goal: fetch employee's `manager_id`
  - Send DM to manager with goal title + new status + deep link
  - Insert into `notification_log`

### Scheduled Reminders (Supabase Edge Function)
- **Function:** `send-deadline-reminders`
- **Schedule:** Daily at 9:00 UTC via `pg_cron`
- **Logic:**
  1. Find cycles where `review_deadline` is in exactly 7 or 3 days
  2. For each: find incomplete `review_assignments` (status != 'completed')
  3. Check `notification_log` — skip if already sent for this `reference_id` + `event_type`
  4. Send DM, log to `notification_log`

### Slack Message Format
```
📋 *Review reminder* — [Cycle Name]
You have a pending review to complete for *[Employee Name]*.
Deadline: [Date]
→ Complete review: [deep link]
```

### Files touched
- `supabase/functions/send-deadline-reminders/index.ts` — new edge function
- `src/app/dashboard/cycles/[id]/cycle-actions.tsx` — trigger on activation
- `src/app/dashboard/goals/goals-client.tsx` — trigger on status change
- `src/lib/slack-notify.ts` — new shared helper for `chat.postMessage`
- DB migration for `notification_log`

---

## 3. Slack App Home Tab

### Goal
When a user opens the Slack app's Home tab, show a personalized, role-aware dashboard.

### Flow
1. Slack sends `app_home_opened` event → `POST /api/slack/events`
2. Verify Slack signature (HMAC-SHA256 with `SLACK_SIGNING_SECRET`)
3. Look up user by `slack_user_id` → get role + workspace
4. Query relevant data (see blocks below)
5. Call `views.publish` with Block Kit payload

### Blocks by Role

| Block | Employee | Manager | Admin/HR |
|---|---|---|---|
| Pending reviews to write | ✅ | ✅ | ✅ |
| Active cycle + deadline | ✅ | ✅ | ✅ |
| Recent feedback received (if visible) | ✅ | ✅ | ✅ |
| Team's pending reviews | ❌ | ✅ | ✅ |
| Own overdue/at-risk goals | ✅ | ✅ | ✅ |

### Feedback Visibility
Only show feedback received if the feedback record's visibility allows the recipient to see it (respects existing visibility logic in the app).

### Env Vars Required
- `SLACK_SIGNING_SECRET` — already needed, add to `.env.local` + Vercel
- `NEXT_PUBLIC_APP_URL` — for deep links

### Files touched
- `src/app/api/slack/events/route.ts` — new route (event handler)
- `src/lib/slack-home.ts` — new helper (builds Block Kit payload)

---

## Summary of New Files

| File | Purpose |
|---|---|
| `src/app/dashboard/team/org-chart.tsx` | Tree view component |
| `src/lib/slack-notify.ts` | Shared Slack DM helper |
| `src/lib/slack-home.ts` | Block Kit home tab builder |
| `src/app/api/slack/events/route.ts` | Slack event handler |
| `supabase/functions/send-deadline-reminders/index.ts` | Scheduled reminder edge function |
| DB migration | `notification_log` table |

## No changes to existing auth/billing/review logic.
