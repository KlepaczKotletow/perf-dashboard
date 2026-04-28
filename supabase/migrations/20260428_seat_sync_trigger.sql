-- Per-seat sync trigger.
-- Fires fire-and-forget HTTP POST to the Next.js app whenever a workspace's
-- billable-seat count might change. The app counts billable users
-- (employee_status != 'deactivated') and pushes the new quantity to Stripe
-- with proration.
--
-- Secrets live in vault (not GUCs — Supabase doesn't allow custom GUCs).
-- Required vault entries (set out-of-band, NOT in this migration so they
-- don't end up in migration history):
--   seat_sync_secret  - HMAC key shared with /api/internal/seat-sync
--                       (must equal SEAT_SYNC_SECRET in Vercel env)
--   dashboard_url     - Public Next.js app URL (e.g. https://namihr.com)
--
-- To populate on a fresh DB:
--   SELECT vault.create_secret('<32-byte-hex>', 'seat_sync_secret', '...');
--   SELECT vault.create_secret('https://your-domain.com', 'dashboard_url', '...');
--
-- Without HMAC, anyone could POST to /api/internal/seat-sync and force
-- arbitrary Stripe quantity updates.

create extension if not exists pg_net;
create extension if not exists pgcrypto;

create or replace function public.notify_seat_sync()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions, net
as $func$
declare
  ws_id    uuid;
  body     text;
  sig      text;
  v_secret text;
  v_url    text;
begin
  ws_id := coalesce(new.workspace_id, old.workspace_id);
  if ws_id is null then
    return null;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'seat_sync_secret';
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'dashboard_url';
  if v_secret is null or v_url is null then
    -- Vault entries missing; noop rather than block user mutations.
    return null;
  end if;

  -- jsonb_build_object()::text produces canonical jsonb text form, matching
  -- what pg_net sends on the wire when body::jsonb is serialized.
  body := jsonb_build_object('workspace_id', ws_id)::text;
  sig  := encode(extensions.hmac(body::bytea, v_secret::bytea, 'sha256'), 'hex');

  perform net.http_post(
    url     := v_url || '/api/internal/seat-sync',
    body    := body::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Seat-Sync-Signature', sig
    ),
    timeout_milliseconds := 5000
  );
  return null;
end;
$func$;

drop trigger if exists users_seat_sync on public.users;
create trigger users_seat_sync
after insert or delete or update of employee_status on public.users
for each row execute function public.notify_seat_sync();
