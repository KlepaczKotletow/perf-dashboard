-- Phase 5.6: refresh the Slack home tab when data the user sees there
-- changes. Uses the same slack_send_queue as P5.3/P5.4 so retries / backoff
-- / bounded concurrency are already handled.
--
-- Dedup: the enqueue helper skips if a pending refresh for the same user
-- already exists, so bulk imports / calibration runs don't hammer Slack's
-- views.publish endpoint.

CREATE OR REPLACE FUNCTION public.enqueue_home_tab_refresh(
  p_workspace_id uuid, p_app_user_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_app_user_id IS NULL OR p_workspace_id IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.slack_send_queue
    WHERE workspace_id = p_workspace_id
      AND action = 'refresh_home_tab'
      AND completed_at IS NULL
      AND (payload->>'app_user_id')::uuid = p_app_user_id
  ) THEN RETURN;
  END IF;
  INSERT INTO public.slack_send_queue (workspace_id, action, payload)
  VALUES (p_workspace_id, 'refresh_home_tab', jsonb_build_object('app_user_id', p_app_user_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_goal_home_refresh()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.progress IS NOT DISTINCT FROM OLD.progress
     AND NEW.tracking_status IS NOT DISTINCT FROM OLD.tracking_status THEN
    RETURN NEW;
  END IF;
  PERFORM public.enqueue_home_tab_refresh(NEW.workspace_id, NEW.employee_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enqueue_goal_home_refresh_trigger ON public.goals;
CREATE TRIGGER enqueue_goal_home_refresh_trigger
  AFTER INSERT OR UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_goal_home_refresh();

CREATE OR REPLACE FUNCTION public.enqueue_assignment_home_refresh()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT workspace_id INTO v_workspace_id FROM performance_cycles WHERE id = NEW.cycle_id;
  IF v_workspace_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.enqueue_home_tab_refresh(v_workspace_id, NEW.employee_id);
  IF NEW.reviewer_id IS NOT NULL THEN
    PERFORM public.enqueue_home_tab_refresh(v_workspace_id, NEW.reviewer_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enqueue_assignment_home_refresh_trigger ON public.review_assignments;
CREATE TRIGGER enqueue_assignment_home_refresh_trigger
  AFTER INSERT OR UPDATE ON public.review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_assignment_home_refresh();
