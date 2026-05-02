-- Sprint 2: 9-box calibration grid prerequisites.
-- 1. Adds the second axis ("Potential") to review_assignments. Same scale as
--    overall_rating; nullable so existing assignments stay valid.
-- 2. Adds calibration_notes — one row per grade or potential change for audit
--    trail and decision memory. Read-restricted to the cycle's workspace;
--    writes only via the v2 update_calibration_grades RPC (security definer).

alter table review_assignments
  add column if not exists potential_rating numeric(3,1);

comment on column review_assignments.potential_rating is
  'Manager-set growth potential rating, used as the Y-axis on the 9-box calibration grid. Same scale as overall_rating.';

create table if not exists calibration_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  cycle_id uuid not null references performance_cycles(id) on delete cascade,
  assignment_id uuid not null references review_assignments(id) on delete cascade,
  calibrator_id uuid not null references users(id) on delete restrict,
  field text not null check (field in ('final_grade', 'potential_rating', 'overall_rating')),
  before_value text,
  after_value text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists calibration_notes_cycle_idx
  on calibration_notes(cycle_id, created_at desc);
create index if not exists calibration_notes_assignment_idx
  on calibration_notes(assignment_id, created_at desc);

alter table calibration_notes enable row level security;

-- Read: any authenticated user in the same workspace as the note (matches
-- the existing performance_cycles / review_assignments visibility model).
create policy "calibration_notes_select_workspace"
  on calibration_notes for select
  to authenticated
  using (
    workspace_id = (
      select u.workspace_id from users u where u.id = auth_user_id()
    )
  );

-- No INSERT / UPDATE / DELETE policies — writes happen exclusively through
-- the v2 update_calibration_grades RPC (security definer), which validates
-- caller role + workspace before inserting note rows.

revoke all on calibration_notes from anon, public;
grant select on calibration_notes to authenticated;
