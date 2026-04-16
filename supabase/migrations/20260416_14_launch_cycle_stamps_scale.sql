-- Phase 3: extend launch_cycle to stamp the workspace's active rating scale
-- onto the cycle at launch time. Cycles created in draft keep their scale_id
-- if already set; otherwise pick up the workspace's current active scale.
-- Also adds publish_rating_scale() so settings changes version the scale
-- instead of mutating the row in place.

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
  v_active_scale_id uuid;
BEGIN
  SELECT c.workspace_id INTO v_workspace_id
  FROM performance_cycles c WHERE c.id = p_cycle_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = '22023';
  END IF;

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

  PERFORM pg_advisory_xact_lock(hashtextextended(p_cycle_id::text, 0));

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

  UPDATE cycle_phases SET status = 'active'
  WHERE id = (
    SELECT id FROM cycle_phases
    WHERE cycle_id = p_cycle_id
    ORDER BY sort_order
    LIMIT 1
  );

  -- Stamp the workspace's current active scale onto the cycle if it doesn't
  -- already have one. Existing cycles with an explicit rating_scale_id keep it.
  SELECT active_rating_scale_id INTO v_active_scale_id
  FROM workspaces WHERE id = v_workspace_id;

  UPDATE performance_cycles
  SET status = 'active',
      updated_at = now(),
      rating_scale_id = COALESCE(rating_scale_id, v_active_scale_id)
  WHERE id = p_cycle_id;

  UPDATE performance_cycle_employees
  SET status = 'in_progress'
  WHERE performance_cycle_id = p_cycle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.launch_cycle(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.launch_cycle(uuid, jsonb) TO authenticated;

-- Helper RPC so the settings page can atomically publish a new scale version
-- instead of mutating the old row in place. Called from the client when the
-- admin changes min/max/labels.
CREATE OR REPLACE FUNCTION public.publish_rating_scale(
  p_min integer,
  p_max integer,
  p_labels jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid := auth_workspace_id();
  v_caller_user_id uuid := auth_user_id();
  v_new_id uuid;
BEGIN
  IF v_workspace_id IS NULL OR v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = v_caller_user_id
      AND u.workspace_id = v_workspace_id
      AND u.role IN ('admin', 'hr')
  ) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;

  IF p_max <= p_min THEN
    RAISE EXCEPTION 'max_value must exceed min_value' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rating_scales (workspace_id, min_value, max_value, labels)
  VALUES (v_workspace_id, p_min, p_max, COALESCE(p_labels, '{}'::jsonb))
  RETURNING id INTO v_new_id;

  -- Archive old active scale (for audit) and set new one as active.
  UPDATE public.rating_scales
  SET archived_at = now()
  WHERE workspace_id = v_workspace_id
    AND id <> v_new_id
    AND archived_at IS NULL;

  UPDATE public.workspaces
  SET active_rating_scale_id = v_new_id,
      -- Keep legacy jsonb in sync so existing readers still work.
      rating_scale = jsonb_build_object('min', p_min, 'max', p_max, 'labels', COALESCE(p_labels, '{}'::jsonb))
  WHERE id = v_workspace_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_rating_scale(integer, integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.publish_rating_scale(integer, integer, jsonb) TO authenticated;
