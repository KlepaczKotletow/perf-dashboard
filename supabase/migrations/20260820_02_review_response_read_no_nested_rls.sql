-- Harden the review_responses SELECT policy against a nested-RLS trap.
--
-- 20260820_01 expressed the policy as an EXISTS over `review_assignments`.
-- That subquery is itself subject to the review_assignments SELECT policy, so
-- a response author who is NOT reachable through that policy — not the
-- assignment's reviewer_id, not its manager_id, not the subject, and not above
-- the subject in the reporting tree — would fail the EXISTS and lose read
-- access to a row they wrote themselves.
--
-- No such row exists today (measured: 0 of 37), because peer review has never
-- generated an assignment: `assignment_type` is only ever 'standard' or
-- 'upward' across the whole instance. It becomes reachable the moment peer
-- review ships, and it would present as a reviewer's own draft vanishing on
-- reload — the exact class of silent failure this codebase has been bitten by
-- before.
--
-- Fix: move the lookup into a SECURITY DEFINER helper. The function is owned
-- by `postgres` and none of these tables sets FORCE ROW LEVEL SECURITY, so the
-- inner lookup bypasses RLS and cannot recurse into the calling policy.
-- Authorisation is unchanged — the same disjunction, evaluated without the
-- subquery being filtered out from under it.

create or replace function public.auth_can_read_response(
  a_id uuid,
  response_reviewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.review_assignments ra
    join public.performance_cycles pc on pc.id = ra.cycle_id
    where ra.id = a_id
      and pc.workspace_id = public.auth_workspace_id()
      and (
        public.auth_user_role() in ('admin', 'hr')
        -- The author, always — including peer and upward reviewers who sit
        -- outside the subject's reporting line.
        or response_reviewer_id = public.auth_user_id()
        or ra.reviewer_id = public.auth_user_id()
        or ra.manager_id = public.auth_user_id()
        or ra.employee_id in (select public.auth_visible_employee_ids())
      )
  );
$$;

comment on function public.auth_can_read_response(uuid, uuid) is
  'May the current user read a review_response on this assignment? SECURITY DEFINER so the assignment lookup is not filtered by review_assignments RLS.';

revoke all on function public.auth_can_read_response(uuid, uuid) from public;
grant execute on function public.auth_can_read_response(uuid, uuid) to authenticated;

drop policy if exists "review_responses_select_scoped" on public.review_responses;

create policy "review_responses_select_scoped"
  on public.review_responses
  for select
  to authenticated
  using (
    public.auth_can_read_response(
      review_responses.assignment_id,
      review_responses.reviewer_id
    )
  );
