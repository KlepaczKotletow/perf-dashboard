-- Phase 5: unified Slack send queue.
--
-- Replaces scattered "fire-and-forget nami-bot invoke from the UI" paths
-- with a durable queue that triggers populate on INSERT. A pg_cron worker
-- then drains the queue by calling the nami-bot edge function, with
-- exponential backoff on failure. One design powers three audit fixes:
--
--   P5.3 Web-originated feedback → Slack DM
--   P5.4 Post-launch reviewer notifications (new reviewers added to
--        already-active cycles get their DM instead of silently missing it)
--   P5.7 Retry queue for bulk sends (rate-limit / transient failures
--        don't drop notifications on the floor)

CREATE TABLE IF NOT EXISTS public.slack_send_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  action          text NOT NULL,
  payload         jsonb NOT NULL,
  attempts        int NOT NULL DEFAULT 0,
  max_attempts    int NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at       timestamptz,
  completed_at    timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_send_queue_ready
  ON public.slack_send_queue (next_attempt_at)
  WHERE completed_at IS NULL;

ALTER TABLE public.slack_send_queue ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (triggers via SECURITY DEFINER + the
-- nami-bot edge function via service_role key) touches this table.

CREATE OR REPLACE FUNCTION public.claim_slack_send_jobs(p_limit int DEFAULT 25)
RETURNS SETOF public.slack_send_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM public.slack_send_queue
    WHERE completed_at IS NULL
      AND next_attempt_at <= now()
      AND (locked_at IS NULL OR locked_at < now() - interval '2 minutes')
    ORDER BY next_attempt_at LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.slack_send_queue q
  SET locked_at = now()
  FROM claimed WHERE q.id = claimed.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_slack_send_jobs(int) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_slack_send_jobs(int) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_slack_send_job(
  p_id uuid, p_success boolean, p_error text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_attempts int; v_max int; v_delay interval;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max
  FROM public.slack_send_queue WHERE id = p_id;
  IF v_attempts IS NULL THEN RETURN; END IF;

  IF p_success THEN
    UPDATE public.slack_send_queue
    SET completed_at = now(), locked_at = NULL, last_error = NULL
    WHERE id = p_id;
    RETURN;
  END IF;

  IF v_attempts + 1 >= v_max THEN
    UPDATE public.slack_send_queue
    SET attempts = v_attempts + 1, last_error = p_error,
        locked_at = NULL, completed_at = now()
    WHERE id = p_id;
  ELSE
    v_delay := make_interval(secs => LEAST(30 * POWER(2, v_attempts)::int, 900));
    UPDATE public.slack_send_queue
    SET attempts = v_attempts + 1, last_error = p_error,
        locked_at = NULL, next_attempt_at = now() + v_delay
    WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_slack_send_job(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_slack_send_job(uuid, boolean, text) TO service_role;

-- Triggers: enqueue on INSERT --------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_feedback_dm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.slack_send_queue (workspace_id, action, payload)
  VALUES (NEW.workspace_id, 'notify_feedback', jsonb_build_object('feedback_id', NEW.id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enqueue_feedback_dm_trigger ON public.continuous_feedback;
CREATE TRIGGER enqueue_feedback_dm_trigger
  AFTER INSERT ON public.continuous_feedback
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_feedback_dm();

CREATE OR REPLACE FUNCTION public.enqueue_new_reviewer_dm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cycle_status text; v_workspace_id uuid;
BEGIN
  IF NEW.reviewer_id IS NULL THEN RETURN NEW; END IF;
  SELECT status, workspace_id INTO v_cycle_status, v_workspace_id
  FROM performance_cycles WHERE id = NEW.cycle_id;
  IF v_cycle_status = 'active' THEN
    INSERT INTO public.slack_send_queue (workspace_id, action, payload)
    VALUES (v_workspace_id, 'notify_new_reviewer', jsonb_build_object('assignment_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enqueue_new_reviewer_dm_trigger ON public.review_assignments;
CREATE TRIGGER enqueue_new_reviewer_dm_trigger
  AFTER INSERT ON public.review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_new_reviewer_dm();
