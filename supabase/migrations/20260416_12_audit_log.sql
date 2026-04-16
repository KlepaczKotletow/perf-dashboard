-- Phase 3: audit log for high-stakes actions.
-- Scope (MVP): grade release, calibration grade changes, user role changes,
-- cycle status transitions. Deliberately narrow — best-in-class tools
-- (Lattice, Workday) log sensitive state changes, not every read or noisy edit.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action         text NOT NULL,        -- e.g. 'cycle.status_change', 'cycle.release_grades', 'assignment.calibrate', 'user.role_change'
  entity_type    text NOT NULL,        -- 'performance_cycle' | 'review_assignment' | 'user'
  entity_id      uuid,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_recent
  ON public.audit_log (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON public.audit_log (entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin / HR can read the audit log.
CREATE POLICY "audit_log_select_admin"
  ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );

-- Rows are written exclusively by triggers (SECURITY DEFINER). No direct
-- INSERT/UPDATE/DELETE policy means PostgREST blocks anon/authenticated writes.

-- ─── Trigger: cycle status transitions + grade release ──────────────────────
CREATE OR REPLACE FUNCTION public.log_cycle_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_log (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
    VALUES (
      NEW.workspace_id, auth_user_id(), 'cycle.status_change', 'performance_cycle', NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'cycle_name', NEW.name)
    );
  END IF;
  IF NEW.grades_released IS DISTINCT FROM OLD.grades_released AND NEW.grades_released THEN
    INSERT INTO public.audit_log (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
    VALUES (
      NEW.workspace_id, auth_user_id(), 'cycle.release_grades', 'performance_cycle', NEW.id,
      jsonb_build_object('cycle_name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_cycle_status_trigger ON public.performance_cycles;
CREATE TRIGGER audit_cycle_status_trigger
  AFTER UPDATE ON public.performance_cycles
  FOR EACH ROW EXECUTE FUNCTION public.log_cycle_status_change();

-- ─── Trigger: calibration grade changes ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_calibration_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace_id uuid;
BEGIN
  IF NEW.final_grade IS DISTINCT FROM OLD.final_grade THEN
    SELECT pc.workspace_id INTO v_workspace_id
    FROM performance_cycles pc WHERE pc.id = NEW.cycle_id;
    INSERT INTO public.audit_log (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_workspace_id, auth_user_id(), 'assignment.calibrate', 'review_assignment', NEW.id,
      jsonb_build_object(
        'from', OLD.final_grade, 'to', NEW.final_grade,
        'employee_id', NEW.employee_id, 'cycle_id', NEW.cycle_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_calibration_trigger ON public.review_assignments;
CREATE TRIGGER audit_calibration_trigger
  AFTER UPDATE ON public.review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_calibration_change();

-- ─── Trigger: user role changes ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.audit_log (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
    VALUES (
      NEW.workspace_id, auth_user_id(), 'user.role_change', 'user', NEW.id,
      jsonb_build_object(
        'from', OLD.role, 'to', NEW.role,
        'target_slack_name', NEW.slack_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_user_role_trigger ON public.users;
CREATE TRIGGER audit_user_role_trigger
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.log_user_role_change();
