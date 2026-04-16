-- Phase 4: companion RPC for the chunked CSV import. After the edge function
-- has created / updated all user rows (possibly across many chunks), the
-- client calls this RPC once with the full list of (email, manager_email)
-- pairs to resolve manager_id — including references that span chunk
-- boundaries.

CREATE OR REPLACE FUNCTION public.link_user_managers(
  p_pairs jsonb        -- [{email: string, manager_email: string}, …]
)
RETURNS jsonb          -- {linked: int, skipped: int}
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid := auth_workspace_id();
  v_caller_user_id uuid := auth_user_id();
  v_linked int := 0;
  v_skipped int := 0;
  v_pair jsonb;
  v_email text;
  v_manager_email text;
  v_user_id uuid;
  v_manager_id uuid;
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

  FOR v_pair IN SELECT * FROM jsonb_array_elements(p_pairs)
  LOOP
    v_email := LOWER(TRIM(v_pair->>'email'));
    v_manager_email := LOWER(TRIM(COALESCE(v_pair->>'manager_email', '')));

    IF v_email = '' OR v_manager_email = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_user_id
    FROM users
    WHERE workspace_id = v_workspace_id AND LOWER(slack_email) = v_email;

    SELECT id INTO v_manager_id
    FROM users
    WHERE workspace_id = v_workspace_id AND LOWER(slack_email) = v_manager_email;

    IF v_user_id IS NULL OR v_manager_id IS NULL OR v_user_id = v_manager_id THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    UPDATE users SET manager_id = v_manager_id WHERE id = v_user_id;
    v_linked := v_linked + 1;
  END LOOP;

  RETURN jsonb_build_object('linked', v_linked, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.link_user_managers(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.link_user_managers(jsonb) TO authenticated;
