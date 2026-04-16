-- Phase 2: private feedback must not leak via direct API calls.
-- Tightens the SELECT policy on continuous_feedback to match Lattice / Leapsome
-- semantics: managers cannot see peer-to-peer private drafts about their reports.
--
-- Before: "workspace_id = auth_workspace_id()" — anyone in the workspace could
-- SELECT any row, including unshared drafts. The application code attempted to
-- filter in JS but got the manager case wrong (it showed all rows to managers
-- regardless of shared_with_employee), and direct REST API calls bypassed it.
--
-- After: HR/admin see everything in their workspace; the author sees their own
-- drafts; the recipient sees shared feedback; the recipient's direct manager
-- sees shared feedback. Nobody else sees private feedback they weren't party to.

DROP POLICY IF EXISTS "Users see workspace continuous feedback" ON public.continuous_feedback;
DROP POLICY IF EXISTS "workspace_feedback_respects_privacy" ON public.continuous_feedback;

CREATE POLICY "workspace_feedback_respects_privacy"
  ON public.continuous_feedback
  FOR SELECT TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND (
      -- HR / admin see everything in their workspace.
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      -- The author always sees their own feedback.
      OR from_user_id = auth_user_id()
      -- The recipient sees it if it was shared with them.
      OR (to_user_id = auth_user_id() AND shared_with_employee = TRUE)
      -- The recipient's direct manager sees it if it was shared with the recipient.
      OR (
        shared_with_employee = TRUE
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = continuous_feedback.to_user_id
            AND u.manager_id = auth_user_id()
        )
      )
    )
  );
