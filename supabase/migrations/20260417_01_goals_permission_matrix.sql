-- Phase 7 Role-Clarity: enforce the goals permission matrix at the RLS layer.
-- Design: docs/plans/2026-04-17-role-clarity-redesign-design.md §4
--
-- Before: goals had 4 permissive policies that mostly boiled down to
-- "any workspace member can read + write any goal in their workspace".
-- After: scope-aware matrix.
--
--   INDIVIDUAL  create/edit by: owner, owner's manager, HR/admin
--               read by:        owner, owner's manager, HR/admin
--   TEAM        create/edit by: any manager (has >=1 direct report), HR/admin
--               read by:        any workspace member
--   COMPANY     create/edit by: HR/admin only
--               read by:        any workspace member (public by design)

-- 1. Schema change: track who suggested a goal for whom.
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS suggested_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Clean any NULL scope rows (none expected; belt-and-braces).
UPDATE public.goals SET scope = 'individual' WHERE scope IS NULL;

-- 3. Drop the existing permissive policies by their real names.
DROP POLICY IF EXISTS "Users view workspace goals" ON public.goals;
DROP POLICY IF EXISTS "Users insert own goals"    ON public.goals;
DROP POLICY IF EXISTS "Users update own goals"    ON public.goals;
DROP POLICY IF EXISTS "Users delete own goals"    ON public.goals;

-- 4. SELECT — visibility matrix
CREATE POLICY "goals_select_matrix"
  ON public.goals FOR SELECT TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND (
      scope = 'company'
      OR auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      OR employee_id = auth_user_id()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = goals.employee_id AND u.manager_id = auth_user_id()
      )
    )
  );

-- 5. INSERT — who can create what scope
CREATE POLICY "goals_insert_matrix"
  ON public.goals FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND (
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      OR (
        scope = 'individual'
        AND (
          employee_id = auth_user_id()
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = goals.employee_id AND u.manager_id = auth_user_id()
          )
        )
      )
      OR (
        scope = 'team'
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.manager_id = auth_user_id()
            AND u.workspace_id = auth_workspace_id()
        )
      )
    )
  );

-- 6. UPDATE — same actors. Scope is immutable (deliberately omitted from
--    WITH CHECK scope transitions so nobody can promote individual→company
--    to gain visibility).
CREATE POLICY "goals_update_matrix"
  ON public.goals FOR UPDATE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      OR (
        scope = 'individual'
        AND (
          employee_id = auth_user_id()
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = goals.employee_id AND u.manager_id = auth_user_id()
          )
        )
      )
      OR (
        scope = 'team'
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.manager_id = auth_user_id()
            AND u.workspace_id = auth_workspace_id()
        )
      )
    )
  )
  WITH CHECK (
    workspace_id = auth_workspace_id()
  );

-- 7. DELETE — owner, owner's manager, HR/admin
CREATE POLICY "goals_delete_matrix"
  ON public.goals FOR DELETE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      OR employee_id = auth_user_id()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = goals.employee_id AND u.manager_id = auth_user_id()
      )
    )
  );
