-- progress_cycle_phases: stop fast-forwarding past unfinished phases.
--
-- The previous version did two unconditional passes:
--
--   1. complete every phase with end_date < now()
--   2. activate the first pending phase WHERE start_date <= now() AND end_date >= now()
--
-- Step 2 could only ever activate a phase whose window was still open. So for
-- any cycle that fell behind its schedule, step 1 completed everything and step
-- 2 activated nothing — leaving an *active* cycle with **no active phase**.
-- Because the review page hard-blocks submission unless the phase matching the
-- reviewer's role is active, that state permanently strands every outstanding
-- review in the cycle.
--
-- This was not theoretical. At the time of writing, the workspace's cycles were
-- in exactly the two states this produces:
--   - "Q2 2026 Performance Review": all 4 phases completed, no active phase,
--     cycle still active  → the terminal dead state above.
--   - "Q2 2026": goal_setting still active 82 days past its end_date, all 5
--     later phases pending → never progressed, and running the OLD function on
--     it would have completed all 6 phases at once and killed its reviews.
--
-- New behaviour:
--   - The target phase is the one whose window contains now.
--   - If the schedule has slipped entirely, hold at the EARLIEST unfinished
--     phase that has started — never the latest. Fast-forwarding past an
--     unfinished phase is what destroys submissions.
--   - Only phases strictly before the target are completed.
--   - If nothing is unfinished, the cycle itself is completed, so a finished
--     cycle stops sitting in 'active' forever.
--
-- Invariant: an active cycle always has exactly one active phase, or it is no
-- longer active.
--
-- Note this function only ever moves a cycle to the earliest work that is
-- genuinely outstanding. It will NOT re-open a phase whose dates have lapsed —
-- rescheduling is an admin decision (see update_cycle_phase_dates).

CREATE OR REPLACE FUNCTION public.progress_cycle_phases(p_cycle_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_id    uuid;
  target_sort  integer;
  unfinished   integer;
  now_ts       timestamptz := now();
BEGIN
  -- What the calendar says we should be in.
  SELECT id INTO target_id
  FROM public.cycle_phases
  WHERE cycle_id = p_cycle_id
    AND start_date <= now_ts
    AND end_date   >= now_ts
  ORDER BY sort_order
  LIMIT 1;

  -- Schedule fully slipped: hold at the earliest phase that is still unfinished
  -- and has already started. Deliberately NOT the last phase.
  IF target_id IS NULL THEN
    SELECT id INTO target_id
    FROM public.cycle_phases
    WHERE cycle_id = p_cycle_id
      AND status <> 'completed'
      AND start_date <= now_ts
    ORDER BY sort_order
    LIMIT 1;
  END IF;

  -- Nothing in window and nothing unfinished: the cycle is genuinely done.
  IF target_id IS NULL THEN
    SELECT count(*) INTO unfinished
    FROM public.cycle_phases
    WHERE cycle_id = p_cycle_id AND status <> 'completed';

    IF unfinished = 0 THEN
      UPDATE public.performance_cycles
         SET status = 'completed', updated_at = now_ts
       WHERE id = p_cycle_id
         AND status = 'active';
    END IF;
    RETURN;
  END IF;

  SELECT sort_order INTO target_sort
  FROM public.cycle_phases WHERE id = target_id;

  -- Everything strictly before the target is done.
  UPDATE public.cycle_phases
     SET status = 'completed', updated_at = now_ts
   WHERE cycle_id = p_cycle_id
     AND status <> 'completed'
     AND sort_order < target_sort;

  -- The target is open.
  UPDATE public.cycle_phases
     SET status = 'active', updated_at = now_ts
   WHERE id = target_id
     AND status <> 'active';
END;
$function$;

-- Signature is unchanged, so the REVOKEs from
-- 20260429_lockdown_security_definer_rpcs*.sql still apply. Re-asserted here so
-- this file is safe against a database that never had those migrations.
REVOKE EXECUTE ON FUNCTION public.progress_cycle_phases(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.progress_cycle_phases(uuid) FROM anon;
