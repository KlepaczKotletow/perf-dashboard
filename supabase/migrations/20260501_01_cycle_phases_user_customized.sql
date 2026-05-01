-- Add a flag indicating whether a phase's start/end date was set by the user
-- (vs. computed from cycle proportions). When the cycle's overall start/end
-- changes, only non-customized phases should be re-flowed.

alter table cycle_phases
  add column if not exists is_user_customized boolean not null default false;

comment on column cycle_phases.is_user_customized is
  'When true, phase start_date/end_date were set by an admin and must not be overwritten by automatic recomputation when the cycle date range changes.';

-- Backfill: all existing phases stay default (false) since they came from
-- DEFAULT_PHASES proportions. New phases that admins customize will flip true.
