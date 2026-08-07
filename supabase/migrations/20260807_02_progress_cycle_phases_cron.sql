-- Advance cycle phases on a schedule instead of on a page view.
--
-- progress_cycle_phases() had exactly one caller in the entire product:
-- src/app/dashboard/cycles/[id]/page.tsx. Nothing else — no cron, no edge
-- function — ever invoked it. So a cycle's phases only moved when an admin
-- happened to open that specific cycle's detail page. If nobody opened it, the
-- cycle silently sat in the wrong phase, and because the review page blocks
-- submission unless the phase matching the reviewer's role is active, everyone
-- in that cycle was quietly locked out of work they had been asked to do.
--
-- 06:05 UTC, ahead of the 09:00 reminder jobs, so a phase that opens today is
-- already active by the time reminders go out about it.
--
-- Safe to run unattended only because 20260807_01 removed the fast-forward
-- behaviour: the previous implementation would have mass-completed every phase
-- of any lapsed cycle the first time this fired.

SELECT cron.unschedule('progress-cycle-phases-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'progress-cycle-phases-daily');

SELECT cron.schedule(
  'progress-cycle-phases-daily',
  '5 6 * * *',
  $cron$
    DO $inner$
    DECLARE c record;
    BEGIN
      FOR c IN SELECT id FROM public.performance_cycles WHERE status = 'active' LOOP
        PERFORM public.progress_cycle_phases(c.id);
      END LOOP;
    END
    $inner$;
  $cron$
);
