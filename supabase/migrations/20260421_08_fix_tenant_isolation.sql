-- ============================================================================
-- CRITICAL FIX: cross-tenant data leak via user-modifiable slack_user_id.
--
-- Before this migration, auth_workspace_id() / auth_user_id() / auth_user_role()
-- read slack_user_id from auth.users.raw_user_meta_data. That column is
-- user-modifiable via supabase.auth.updateUser({ data: { ... } }) — any
-- authenticated user could overwrite their own slack_user_id, causing the
-- RLS helper to resolve to a *different* workspace's records. Confirmed
-- exploitable: a user in workspace A could read all data in workspace B
-- by overwriting slack_user_id and querying via PostgREST.
--
-- The fix moves slack_user_id to raw_app_meta_data, which is service-role-only.
-- Three steps:
--   1. Backfill: copy slack_user_id from raw_user_meta_data to raw_app_meta_data
--      for every existing auth.users row.
--   2. Replace the three RLS helpers to read from raw_app_meta_data.
--   3. Add a get_my_slack_user_id() RPC the Next.js layer can call instead of
--      trusting user.user_metadata in the JWT.
--
-- The dashboard-auth edge function and Next.js code paths are updated in the
-- accompanying TS commit; this migration only changes the database side.
-- ============================================================================

-- 1. Backfill app_metadata.slack_user_id for existing users.
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('slack_user_id', raw_user_meta_data->>'slack_user_id')
WHERE raw_user_meta_data ? 'slack_user_id';

-- 2a. auth_workspace_id reads app_metadata.
CREATE OR REPLACE FUNCTION public.auth_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.workspace_id FROM public.users u
  WHERE u.slack_user_id = (
    SELECT au.raw_app_meta_data->>'slack_user_id'
    FROM auth.users au WHERE au.id = auth.uid()
  )
  AND u.employee_status IS DISTINCT FROM 'deactivated'
  LIMIT 1;
$$;

-- 2b. auth_user_id reads app_metadata.
CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id FROM public.users u
  WHERE u.slack_user_id = (
    SELECT au.raw_app_meta_data->>'slack_user_id'
    FROM auth.users au WHERE au.id = auth.uid()
  )
  AND u.employee_status IS DISTINCT FROM 'deactivated'
  LIMIT 1;
$$;

-- 2c. auth_user_role reads app_metadata.
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT u.role FROM public.users u
     WHERE u.slack_user_id = (
       SELECT au.raw_app_meta_data->>'slack_user_id'
       FROM auth.users au WHERE au.id = auth.uid()
     )
     AND u.employee_status IS DISTINCT FROM 'deactivated'
     LIMIT 1),
    'user'
  );
$$;

-- 3. Helper RPC for the Next.js layer. Returns the current user's
--    slack_user_id from the safe (service-role-writable) source, so app code
--    can stop reading user.user_metadata.slack_user_id from the JWT.
CREATE OR REPLACE FUNCTION public.get_my_slack_user_id()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT raw_app_meta_data->>'slack_user_id'
  FROM auth.users WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_slack_user_id FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_slack_user_id TO authenticated, service_role;
