-- The original mint_dashboard_link_token used gen_random_bytes(32) without
-- qualifying the schema. pgcrypto lives in `extensions`, not `public`, so the
-- function body failed at runtime with 42883 and silently broke every call
-- site that depended on it. This patch qualifies the crypto call and widens
-- search_path to include extensions so any future calls resolve cleanly.

CREATE OR REPLACE FUNCTION public.mint_dashboard_link_token(
  p_user_id uuid,
  p_target_path text DEFAULT '/dashboard',
  p_ttl_seconds int DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_token text; v_expires timestamptz;
BEGIN
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(secs => GREATEST(p_ttl_seconds, 30));
  INSERT INTO public.dashboard_link_tokens (token, user_id, target_path, expires_at)
  VALUES (v_token, p_user_id, p_target_path, v_expires);
  RETURN jsonb_build_object('token', v_token, 'expires_at', v_expires);
END;
$$;

REVOKE ALL ON FUNCTION public.mint_dashboard_link_token(uuid, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.mint_dashboard_link_token(uuid, text, int) TO service_role;
