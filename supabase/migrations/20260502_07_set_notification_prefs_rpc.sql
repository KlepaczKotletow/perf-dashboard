-- RPC for users to update their own notification_prefs from Slack
-- (snooze buttons, mode-switch dropdowns) or from the dashboard.
--
-- Pass NULL for any field you don't want to change. To CLEAR a snooze, pass
-- p_clear_snooze=true (NULL on p_snoozed_until alone is ambiguous — JSONB
-- can't distinguish "leave it" from "set to null").
--
-- security definer + auth_user_id() — same Slack-OAuth-aware pattern as the
-- rest of the codebase. Self-only: a user can only update their own row.

create or replace function set_notification_prefs(
  p_mode text default null,
  p_digest_hour int default null,
  p_digest_timezone text default null,
  p_snoozed_until timestamptz default null,
  p_clear_snooze boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth_user_id();
  v_current jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_mode is not null and p_mode not in ('realtime', 'digest', 'critical_only') then
    raise exception 'Unknown mode: %', p_mode using errcode = '22023';
  end if;
  if p_digest_hour is not null and (p_digest_hour < 0 or p_digest_hour > 23) then
    raise exception 'digest_hour must be 0-23' using errcode = '22023';
  end if;

  select notification_prefs into v_current from users where id = v_user_id;
  if v_current is null then
    raise exception 'User not found' using errcode = '42704';
  end if;

  if p_mode is not null then
    v_current := jsonb_set(v_current, '{mode}', to_jsonb(p_mode), true);
  end if;
  if p_digest_hour is not null then
    v_current := jsonb_set(v_current, '{digest_hour}', to_jsonb(p_digest_hour), true);
  end if;
  if p_digest_timezone is not null then
    v_current := jsonb_set(v_current, '{digest_timezone}', to_jsonb(p_digest_timezone), true);
  end if;
  if p_clear_snooze then
    v_current := jsonb_set(v_current, '{snoozed_until}', 'null'::jsonb, true);
  elsif p_snoozed_until is not null then
    v_current := jsonb_set(v_current, '{snoozed_until}', to_jsonb(p_snoozed_until), true);
  end if;

  update users set notification_prefs = v_current where id = v_user_id;
  return v_current;
end;
$$;

comment on function set_notification_prefs(text, int, text, timestamptz, boolean) is
  'Self-update of notification_prefs. Returns the new prefs jsonb.';

revoke all on function set_notification_prefs(text, int, text, timestamptz, boolean) from public, anon;
grant execute on function set_notification_prefs(text, int, text, timestamptz, boolean) to authenticated;
