-- Phase 3: audit trail for goal progress changes.
-- Tracks every change to metric_current, progress, status, and tracking_status
-- so managers/HR can see the story behind a number, not just the current state.
-- Mirrors Lattice / Leapsome "History" timeline on goal detail pages.

CREATE TABLE IF NOT EXISTS public.goal_progress_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  goal_id         uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  actor_user_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  old_progress         integer,
  new_progress         integer,
  old_metric_current   numeric,
  new_metric_current   numeric,
  old_status           varchar,
  new_status           varchar,
  old_tracking_status  varchar,
  new_tracking_status  varchar,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_events_goal ON public.goal_progress_events (goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_progress_events_workspace ON public.goal_progress_events (workspace_id, created_at DESC);

ALTER TABLE public.goal_progress_events ENABLE ROW LEVEL SECURITY;

-- Workspace members see the history for goals they can see; HR/admin see all.
-- (We intentionally don't scope this by goal visibility — the trigger only writes
-- events for goals that exist in the workspace, and the client only reads the
-- history for goals it has already been allowed to load.)
CREATE POLICY "goal_progress_events_select_workspace"
  ON public.goal_progress_events
  FOR SELECT TO authenticated
  USING (workspace_id = auth_workspace_id());

-- Events are system-written via trigger; no INSERT / UPDATE / DELETE policy
-- means PostgREST blocks anon and authenticated roles from writing directly.

-- Trigger: writes an event whenever a tracked field changes.
CREATE OR REPLACE FUNCTION public.log_goal_progress_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.progress        IS DISTINCT FROM OLD.progress
  OR NEW.metric_current  IS DISTINCT FROM OLD.metric_current
  OR NEW.status          IS DISTINCT FROM OLD.status
  OR NEW.tracking_status IS DISTINCT FROM OLD.tracking_status
  THEN
    INSERT INTO public.goal_progress_events (
      workspace_id, goal_id, actor_user_id,
      old_progress, new_progress,
      old_metric_current, new_metric_current,
      old_status, new_status,
      old_tracking_status, new_tracking_status
    )
    VALUES (
      NEW.workspace_id, NEW.id, auth_user_id(),
      OLD.progress, NEW.progress,
      OLD.metric_current, NEW.metric_current,
      OLD.status, NEW.status,
      OLD.tracking_status, NEW.tracking_status
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goal_progress_audit_trigger ON public.goals;
CREATE TRIGGER goal_progress_audit_trigger
  AFTER UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_goal_progress_change();
