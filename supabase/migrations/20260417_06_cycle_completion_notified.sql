-- Idempotency for the "all reviews complete" alerts fired by
-- checkAndNotifyCompletion. Without a DB-level flag, two near-simultaneous
-- last-submissions both observe "everything done" and fire the alert twice
-- (or more, for per-employee milestones).
--
-- We store the flag on the natural pivot for each alert:
--  * performance_cycles.completion_notified_at — cycle-wide "all done" alert
--  * review_assignments.employee_completion_notified_at — per-employee alert
--
-- The update-with-null-guard pattern (UPDATE ... WHERE x IS NULL RETURNING ...)
-- gives us atomic claim semantics: only the first caller gets rows back.

ALTER TABLE public.performance_cycles
  ADD COLUMN IF NOT EXISTS completion_notified_at timestamptz;

ALTER TABLE public.review_assignments
  ADD COLUMN IF NOT EXISTS employee_completion_notified_at timestamptz;
