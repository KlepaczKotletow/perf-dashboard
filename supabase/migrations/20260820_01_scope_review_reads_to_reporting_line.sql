-- Scope review reads to the reporting line.
--
-- BEFORE: `review_assignments` and `review_responses` each had exactly one
-- SELECT policy, and its only condition was
-- `pc.workspace_id = auth_workspace_id()`, granted to `authenticated`. Because
-- the web app talks to Postgres with the ANON key plus a cookie session
-- (see src/lib/supabase-server.ts createServerSupabaseClient), that meant any
-- employee with a browser session could read every rating, every final grade
-- and every written review comment in their company — including their
-- manager's private notes on their peers.
--
-- Measured on the 45-person test workspace before this migration: all 37 plain
-- employees could read all 15 assignments; one manager (no HR role) could read
-- all 37 review_responses, of which 0 belonged to her reporting line.
--
-- This is the *intra*-tenant boundary. Cross-tenant isolation was already
-- sound and is unchanged.
--
-- The model implemented here is not new — it is the one already documented and
-- unit-tested in src/lib/reporting-tree.ts, whose header comment records that
-- RLS is workspace-wide "so the scoping has to happen in application code".
-- That application-code scoping stays; this makes the database agree with it,
-- so a direct PostgREST call can no longer bypass it.
--
-- Slack is unaffected: every edge function uses the SERVICE_ROLE key, which
-- bypasses RLS.

-- ── Helper ───────────────────────────────────────────────────────────────────
-- The employee ids the current user may see: themselves plus their full
-- recursive reporting subtree. UNION (not UNION ALL) dedupes, so a reporting
-- cycle (A→B→A, creatable via the edit form, which has no cycle guard)
-- terminates instead of looping forever — matching reportingSubtree()'s
-- explicit cycle guard.
--
-- STABLE so Postgres evaluates it once per statement rather than once per row.
create or replace function public.auth_visible_employee_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  with recursive tree as (
    select public.auth_user_id() as id
    union
    select c.id
    from public.users c
    join tree on c.manager_id = tree.id
    where c.workspace_id = public.auth_workspace_id()
  )
  select id from tree where id is not null;
$$;

comment on function public.auth_visible_employee_ids() is
  'Employee ids visible to the current user: self + full recursive reporting subtree. Backs the review_assignments / review_responses SELECT policies.';

revoke all on function public.auth_visible_employee_ids() from public;
grant execute on function public.auth_visible_employee_ids() to authenticated;

-- ── review_assignments ───────────────────────────────────────────────────────
drop policy if exists "Users view own assignments or managers view team" on public.review_assignments;

create policy "review_assignments_select_scoped"
  on public.review_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.performance_cycles pc
      where pc.id = review_assignments.cycle_id
        and pc.workspace_id = public.auth_workspace_id()
    )
    and (
      -- HR and admins keep workspace-wide read: calibration, analytics, the
      -- cycle pages and both CSV exports all depend on it.
      public.auth_user_role() in ('admin', 'hr')
      -- The person doing the review, however they were assigned.
      or review_assignments.reviewer_id = public.auth_user_id()
      -- The manager of record on the assignment.
      or review_assignments.manager_id = public.auth_user_id()
      -- The subject, and anyone below the viewer in the reporting tree.
      or review_assignments.employee_id in (select public.auth_visible_employee_ids())
    )
  );

-- ── review_responses ─────────────────────────────────────────────────────────
drop policy if exists "Users view workspace review responses" on public.review_responses;

create policy "review_responses_select_scoped"
  on public.review_responses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.review_assignments ra
      join public.performance_cycles pc on pc.id = ra.cycle_id
      where ra.id = review_responses.assignment_id
        and pc.workspace_id = public.auth_workspace_id()
        and (
          public.auth_user_role() in ('admin', 'hr')
          -- An author can always read back what they wrote, even when they are
          -- outside the subject's reporting line (peer and upward reviews).
          -- Without this the reviewer's own draft would vanish on reload.
          or review_responses.reviewer_id = public.auth_user_id()
          or ra.reviewer_id = public.auth_user_id()
          or ra.manager_id = public.auth_user_id()
          or ra.employee_id in (select public.auth_visible_employee_ids())
        )
    )
  );
