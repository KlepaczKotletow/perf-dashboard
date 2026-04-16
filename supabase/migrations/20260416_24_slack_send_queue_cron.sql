-- Phase 5: drain the slack_send_queue every minute.
--
-- Passes both apikey + Authorization headers with the vault's anon_key to
-- get past the Supabase API Gateway. Nami-bot itself does not require auth
-- for the drain_send_queue action because queue rows were already
-- authorized when the SECURITY DEFINER triggers inserted them, and the
-- work is strictly bounded (25 jobs per call, attempts cap per job).

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'nami_drain_send_queue';

SELECT cron.schedule(
  'nami_drain_send_queue',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/nami-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
      ),
      body := '{"action":"drain_send_queue"}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
