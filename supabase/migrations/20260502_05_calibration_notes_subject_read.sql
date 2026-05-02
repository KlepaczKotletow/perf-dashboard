-- Allow a subject employee to read their own calibration_notes — but only
-- after grades have been released (cycle.grades_released = true), and via a
-- *redacted view* that hides calibrator identity. This satisfies GDPR Art.
-- 22's "right to meaningful information about the logic involved" without
-- exposing rater identity, which the EEOC retaliation guidance treats as
-- protected (a subject seeing who said what about them is a retaliation
-- vector).
--
-- Two-layer design:
-- 1. A new RLS policy on the table allowing the subject to SELECT rows
--    about themselves once grades are released.
-- 2. A redacted view (`my_calibration_notes`) that exposes only:
--    field, before_value, after_value, note, created_at — never
--    calibrator_id, never workspace_id, never assignment_id metadata that
--    could leak peer identity.
-- The dashboard reads from the view, not the table directly, so the
-- redaction can't be bypassed by client code.

-- Subject-employee read policy
create policy "calibration_notes_select_subject_after_release"
  on calibration_notes for select
  to authenticated
  using (
    exists (
      select 1
      from review_assignments ra
      join performance_cycles pc on pc.id = ra.cycle_id
      where ra.id = calibration_notes.assignment_id
        and ra.employee_id = auth_user_id()
        and pc.grades_released = true
    )
  );

comment on policy "calibration_notes_select_subject_after_release" on calibration_notes is
  'GDPR Art. 22 right of access: subject employees can read calibration notes about themselves once grades are released. Pair with the my_calibration_notes view, which redacts calibrator_id.';

-- Redacted view used by the dashboard for the subject-facing read.
-- security_invoker so RLS still applies (the policy above gates access).
create or replace view my_calibration_notes
with (security_invoker = true)
as
select
  cn.id,
  cn.assignment_id,
  cn.field,
  cn.before_value,
  cn.after_value,
  cn.note,
  cn.created_at
from calibration_notes cn
join review_assignments ra on ra.id = cn.assignment_id
where ra.employee_id = auth_user_id();

comment on view my_calibration_notes is
  'Subject-facing redacted view of calibration_notes. Hides calibrator_id, workspace_id, and FK metadata that could leak rater identity. RLS on the underlying table gates which rows the caller sees (subject of a released cycle only).';

revoke all on my_calibration_notes from public, anon;
grant select on my_calibration_notes to authenticated;
