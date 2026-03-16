-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Enable pg_net extension (required for HTTP calls from cron)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if it exists (idempotent)
SELECT cron.unschedule('deadline-reminders-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'deadline-reminders-daily'
);

-- Schedule daily at 09:00 UTC
SELECT cron.schedule(
  'deadline-reminders-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zhfvxfvmdlpdfgxrwtdn.supabase.co/functions/v1/send-deadline-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);
