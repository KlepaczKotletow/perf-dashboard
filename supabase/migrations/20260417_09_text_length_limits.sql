-- Length ceilings on user-visible text fields. Chosen so legitimate content
-- never hits them but pathological pastes (long emoji chains, accidental
-- whole-document drops into a single field) are rejected at the DB.
--
-- NOT VALID + VALIDATE keeps the ALTER fast even on big tables; since the
-- pre-check showed all current values under the limits, VALIDATE is a noop.

ALTER TABLE public.performance_cycles
  ADD CONSTRAINT chk_performance_cycles_name_len
  CHECK (LENGTH(name) <= 120) NOT VALID;
ALTER TABLE public.performance_cycles VALIDATE CONSTRAINT chk_performance_cycles_name_len;

ALTER TABLE public.goals
  ADD CONSTRAINT chk_goals_title_len
  CHECK (LENGTH(title) <= 200) NOT VALID;
ALTER TABLE public.goals VALIDATE CONSTRAINT chk_goals_title_len;

ALTER TABLE public.users
  ADD CONSTRAINT chk_users_job_title_len
  CHECK (job_title IS NULL OR LENGTH(job_title) <= 120) NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT chk_users_job_title_len;

ALTER TABLE public.users
  ADD CONSTRAINT chk_users_department_len
  CHECK (department IS NULL OR LENGTH(department) <= 120) NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT chk_users_department_len;

ALTER TABLE public.review_responses
  ADD CONSTRAINT chk_review_responses_comment_len
  CHECK (comment IS NULL OR LENGTH(comment) <= 5000) NOT VALID;
ALTER TABLE public.review_responses VALIDATE CONSTRAINT chk_review_responses_comment_len;
