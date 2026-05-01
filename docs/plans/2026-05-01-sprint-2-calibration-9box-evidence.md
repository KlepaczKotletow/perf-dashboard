# Sprint 2: 9-Box Calibration Grid + Evidence Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dropdown-grid calibration UI with a drag-and-drop 9-box grid (Performance × Potential). Hovering or clicking a chip surfaces the evidence underneath: peer feedback excerpts, prior cycle ratings, manager comments, kudos history. Add per-change calibration notes and an audit log.

**Architecture:**
- **Two-axis grid (3×3 = 9 boxes):** X-axis "Performance" (from `overall_rating`), Y-axis "Potential" (new manager-set field). Each employee = one chip placed in the box that matches their proposed grade.
- **Drag-and-drop** via `@dnd-kit/core` (already installed). Each box is a droppable; each chip is draggable. Drop = grade change.
- **Evidence overlay** is a side sheet: opens when a chip is clicked (not dragged). Pulls peer feedback comments, manager rating + comment, prior cycle final_grade, recent `/kudos` mentions. All data is already in the schema; the work is querying + rendering.
- **Calibration notes:** each grade change writes a row in a new `calibration_notes` table (employee_id, calibrator_id, before_grade, after_grade, note, created_at).
- **Audit log** is a chronological list rendered next to the grid; uses the existing `audit_log` table conventions.

**Tech Stack:**
- `@dnd-kit/core` + `@dnd-kit/sortable` (already in `package.json`)
- Existing `update_calibration_grades()` RPC extended to also write notes and audit entries
- shadcn/ui Sheet for the evidence side panel
- recharts (already installed) for distribution sparkline

**Out of scope:** Forced distribution targets (every competitor has stayed away — customers hate it). Multi-calibrator real-time collaboration (separate sprint). Calibration sessions/meetings as scheduled events.

---

## Pre-flight

### Task 0: Branch + baseline

**Step 1:** Create branch.
```bash
git checkout main && git pull
git checkout -b sprint-2-calibration-9box
```

**Step 2:** Verify `@dnd-kit/core` is installed.
```bash
grep '"@dnd-kit/core"' package.json
```
Expected: `^6.3.1` or similar.

**Step 3:** Run baseline tests.
```bash
npm test
```
Expected: green.

---

## Track A: Schema for Potential dimension + notes + audit

### Task 1: Migration — add `potential_rating` and `calibration_notes`

**Files:**
- Create: `supabase/migrations/20260515_01_calibration_potential_and_notes.sql`

**Step 1: Write migration**

```sql
-- Adds the second axis ("Potential") to review_assignments and a notes table
-- for capturing rationale on each calibration change.

-- 1. Potential rating column on review_assignments. Same scale as overall_rating.
alter table review_assignments
  add column if not exists potential_rating numeric(3,1);

comment on column review_assignments.potential_rating is
  'Manager-set growth potential rating, used as the Y-axis on the 9-box calibration grid. Same scale as overall_rating.';

-- 2. Calibration notes audit table — one row per grade or potential change.
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

create index if not exists calibration_notes_cycle_idx on calibration_notes(cycle_id, created_at desc);
create index if not exists calibration_notes_assignment_idx on calibration_notes(assignment_id, created_at desc);

-- RLS — same pattern as the rest of the cycle data
alter table calibration_notes enable row level security;

create policy "calibration_notes_select_workspace"
  on calibration_notes for select
  to authenticated
  using (
    workspace_id = (select workspace_id from users where id = auth.uid())
  );

create policy "calibration_notes_insert_calibrators"
  on calibration_notes for insert
  to authenticated
  with check (
    workspace_id = (select workspace_id from users where id = auth.uid())
    and calibrator_id = auth.uid()
    and exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.role in ('hr', 'admin', 'owner')
    )
  );

revoke all on calibration_notes from anon, public;
grant select, insert on calibration_notes to authenticated;
```

**Step 2: Apply migration**

```bash
supabase db reset
```

**Step 3: Verify**

```bash
supabase db execute "select column_name from information_schema.columns where table_name='review_assignments' and column_name='potential_rating';"
supabase db execute "select count(*) from calibration_notes;"
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260515_01_calibration_potential_and_notes.sql
git commit -m "feat(calibration): add potential_rating + calibration_notes audit table"
```

---

### Task 2: Extend `update_calibration_grades` RPC to write notes

**Files:**
- Create: `supabase/migrations/20260515_02_update_calibration_grades_v2.sql`

**Why:** Today's RPC takes `[{assignment_id, final_grade}]`. We extend it to accept `potential_rating` and an optional `note` per change, and write a `calibration_notes` row whenever a value actually changes.

**Step 1: Write migration**

```sql
-- v2 of update_calibration_grades: handles potential_rating + per-change notes
-- and writes audit rows. Drops & recreates rather than overload.

drop function if exists update_calibration_grades(uuid, jsonb);

create or replace function update_calibration_grades(
  p_cycle_id uuid,
  p_changes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_user_role text;
  v_change record;
  v_existing record;
  v_updated int := 0;
  v_skipped int := 0;
  v_notes_written int := 0;
begin
  select workspace_id into v_workspace_id from performance_cycles where id = p_cycle_id;
  if v_workspace_id is null then raise exception 'Cycle not found' using errcode='42704'; end if;

  select role into v_user_role from users where id = auth.uid();
  if v_user_role not in ('hr', 'admin', 'owner') then
    -- Allow dept heads only for their own department's assignments
    if not exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.is_department_head = true
    ) then
      raise exception 'Insufficient role' using errcode='42501';
    end if;
  end if;

  for v_change in
    select
      (c->>'assignment_id')::uuid as assignment_id,
      c->>'final_grade' as final_grade,
      (c->>'potential_rating')::numeric as potential_rating,
      c->>'note' as note
    from jsonb_array_elements(p_changes) c
  loop
    select
      ra.id, ra.final_grade as cur_grade, ra.potential_rating as cur_potential,
      u.department, u.id as employee_id
    into v_existing
    from review_assignments ra
    join users u on u.id = ra.employee_id
    where ra.id = v_change.assignment_id and ra.cycle_id = p_cycle_id;

    if v_existing is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Dept-head scope check
    if v_user_role not in ('hr', 'admin', 'owner') then
      if not exists (
        select 1 from users u
        where u.id = auth.uid()
          and u.department = v_existing.department
          and u.is_department_head = true
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;
    end if;

    -- Apply update
    update review_assignments
    set
      final_grade = coalesce(v_change.final_grade, final_grade),
      potential_rating = coalesce(v_change.potential_rating, potential_rating),
      calibrated_by = auth.uid(),
      calibrated_at = now()
    where id = v_change.assignment_id;

    -- Write notes for fields that actually changed
    if v_change.final_grade is not null
       and v_change.final_grade is distinct from v_existing.cur_grade then
      insert into calibration_notes (workspace_id, cycle_id, assignment_id, calibrator_id, field, before_value, after_value, note)
      values (v_workspace_id, p_cycle_id, v_change.assignment_id, auth.uid(),
              'final_grade', v_existing.cur_grade, v_change.final_grade, v_change.note);
      v_notes_written := v_notes_written + 1;
    end if;
    if v_change.potential_rating is not null
       and v_change.potential_rating is distinct from v_existing.cur_potential then
      insert into calibration_notes (workspace_id, cycle_id, assignment_id, calibrator_id, field, before_value, after_value, note)
      values (v_workspace_id, p_cycle_id, v_change.assignment_id, auth.uid(),
              'potential_rating', v_existing.cur_potential::text, v_change.potential_rating::text, v_change.note);
      v_notes_written := v_notes_written + 1;
    end if;

    v_updated := v_updated + 1;
  end loop;

  return jsonb_build_object('updated', v_updated, 'skipped', v_skipped, 'notes_written', v_notes_written);
end;
$$;

revoke all on function update_calibration_grades(uuid, jsonb) from public, anon;
grant execute on function update_calibration_grades(uuid, jsonb) to authenticated;

comment on function update_calibration_grades(uuid, jsonb) is
  'v2: applies a batch of {assignment_id, final_grade?, potential_rating?, note?} changes. Writes calibration_notes rows for actual deltas. Returns {updated, skipped, notes_written}.';
```

**Step 2: Apply + verify**

```bash
supabase db reset
supabase db execute "select pg_get_functiondef(oid) from pg_proc where proname='update_calibration_grades';" | head -5
```

**Step 3: Regenerate types**

```bash
npx supabase gen types typescript --project-id zhfvxfvmdlpdfgxrwtdn > src/types/database.ts
npx tsc --noEmit
```
Fix any compile errors in existing calibration code that referenced the old RPC shape.

**Step 4: Commit**

```bash
git add supabase/migrations/20260515_02_update_calibration_grades_v2.sql src/types/database.ts
git commit -m "feat(calibration): RPC v2 with potential_rating + notes"
```

---

## Track B: 9-box grid component

### Task 3: Pure helper — map (overall, potential) to a 3×3 box

**Files:**
- Create: `src/lib/nine-box.ts`
- Create: `src/lib/__tests__/nine-box.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { ratingToAxis, BOX_ROWS, BOX_COLS, gradeToBox } from "../nine-box";

describe("nine-box helpers", () => {
  it("ratingToAxis: 1-5 maps to 0|1|2", () => {
    expect(ratingToAxis(1)).toBe(0);
    expect(ratingToAxis(2)).toBe(0);
    expect(ratingToAxis(2.5)).toBe(1); // boundary: low/mid
    expect(ratingToAxis(3)).toBe(1);
    expect(ratingToAxis(3.5)).toBe(2);
    expect(ratingToAxis(5)).toBe(2);
    expect(ratingToAxis(null)).toBe(null);
  });

  it("gradeToBox: derives box from final_grade alone when potential missing", () => {
    expect(gradeToBox("Exceptional", null)).toEqual({ row: 2, col: 2 });
    expect(gradeToBox("Meets Expectations", null)).toEqual({ row: 1, col: 1 });
    expect(gradeToBox("Needs Improvement", null)).toEqual({ row: 0, col: 0 });
  });

  it("gradeToBox: when both grade and potential present, uses both axes", () => {
    expect(gradeToBox("Exceeds Expectations", 4.5)).toEqual({ row: 2, col: 2 });
    expect(gradeToBox("Below Expectations", 4)).toEqual({ row: 2, col: 0 });
  });

  it("BOX_ROWS / BOX_COLS each have 3 entries", () => {
    expect(BOX_ROWS).toHaveLength(3);
    expect(BOX_COLS).toHaveLength(3);
  });
});
```

**Step 2: Run — expect failure**
```bash
npm test -- nine-box
```

**Step 3: Implement**

```typescript
// src/lib/nine-box.ts

export const BOX_ROWS = ["Low Potential", "Core Player", "High Potential"] as const;
export const BOX_COLS = ["Below", "Solid", "Strong"] as const;

export type BoxCoord = { row: 0 | 1 | 2; col: 0 | 1 | 2 };

export function ratingToAxis(r: number | null): 0 | 1 | 2 | null {
  if (r === null || r === undefined) return null;
  if (r < 2.5) return 0;
  if (r < 3.5) return 1;
  return 2;
}

const GRADE_TO_COL: Record<string, 0 | 1 | 2> = {
  "Needs Improvement": 0,
  "Below Expectations": 0,
  "Meets Expectations": 1,
  "Exceeds Expectations": 2,
  "Exceptional": 2,
};

const GRADE_TO_DEFAULT_ROW: Record<string, 0 | 1 | 2> = {
  "Needs Improvement": 0,
  "Below Expectations": 0,
  "Meets Expectations": 1,
  "Exceeds Expectations": 2,
  "Exceptional": 2,
};

export function gradeToBox(grade: string | null, potential: number | null): BoxCoord | null {
  if (!grade) return null;
  const col = GRADE_TO_COL[grade];
  if (col === undefined) return null;
  const potRow = ratingToAxis(potential);
  const row = potRow ?? GRADE_TO_DEFAULT_ROW[grade];
  return { row, col };
}

export function boxToGrade(coord: BoxCoord): { final_grade: string; potential: number } {
  // Inverse for drag-drop: given a box, propose a grade + potential midpoint
  const COL_TO_GRADE: Record<0 | 1 | 2, string> = {
    0: "Below Expectations",
    1: "Meets Expectations",
    2: "Exceeds Expectations",
  };
  const ROW_TO_POTENTIAL: Record<0 | 1 | 2, number> = { 0: 2, 1: 3, 2: 4 };
  return {
    final_grade: COL_TO_GRADE[coord.col],
    potential: ROW_TO_POTENTIAL[coord.row],
  };
}
```

**Step 4: Run — expect pass**

**Step 5: Commit**

```bash
git add src/lib/nine-box.ts src/lib/__tests__/nine-box.test.ts
git commit -m "feat(calibration): pure helper for 9-box mapping"
```

---

### Task 4: `<NineBoxGrid>` component (no drag yet)

**Files:**
- Create: `src/app/dashboard/cycles/[id]/calibration/nine-box-grid.tsx`
- Create: `src/app/dashboard/cycles/[id]/calibration/__tests__/nine-box-grid.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NineBoxGrid } from "../nine-box-grid";

const assignments = [
  { id: "a1", employee: { slack_name: "Alice" }, final_grade: "Exceptional", potential_rating: 5, overall_rating: 4.5 },
  { id: "a2", employee: { slack_name: "Bob" }, final_grade: "Meets Expectations", potential_rating: 3, overall_rating: 3 },
  { id: "a3", employee: { slack_name: "Carol" }, final_grade: null, potential_rating: null, overall_rating: 2 },
] as any[];

describe("<NineBoxGrid>", () => {
  it("renders 9 boxes with row + column labels", () => {
    render(<NineBoxGrid assignments={assignments} onChipClick={() => {}} onMove={() => {}} />);
    expect(screen.getAllByTestId(/box-\d-\d/)).toHaveLength(9);
    expect(screen.getByText(/High Potential/i)).toBeInTheDocument();
    expect(screen.getByText(/Strong/i)).toBeInTheDocument();
  });

  it("places chips in the right boxes", () => {
    render(<NineBoxGrid assignments={assignments} onChipClick={() => {}} onMove={() => {}} />);
    const aliceBox = screen.getByTestId("box-2-2");
    expect(aliceBox).toHaveTextContent("Alice");
    const bobBox = screen.getByTestId("box-1-1");
    expect(bobBox).toHaveTextContent("Bob");
  });

  it("renders ungraded chips in a separate parking lot", () => {
    render(<NineBoxGrid assignments={assignments} onChipClick={() => {}} onMove={() => {}} />);
    const parking = screen.getByTestId("box-parking");
    expect(parking).toHaveTextContent("Carol");
  });
});
```

**Step 2: Implement (no drag-drop yet — just render)**

```tsx
// src/app/dashboard/cycles/[id]/calibration/nine-box-grid.tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BOX_ROWS, BOX_COLS, gradeToBox, BoxCoord } from "@/lib/nine-box";

interface Assignment {
  id: string;
  employee: { id: string; slack_name: string | null; department: string | null } | null;
  final_grade: string | null;
  potential_rating: number | null;
  overall_rating: number | null;
}

interface Props {
  assignments: Assignment[];
  onChipClick: (assignmentId: string) => void;
  onMove: (assignmentId: string, target: BoxCoord) => void;
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function NineBoxGrid({ assignments, onChipClick, onMove }: Props) {
  // Bucket assignments
  const buckets: Record<string, Assignment[]> = {};
  const parking: Assignment[] = [];

  for (const a of assignments) {
    const coord = gradeToBox(a.final_grade, a.potential_rating);
    if (!coord) {
      parking.push(a);
      continue;
    }
    const k = `${coord.row}-${coord.col}`;
    (buckets[k] ||= []).push(a);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {/* Y-axis labels */}
        <div className="flex flex-col-reverse justify-around w-24 text-xs text-muted-foreground text-right pr-2">
          {BOX_ROWS.map((label) => (
            <div key={label} className="leading-tight">{label}</div>
          ))}
        </div>
        {/* Grid 3x3 */}
        <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-2 aspect-[3/2] min-h-[300px]">
          {/* Top row -> bottom row in DOM, but we want row 2 (high) on top visually.
              CSS grid order: render row 2 first, then row 1, then row 0. */}
          {[2, 1, 0].map((row) =>
            [0, 1, 2].map((col) => {
              const k = `${row}-${col}`;
              const list = buckets[k] || [];
              const tone =
                row === 2 && col === 2 ? "bg-emerald-50 border-emerald-200" :
                row === 0 && col === 0 ? "bg-rose-50 border-rose-200" :
                "bg-muted/30 border-border/60";
              return (
                <div
                  key={k}
                  data-testid={`box-${row}-${col}`}
                  className={`rounded-lg border p-2 flex flex-wrap gap-1.5 content-start ${tone}`}
                >
                  {list.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => onChipClick(a.id)}
                      className="flex items-center gap-1.5 bg-background rounded-full pl-0.5 pr-2 py-0.5 border border-border/80 hover:border-primary transition-colors text-xs"
                    >
                      <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{getInitials(a.employee?.slack_name)}</AvatarFallback></Avatar>
                      <span className="truncate max-w-[80px]">{a.employee?.slack_name}</span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex gap-3">
        <div className="w-24" />
        <div className="flex-1 grid grid-cols-3 text-xs text-muted-foreground text-center">
          {BOX_COLS.map((label) => <div key={label}>{label}</div>)}
        </div>
      </div>

      {/* Parking lot for ungraded */}
      {parking.length > 0 && (
        <div data-testid="box-parking" className="rounded-lg border border-dashed border-border/60 p-3 bg-muted/10">
          <p className="text-xs text-muted-foreground mb-2">Not yet calibrated ({parking.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {parking.map((a) => (
              <button key={a.id} onClick={() => onChipClick(a.id)} className="flex items-center gap-1.5 bg-background rounded-full pl-0.5 pr-2 py-0.5 border border-border/80 hover:border-primary text-xs">
                <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{getInitials(a.employee?.slack_name)}</AvatarFallback></Avatar>
                <span className="truncate max-w-[80px]">{a.employee?.slack_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Run — expect pass**
```bash
npm test -- nine-box-grid
```

**Step 4: Commit**

```bash
git add src/app/dashboard/cycles/[id]/calibration/nine-box-grid.tsx src/app/dashboard/cycles/[id]/calibration/__tests__/nine-box-grid.test.tsx
git commit -m "feat(calibration): render-only 9-box grid component"
```

---

### Task 5: Add drag-and-drop with `@dnd-kit/core`

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/calibration/nine-box-grid.tsx`

**Step 1: Wrap in `DndContext` + register draggables/droppables**

Replace the chip rendering and box wrappers:

```tsx
import { DndContext, useDraggable, useDroppable, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { boxToGrade } from "@/lib/nine-box";

function ChipDraggable({ a, onClick }: { a: Assignment; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: a.id });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`flex items-center gap-1.5 bg-background rounded-full pl-0.5 pr-2 py-0.5 border border-border/80 hover:border-primary text-xs ${isDragging ? "opacity-40" : ""}`}
    >
      <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{getInitials(a.employee?.slack_name)}</AvatarFallback></Avatar>
      <span className="truncate max-w-[80px]">{a.employee?.slack_name}</span>
    </button>
  );
}

function BoxDroppable({ row, col, children, tone }: { row: number; col: number; children: React.ReactNode; tone: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `box-${row}-${col}` });
  return (
    <div
      ref={setNodeRef}
      data-testid={`box-${row}-${col}`}
      className={`rounded-lg border p-2 flex flex-wrap gap-1.5 content-start ${tone} ${isOver ? "ring-2 ring-primary" : ""}`}
    >{children}</div>
  );
}
```

Wrap the whole grid in `<DndContext>`:

```tsx
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

function handleDragEnd(ev: DragEndEvent) {
  const assignmentId = String(ev.active.id);
  const overId = ev.over?.id ? String(ev.over.id) : null;
  if (!overId || !overId.startsWith("box-")) return;
  if (overId === "box-parking") return; // can drag back to parking? no — parking is read-only here
  const m = /^box-(\d)-(\d)$/.exec(overId);
  if (!m) return;
  const target = { row: parseInt(m[1]) as 0 | 1 | 2, col: parseInt(m[2]) as 0 | 1 | 2 };
  onMove(assignmentId, target);
}

return (
  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    {/* ...existing JSX with BoxDroppable + ChipDraggable... */}
  </DndContext>
);
```

**Step 2: Make a manual test cycle's calibration page render the new grid (Task 6 wires it). For now confirm it compiles.**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/[id]/calibration/nine-box-grid.tsx
git commit -m "feat(calibration): add drag-drop to 9-box grid"
```

---

## Track C: Replace the dropdown calibration UI

### Task 6: Wire the grid into `CalibrationView`

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/calibration/calibration-view.tsx`

**Step 1: Replace the dropdown table with `<NineBoxGrid>`**

Remove the dropdown rendering (the per-employee `<Select>` blocks). In its place:

```tsx
import { NineBoxGrid } from "./nine-box-grid";
import { boxToGrade } from "@/lib/nine-box";

// Inside the component:
function handleMove(assignmentId: string, target: BoxCoord) {
  const proposal = boxToGrade(target);
  setGrades((g) => ({ ...g, [assignmentId]: proposal.final_grade }));
  setPotentials((p) => ({ ...p, [assignmentId]: proposal.potential }));
}

const assignmentsForGrid = visibleAssignments.map((a) => ({
  ...a,
  final_grade: grades[a.id] ?? a.final_grade,
  potential_rating: potentials[a.id] ?? a.potential_rating,
}));

<NineBoxGrid
  assignments={assignmentsForGrid}
  onChipClick={setSelectedAssignmentId}
  onMove={handleMove}
/>
```

**Step 2: Add `potentials` state alongside `grades`**

```tsx
const [potentials, setPotentials] = useState<Record<string, number>>(() => {
  const initial: Record<string, number> = {};
  assignments.forEach((a) => { if (a.potential_rating != null) initial[a.id] = a.potential_rating; });
  return initial;
});
const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
```

**Step 3: Update `handleSave` to send the v2 RPC payload**

Replace the existing per-row update loop with a single RPC call:

```tsx
const changes = Object.keys(grades).map((assignmentId) => ({
  assignment_id: assignmentId,
  final_grade: grades[assignmentId] ?? null,
  potential_rating: potentials[assignmentId] ?? null,
}));
const { data, error: rpcErr } = await supabase.rpc("update_calibration_grades", {
  p_cycle_id: cycle.id,
  p_changes: changes,
});
if (rpcErr || (data?.skipped ?? 0) > 0) {
  setError(rpcErr?.message ?? `${data.skipped} change(s) skipped due to permission`);
  return;
}
setSaved(true);
```

**Step 4: Manual smoke test**

```bash
npm run dev
```
Open `/dashboard/cycles/<id>/calibration`. Confirm:
- 3×3 grid renders with chips placed correctly for already-calibrated employees
- Parking lot at the bottom shows uncalibrated employees
- Dragging a chip across boxes changes its position; chip stays where dropped
- Clicking Save calls the v2 RPC successfully

**Step 5: Commit**

```bash
git add src/app/dashboard/cycles/[id]/calibration/calibration-view.tsx
git commit -m "feat(calibration): replace dropdown grid with 9-box drag-drop"
```

---

## Track D: Evidence overlay

### Task 7: Server data — `getEmployeeEvidence`

**Files:**
- Create: `src/app/dashboard/cycles/[id]/calibration/evidence-data.ts`

**What to fetch for the side sheet:**
1. Manager's review responses (rating + comment for each competency)
2. Peer responses (anonymized comments) — query `review_responses` where `reviewer_role = 'peer'` joined to `review_assignments` for this employee in this cycle
3. Upward feedback (if any)
4. Most recent `/kudos` (anonymous + named) about this employee — last 10
5. Prior cycle's `final_grade` (the cycle ending most recently before this one)

**Step 1: Implement**

```typescript
// src/app/dashboard/cycles/[id]/calibration/evidence-data.ts
import { SupabaseClient } from "@supabase/supabase-js";

export interface EmployeeEvidence {
  managerResponses: { competency: string | null; rating: number | null; comment: string | null }[];
  peerComments: { comment: string; submitted_at: string }[];
  upwardComments: { comment: string; submitted_at: string }[];
  recentKudos: { sender_name: string | null; message: string; created_at: string; anonymous: boolean }[];
  priorGrade: { cycle_name: string; final_grade: string | null; cycle_end: string } | null;
}

export async function getEmployeeEvidence(
  supabase: SupabaseClient,
  workspaceId: string,
  cycleId: string,
  assignmentId: string,
  employeeId: string,
): Promise<EmployeeEvidence> {
  const [managerR, peerR, upwardR, kudosR, priorR] = await Promise.all([
    // Manager responses on this assignment
    supabase
      .from("review_responses")
      .select("rating, comment, competency:competencies(name)")
      .eq("assignment_id", assignmentId)
      .eq("reviewer_role", "manager"),

    // Peer responses across all assignments where this employee is the subject
    supabase
      .from("review_responses")
      .select("comment, submitted_at, assignment:review_assignments!inner(employee_id, cycle_id)")
      .eq("reviewer_role", "peer")
      .eq("assignment.employee_id", employeeId)
      .eq("assignment.cycle_id", cycleId)
      .not("comment", "is", null),

    supabase
      .from("review_responses")
      .select("comment, submitted_at, assignment:review_assignments!inner(employee_id, cycle_id)")
      .eq("reviewer_role", "upward")
      .eq("assignment.employee_id", employeeId)
      .eq("assignment.cycle_id", cycleId)
      .not("comment", "is", null),

    supabase
      .from("feedback") // adjust to actual /kudos table name
      .select("message, created_at, anonymous, sender:users!feedback_sender_id_fkey(slack_name)")
      .eq("recipient_id", employeeId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(10),

    supabase
      .from("review_assignments")
      .select("final_grade, cycle:performance_cycles!inner(name, end_date, status)")
      .eq("employee_id", employeeId)
      .neq("cycle_id", cycleId)
      .eq("cycle.status", "completed")
      .order("cycle.end_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    managerResponses: (managerR.data || []).map((r: any) => ({
      competency: r.competency?.name ?? null,
      rating: r.rating,
      comment: r.comment,
    })),
    peerComments: (peerR.data || []).map((r: any) => ({ comment: r.comment, submitted_at: r.submitted_at })),
    upwardComments: (upwardR.data || []).map((r: any) => ({ comment: r.comment, submitted_at: r.submitted_at })),
    recentKudos: (kudosR.data || []).map((k: any) => ({
      sender_name: k.anonymous ? null : k.sender?.slack_name ?? null,
      message: k.message,
      created_at: k.created_at,
      anonymous: k.anonymous,
    })),
    priorGrade: priorR.data
      ? { cycle_name: priorR.data.cycle.name, final_grade: priorR.data.final_grade, cycle_end: priorR.data.cycle.end_date }
      : null,
  };
}
```

**Step 2: Verify table/column names match your schema** — adjust the `feedback` query to whatever `/kudos` uses (search the codebase for `kudos` or check `slack-commands/index.ts`'s `feedback_form_configs`).

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/[id]/calibration/evidence-data.ts
git commit -m "feat(calibration): query helpers for evidence overlay"
```

---

### Task 8: Evidence side sheet component

**Files:**
- Create: `src/app/dashboard/cycles/[id]/calibration/evidence-sheet.tsx`

**Step 1: Implement**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { createBrowserClient } from "@supabase/ssr";
import { getEmployeeEvidence, EmployeeEvidence } from "./evidence-data";

interface Props {
  assignmentId: string | null;
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  cycleId: string;
  assignments: { id: string; employee: { id: string; slack_name: string | null } | null }[];
}

export function EvidenceSheet({ assignmentId, open, onClose, workspaceId, cycleId, assignments }: Props) {
  const [data, setData] = useState<EmployeeEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const assignment = assignments.find((a) => a.id === assignmentId);

  useEffect(() => {
    if (!assignmentId || !assignment?.employee?.id) return;
    setLoading(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    getEmployeeEvidence(supabase, workspaceId, cycleId, assignmentId, assignment.employee.id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [assignmentId, assignment?.employee?.id, workspaceId, cycleId]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{assignment?.employee?.slack_name ?? "Evidence"}</SheetTitle>
          <SheetDescription>What's underneath this calibration decision</SheetDescription>
        </SheetHeader>

        {loading && <Skeleton className="h-32 mt-4" />}

        {data && (
          <div className="mt-6 space-y-6">
            {data.priorGrade && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Last cycle</h4>
                <p className="text-sm text-muted-foreground">
                  {data.priorGrade.cycle_name} ({format(new Date(data.priorGrade.cycle_end), "MMM yyyy")})
                </p>
                <Badge variant="outline" className="mt-1">{data.priorGrade.final_grade ?? "(no grade)"}</Badge>
              </section>
            )}

            {data.managerResponses.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Manager review</h4>
                {data.managerResponses.map((r, i) => (
                  <div key={i} className="border-l-2 border-border pl-3 py-1 text-sm">
                    <div className="text-xs text-muted-foreground">
                      {r.competency ?? "Overall"} {r.rating != null && <>· {r.rating}/5</>}
                    </div>
                    {r.comment && <p className="mt-0.5">{r.comment}</p>}
                  </div>
                ))}
              </section>
            )}

            {data.peerComments.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Peer feedback ({data.peerComments.length})</h4>
                {data.peerComments.slice(0, 5).map((p, i) => (
                  <blockquote key={i} className="border-l-2 border-border pl-3 py-1 text-sm italic mb-2">
                    "{p.comment}"
                    <div className="text-[10px] text-muted-foreground not-italic">
                      {format(new Date(p.submitted_at), "MMM d")}
                    </div>
                  </blockquote>
                ))}
              </section>
            )}

            {data.upwardComments.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Upward feedback</h4>
                {data.upwardComments.map((p, i) => (
                  <blockquote key={i} className="border-l-2 border-amber-300 pl-3 py-1 text-sm italic mb-2">"{p.comment}"</blockquote>
                ))}
              </section>
            )}

            {data.recentKudos.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Recent kudos</h4>
                {data.recentKudos.map((k, i) => (
                  <div key={i} className="text-sm mb-2">
                    <span className="text-xs text-muted-foreground">
                      {k.anonymous ? "Anonymous" : k.sender_name ?? "?"} · {format(new Date(k.created_at), "MMM d")}
                    </span>
                    <p>{k.message}</p>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Wire into `CalibrationView`**

In `calibration-view.tsx`, render at the bottom:

```tsx
<EvidenceSheet
  assignmentId={selectedAssignmentId}
  open={!!selectedAssignmentId}
  onClose={() => setSelectedAssignmentId(null)}
  workspaceId={workspaceId}
  cycleId={cycle.id}
  assignments={visibleAssignments}
/>
```

**Step 3: Manual verification**

Open calibration view, click any chip → sheet slides in from the right with the evidence sections populated. Drag a chip across the grid → sheet does NOT open (drag activation must be > 4px before click event is suppressed).

**Step 4: Commit**

```bash
git add src/app/dashboard/cycles/[id]/calibration/evidence-sheet.tsx src/app/dashboard/cycles/[id]/calibration/calibration-view.tsx
git commit -m "feat(calibration): evidence overlay side sheet"
```

---

## Track E: Calibration notes input + audit log view

### Task 9: Note input on each chip move

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/calibration/calibration-view.tsx`

**Step 1: After a drag, prompt for an optional note**

Use a small dialog/popover. Add state:

```tsx
const [pendingMove, setPendingMove] = useState<{ assignmentId: string; before: any; after: any } | null>(null);
const [pendingNote, setPendingNote] = useState("");
```

Replace `handleMove` to set `pendingMove` instead of immediately mutating:

```tsx
function handleMove(assignmentId: string, target: BoxCoord) {
  const proposal = boxToGrade(target);
  const a = assignments.find((x) => x.id === assignmentId);
  setPendingMove({
    assignmentId,
    before: { final_grade: a?.final_grade, potential_rating: a?.potential_rating },
    after: { final_grade: proposal.final_grade, potential_rating: proposal.potential },
  });
}
```

Render a popover/dialog tied to `pendingMove`:

```tsx
<Dialog open={!!pendingMove} onOpenChange={(v) => !v && setPendingMove(null)}>
  <DialogContent>
    <DialogHeader><DialogTitle>Why this change?</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">
      {pendingMove?.before.final_grade ?? "(uncalibrated)"} → {pendingMove?.after.final_grade}
    </p>
    <Textarea
      value={pendingNote}
      onChange={(e) => setPendingNote(e.target.value)}
      placeholder="Optional rationale visible to other calibrators and the manager..."
      rows={3}
    />
    <DialogFooter>
      <Button variant="ghost" onClick={() => setPendingMove(null)}>Cancel</Button>
      <Button onClick={confirmMove}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

`confirmMove` updates local state AND queues the note to be sent on save:

```tsx
function confirmMove() {
  if (!pendingMove) return;
  setGrades((g) => ({ ...g, [pendingMove.assignmentId]: pendingMove.after.final_grade }));
  setPotentials((p) => ({ ...p, [pendingMove.assignmentId]: pendingMove.after.potential_rating }));
  setNotes((n) => ({ ...n, [pendingMove.assignmentId]: pendingNote }));
  setPendingMove(null);
  setPendingNote("");
}
```

Pass `note` into the RPC payload:

```tsx
const changes = Object.keys(grades).map((assignmentId) => ({
  assignment_id: assignmentId,
  final_grade: grades[assignmentId] ?? null,
  potential_rating: potentials[assignmentId] ?? null,
  note: notes[assignmentId] ?? null,
}));
```

**Step 2: Commit**

```bash
git add src/app/dashboard/cycles/[id]/calibration/calibration-view.tsx
git commit -m "feat(calibration): note input on chip moves, sent with v2 RPC"
```

---

### Task 10: Audit log panel

**Files:**
- Create: `src/app/dashboard/cycles/[id]/calibration/audit-log.tsx`

**Step 1: Implement**

```tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Note {
  id: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
  note: string | null;
  created_at: string;
  calibrator: { slack_name: string | null } | null;
  assignment: { employee: { slack_name: string | null } | null } | null;
}

export function CalibrationAuditLog({ cycleId }: { cycleId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase
      .from("calibration_notes")
      .select(`
        id, field, before_value, after_value, note, created_at,
        calibrator:users!calibration_notes_calibrator_id_fkey(slack_name),
        assignment:review_assignments(employee:users!review_assignments_employee_id_fkey(slack_name))
      `)
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setNotes(data || []);
        setLoading(false);
      });
  }, [cycleId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading audit log…</div>;
  if (notes.length === 0) return <div className="text-sm text-muted-foreground">No calibration changes yet.</div>;

  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <div key={n.id} className="flex gap-3 border-b border-border/40 pb-3 last:border-0">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-[10px]">
              {n.calibrator?.slack_name?.split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm flex-1">
            <span className="font-medium">{n.calibrator?.slack_name ?? "Someone"}</span>
            {" changed "}<strong>{n.assignment?.employee?.slack_name ?? "an employee"}</strong>'s {n.field.replace("_", " ")} from
            {" "}<code className="bg-muted px-1 py-0.5 rounded text-xs">{n.before_value ?? "—"}</code>
            {" → "}<code className="bg-muted px-1 py-0.5 rounded text-xs">{n.after_value ?? "—"}</code>
            <div className="text-[11px] text-muted-foreground">{format(new Date(n.created_at), "MMM d, yyyy 'at' HH:mm")}</div>
            {n.note && <p className="mt-1 italic text-muted-foreground">"{n.note}"</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Render in the calibration page** as a collapsible panel below the grid.

```tsx
<details className="border rounded-lg p-3">
  <summary className="cursor-pointer font-medium text-sm">Activity log</summary>
  <div className="mt-3"><CalibrationAuditLog cycleId={cycle.id} /></div>
</details>
```

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/[id]/calibration/audit-log.tsx src/app/dashboard/cycles/[id]/calibration/page.tsx
git commit -m "feat(calibration): audit log panel"
```

---

## Track F: Verification + ship

### Task 11: End-to-end manual run

```bash
supabase db reset
npm run dev
```

Walk through:
1. Seed a cycle with ~12 employees across 3 departments, each with `overall_rating` set.
2. Open calibration view → confirm chips appear in matching boxes (or parking lot).
3. Drag Alice from "Solid + Core Player" to "Strong + High Potential" → note dialog appears.
4. Type "Strong delivery this half + mentoring 2 juniors" → confirm.
5. Repeat for 3-4 more.
6. Click Save → toast confirms.
7. Refresh → chips stay in new positions (`final_grade` + `potential_rating` persisted).
8. Click Alice's chip → side sheet shows manager comments, peer feedback, kudos, prior grade.
9. Open audit log → 4 entries, most recent first, with the rationale notes visible.
10. As a non-HR user, calibration page is hidden or read-only (verify via existing `canCalibrateDepartment`).

### Task 12: PR

```bash
git push -u origin sprint-2-calibration-9box
gh pr create --title "Sprint 2: 9-box calibration grid + evidence overlay" --body "..."
```

---

## Notes

- **Don't replace the dropdown grid in one merge** if the user base is large — gate behind a workspace flag (similar to Sprint 1's `phase_deadline_reminders_enabled`) and migrate workspace-by-workspace.
- **Performance:** for cycles with >200 employees, batch the evidence query in the side sheet (already lazy on click). Don't preload.
- **Anonymous peer comments:** if your `feedback` (`/kudos`) table stores `anonymous: true` separately, ensure the evidence sheet's "Recent kudos" section respects that — never leak sender for anonymous rows.
- **Drag activation distance:** the 4px constraint in `PointerSensor` is intentional — keeps single-clicks routed to `onChipClick` instead of starting a drag.
- **`@dnd-kit` SSR:** wrap the grid with a check `typeof window !== 'undefined'` if Next.js complains about hydration mismatches; we're already client-only via `"use client"` so this should be fine.

## Estimated time

| Track | Hours |
|---|---|
| A: Schema + RPC | 5 |
| B: Grid component | 8 |
| C: Wire into page | 4 |
| D: Evidence overlay | 6 |
| E: Notes + audit log | 5 |
| F: Verify + PR | 3 |
| **Total** | **~31h** = 1 sprint at 80% capacity |
