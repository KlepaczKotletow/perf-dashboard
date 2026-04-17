-- Prevent duplicate goals for the same (cycle, employee, title). Cycle_id is
-- nullable for workspace-scope goals that aren't tied to a review cycle, so
-- the index is partial.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_goal_per_cycle_employee_title
  ON public.goals (cycle_id, employee_id, title)
  WHERE cycle_id IS NOT NULL;
