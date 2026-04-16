-- Phase 4: batch calibration grade updates.
-- Before: each row-save is a separate UPDATE from the client. Calibrating 50
-- people requires 50 sequential round-trips and partial state if the browser
-- is closed mid-session. Matches Lattice bulk-calibrate pattern.

CREATE OR REPLACE FUNCTION public.update_calibration_grades(
  p_changes jsonb    -- [{assignment_id, grade: text|null}, …]
)
RETURNS jsonb        -- {updated: int, skipped: int}
LANGUAGE plpgsql
SECURITY INVOKER     -- RLS on review_assignments still applies
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid := auth_workspace_id();
  v_caller_user_id uuid := auth_user_id();
  v_updated int := 0;
  v_skipped int := 0;
  v_change jsonb;
  v_assignment_id uuid;
  v_grade text;
  v_cycle_workspace uuid;
BEGIN
  IF v_workspace_id IS NULL OR v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = v_caller_user_id
      AND u.workspace_id = v_workspace_id
      AND u.role IN ('admin', 'hr', 'manager')
  ) THEN
    RAISE EXCEPTION 'Not authorised to calibrate' USING ERRCODE = '42501';
  END IF;

  FOR v_change IN SELECT * FROM jsonb_array_elements(p_changes)
  LOOP
    v_assignment_id := (v_change->>'assignment_id')::uuid;
    v_grade := NULLIF(v_change->>'grade', '');

    -- Verify the assignment lives in the caller's workspace via its cycle.
    SELECT pc.workspace_id INTO v_cycle_workspace
    FROM review_assignments ra
    JOIN performance_cycles pc ON pc.id = ra.cycle_id
    WHERE ra.id = v_assignment_id;

    IF v_cycle_workspace IS DISTINCT FROM v_workspace_id THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    UPDATE review_assignments
    SET final_grade = v_grade,
        calibrated_by = v_caller_user_id,
        calibrated_at = now(),
        updated_at = now()
    WHERE id = v_assignment_id;

    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.update_calibration_grades(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.update_calibration_grades(jsonb) TO authenticated;
