-- Managers need to see participant rows for surveys they're responsible
-- for, otherwise the "X of Y responded" progress bar shows 1/1 (just
-- themselves) instead of real team numbers.
--
-- Scope:
--   - admin / hr: see all (unchanged)
--   - managers: see their own row + rows where user IS a direct report +
--     rows where subject IS a direct report (360) + pulse/eNPS
--     anonymous surveys across the workspace

DROP POLICY IF EXISTS "read_own_participations" ON public.survey_participants;

CREATE POLICY "read_own_participations" ON public.survey_participants
  FOR SELECT TO authenticated
  USING (
    -- self (unchanged)
    user_id = auth_user_id()
    -- admin / hr within the workspace
    OR (
      survey_id IN (
        SELECT s.id FROM public.surveys s
        WHERE s.workspace_id = auth_workspace_id()
      )
      AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
    )
    -- manager: direct-report participant (they filled out a survey)
    OR user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.manager_id = auth_user_id()
        AND u.workspace_id = auth_workspace_id()
    )
    -- manager: direct-report subject (someone is being reviewed about)
    OR subject_user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.manager_id = auth_user_id()
        AND u.workspace_id = auth_workspace_id()
    )
    -- manager: anonymous pulse/eNPS — see all participants in workspace
    OR (
      subject_user_id IS NULL
      AND survey_id IN (
        SELECT s.id FROM public.surveys s
        WHERE s.workspace_id = auth_workspace_id()
      )
      AND (
        auth_user_role() = 'manager'::text
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.manager_id = auth_user_id()
            AND u.workspace_id = auth_workspace_id()
        )
      )
    )
  );
