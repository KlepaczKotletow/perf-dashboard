-- Tighten the calibration_notes SELECT policy.
--
-- The original policy (20260502_01) allowed any authenticated user in the
-- workspace to read every calibration_notes row. That's wrong for two
-- reasons:
--
-- 1. EEOC retaliation guidance treats calibration rationale as protected
--    decision evidence — a peer manager seeing another manager's reasoning
--    creates an obvious retaliation vector against the rater.
-- 2. GDPR Art. 22 + ICO guidance: calibration is automated processing with
--    legal effects on a data subject; "meaningful information about the
--    logic involved" is granted to the subject themselves, not coworkers.
--
-- New policy:
--   - HR / admin: full read on workspace's calibration_notes (compliance
--     officers and people responsible for cycle integrity need this).
--   - Manager / calibrator: read only rows they themselves wrote (own audit
--     trail visible; peer rationale is not).
--   - Subject employee read of their own redacted history is deferred to
--     a future migration that can also enforce cycle-status checks.
--   - Everyone else: no read.

drop policy if exists "calibration_notes_select_workspace" on calibration_notes;

create policy "calibration_notes_select_hr_or_self"
  on calibration_notes for select
  to authenticated
  using (
    -- HR/admin/owner can read all calibration notes in their workspace.
    (
      workspace_id = (select u.workspace_id from users u where u.id = auth_user_id())
      and exists (
        select 1 from users u
        where u.id = auth_user_id()
          and u.role in ('admin', 'hr')
      )
    )
    -- A calibrator can read their own audit trail (rows they wrote).
    or calibrator_id = auth_user_id()
  );

comment on policy "calibration_notes_select_hr_or_self" on calibration_notes is
  'Replaces the v1 workspace-wide read with HR-or-self scoping. Closes the EEOC retaliation vector and GDPR Art. 22 access-control gap. See migration header for sources.';
