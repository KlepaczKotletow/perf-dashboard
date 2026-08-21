-- Lock down public.slack_interactivity_debug (verification 2026-06-09).
--
-- This diagnostic table is written ONLY by the slack-interactivity edge
-- function using the service-role key (see supabase/functions/slack-interactivity/
-- index.ts lines ~99 and ~1718). It was created out-of-band and never received
-- the deny-all lockdown its siblings (slack_send_queue, slack_processed_events,
-- dashboard_link_tokens) have. It shipped with RLS DISABLED and full
-- INSERT/SELECT/UPDATE/DELETE/TRUNCATE granted to the anon + authenticated
-- PostgREST roles — meaning anyone holding the public anon key could read every
-- workspace's Slack interaction metadata (a cross-tenant leak) or wipe/forge rows.
--
-- Service-role writes BYPASS RLS, so enabling RLS with no policy is a zero-impact
-- lockdown for the edge function. We also REVOKE the broad table grants from
-- anon/authenticated because TRUNCATE is governed by the grant, not by RLS.
-- This brings the table to the same deny-all posture as its siblings.

alter table public.slack_interactivity_debug enable row level security;

revoke all on table public.slack_interactivity_debug from anon, authenticated;

-- No policies are created on purpose: RLS-enabled + zero-policies = deny-all to
-- every non-service role, identical to slack_send_queue / slack_processed_events.
