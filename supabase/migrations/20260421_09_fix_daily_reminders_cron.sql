-- ============================================================================
-- Fix `nami-daily-reminders` cron — has been failing every day since at least
-- 2026-04-17 with:
--   ERROR: unrecognized configuration parameter "app.settings.supabase_url"
--
-- The command referenced two Postgres GUCs (`app.settings.supabase_url` and
-- `app.settings.cron_secret`) that were never set at the database level.
-- Impact: no deadline-reminder DMs have gone out — cycles silently sit
-- without follow-up nudges.
--
-- Fix: port to the same vault-secret + custom-header pattern Phase 3
-- adopted for `nami_drain_send_queue`. Read `project_url` + `cron_secret`
-- from vault.decrypted_secrets; pass the secret in `x-cron-secret` so the
-- Supabase API gateway's Authorization-as-JWT check still succeeds.
-- ============================================================================

SELECT cron.unschedule('nami-daily-reminders');

SELECT cron.schedule(
  'nami-daily-reminders',
  '0 9 * * *',  -- 09:00 UTC daily, unchanged
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/nami-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body := '{"action":"run_reminders"}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
