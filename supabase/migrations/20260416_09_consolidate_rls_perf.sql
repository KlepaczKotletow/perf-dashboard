-- Phase 2: consolidate overlapping permissive RLS policies flagged by the
-- Supabase advisor. Multiple permissive policies on the same (role, action)
-- force Postgres to evaluate every predicate per row.
--
-- We merge each pair into a single OR'd policy per action, preserving the
-- original semantics exactly. Also wraps auth.uid() in (SELECT auth.uid())
-- on competency_score_descriptors so the function is evaluated once per
-- query instead of once per row.
--
-- Also drops the duplicate-index warning introduced in Phase 1
-- (uniq_vote_per_fingerprint duplicates the pre-existing
-- roadmap_votes_item_id_fingerprint_key constraint) and adds missing FK
-- covering indexes.

-- ─── cycle_questions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage cycle_questions" ON public.cycle_questions;
DROP POLICY IF EXISTS "Users can view cycle_questions for their workspace" ON public.cycle_questions;

CREATE POLICY "cycle_questions_select_workspace" ON public.cycle_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM performance_cycles pc
      WHERE pc.id = cycle_questions.cycle_id
        AND pc.workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY "cycle_questions_insert_admin" ON public.cycle_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM performance_cycles pc
      WHERE pc.id = cycle_questions.cycle_id
        AND pc.workspace_id = auth_workspace_id()
    )
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );
CREATE POLICY "cycle_questions_update_admin" ON public.cycle_questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM performance_cycles pc
      WHERE pc.id = cycle_questions.cycle_id
        AND pc.workspace_id = auth_workspace_id()
    )
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );
CREATE POLICY "cycle_questions_delete_admin" ON public.cycle_questions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM performance_cycles pc
      WHERE pc.id = cycle_questions.cycle_id
        AND pc.workspace_id = auth_workspace_id()
    )
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );

-- ─── departments ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins can manage departments" ON public.departments;
DROP POLICY IF EXISTS "workspace members can read departments" ON public.departments;

CREATE POLICY "departments_select_workspace" ON public.departments
  FOR SELECT TO authenticated
  USING (workspace_id = auth_workspace_id());

CREATE POLICY "departments_insert_admin" ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );
CREATE POLICY "departments_update_admin" ON public.departments
  FOR UPDATE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  )
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );
CREATE POLICY "departments_delete_admin" ON public.departments
  FOR DELETE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );

-- ─── feedback_form_configs ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "hr_admin_read_form_config" ON public.feedback_form_configs;

-- ─── review_assignments ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers update review assignments" ON public.review_assignments;
DROP POLICY IF EXISTS "Users update own review assignments" ON public.review_assignments;

CREATE POLICY "review_assignments_update_authorised" ON public.review_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM performance_cycles pc
      WHERE pc.id = review_assignments.cycle_id
        AND pc.workspace_id = auth_workspace_id()
    )
    AND (
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text, 'manager'::text])
      OR employee_id = auth_user_id()
      OR reviewer_id = auth_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM performance_cycles pc
      WHERE pc.id = review_assignments.cycle_id
        AND pc.workspace_id = auth_workspace_id()
    )
    AND (
      auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text, 'manager'::text])
      OR employee_id = auth_user_id()
      OR reviewer_id = auth_user_id()
    )
  );

-- ─── surveys ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hr_admin_write_surveys" ON public.surveys;

CREATE POLICY "surveys_insert_admin" ON public.surveys
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );
CREATE POLICY "surveys_update_admin" ON public.surveys
  FOR UPDATE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  )
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );
CREATE POLICY "surveys_delete_admin" ON public.surveys
  FOR DELETE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text])
  );

-- ─── users ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins update any user in workspace" ON public.users;
DROP POLICY IF EXISTS "HR update users except role" ON public.users;
DROP POLICY IF EXISTS "Users update own safe fields" ON public.users;

CREATE POLICY "users_update_scoped" ON public.users
  FOR UPDATE TO authenticated
  USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_user_role() = 'admin'
      OR auth_user_role() = 'hr'
      OR id = auth_user_id()
    )
  )
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND (
      auth_user_role() = 'admin'
      OR (
        (auth_user_role() = 'hr' OR id = auth_user_id())
        AND (role)::text = (SELECT (u.role)::text FROM users u WHERE u.id = users.id)
      )
    )
  );

-- ─── competency_score_descriptors ───────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can view score descriptors" ON public.competency_score_descriptors;
DROP POLICY IF EXISTS "Workspace members can insert score descriptors" ON public.competency_score_descriptors;
DROP POLICY IF EXISTS "Workspace members can update score descriptors" ON public.competency_score_descriptors;
DROP POLICY IF EXISTS "Workspace members can delete score descriptors" ON public.competency_score_descriptors;

CREATE POLICY "score_descriptors_select_workspace" ON public.competency_score_descriptors
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT u.workspace_id FROM users u WHERE u.id = (SELECT auth.uid()))
  );
CREATE POLICY "score_descriptors_insert_workspace" ON public.competency_score_descriptors
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT u.workspace_id FROM users u WHERE u.id = (SELECT auth.uid()))
  );
CREATE POLICY "score_descriptors_update_workspace" ON public.competency_score_descriptors
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT u.workspace_id FROM users u WHERE u.id = (SELECT auth.uid()))
  )
  WITH CHECK (
    workspace_id IN (SELECT u.workspace_id FROM users u WHERE u.id = (SELECT auth.uid()))
  );
CREATE POLICY "score_descriptors_delete_workspace" ON public.competency_score_descriptors
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT u.workspace_id FROM users u WHERE u.id = (SELECT auth.uid()))
  );

-- ─── Duplicate index cleanup (Phase 1 artefact) ─────────────────────────────
DROP INDEX IF EXISTS public.uniq_vote_per_fingerprint;

-- ─── Unindexed FK covering indexes (advisor INFO) ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_survey_participants_workspace
  ON public.survey_participants (workspace_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_workspace
  ON public.survey_responses (workspace_id);
