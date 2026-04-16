-- Phase 1, audit fix 1.1 (backstop): prevent duplicate review_assignments.
-- Companion to the launch_cycle RPC migration. Zero dupes verified at time of
-- authoring. reviewer_id can be NULL for not-yet-assigned assignments, but
-- Postgres unique indexes treat NULLs as distinct which is acceptable here —
-- the cycle launch path always assigns a reviewer.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_assignment
  ON public.review_assignments (cycle_id, employee_id, reviewer_id, assignment_type);
