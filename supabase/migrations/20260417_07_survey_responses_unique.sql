-- Prevent duplicate survey submissions for the same (survey, participant, subject)
-- tuple. The Slack survey_modal_submit handler previously relied on a soft
-- status check, which races when two tabs or a Slack-retry both observe
-- status != 'completed' and both INSERT.
--
-- subject_user_id is part of the tuple because a single participant (peer
-- reviewer) may answer the same survey for multiple subjects. Two partial
-- indexes because UNIQUE over nullable columns treats NULLs as distinct by
-- default, which is the opposite of what we want.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_survey_response_participant_subject
  ON public.survey_responses (survey_id, participant_id, subject_user_id)
  WHERE subject_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_survey_response_participant_nosubject
  ON public.survey_responses (survey_id, participant_id)
  WHERE subject_user_id IS NULL;
