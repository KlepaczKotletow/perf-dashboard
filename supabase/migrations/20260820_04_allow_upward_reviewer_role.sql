-- Let upward feedback actually be submitted.
--
-- `review_responses_reviewer_role_check` allowed only
-- ('self','peer','manager','skip_level'). Both review-writing surfaces compute
-- reviewer_role = 'upward' for an upward assignment and pass it straight to the
-- insert, so every upward submission failed with SQLSTATE 23514.
--
-- Evidence this has never worked in production: there are upward assignments,
-- and `review_responses` contains 267 'self' rows and 200 'manager' rows and
-- exactly zero 'upward' rows.
--
-- The intent was clearly for 'upward' to be valid — the INSERT policy
-- `reviewer_role_matches_relationship_and_phase_active` already carries a
-- dedicated branch mapping reviewer_role 'upward' to the 'manager_review'
-- phase, and a matching relationship rule (a.reviewer_id = auth_user_id() and
-- a.assignment_type = 'upward'). Only the CHECK was left behind.
--
-- 'skip_level' is retained: it is unused today but is part of the intended
-- vocabulary, and dropping it would be a separate decision.

alter table public.review_responses
  drop constraint if exists review_responses_reviewer_role_check;

alter table public.review_responses
  add constraint review_responses_reviewer_role_check
  check (
    (reviewer_role)::text = any (
      (array['self', 'peer', 'manager', 'skip_level', 'upward'])::text[]
    )
  );
