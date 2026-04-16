-- Phase 5: auto-expire abandoned Slack DM conversations.
--
-- The slack-events / slack-commands edge functions already set
-- conversation_states.expires_at, but nothing was garbage-collecting rows
-- past their TTL. The table was growing unbounded with abandoned
-- review-in-Slack flows.
--
-- Cleanup policy: delete rows whose expires_at is older than 7 days (user
-- abandoned; resume would be stale). Rows expired within the 7-day window
-- are kept so a user who comes back after a lunch break can pick up.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'nami_conversation_state_cleanup';

SELECT cron.schedule(
  'nami_conversation_state_cleanup',
  '17 3 * * *',   -- daily at 03:17 UTC (off-hours)
  $$
    DELETE FROM public.conversation_states
    WHERE expires_at < now() - interval '7 days';
  $$
);
