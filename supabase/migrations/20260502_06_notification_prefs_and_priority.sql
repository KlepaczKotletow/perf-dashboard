-- Sprint 3: Smart notifications.
-- 1. Per-user notification_prefs (mode, snooze, digest hour/timezone) on users.
-- 2. Priority column on slack_send_queue so the drain loop can let critical
--    items (cycle launch, grade release, final escalations) bypass snooze
--    and digest mode while routing 'normal' items through user prefs.

-- ── 1. notification_prefs ───────────────────────────────────────────────────
alter table users
  add column if not exists notification_prefs jsonb not null default jsonb_build_object(
    'mode', 'realtime',
    'digest_hour', 9,
    'digest_timezone', 'UTC',
    'snoozed_until', null
  );

comment on column users.notification_prefs is
  'Slack notification preferences: { mode (realtime|digest|critical_only), digest_hour 0-23, digest_timezone IANA tz, snoozed_until ISO timestamp or null }';

-- Validation: mode is one of three known values; digest_hour is a sane hour.
alter table users
  drop constraint if exists users_notification_prefs_shape;
alter table users
  add constraint users_notification_prefs_shape
  check (
    (notification_prefs->>'mode') in ('realtime', 'digest', 'critical_only')
    and ((notification_prefs->>'digest_hour')::int) between 0 and 23
  );

-- Functional index on digest_hour — used by the future digest enqueue cron
-- so we can find "users due for digest at the current local hour" cheaply.
create index if not exists users_digest_hour_idx
  on users (((notification_prefs->>'digest_hour')::int))
  where (notification_prefs->>'mode') = 'digest';

-- ── 2. slack_send_queue.priority ──────────────────────────────────────────
-- 'critical' bypasses snooze + digest (final warnings, grade releases,
-- cycle launch DMs). 'normal' respects user prefs.
alter table slack_send_queue
  add column if not exists priority text not null default 'normal'
  check (priority in ('critical', 'normal'));

comment on column slack_send_queue.priority is
  'normal: subject to user notification_prefs (snooze, digest). critical: bypass everything (cycle launch, grade release, final warning).';

create index if not exists slack_send_queue_priority_pending_idx
  on slack_send_queue (priority, next_attempt_at)
  where completed_at is null;
