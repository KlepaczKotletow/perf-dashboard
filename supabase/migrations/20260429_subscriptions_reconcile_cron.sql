-- Daily backstop that refetches every linked Stripe subscription and
-- writes status + period_end back. Catches state drift from missed
-- webhooks (extended outage, signature key mismatch, etc.).
--
-- Runs at 02:00 UTC — off-peak, well after the hourly seat-sync reconcile.

DO $$
BEGIN
  PERFORM cron.unschedule('subscriptions-reconcile-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'subscriptions-reconcile-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'subscriptions-reconcile-daily',
  '0 2 * * *',
  $$
    SELECT net.http_get(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dashboard_url') || '/api/internal/subscriptions-reconcile',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seat_sync_secret')
      ),
      timeout_milliseconds := 60000
    );
  $$
);
