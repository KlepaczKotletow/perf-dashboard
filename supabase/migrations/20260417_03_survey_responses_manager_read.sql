-- Managers need to see survey results for their team — this was blocked
-- by an admin/hr-only SELECT policy on survey_responses.
--
-- The fix: preserve admin/hr blanket access, but additionally allow
-- managers to read:
--
--   a) 360-review responses where the subject is one of their direct
--      reports. subject_user_id is the person being reviewed; a manager
--      seeing aggregated feedback about Jane (their report) is the core
--      use case for "managers see those so they can measure their team".
--
--   b) Pulse / eNPS responses (subject_user_id IS NULL) in the
--      workspace. These are inherently anonymous — survey_responses
--      doesn't carry reviewer identity for anon surveys, so there's no
--      PII leak. Managers get to see team sentiment numbers.
--
-- Non-managers (role=user with no direct reports) remain unable to read
-- responses. HR/admin unaffected.

DROP POLICY IF EXISTS "read_survey_responses" ON public.survey_responses;

CREATE POLICY "read_survey_responses" ON public.survey_responses
  FOR SELECT TO authenticated
  USING (
    -- Must belong to the caller's workspace.
    survey_id IN (
      SELECT s.id FROM public.surveys s
      WHERE s.workspace_id = auth_workspace_id()
    )
    AND (
      -- HR / admin see everything (unchanged).
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
      -- Managers see 360 reviews of their direct reports.
      OR subject_user_id IN (
        SELECT u.id FROM public.users u
        WHERE u.manager_id = auth_user_id()
          AND u.workspace_id = auth_workspace_id()
      )
      -- Managers (role=manager OR anyone with >=1 direct report) also see
      -- pulse / eNPS responses (no subject; anonymous by design).
      OR (
        subject_user_id IS NULL
        AND (
          auth_user_role() = 'manager'::text
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.manager_id = auth_user_id()
              AND u.workspace_id = auth_workspace_id()
          )
        )
      )
    )
  );
