-- Phase 6: short-lived tokens bound to (user, target path) so Slack-
-- embedded dashboard links land in an authenticated session instead of
-- kicking the user to /?signin=required.

CREATE TABLE IF NOT EXISTS public.dashboard_link_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text NOT NULL UNIQUE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_path  text NOT NULL DEFAULT '/dashboard',
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_link_tokens_expiry
  ON public.dashboard_link_tokens (expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.dashboard_link_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (edge fns + /api route) touches this.

CREATE OR REPLACE FUNCTION public.mint_dashboard_link_token(
  p_user_id uuid,
  p_target_path text DEFAULT '/dashboard',
  p_ttl_seconds int DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_expires timestamptz;
BEGIN
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(secs => GREATEST(p_ttl_seconds, 30));
  INSERT INTO public.dashboard_link_tokens (token, user_id, target_path, expires_at)
  VALUES (v_token, p_user_id, p_target_path, v_expires);
  RETURN jsonb_build_object('token', v_token, 'expires_at', v_expires);
END;
$$;
REVOKE ALL ON FUNCTION public.mint_dashboard_link_token(uuid, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.mint_dashboard_link_token(uuid, text, int) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_dashboard_link_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row record;
BEGIN
  UPDATE public.dashboard_link_tokens
  SET used_at = now()
  WHERE token = p_token AND used_at IS NULL AND expires_at > now()
  RETURNING user_id, target_path INTO v_row;
  IF v_row.user_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('user_id', v_row.user_id, 'target_path', v_row.target_path);
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_dashboard_link_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_dashboard_link_token(text) TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'nami_dashboard_link_tokens_cleanup';
SELECT cron.schedule(
  'nami_dashboard_link_tokens_cleanup',
  '23 4 * * *',
  $$
    DELETE FROM public.dashboard_link_tokens
    WHERE (used_at IS NOT NULL AND used_at < now() - interval '1 day')
       OR expires_at < now() - interval '1 day';
  $$
);
