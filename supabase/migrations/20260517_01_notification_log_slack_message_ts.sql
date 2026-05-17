-- Track the Slack message_ts + channel for each notification_log row so
-- the slack-interactivity submit handler can update every stale reminder
-- DM in place when a review completes.
--
-- Why this matters: HR commonly sends multiple reminders for the same
-- review (cron escalation 7d/3d/1d plus manual "Remind" nudges). Each
-- lands as a separate Slack DM with its own "Let's do it" button. Once
-- the user finishes the review, every remaining DM still LOOKS clickable.
-- Without these columns we'd have no way to find those messages and
-- rewrite them to "✅ Done".

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS slack_message_ts text,
  ADD COLUMN IF NOT EXISTS slack_channel text;

-- Lookup index for the sweep query in slack-interactivity:
-- `notification_log where user_id=? and reference_id like '...' and slack_message_ts is not null`
CREATE INDEX IF NOT EXISTS idx_notification_log_user_with_ts
  ON notification_log (user_id, event_type)
  WHERE slack_message_ts IS NOT NULL;
