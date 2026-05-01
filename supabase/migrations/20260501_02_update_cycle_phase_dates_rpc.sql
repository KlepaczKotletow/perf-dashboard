-- update_cycle_phase_dates: bulk update of phase start_date/end_date with
-- ordering validation. Atomic — either all phases update or none.
--
-- Input shape:
--   p_cycle_id uuid
--   p_phase_dates jsonb (array): [{"phase_id": "...", "start_date": "ISO", "end_date": "ISO"}]
--
-- Returns: jsonb { updated: int, skipped: int, errors: text[] }
--
-- AuthZ note: this app authenticates via Slack OAuth, so auth.uid() is the
-- Supabase Auth UUID, NOT public.users.id. We resolve the app user via the
-- auth_user_id() helper (defined in 20260421_08_fix_tenant_isolation.sql),
-- matching the launch_cycle / update_calibration_grades pattern. Roles
-- accepted are ('admin', 'hr') — see roles.ts and launch_cycle.

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
  v_caller_user_id uuid;
  v_phase record;
  v_prev_end timestamptz;
  v_updated int := 0;
  v_input_count int;
  v_errors text[] := '{}';
begin
  -- Up-front input validation: bad shape returns a structured error instead
  -- of a Postgres exception. Bad UUIDs / timestamps inside the array are
  -- programmer errors and are allowed to raise.
  if p_phase_dates is null or jsonb_typeof(p_phase_dates) <> 'array' then
    return jsonb_build_object(
      'updated', 0,
      'skipped', 0,
      'errors', array['p_phase_dates must be a JSON array']
    );
  end if;

  -- Resolve the cycle's workspace.
  select workspace_id into v_workspace_id
  from performance_cycles where id = p_cycle_id;
  if v_workspace_id is null then
    raise exception 'Cycle not found' using errcode = '22023';
  end if;

  -- Resolve the caller's app user id (Slack-OAuth-aware) and verify
  -- admin/hr role in the cycle's workspace.
  v_caller_user_id := auth_user_id();
  if v_caller_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from users u
    where u.id = v_caller_user_id
      and u.workspace_id = v_workspace_id
      and u.role in ('admin', 'hr')
  ) then
    raise exception 'Not authorised to update cycle phase dates' using errcode = '42501';
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

  if cardinality(v_errors) > 0 then
    return jsonb_build_object('updated', 0, 'skipped', 0, 'errors', v_errors);
  end if;

  -- Apply updates only for phases present in the input that belong to this cycle
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

  -- skipped = input rows that didn't match any phase in this cycle
  -- (e.g. caller sent a phase_id from a different cycle or a stale id).
  v_input_count := jsonb_array_length(p_phase_dates);
  return jsonb_build_object(
    'updated', v_updated,
    'skipped', greatest(v_input_count - v_updated, 0),
    'errors', '{}'::text[]
  );
end;
$$;

comment on function update_cycle_phase_dates(uuid, jsonb) is
  'Atomically updates per-phase start/end dates for a cycle. Validates ordering. Marks phases as user_customized. HR/admin only. AuthZ via auth_user_id() (Slack OAuth aware).';

-- Lock down: explicitly revoke from anon/public per the project lockdown pattern
revoke all on function update_cycle_phase_dates(uuid, jsonb) from public, anon;
grant execute on function update_cycle_phase_dates(uuid, jsonb) to authenticated;
