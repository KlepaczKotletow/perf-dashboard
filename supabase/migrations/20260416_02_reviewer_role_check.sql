-- Phase 1, audit fix 1.5: enforce that the declared reviewer_role matches
-- the caller's actual relationship to the review_assignment row.
--
-- Before: the INSERT policy "Users create review responses" only required that
-- the target assignment belonged to the caller's workspace. A peer reviewer
-- could patch their client-side role string and submit reviewer_role='manager',
-- which fed a peer rating into manager-weighted aggregations.
--
-- After: the policy walks review_assignments to confirm the declared role
-- corresponds to an actual relationship (employee/manager/reviewer on the row).

DROP POLICY IF EXISTS "Users create review responses" ON public.review_responses;

CREATE POLICY "reviewer_role_matches_relationship"
  ON public.review_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM review_assignments a
      JOIN performance_cycles pc ON pc.id = a.cycle_id
      WHERE a.id = review_responses.assignment_id
        AND pc.workspace_id = auth_workspace_id()
        AND review_responses.reviewer_id = auth_user_id()
        AND (
          (review_responses.reviewer_role = 'self'
            AND a.employee_id = auth_user_id())
          OR (review_responses.reviewer_role = 'manager'
            AND a.manager_id = auth_user_id())
          OR (review_responses.reviewer_role = 'upward'
            AND a.reviewer_id = auth_user_id()
            AND a.assignment_type = 'upward')
          OR (review_responses.reviewer_role = 'peer'
            AND a.reviewer_id = auth_user_id()
            AND a.assignment_type = 'standard'
            AND a.employee_id <> auth_user_id()
            AND COALESCE(a.manager_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth_user_id())
        )
    )
  );
