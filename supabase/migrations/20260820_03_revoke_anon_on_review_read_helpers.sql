-- Match the least-privilege pattern the other auth_* helpers already follow.
--
-- `revoke all ... from public` in 20260820_01/_02 did not remove `anon`:
-- Supabase's default privileges grant EXECUTE to both `anon` and
-- `authenticated` on newly created functions in `public`, and a PUBLIC revoke
-- does not touch those role-level grants. Verified via has_function_privilege:
-- the pre-existing auth_user_id() and auth_workspace_id() are executable by
-- `authenticated` only, while the two new helpers were also reachable by
-- `anon` — which is what the database linter flagged
-- (0028_anon_security_definer_function_executable).
--
-- The practical exposure was nil: without a session auth.uid() is null, so
-- auth_visible_employee_ids() returns no rows and auth_can_read_response()
-- returns false. This is consistency and least privilege, not an incident.

revoke execute on function public.auth_visible_employee_ids() from anon;
revoke execute on function public.auth_can_read_response(uuid, uuid) from anon;
