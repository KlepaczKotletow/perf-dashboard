-- v2 of update_calibration_grades: extends per-row payload with optional
-- potential_rating + note. Backward compatible — callers passing the original
-- {assignment_id, grade} shape get exactly the previous behavior plus zero
-- notes_written.
--
-- We keep the original signature `update_calibration_grades(p_changes jsonb)`
-- (single param, no p_cycle_id) and SECURITY INVOKER so RLS on
-- review_assignments still applies. v2 is reflected in the comment only.

create or replace function public.update_calibration_grades(
  p_changes jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid := auth_workspace_id();
  v_caller_user_id uuid := auth_user_id();
  v_change jsonb;
  v_assignment_id uuid;
  v_grade text;
  v_potential numeric;
  v_note text;
  v_cycle_workspace uuid;
  v_cycle_id uuid;
  v_cur_grade text;
  v_cur_potential numeric;
  v_updated int := 0;
  v_skipped int := 0;
  v_notes_written int := 0;
begin
  if v_workspace_id is null or v_caller_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from users u
    where u.id = v_caller_user_id
      and u.workspace_id = v_workspace_id
      and u.role in ('admin', 'hr', 'manager')
  ) then
    raise exception 'Not authorised to calibrate' using errcode = '42501';
  end if;

  for v_change in select * from jsonb_array_elements(p_changes)
  loop
    v_assignment_id := (v_change->>'assignment_id')::uuid;
    v_grade := nullif(v_change->>'grade', '');
    v_potential := case
      when v_change ? 'potential_rating' and (v_change->>'potential_rating') is not null
      then (v_change->>'potential_rating')::numeric
      else null
    end;
    v_note := nullif(v_change->>'note', '');

    -- Verify the assignment lives in caller's workspace, and capture
    -- before-values for the audit row.
    select pc.workspace_id, pc.id, ra.final_grade, ra.potential_rating
      into v_cycle_workspace, v_cycle_id, v_cur_grade, v_cur_potential
    from review_assignments ra
    join performance_cycles pc on pc.id = ra.cycle_id
    where ra.id = v_assignment_id;

    if v_cycle_workspace is distinct from v_workspace_id then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Apply the update. Only set fields the caller actually provided.
    -- (jsonb ? 'key' tests for presence; lets caller distinguish between
    -- "don't touch this field" vs "explicitly set null".)
    update review_assignments
    set
      final_grade = case when v_change ? 'grade' then v_grade else final_grade end,
      potential_rating = case when v_change ? 'potential_rating' then v_potential else potential_rating end,
      calibrated_by = v_caller_user_id,
      calibrated_at = now(),
      updated_at = now()
    where id = v_assignment_id;

    -- Audit notes: one row per field whose value actually changed.
    if v_change ? 'grade' and v_grade is distinct from v_cur_grade then
      insert into calibration_notes
        (workspace_id, cycle_id, assignment_id, calibrator_id, field, before_value, after_value, note)
      values
        (v_workspace_id, v_cycle_id, v_assignment_id, v_caller_user_id,
         'final_grade', v_cur_grade, v_grade, v_note);
      v_notes_written := v_notes_written + 1;
    end if;
    if v_change ? 'potential_rating' and v_potential is distinct from v_cur_potential then
      insert into calibration_notes
        (workspace_id, cycle_id, assignment_id, calibrator_id, field, before_value, after_value, note)
      values
        (v_workspace_id, v_cycle_id, v_assignment_id, v_caller_user_id,
         'potential_rating', v_cur_potential::text, v_potential::text, v_note);
      v_notes_written := v_notes_written + 1;
    end if;

    v_updated := v_updated + 1;
  end loop;

  return jsonb_build_object(
    'updated', v_updated,
    'skipped', v_skipped,
    'notes_written', v_notes_written
  );
end;
$$;

comment on function public.update_calibration_grades(jsonb) is
  'v2: applies a batch of {assignment_id, grade?, potential_rating?, note?} changes. Writes calibration_notes rows for actual field deltas. Returns {updated, skipped, notes_written}. Backward compat with v1 shape {assignment_id, grade}.';

revoke all on function public.update_calibration_grades(jsonb) from public, anon;
grant execute on function public.update_calibration_grades(jsonb) to authenticated;

-- INSERT policy on calibration_notes: lets the SECURITY INVOKER RPC actually
-- write notes. Calibrator must be auth_user_id() and have a calibrator role
-- in the same workspace as the note. Drop-then-create makes the migration
-- idempotent (create policy is not idempotent on its own).
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
  );

grant insert on calibration_notes to authenticated;
