-- Align competency_score_descriptors RLS with the sibling tables
-- (competencies, levels, job_families, level_competencies).
--
-- This app authenticates via Slack OAuth through a custom edge function,
-- not Supabase Auth. Session resolution goes through the app's helpers:
--   auth_workspace_id() — returns the current user's workspace
--   auth_user_role()    — returns the current user's role
--
-- The four policies on competency_score_descriptors were using the legacy
-- `auth.uid()`-based pattern which silently evaluates to false for our
-- session tokens. The symptom: creating a Function from a template failed
-- with "new row violates row-level security policy for table
-- 'competency_score_descriptors'" on the final INSERT of the import flow
-- (job_families, levels, competencies, level_competencies all succeeded
-- because they already use the new helpers; score_descriptors was the
-- only table stuck on the old pattern).
--
-- Policies below mirror level_competencies. admin / hr / manager can
-- write; every workspace member can read.

DROP POLICY IF EXISTS "score_descriptors_select_workspace" ON public.competency_score_descriptors;
DROP POLICY IF EXISTS "score_descriptors_insert_workspace" ON public.competency_score_descriptors;
DROP POLICY IF EXISTS "score_descriptors_update_workspace" ON public.competency_score_descriptors;
DROP POLICY IF EXISTS "score_descriptors_delete_workspace" ON public.competency_score_descriptors;

CREATE POLICY "score_descriptors_select_workspace"
  ON public.competency_score_descriptors FOR SELECT TO authenticated
  USING (workspace_id = auth_workspace_id());

CREATE POLICY "score_descriptors_insert_workspace"
  ON public.competency_score_descriptors FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text, 'manager'::text])
  );

CREATE POLICY "score_descriptors_update_workspace"
  ON public.competency_score_descriptors FOR UPDATE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text, 'manager'::text])
  )
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text, 'manager'::text])
  );

CREATE POLICY "score_descriptors_delete_workspace"
  ON public.competency_score_descriptors FOR DELETE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text, 'manager'::text])
  );
