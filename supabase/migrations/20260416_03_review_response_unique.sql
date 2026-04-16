-- Phase 1, audit fix 1.6: make review submission idempotent.
-- The real idempotency key is (assignment_id, reviewer_id, reviewer_role, competency_id).
-- Multiple rows per (assignment, reviewer, role) are legitimate: one per competency.
--
-- Rows with competency_id IS NULL (text-only question responses) remain
-- unconstrained because Postgres unique indexes treat NULLs as distinct; the
-- dominant case (competency ratings) is covered and text-only duplication is
-- bounded by the review form's submit flow.
--
-- Dedupe is not needed: zero dupe groups exist on the 4-tuple as verified at
-- time of authoring via COUNT(*) GROUP BY 1,2,3,4 HAVING COUNT(*) > 1.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_response_4tuple
  ON public.review_responses (assignment_id, reviewer_id, reviewer_role, competency_id);
