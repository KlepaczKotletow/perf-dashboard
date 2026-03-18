-- ============================================================
-- MIGRATION: Fix workspace isolation security gaps
-- 1. Enable RLS on notification_log (was completely open)
-- 2. Allow employees/reviewers to update their own review_assignments
--    (self-review status updates silently failed for 'user' role)
-- ============================================================

-- ── 1. notification_log ─────────────────────────────────────
-- The edge function uses service_role key → bypasses RLS → still works.
-- Without RLS, any authenticated user could read notification records
-- from ALL workspaces (cross-org data leak).

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Workspace members can only see their own workspace's notification log
CREATE POLICY "Workspace members view own notification log"
  ON public.notification_log
  FOR SELECT
  USING (workspace_id = auth_workspace_id());

-- Authenticated users can only insert log entries for their own workspace
CREATE POLICY "Workspace members insert own notification log"
  ON public.notification_log
  FOR INSERT
  WITH CHECK (workspace_id = auth_workspace_id());

-- No DELETE policy for anon/authenticated key.
-- Only service_role (edge function) can delete — intentional.


-- ── 2. review_assignments: employee UPDATE permission ────────
-- The existing UPDATE policy only allows admin/hr/manager roles.
-- Regular employees (role='user') need to update their own assignment
-- when submitting a self-review (status: pending → in_progress).
-- Upward reviewers also need to update assignments where they are reviewer_id.
--
-- WITH CHECK prevents employees from reassigning cycle_id/employee_id
-- to rows outside their workspace (workspace-hopping prevention).

CREATE POLICY "Users update own review assignments"
  ON public.review_assignments
  FOR UPDATE
  USING (
    (
      employee_id = auth_user_id()
      OR reviewer_id = auth_user_id()
    )
    AND EXISTS (
      SELECT 1
      FROM performance_cycles pc
      WHERE pc.id = review_assignments.cycle_id
        AND pc.workspace_id = auth_workspace_id()
    )
  )
  WITH CHECK (
    (
      employee_id = auth_user_id()
      OR reviewer_id = auth_user_id()
    )
    AND EXISTS (
      SELECT 1
      FROM performance_cycles pc
      WHERE pc.id = review_assignments.cycle_id
        AND pc.workspace_id = auth_workspace_id()
    )
  );
