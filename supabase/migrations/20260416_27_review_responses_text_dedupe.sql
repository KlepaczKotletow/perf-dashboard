-- Phase 6: close the remaining duplicate-text-response gap.
--
-- uniq_review_response_4tuple on (assignment_id, reviewer_id, reviewer_role,
-- competency_id) catches rating rows. Text-only rows (competency_id IS NULL)
-- had no uniqueness constraint, so a rapid double-submit via Slack DM
-- could create duplicate comment rows.
--
-- Constrain text-only rows by (assignment, reviewer, role, md5(comment)) —
-- the md5 tolerates different questions producing different comments while
-- still catching an exact-duplicate re-submit of the same text.

WITH dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY assignment_id, reviewer_id, reviewer_role, md5(COALESCE(comment, ''))
           ORDER BY created_at
         ) AS rn
  FROM review_responses
  WHERE competency_id IS NULL
)
DELETE FROM review_responses
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_response_text
  ON public.review_responses (assignment_id, reviewer_id, reviewer_role, md5(COALESCE(comment, '')))
  WHERE competency_id IS NULL;
