-- Workspace-level flag controlling whether Nami targets reminders at the
-- active phase's end_date (true) or the legacy cycles.review_deadline (false).
-- Default false during rollout; flip workspace-by-workspace.

alter table workspaces
  add column if not exists phase_deadline_reminders_enabled boolean not null default false;

comment on column workspaces.phase_deadline_reminders_enabled is
  'When true, Nami reminder cron uses cycle_phases.end_date for the active phase as the deadline target. When false, falls back to legacy cycles.review_deadline.';
