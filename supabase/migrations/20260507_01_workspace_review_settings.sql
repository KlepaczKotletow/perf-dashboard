-- Persist the four review-process toggles that the Settings page previously
-- held only in client React state with a "DB migration later" TODO —
-- toggling them did nothing. Promote them to first-class workspace columns
-- with a self-update RPC scoped to admin/hr.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS self_review_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS peer_review_anonymous boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_ratings_with_employees boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manager_sees_individual_upward boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workspaces.self_review_required IS
  'When true, employees must submit a self-review before their manager can submit theirs.';
COMMENT ON COLUMN public.workspaces.peer_review_anonymous IS
  'When true, peer-review reviewer names are hidden from the employee receiving feedback.';
COMMENT ON COLUMN public.workspaces.share_ratings_with_employees IS
  'When true, employees see their numerical ratings after review completion.';
COMMENT ON COLUMN public.workspaces.manager_sees_individual_upward IS
  'When true, managers see individual upward-review responses (not just aggregated).';

CREATE OR REPLACE FUNCTION public.update_workspace_review_settings(
  p_self_review_required boolean,
  p_peer_review_anonymous boolean,
  p_share_ratings_with_employees boolean,
  p_manager_sees_individual_upward boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid := auth_workspace_id();
  v_caller_user_id uuid := auth_user_id();
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

  UPDATE public.workspaces
  SET
    self_review_required          = p_self_review_required,
    peer_review_anonymous         = p_peer_review_anonymous,
    share_ratings_with_employees  = p_share_ratings_with_employees,
    manager_sees_individual_upward = p_manager_sees_individual_upward,
    updated_at                     = now()
  WHERE id = v_workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_workspace_review_settings(boolean, boolean, boolean, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_workspace_review_settings(boolean, boolean, boolean, boolean) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_workspace_review_settings(boolean, boolean, boolean, boolean) TO authenticated;
