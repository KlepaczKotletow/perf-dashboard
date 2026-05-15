-- Reverse 20260417_10_launch_cycle_manager_check.sql.
--
-- The previous migration blocked cycle launches whenever any 'standard'
-- assignment had a NULL manager_id, with the reasoning that the
-- manager_review phase would otherwise have no reviewer and the cycle
-- would stall on auto-completion.
--
-- That reasoning excluded people without a manager (e.g. founders, CEOs,
-- new hires whose reporting line isn't set up yet) from the cycle entirely
-- — they couldn't do self-review or peer-review or receive peer/upward
-- feedback. That's the wrong trade-off: the right behaviour is to let them
-- participate in the cycle and simply skip the manager-review portion of
-- their standard assignment.
--
-- Downstream impact:
--   * Standard assignments may now have NULL manager_id.
--   * `checkAndNotifyCompletion` in supabase/functions/slack-interactivity
--     uses `status != completed` as the cycle-wide completion signal.
--     Manager-less standard assignments will stay 'pending' since no
--     manager submits, so the automatic "all reviews done" Slack message
--     may never fire for cycles containing them. Admins can still close
--     the cycle manually via the "Mark Completed" action — the cycle still
--     functions end-to-end.

CREATE OR REPLACE FUNCTION public.launch_cycle(
  p_cycle_id uuid,
  p_assignments jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_caller_user_id uuid;
BEGIN
  -- Resolve the cycle's workspace.
  SELECT c.workspace_id INTO v_workspace_id
  FROM performance_cycles c
  WHERE c.id = p_cycle_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = '22023';
  END IF;

  -- Resolve the caller's app user id and verify admin/HR role in this workspace.
  v_caller_user_id := auth_user_id();
  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = v_caller_user_id
      AND u.workspace_id = v_workspace_id
      AND u.role IN ('admin', 'hr')
  ) THEN
    RAISE EXCEPTION 'Not authorised to launch cycle' USING ERRCODE = '42501';
  END IF;

  -- Serialise concurrent launches of the same cycle.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_cycle_id::text, 0));

  -- Replace the assignment set. ON CONFLICT guards against duplicates even if
  -- a concurrent launch slipped through before the advisory lock was acquired.
  DELETE FROM review_assignments WHERE cycle_id = p_cycle_id;

  INSERT INTO review_assignments (
    cycle_id, employee_id, reviewer_id, manager_id, assignment_type, status
  )
  SELECT
    p_cycle_id,
    (x->>'employee_id')::uuid,
    (x->>'reviewer_id')::uuid,
    NULLIF(x->>'manager_id','')::uuid,
    COALESCE(x->>'assignment_type', 'standard'),
    COALESCE(x->>'status', 'pending')
  FROM jsonb_array_elements(p_assignments) x
  ON CONFLICT ON CONSTRAINT uniq_review_assignment DO NOTHING;

  -- Activate the first phase if any exist.
  UPDATE cycle_phases SET status = 'active'
  WHERE id = (
    SELECT id FROM cycle_phases
    WHERE cycle_id = p_cycle_id
    ORDER BY sort_order
    LIMIT 1
  );

  UPDATE performance_cycles
  SET status = 'active', updated_at = now()
  WHERE id = p_cycle_id;

  UPDATE performance_cycle_employees
  SET status = 'in_progress'
  WHERE performance_cycle_id = p_cycle_id;
END;
$$;
