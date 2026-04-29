-- ============================================================================
-- Lock down anon/authenticated EXECUTE on SECURITY DEFINER RPCs.
--
-- BACKGROUND
-- Supabase exposes every public-schema function via PostgREST as
-- /rest/v1/rpc/<function_name>. PostgreSQL's default schema privileges grant
-- EXECUTE on new functions to PUBLIC, which Supabase configures to include
-- both `anon` and `authenticated`. Combined with SECURITY DEFINER, this means
-- any unauthenticated internet caller can invoke functions that elevate to
-- the function-owner role (postgres) and bypass our RLS layer entirely.
--
-- The earlier `REVOKE ALL ON FUNCTION ... FROM public` pattern in
-- 20260416_26 / 20260417_05 does NOT close this hole: PUBLIC and the explicit
-- `anon` / `authenticated` role grants are independent in PostgreSQL, so
-- revoking from PUBLIC leaves the explicit grants in place.
--
-- CONFIRMED EXPLOITABLE BEFORE THIS MIGRATION
--   has_function_privilege('anon', 'public.mint_dashboard_link_token(uuid,text,integer)', 'EXECUTE') = true
--   has_function_privilege('authenticated', 'public.mint_dashboard_link_token(uuid,text,integer)', 'EXECUTE') = true
--
-- mint_dashboard_link_token(p_user_id uuid, ...) accepts an arbitrary user
-- UUID and mints a single-use auth token bound to it. /api/auth/slack-link
-- redeems any valid token by issuing a magic-link session for the bound
-- user. Combined: any anon caller can mint+redeem a token for any user UUID
-- and obtain a session as that user. Unconditional account takeover.
--
-- WHAT THIS MIGRATION DOES
--   1. Service-role-only RPCs: revoke EXECUTE from anon AND authenticated.
--      Verified via grep that every runtime caller uses the
--      service-role-keyed admin client.
--   2. Trigger-only functions: revoke EXECUTE from anon AND authenticated AND
--      PUBLIC. Triggers fire as the table owner regardless of grants, so this
--      is purely about closing the /rest/v1/rpc surface.
--   3. Authenticated admin RPCs (called from app pages with a session cookie):
--      revoke from anon ONLY. They have internal admin/hr role checks
--      (verified by reading each function body) and authenticated EXECUTE is
--      required because the calling client is the authenticated PostgREST role.
--   4. RLS helpers (auth_user_id, auth_user_role, auth_workspace_id): revoke
--      from anon ONLY. Authenticated EXECUTE is REQUIRED because PostgreSQL
--      evaluates functions inside RLS policy expressions with the privileges
--      of the querying user; revoking from authenticated would break every
--      authenticated query against any RLS-protected table.
--
-- VERIFIED ZERO-IMPACT CALLERS
--   mint_dashboard_link_token       → supabase/functions/_shared/slack-api.ts (service_role)
--   redeem_dashboard_link_token     → src/app/api/auth/slack-link/route.ts (service_role)
--   claim_slack_send_jobs           → supabase/functions/nami-bot/index.ts (service_role)
--   complete_slack_send_job         → supabase/functions/nami-bot/index.ts (service_role)
--   enqueue_home_tab_refresh        → no TS callers; only invoked from SQL/triggers
--   notify_seat_sync, validate_*, log_*, enqueue_*_refresh, enqueue_*_dm,
--   check_assignment_completion     → trigger-only, no direct callers
--   launch_cycle                    → src/app/dashboard/cycles/[id]/cycle-actions.tsx (authenticated)
--                                     src/app/dashboard/cycles/new/page.tsx (authenticated)
--   link_user_managers              → src/app/dashboard/team/import/page.tsx (authenticated)
--   publish_rating_scale            → src/app/dashboard/settings/settings-client.tsx (authenticated)
--   progress_cycle_phases           → src/app/dashboard/cycles/[id]/page.tsx (authenticated)
-- ============================================================================

-- 1. Service-role-only RPCs.
REVOKE EXECUTE ON FUNCTION public.mint_dashboard_link_token(uuid, text, integer)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_dashboard_link_token(text)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_slack_send_jobs(integer)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_slack_send_job(uuid, boolean, text)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_home_tab_refresh(uuid, uuid)
  FROM anon, authenticated;

-- 2. Trigger-only functions. Triggers fire as table owner irrespective of
--    EXECUTE grants, so revoking is safe and closes the /rest/v1/rpc surface.
--    notify_seat_sync also has an explicit PUBLIC grant from 20260428 — strip it.
REVOKE EXECUTE ON FUNCTION public.notify_seat_sync()
  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_assignment_completion()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_assignment_home_refresh()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_feedback_dm()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_goal_home_refresh()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_new_reviewer_dm()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_calibration_change()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_cycle_status_change()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_goal_progress_change()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_user_role_change()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_participant_tenant()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_review_assignment_tenant()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_review_response_tenant()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_same_workspace()
  FROM anon, authenticated;

-- 3. Authenticated admin RPCs. Each has internal `role IN ('admin','hr')`
--    enforcement; we only need to slam the door on anon.
REVOKE EXECUTE ON FUNCTION public.launch_cycle(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_user_managers(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.publish_rating_scale(integer, integer, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.progress_cycle_phases(uuid) FROM anon;

-- 4. RLS helpers. Keep authenticated EXECUTE (required for RLS evaluation
--    against every protected table); revoke anon for hygiene — anon has no
--    auth.uid() so the helpers return NULL and gates close anyway.
REVOKE EXECUTE ON FUNCTION public.auth_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_workspace_id() FROM anon;
