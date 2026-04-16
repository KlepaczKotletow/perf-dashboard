-- Phase 2: ensure review responses can only be submitted while the matching
-- review phase is active. Mirrors the Lattice / Leapsome behaviour where
-- submissions are hard-blocked once a phase closes.
--
-- Role -> required active phase mapping:
--   self    -> self_assessment
--   peer    -> peer_review
--   manager -> manager_review
--   upward  -> manager_review (upward feedback travels during manager phase)
--
-- Replaces the Phase-1 policy reviewer_role_matches_relationship. The existing
-- relationship checks are preserved; the new EXISTS (cycle_phases) clause adds
-- the phase-active requirement. Client shows a specific error before attempting
-- the insert; RLS is the backstop for stale tabs.

DROP POLICY IF EXISTS "reviewer_role_matches_relationship" ON public.review_responses;

CREATE POLICY "reviewer_role_matches_relationship_and_phase_active"
  ON public.review_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM review_assignments a
      JOIN performance_cycles pc ON pc.id = a.cycle_id
      JOIN cycle_phases cp ON cp.cycle_id = a.cycle_id
       AND cp.status = 'active'
       AND cp.phase_type = CASE review_responses.reviewer_role
         WHEN 'self'    THEN 'self_assessment'
         WHEN 'peer'    THEN 'peer_review'
         WHEN 'manager' THEN 'manager_review'
         WHEN 'upward'  THEN 'manager_review'
       END
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
