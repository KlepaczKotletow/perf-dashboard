-- ============================================================================
-- v2 follow-up to 20260429_lockdown_security_definer_rpcs.sql.
--
-- WHY THIS EXISTS
-- The v1 migration revoked the explicit `anon` and `authenticated` grants on
-- our SECURITY DEFINER functions, but missed a more subtle source of access:
-- many of these functions had EXECUTE granted to PUBLIC via the schema-default
-- privilege. Both `anon` and `authenticated` are members of PUBLIC, so they
-- retained EXECUTE through that path even after v1 ran.
--
-- Confirmed via:
--   SELECT proacl FROM pg_proc WHERE proname = 'auth_workspace_id';
--   -> {=X/postgres, postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
-- The leading `=X/postgres` is the PUBLIC grant. After v1, anon could still
-- call auth_workspace_id() via PUBLIC inheritance.
--
-- This migration revokes EXECUTE FROM PUBLIC on every function v1 targeted.
-- Functions that legitimately need authenticated access (RLS helpers, admin
-- RPCs) already have an explicit `authenticated=X` grant from earlier
-- migrations, which survives the PUBLIC revoke. Trigger-only functions need
-- no external EXECUTE grant — they fire as the table owner during DML.
--
-- AFTER THIS MIGRATION
--   anon  -> denied for every targeted function.
--   authenticated -> denied for service-role-only and trigger-only functions;
--                    callable for admin RPCs and RLS helpers.
--   service_role -> unchanged (always callable).
-- ============================================================================

-- RLS helpers (authenticated grant survives; anon loses access).
REVOKE EXECUTE ON FUNCTION public.auth_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_workspace_id() FROM PUBLIC;

-- Trigger-only functions (no callers needed).
REVOKE EXECUTE ON FUNCTION public.check_assignment_completion() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_assignment_home_refresh() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_feedback_dm() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_goal_home_refresh() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_new_reviewer_dm() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_calibration_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_cycle_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_goal_progress_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_user_role_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_participant_tenant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_review_assignment_tenant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_review_response_tenant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_same_workspace() FROM PUBLIC;

-- Internal helper, no TS callers (only invoked from SQL/triggers).
REVOKE EXECUTE ON FUNCTION public.enqueue_home_tab_refresh(uuid, uuid) FROM PUBLIC;

-- Authenticated admin RPC: keep authenticated, drop PUBLIC (anon access leak).
REVOKE EXECUTE ON FUNCTION public.progress_cycle_phases(uuid) FROM PUBLIC;
