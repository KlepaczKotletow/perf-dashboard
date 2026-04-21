-- Inbox table for Slack event_ids. INSERT is the dedup primitive — a
-- conflict on event_id means we've already processed (or are processing)
-- this event and must short-circuit.
CREATE TABLE IF NOT EXISTS slack_processed_events (
  event_id     text PRIMARY KEY,
  team_id      text NOT NULL,
  event_type   text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_processed_events_received
  ON slack_processed_events(received_at);

ALTER TABLE slack_processed_events ENABLE ROW LEVEL SECURITY;
-- Service-role only. No user-facing policies.

-- Daily cleanup. Slack's retry window is ~1 hour; 24h gives us a
-- comfortable margin without the table growing forever.
CREATE OR REPLACE FUNCTION cleanup_slack_processed_events()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM slack_processed_events WHERE received_at < now() - interval '24 hours';
$$;

REVOKE ALL ON FUNCTION cleanup_slack_processed_events FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_slack_processed_events TO service_role;

-- Schedule the cleanup. pg_cron is already enabled (see slack_send_queue cron).
SELECT cron.schedule(
  'cleanup-slack-processed-events',
  '17 3 * * *',  -- 03:17 UTC daily
  $$ SELECT public.cleanup_slack_processed_events() $$
);
