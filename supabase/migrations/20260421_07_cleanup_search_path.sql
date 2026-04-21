-- Pin search_path on cleanup_slack_processed_events to silence the
-- function_search_path_mutable advisor warning. Behaviourally identical
-- to the original definition in 20260421_03_slack_processed_events.sql.
CREATE OR REPLACE FUNCTION cleanup_slack_processed_events()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM slack_processed_events WHERE received_at < now() - interval '24 hours';
$$;
