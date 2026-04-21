-- Stable dedupe key — producers compute at enqueue time. Closes the
-- "admin clicks Launch twice" failure mode by collapsing repeat enqueues
-- into a single job.
ALTER TABLE slack_send_queue
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Partial unique index — only enforced for pending jobs. Once a job
-- completes, the next enqueue with the same dedupe_key may proceed
-- (e.g. a future cycle reuses the same recipient).
CREATE UNIQUE INDEX IF NOT EXISTS slack_send_queue_pending_dedupe
  ON slack_send_queue(workspace_id, dedupe_key)
  WHERE completed_at IS NULL AND dedupe_key IS NOT NULL;

-- Track Slack message_ts on success — closes the "Slack got it but we
-- lost the response" failure mode. We don't read this for retry-skip
-- logic (notification_log dedup handles that), but it's invaluable for
-- audit and future cleanup.
ALTER TABLE slack_send_queue
  ADD COLUMN IF NOT EXISTS slack_message_ts text;

-- Helper RPC to mark a job complete + record the Slack ts in one
-- round-trip. Service-role only.
CREATE OR REPLACE FUNCTION public.complete_slack_send_job_with_ts(
  p_id uuid,
  p_slack_message_ts text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE slack_send_queue
     SET completed_at = now(),
         slack_message_ts = p_slack_message_ts,
         locked_at = NULL,
         last_error = NULL
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.complete_slack_send_job_with_ts FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_slack_send_job_with_ts TO service_role;
