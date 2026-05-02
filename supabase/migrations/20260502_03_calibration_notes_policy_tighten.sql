-- Tighten the calibration_notes INSERT policy: also verify that the inserted
-- assignment_id actually belongs to the same workspace_id. Without this,
-- a calibrator-role user could write a note pointing at an assignment from
-- another workspace as long as the note row's workspace_id matched their own.
-- Read-side RLS still gates visibility, but the integrity check belongs here.

drop policy if exists "calibration_notes_insert_via_calibration" on calibration_notes;

create policy "calibration_notes_insert_via_calibration"
  on calibration_notes for insert
  to authenticated
  with check (
    calibrator_id = auth_user_id()
    and exists (
      select 1 from users u
      where u.id = auth_user_id()
        and u.workspace_id = calibration_notes.workspace_id
        and u.role in ('admin', 'hr', 'manager')
    )
    and exists (
      select 1 from review_assignments ra
      join performance_cycles pc on pc.id = ra.cycle_id
      where ra.id = calibration_notes.assignment_id
        and pc.workspace_id = calibration_notes.workspace_id
    )
  );
