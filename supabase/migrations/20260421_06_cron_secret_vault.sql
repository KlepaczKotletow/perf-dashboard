-- =========================================================================
-- Phase 3 / Task 10: Authenticate the slack send-queue drainer.
--
-- Until now nami-bot's drain_send_queue action was on a no-auth carve-out,
-- because the cron passes Bearer <anon_key> and our JWT path (auth.getUser)
-- doesn't accept service/anon keys. The anon key is public (it's also the
-- NEXT_PUBLIC_SUPABASE_ANON_KEY shipped in the browser bundle), so the
-- carve-out effectively let any internet caller invoke the drainer.
--
-- Fix: store a random `cron_secret` in the Vault, switch the drainer cron
-- to send Bearer <cron_secret>, and have nami-bot's hasCronAuth check
-- against this vault secret (in addition to the existing CRON_SECRET env
-- var path).
--
-- Idempotent: the secret is only created if it doesn't already exist.
-- =========================================================================

DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cron_secret',
      'Bearer token used by pg_cron jobs to authenticate against Edge Functions'
    );
  END IF;
END $$;

-- Reader RPC for nami-bot to fetch the cron secret on cold start.
-- SECURITY DEFINER + locked search_path so a service-role caller can read
-- it via PostgREST without us exposing all of vault.decrypted_secrets.
CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_cron_secret() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role;

-- Re-schedule the drain cron to send the vault's cron_secret via a custom
-- x-cron-secret header (NOT the Authorization header, which the Supabase
-- API gateway requires to be a valid JWT). The Authorization + apikey
-- headers still hold the anon_key so we get past the gateway; nami-bot
-- ignores them for cron auth and looks at x-cron-secret.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'nami_drain_send_queue';

SELECT cron.schedule(
  'nami_drain_send_queue',
  '* * * * *',
  $cmd$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/nami-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body := '{"action":"drain_send_queue"}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cmd$
);
