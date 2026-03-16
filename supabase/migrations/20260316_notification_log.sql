-- supabase/migrations/20260316_notification_log.sql
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index prevents duplicate sends for the same event+reference
CREATE UNIQUE INDEX IF NOT EXISTS notification_log_dedup
  ON notification_log(workspace_id, user_id, event_type, reference_id);

CREATE INDEX IF NOT EXISTS notification_log_workspace_idx
  ON notification_log(workspace_id, event_type, sent_at);
