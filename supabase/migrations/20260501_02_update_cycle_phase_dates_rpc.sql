-- update_cycle_phase_dates: bulk update of phase start_date/end_date with
-- ordering validation. Atomic — either all phases update or none.
--
-- Input shape:
--   p_cycle_id uuid
--   p_phase_dates jsonb (array): [{"phase_id": "...", "start_date": "ISO", "end_date": "ISO"}]
--
-- Returns: jsonb { updated: int, errors: text[] }
--
-- AuthZ note: roles checked are ('admin', 'hr'), matching the rest of the
-- codebase (see roles.ts and launch_cycle / progress_cycle_phases). There is
-- no `owner` role in this schema.

create or replace function update_cycle_phase_dates(
  p_cycle_id uuid,
  p_phase_dates jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_user_workspace_id uuid;
  v_user_role text;
  v_phase record;
  v_prev_end timestamptz;
  v_updated int := 0;
  v_errors text[] := '{}';
begin
  -- AuthZ: user must be HR-or-above in the cycle's workspace
  select workspace_id into v_workspace_id
  from performance_cycles where id = p_cycle_id;
  if v_workspace_id is null then
    raise exception 'Cycle not found' using errcode = '42704';
  end if;

  select workspace_id, role into v_user_workspace_id, v_user_role
  from users where id = auth.uid();
  if v_user_workspace_id is distinct from v_workspace_id then
    raise exception 'Workspace mismatch' using errcode = '42501';
  end if;
  if v_user_role not in ('admin', 'hr') then
    raise exception 'Insufficient role' using errcode = '42501';
  end if;

  -- Validate ordering: load phases in sort_order, walk through proposed dates
  -- ensuring each end_date > start_date and start_date >= previous phase's end_date
  v_prev_end := null;
  for v_phase in
    select cp.id, cp.sort_order,
           coalesce((p->>'start_date')::timestamptz, cp.start_date) as new_start,
           coalesce((p->>'end_date')::timestamptz, cp.end_date) as new_end
    from cycle_phases cp
    left join lateral jsonb_array_elements(p_phase_dates) p
      on (p->>'phase_id')::uuid = cp.id
    where cp.cycle_id = p_cycle_id
    order by cp.sort_order
  loop
    if v_phase.new_end <= v_phase.new_start then
      v_errors := v_errors || format('Phase %s: end_date must be after start_date', v_phase.id);
    elsif v_prev_end is not null and v_phase.new_start < v_prev_end then
      v_errors := v_errors || format('Phase %s: start_date must be >= previous phase end_date', v_phase.id);
    end if;
    v_prev_end := v_phase.new_end;
  end loop;

  if array_length(v_errors, 1) > 0 then
    return jsonb_build_object('updated', 0, 'errors', v_errors);
  end if;

  -- Apply updates only for phases present in the input
  update cycle_phases cp
  set
    start_date = (p->>'start_date')::timestamptz,
    end_date = (p->>'end_date')::timestamptz,
    is_user_customized = true,
    updated_at = now()
  from jsonb_array_elements(p_phase_dates) p
  where (p->>'phase_id')::uuid = cp.id
    and cp.cycle_id = p_cycle_id;

  get diagnostics v_updated = row_count;

  return jsonb_build_object('updated', v_updated, 'errors', '{}'::text[]);
end;
$$;

comment on function update_cycle_phase_dates(uuid, jsonb) is
  'Atomically updates per-phase start/end dates for a cycle. Validates ordering. Marks phases as user_customized. HR/admin only.';

-- Lock down: explicitly revoke from anon/public per the project lockdown pattern
revoke all on function update_cycle_phase_dates(uuid, jsonb) from public, anon;
grant execute on function update_cycle_phase_dates(uuid, jsonb) to authenticated;
