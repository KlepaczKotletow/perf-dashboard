-- Sprint 3.5: hourly digest cron.
--
-- Fires every UTC hour and POSTs to the nami-bot edge function with action
-- 'run_digests'. The handler iterates users with mode=digest and sends the
-- daily roll-up DM to those whose local digest_hour matches the current
-- hour-in-tz. Per-user dedup via notification_log (event_type='nami_digest',
-- reference_id=YYYY-MM-DD).
--
-- Pattern matches nami-daily-reminders + nami_drain_send_queue: vault-secret
-- auth via x-cron-secret, anon-key Bearer for the API gateway's JWT check.

-- pg_cron's cron.schedule(jobname, schedule, command) upserts on jobname,
-- so this is safe to re-run (no need to unschedule first).
select cron.schedule(
  'nami_run_digests',
  '0 * * * *',  -- top of every hour, UTC
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/nami-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{"action":"run_digests"}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
