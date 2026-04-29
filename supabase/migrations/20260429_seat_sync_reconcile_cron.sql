-- Schedule hourly seat-sync reconciliation. Acts as a backstop when the
-- per-user-mutation trigger fails (pg_net is fire-and-forget — no retry)
-- or when /setup's post-link fetch fails. Loops over every billable
-- subscription and pushes the current seat count to Stripe.
--
-- Auth: bearer SEAT_SYNC_SECRET (the seat-sync-reconcile route was updated
-- in the same change to accept this secret, since the endpoint is
-- purpose-specific to seat-sync). vault.seat_sync_secret already matches
-- the Vercel SEAT_SYNC_SECRET env — the per-mutation trigger would
-- otherwise be broken.

DO $$
BEGIN
  -- Drop any prior schedule with this name so re-applying the migration is safe.
  PERFORM cron.unschedule('seat-sync-reconcile-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'seat-sync-reconcile-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'seat-sync-reconcile-hourly',
  '0 * * * *',
  $$
    SELECT net.http_get(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dashboard_url') || '/api/internal/seat-sync-reconcile',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seat_sync_secret')
      ),
      timeout_milliseconds := 60000
    );
  $$
);
