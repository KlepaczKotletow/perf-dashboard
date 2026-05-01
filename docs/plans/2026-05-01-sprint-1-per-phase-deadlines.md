# Sprint 1: Per-Phase Deadlines Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single global `review_deadline` per cycle with per-phase deadlines. HR can drag a timeline to adjust phase boundaries during cycle creation; the detail page exposes editable per-phase end dates; Nami reminders fire against the active phase's deadline (soft enforcement — submissions remain editable past deadline until cycle is completed).

**Architecture:**
- The `cycle_phases` table already has `start_date` and `end_date` columns — they're just being computed from hardcoded `DEFAULT_PHASES` proportions and never customized in the UI. We make them editable.
- Soft enforcement is already largely in place: `progress_cycle_phases()` auto-advances phases by `end_date`, but `review_responses` aren't blocked by phase status until the cycle itself is marked completed. We'll preserve this and document it.
- The global `cycles.review_deadline` becomes derived (latest phase `end_date`) but remains a column for backward compat with existing reminder code, then is deprecated in a follow-up.
- Nami reminder logic switches from cycle-level deadline to phase-level — this is the riskiest change and gets its own task with feature flag.

**Tech Stack:**
- Next.js 16 / React 19 / TypeScript
- Supabase (Postgres + Edge Functions in Deno)
- shadcn/ui + Tailwind CSS
- @dnd-kit/core for drag-to-resize
- Vitest for unit tests
- date-fns for date math

**Out of scope for Sprint 1:** Peer nomination flow (deferred). Per-cohort/per-department deadlines (added in Sprint 5 with staged release). Per-phase reminder cadence customization (Sprint 3).

---

## Pre-flight

### Task 0: Branch + sanity check

**Step 1:** Create a feature branch.

```bash
git checkout -b sprint-1-per-phase-deadlines
```

**Step 2:** Run the test suite to ensure baseline passes.

```bash
npm test
```
Expected: all green. If anything fails before we start, stop and fix or document.

**Step 3:** Run the dev server briefly to confirm the cycle wizard loads.

```bash
npm run dev
```
Open `/dashboard/cycles/new` — confirm the existing PhaseTimelinePreview renders with the static colored bands. Stop the server.

**Step 4:** Commit nothing yet — branch is clean.

---

## Track A: Schema + RPC changes

### Task 1: Migration — add `is_user_customized` flag to `cycle_phases`

**Why:** Today every phase's `end_date` is computed from the hardcoded proportion. We need to know which dates were explicitly set by the user vs. computed, so re-computing on cycle date changes doesn't silently overwrite user intent.

**Files:**
- Create: `supabase/migrations/20260501_01_cycle_phases_user_customized.sql`

**Step 1: Write the migration**

```sql
-- Add a flag indicating whether a phase's start/end date was set by the user
-- (vs. computed from cycle proportions). When the cycle's overall start/end
-- changes, only non-customized phases should be re-flowed.

alter table cycle_phases
  add column if not exists is_user_customized boolean not null default false;

comment on column cycle_phases.is_user_customized is
  'When true, phase start_date/end_date were set by an admin and must not be overwritten by automatic recomputation when the cycle date range changes.';

-- Backfill: all existing phases stay default (false) since they came from
-- DEFAULT_PHASES proportions. New phases that admins customize will flip true.
```

**Step 2: Apply the migration locally**

```bash
# Via supabase CLI (assumes local supabase running):
supabase db reset
# OR: supabase migration up
```
Expected: applies cleanly. No errors.

**Step 3: Verify via psql**

```bash
supabase db execute "select column_name, data_type, column_default from information_schema.columns where table_name='cycle_phases' and column_name='is_user_customized';"
```
Expected: one row, `boolean`, default `false`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260501_01_cycle_phases_user_customized.sql
git commit -m "feat(cycles): add is_user_customized flag to cycle_phases"
```

---

### Task 2: RPC — `update_cycle_phase_dates` for editable phases on existing cycles

**Why:** HR may want to push back the calibration phase deadline mid-cycle. They can't do that today. We need a single RPC that validates ordering (phase N's end ≤ phase N+1's start) and writes the date with `is_user_customized=true`.

**Files:**
- Create: `supabase/migrations/20260501_02_update_cycle_phase_dates_rpc.sql`

**Step 1: Write the failing test (SQL-level)**

Create: `supabase/migrations/__tests__/update_cycle_phase_dates.test.sql` (or use a Vitest test that calls supabase.rpc — see Task 4). For now we'll skip a SQL-level test and rely on the JS-level test in Task 4.

**Step 2: Write the RPC**

```sql
-- update_cycle_phase_dates: bulk update of phase start_date/end_date with
-- ordering validation. Atomic — either all phases update or none.
--
-- Input shape:
--   p_cycle_id uuid
--   p_phase_dates jsonb (array): [{"phase_id": "...", "start_date": "ISO", "end_date": "ISO"}]
--
-- Returns: jsonb { updated: int, errors: text[] }

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
  if v_user_role not in ('hr', 'admin', 'owner') then
    raise exception 'Insufficient role' using errcode = '42501';
  end if;

  -- Validate ordering: load phases in sort_order, walk through proposed dates
  -- ensuring each end_date >= start_date and >= previous phase's end_date
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
  'Atomically updates per-phase start/end dates for a cycle. Validates ordering. Marks phases as user_customized. HR/admin/owner only.';

-- Lock down: explicitly revoke from anon/public per the project lockdown pattern
revoke all on function update_cycle_phase_dates(uuid, jsonb) from public, anon;
grant execute on function update_cycle_phase_dates(uuid, jsonb) to authenticated;
```

**Step 3: Apply the migration**

```bash
supabase db reset
```
Expected: applies cleanly.

**Step 4: Sanity-check the RPC exists**

```bash
supabase db execute "select proname, pg_get_function_arguments(oid) from pg_proc where proname='update_cycle_phase_dates';"
```
Expected: one row showing the function and `(p_cycle_id uuid, p_phase_dates jsonb)`.

**Step 5: Commit**

```bash
git add supabase/migrations/20260501_02_update_cycle_phase_dates_rpc.sql
git commit -m "feat(cycles): add update_cycle_phase_dates RPC with ordering validation"
```

---

### Task 3: TypeScript types regen

**Why:** Auto-generated DB types are stale after the new column.

**Files:**
- Modify: `src/types/database.ts` (or wherever Supabase types live)

**Step 1: Find the types file**

```bash
grep -rln "cycle_phases" src/types/ 2>/dev/null || find src -name "database.ts" -o -name "supabase.ts" | head
```

**Step 2: Regenerate**

```bash
npx supabase gen types typescript --project-id zhfvxfvmdlpdfgxrwtdn > src/types/database.ts
```
Expected: file updated. `is_user_customized: boolean` appears under `cycle_phases.Row`.

**Step 3: TypeCheck**

```bash
npx tsc --noEmit
```
Expected: green. If existing code uses spread on cycle_phases rows and breaks, fix the call sites — it'll be obvious from compiler errors.

**Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "chore: regenerate Supabase types for cycle_phases.is_user_customized"
```

---

### Task 4: Vitest test for RPC ordering validation

**Files:**
- Create: `src/app/dashboard/cycles/__tests__/update-cycle-phase-dates.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// These tests run against a local Supabase. Skip if NEXT_PUBLIC_SUPABASE_URL
// points to production — defensive only; CI should set a local URL.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const skip = !url || !serviceKey || url.includes(".supabase.co");

(skip ? describe.skip : describe)("update_cycle_phase_dates RPC", () => {
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  let cycleId: string;
  let phaseIds: string[] = [];
  const testWorkspaceId = "00000000-0000-0000-0000-000000000001"; // seed fixture

  beforeAll(async () => {
    // Create a test cycle with 3 phases
    const { data: cycle } = await supabase
      .from("performance_cycles")
      .insert({
        workspace_id: testWorkspaceId,
        name: "RPC test cycle",
        status: "draft",
        start_date: "2026-06-01T00:00:00Z",
        end_date: "2026-09-01T00:00:00Z",
      })
      .select("id")
      .single();
    cycleId = cycle!.id;

    const { data: phases } = await supabase
      .from("cycle_phases")
      .insert([
        { cycle_id: cycleId, phase_type: "self_assessment", name: "Self", start_date: "2026-06-01T00:00:00Z", end_date: "2026-07-01T00:00:00Z", sort_order: 0, status: "pending" },
        { cycle_id: cycleId, phase_type: "manager_review", name: "Mgr", start_date: "2026-07-01T00:00:00Z", end_date: "2026-08-01T00:00:00Z", sort_order: 1, status: "pending" },
        { cycle_id: cycleId, phase_type: "calibration", name: "Cal", start_date: "2026-08-01T00:00:00Z", end_date: "2026-09-01T00:00:00Z", sort_order: 2, status: "pending" },
      ])
      .select("id");
    phaseIds = phases!.map((p) => p.id);
  });

  afterAll(async () => {
    if (cycleId) await supabase.from("performance_cycles").delete().eq("id", cycleId);
  });

  it("rejects when end <= start", async () => {
    const { data } = await supabase.rpc("update_cycle_phase_dates", {
      p_cycle_id: cycleId,
      p_phase_dates: [
        { phase_id: phaseIds[0], start_date: "2026-06-01T00:00:00Z", end_date: "2026-06-01T00:00:00Z" },
      ],
    });
    expect(data.updated).toBe(0);
    expect(data.errors.length).toBe(1);
    expect(data.errors[0]).toMatch(/end_date must be after start_date/);
  });

  it("rejects when phase N start < phase N-1 end", async () => {
    const { data } = await supabase.rpc("update_cycle_phase_dates", {
      p_cycle_id: cycleId,
      p_phase_dates: [
        { phase_id: phaseIds[1], start_date: "2026-06-15T00:00:00Z", end_date: "2026-08-01T00:00:00Z" },
      ],
    });
    expect(data.updated).toBe(0);
    expect(data.errors[0]).toMatch(/must be >= previous phase end_date/);
  });

  it("accepts valid date shifts and flips is_user_customized", async () => {
    const { data } = await supabase.rpc("update_cycle_phase_dates", {
      p_cycle_id: cycleId,
      p_phase_dates: [
        { phase_id: phaseIds[2], start_date: "2026-08-01T00:00:00Z", end_date: "2026-09-15T00:00:00Z" },
      ],
    });
    expect(data.updated).toBe(1);
    expect(data.errors).toEqual([]);

    const { data: phase } = await supabase
      .from("cycle_phases")
      .select("end_date, is_user_customized")
      .eq("id", phaseIds[2])
      .single();
    expect(phase!.is_user_customized).toBe(true);
    expect(new Date(phase!.end_date).toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });
});
```

**Step 2: Run the test — expect failure if RPC doesn't exist**

```bash
npm test -- update-cycle-phase-dates
```
Expected: 3 passes (RPC was added in Task 2). If it fails, debug the RPC against actual Supabase output.

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/__tests__/update-cycle-phase-dates.test.ts
git commit -m "test(cycles): RPC ordering validation for update_cycle_phase_dates"
```

---

## Track B: Cycle creation wizard — drag-to-resize timeline

### Task 5: Pure helper — compute phase ranges from cycle bounds + custom overrides

**Why:** This logic is reused in PhaseTimelinePreview, the new editable timeline, and on save. Extract to a pure function for testability.

**Files:**
- Create: `src/lib/cycle-phases.ts`
- Create: `src/lib/__tests__/cycle-phases.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computePhaseRanges, DEFAULT_PHASES } from "../cycle-phases";

describe("computePhaseRanges", () => {
  const start = new Date("2026-06-01T00:00:00Z");
  const end = new Date("2026-09-01T00:00:00Z"); // 92 days

  it("splits phases by proportion when no overrides", () => {
    const phases = computePhaseRanges(start, end, []);
    expect(phases).toHaveLength(DEFAULT_PHASES.length);
    expect(phases[0].start_date.toISOString()).toBe(start.toISOString());
    // Last phase ends exactly at cycle end
    expect(phases[phases.length - 1].end_date.toISOString()).toBe(end.toISOString());
    // Phases are contiguous
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].start_date.toISOString()).toBe(phases[i - 1].end_date.toISOString());
    }
  });

  it("respects user-customized phase end_dates and reflows non-customized neighbors", () => {
    const overrides = [{ phase_type: "self_assessment", end_date: new Date("2026-07-15T00:00:00Z") }];
    const phases = computePhaseRanges(start, end, overrides);
    const self = phases.find((p) => p.phase_type === "self_assessment")!;
    expect(self.end_date.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(self.is_user_customized).toBe(true);
    // The phase after self_assessment should now start at 2026-07-15
    const peer = phases.find((p) => p.phase_type === "peer_review")!;
    expect(peer.start_date.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("returns empty array when end <= start", () => {
    expect(computePhaseRanges(end, start, [])).toEqual([]);
  });
});
```

**Step 2: Run — expect failure (module not found)**

```bash
npm test -- cycle-phases.test
```

**Step 3: Implement**

```typescript
// src/lib/cycle-phases.ts

export const DEFAULT_PHASES = [
  { phase_type: "goal_setting" as const,    name: "Goal Setting",          proportion: 2 / 12 },
  { phase_type: "self_assessment" as const, name: "Self Assessment",        proportion: 2 / 12 },
  { phase_type: "peer_review" as const,     name: "Peer Review",            proportion: 3 / 12 },
  { phase_type: "manager_review" as const,  name: "Manager Review",         proportion: 2 / 12 },
  { phase_type: "calibration" as const,     name: "Calibration",            proportion: 1 / 12 },
  { phase_type: "communication" as const,   name: "Results Communication",  proportion: 2 / 12 },
];

export type PhaseType = (typeof DEFAULT_PHASES)[number]["phase_type"];

export interface PhaseRange {
  phase_type: PhaseType;
  name: string;
  start_date: Date;
  end_date: Date;
  is_user_customized: boolean;
}

export interface PhaseOverride {
  phase_type: PhaseType;
  end_date: Date;
}

/**
 * Compute concrete phase date ranges from a cycle's start/end and optional
 * user overrides. User overrides are honored exactly; non-customized phases
 * are reflowed proportionally between the customized boundaries.
 */
export function computePhaseRanges(
  cycleStart: Date,
  cycleEnd: Date,
  overrides: PhaseOverride[],
): PhaseRange[] {
  if (cycleEnd <= cycleStart) return [];

  const overrideMap = new Map(overrides.map((o) => [o.phase_type, o.end_date]));
  // Walk phases left-to-right. For a non-customized run between two customized
  // boundaries, distribute time proportional to the original proportions.
  const phases: PhaseRange[] = [];
  let cursor = cycleStart;

  // Find the next customized boundary (or cycle end) starting at index i.
  function nextBoundary(fromIdx: number): { boundary: Date; atIdx: number } {
    for (let i = fromIdx; i < DEFAULT_PHASES.length; i++) {
      const ov = overrideMap.get(DEFAULT_PHASES[i].phase_type);
      if (ov) return { boundary: ov, atIdx: i };
    }
    return { boundary: cycleEnd, atIdx: DEFAULT_PHASES.length - 1 };
  }

  let i = 0;
  while (i < DEFAULT_PHASES.length) {
    const { boundary, atIdx } = nextBoundary(i);
    const totalProportion = DEFAULT_PHASES.slice(i, atIdx + 1).reduce(
      (sum, p) => sum + p.proportion, 0,
    );
    const segmentMs = boundary.getTime() - cursor.getTime();
    let inner = cursor;
    for (let j = i; j <= atIdx; j++) {
      const phase = DEFAULT_PHASES[j];
      const isCustomized = j === atIdx && overrideMap.has(phase.phase_type);
      const phaseEnd = j === atIdx
        ? boundary
        : new Date(inner.getTime() + (phase.proportion / totalProportion) * segmentMs);
      phases.push({
        phase_type: phase.phase_type,
        name: phase.name,
        start_date: inner,
        end_date: phaseEnd,
        is_user_customized: isCustomized,
      });
      inner = phaseEnd;
    }
    cursor = boundary;
    i = atIdx + 1;
  }

  return phases;
}
```

**Step 4: Run — expect pass**

```bash
npm test -- cycle-phases.test
```

**Step 5: Commit**

```bash
git add src/lib/cycle-phases.ts src/lib/__tests__/cycle-phases.test.ts
git commit -m "feat(cycles): pure helper for computing phase ranges with overrides"
```

---

### Task 6: New `EditablePhaseTimeline` component

**Why:** Replace the read-only `PhaseTimelinePreview` with a draggable timeline. Each phase boundary (between two adjacent phases) has a draggable handle; dragging adjusts the boundary in user-customized state.

**Files:**
- Create: `src/app/dashboard/cycles/new/editable-phase-timeline.tsx`
- Create: `src/app/dashboard/cycles/new/__tests__/editable-phase-timeline.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditablePhaseTimeline } from "../editable-phase-timeline";

describe("<EditablePhaseTimeline>", () => {
  const start = new Date("2026-06-01T00:00:00Z");
  const end = new Date("2026-09-01T00:00:00Z");

  it("renders all six default phase bands", () => {
    render(<EditablePhaseTimeline startDate={start} endDate={end} overrides={[]} onChange={() => {}} />);
    expect(screen.getByText(/Goal/i)).toBeInTheDocument();
    expect(screen.getByText(/Self/i)).toBeInTheDocument();
    expect(screen.getByText(/Peer/i)).toBeInTheDocument();
    expect(screen.getByText(/Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/Calibration/i)).toBeInTheDocument();
    expect(screen.getByText(/Results/i)).toBeInTheDocument();
  });

  it("shows 5 drag handles between 6 phases", () => {
    render(<EditablePhaseTimeline startDate={start} endDate={end} overrides={[]} onChange={() => {}} />);
    expect(screen.getAllByRole("slider")).toHaveLength(5);
  });

  it("renders empty when end <= start", () => {
    const { container } = render(
      <EditablePhaseTimeline startDate={end} endDate={start} overrides={[]} onChange={() => {}} />
    );
    expect(container.querySelector('[role="slider"]')).toBeNull();
  });
});
```

**Step 2: Run — expect failure**

```bash
npm test -- editable-phase-timeline
```

**Step 3: Implement**

```tsx
// src/app/dashboard/cycles/new/editable-phase-timeline.tsx
"use client";

import { useMemo, useRef, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  computePhaseRanges,
  PhaseOverride,
  PhaseRange,
} from "@/lib/cycle-phases";

const COLORS = [
  "bg-blue-400", "bg-indigo-400", "bg-purple-400",
  "bg-pink-400", "bg-amber-400", "bg-emerald-400",
];

interface Props {
  startDate?: Date;
  endDate?: Date;
  overrides: PhaseOverride[];
  onChange: (overrides: PhaseOverride[]) => void;
}

export function EditablePhaseTimeline({ startDate, endDate, overrides, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const phases: PhaseRange[] = useMemo(() => {
    if (!startDate || !endDate) return [];
    return computePhaseRanges(startDate, endDate, overrides);
  }, [startDate, endDate, overrides]);

  const totalMs = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return endDate.getTime() - startDate.getTime();
  }, [startDate, endDate]);

  // Convert a pixel x within the bar to a date
  const xToDate = useCallback((xPx: number, widthPx: number): Date => {
    if (!startDate || totalMs <= 0) return startDate ?? new Date();
    const ratio = Math.max(0, Math.min(1, xPx / widthPx));
    return new Date(startDate.getTime() + ratio * totalMs);
  }, [startDate, totalMs]);

  // Handle drag of boundary i (between phases[i] and phases[i+1])
  function startDrag(boundaryIdx: number, ev: React.PointerEvent) {
    if (!containerRef.current) return;
    ev.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();

    function onMove(e: PointerEvent) {
      const xPx = e.clientX - rect.left;
      const newDate = xToDate(xPx, rect.width);
      const phase = phases[boundaryIdx];
      const next = phases[boundaryIdx + 1];
      if (!phase || !next) return;
      // Clamp: stay strictly inside (phase.start, next.end)
      const minMs = phase.start_date.getTime() + 60_000; // 1-min minimum width
      const maxMs = next.end_date.getTime() - 60_000;
      const clamped = new Date(Math.max(minMs, Math.min(maxMs, newDate.getTime())));
      const updated = overrides.filter((o) => o.phase_type !== phase.phase_type);
      updated.push({ phase_type: phase.phase_type, end_date: clamped });
      onChange(updated);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (!startDate || !endDate || endDate <= startDate || phases.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Phase Timeline</Label>
        <div className="flex h-10 rounded-lg items-center justify-center border border-dashed border-amber-300 bg-amber-50/50">
          <span className="text-xs text-amber-600">Set valid start and end dates</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium">Phase Timeline</Label>
        <span className="text-[11px] text-muted-foreground">Drag handles to adjust phase deadlines</span>
      </div>
      <div ref={containerRef} className="relative flex h-10 rounded-lg overflow-hidden border border-border/60 select-none">
        {phases.map((phase, idx) => {
          const widthPct = ((phase.end_date.getTime() - phase.start_date.getTime()) / totalMs) * 100;
          const isCustom = phase.is_user_customized;
          return (
            <div
              key={phase.phase_type}
              className={`${COLORS[idx]} flex items-center justify-center relative ${isCustom ? "ring-2 ring-inset ring-white/40" : ""}`}
              style={{ width: `${widthPct}%` }}
              title={`${phase.name}: ${format(phase.start_date, "MMM d")} → ${format(phase.end_date, "MMM d")}`}
            >
              <span className="text-[11px] text-white font-semibold truncate px-1 pointer-events-none">
                {phase.name.split(" ")[0]}
              </span>
            </div>
          );
        })}
        {/* 5 boundary handles between 6 phases */}
        {phases.slice(0, -1).map((phase, idx) => {
          const leftPct = ((phase.end_date.getTime() - startDate.getTime()) / totalMs) * 100;
          return (
            <div
              key={`handle-${phase.phase_type}`}
              role="slider"
              aria-label={`Boundary after ${phase.name}`}
              aria-valuemin={startDate.getTime()}
              aria-valuemax={endDate.getTime()}
              aria-valuenow={phase.end_date.getTime()}
              tabIndex={0}
              className="absolute top-0 h-full w-2 -translate-x-1/2 cursor-ew-resize bg-white/0 hover:bg-white/30 active:bg-white/50 transition-colors"
              style={{ left: `${leftPct}%` }}
              onPointerDown={(e) => startDrag(idx, e)}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{format(startDate, "MMM d")}</span>
        <span>{format(endDate, "MMM d, yyyy")}</span>
      </div>
    </div>
  );
}
```

**Step 4: Run — expect pass**

```bash
npm test -- editable-phase-timeline
```

**Step 5: Commit**

```bash
git add src/app/dashboard/cycles/new/editable-phase-timeline.tsx src/app/dashboard/cycles/new/__tests__/editable-phase-timeline.test.tsx
git commit -m "feat(cycles): editable phase timeline with drag handles"
```

---

### Task 7: Wire `EditablePhaseTimeline` into the cycle wizard

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

**Step 1: Add overrides state**

Around line 220 (alongside `startDate`/`endDate` state), add:

```tsx
import { PhaseOverride } from "@/lib/cycle-phases";
// ...
const [phaseOverrides, setPhaseOverrides] = useState<PhaseOverride[]>([]);
```

**Step 2: Replace the timeline component usage**

At line 845, change:

```tsx
<PhaseTimelinePreview startDate={startDate} endDate={endDate} />
```

to:

```tsx
<EditablePhaseTimeline
  startDate={startDate}
  endDate={endDate}
  overrides={phaseOverrides}
  onChange={setPhaseOverrides}
/>
```

Add the import at the top of the file:

```tsx
import { EditablePhaseTimeline } from "./editable-phase-timeline";
```

**Step 3: Use overrides when inserting phases**

Replace the phase insert at lines 532-545 with:

```tsx
if (startDate && endDate) {
  const { computePhaseRanges } = await import("@/lib/cycle-phases");
  const ranges = computePhaseRanges(startDate, endDate, phaseOverrides);
  const phases = ranges.map((p, idx) => ({
    cycle_id: cycleId,
    phase_type: p.phase_type,
    name: p.name,
    start_date: p.start_date.toISOString(),
    end_date: p.end_date.toISOString(),
    status: "pending",
    sort_order: idx,
    is_user_customized: p.is_user_customized,
  }));
  await supabase.from("cycle_phases").insert(phases);
}
```

**Step 4: Restore overrides on draft load**

Find where the draft is loaded (around line 280-310). After loading, fetch any existing user-customized phases for this draft cycle:

```tsx
if (draft.id) {
  const { data: customPhases } = await supabase
    .from("cycle_phases")
    .select("phase_type, end_date, is_user_customized")
    .eq("cycle_id", draft.id)
    .eq("is_user_customized", true);
  if (customPhases?.length) {
    setPhaseOverrides(customPhases.map((p: any) => ({
      phase_type: p.phase_type,
      end_date: new Date(p.end_date),
    })));
  }
}
```

**Step 5: Manual smoke test**

```bash
npm run dev
```
Open `/dashboard/cycles/new`. Set valid start/end dates. Confirm:
- Bands render
- Five visible drag handles
- Dragging a handle shifts the adjacent phase widths
- The customized phase gets a white inset ring
- Reloading the page (after auto-save) preserves overrides

Stop the server.

**Step 6: Commit**

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat(cycles): wire editable timeline into cycle creation wizard"
```

---

## Track C: Cycle detail page — per-phase deadline editing post-launch

### Task 8: Phase row component with inline date editor

**Files:**
- Create: `src/app/dashboard/cycles/[id]/phase-deadline-editor.tsx`
- Create: `src/app/dashboard/cycles/[id]/__tests__/phase-deadline-editor.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhaseDeadlineEditor } from "../phase-deadline-editor";

describe("<PhaseDeadlineEditor>", () => {
  const phase = {
    id: "p1",
    name: "Self Assessment",
    phase_type: "self_assessment",
    status: "active" as const,
    start_date: "2026-06-01T00:00:00Z",
    end_date: "2026-07-01T00:00:00Z",
    is_user_customized: false,
  };

  it("shows phase name and current deadline", () => {
    render(<PhaseDeadlineEditor phase={phase} canEdit={true} cycleId="c1" />);
    expect(screen.getByText(/Self Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/Jul 1/i)).toBeInTheDocument();
  });

  it("hides edit button when canEdit=false", () => {
    render(<PhaseDeadlineEditor phase={phase} canEdit={false} cycleId="c1" />);
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });
});
```

**Step 2: Run — expect failure**

**Step 3: Implement**

```tsx
// src/app/dashboard/cycles/[id]/phase-deadline-editor.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Pencil, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { createBrowserClient } from "@supabase/ssr";

interface Phase {
  id: string;
  name: string;
  phase_type: string;
  status: "pending" | "active" | "completed";
  start_date: string;
  end_date: string;
  is_user_customized: boolean;
}

interface Props {
  phase: Phase;
  canEdit: boolean;
  cycleId: string;
  onUpdated?: (newEndDate: Date) => void;
}

export function PhaseDeadlineEditor({ phase, canEdit, cycleId, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(new Date(phase.end_date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data, error: rpcErr } = await supabase.rpc("update_cycle_phase_dates", {
      p_cycle_id: cycleId,
      p_phase_dates: [{
        phase_id: phase.id,
        start_date: phase.start_date,
        end_date: draftDate.toISOString(),
      }],
    });
    setSaving(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    if (data?.errors?.length) {
      setError(data.errors[0]);
      return;
    }
    setEditing(false);
    onUpdated?.(draftDate);
  }

  const statusColor =
    phase.status === "active" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
    phase.status === "completed" ? "text-muted-foreground bg-muted border-border" :
    "text-sky-700 bg-sky-50 border-sky-200";

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{phase.name}</span>
        <Badge variant="outline" className={statusColor}>{phase.status}</Badge>
        {phase.is_user_customized && (
          <span className="text-[10px] text-muted-foreground italic">(customized)</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {format(new Date(phase.start_date), "MMM d")} → {format(new Date(phase.end_date), "MMM d, yyyy")}
        </span>
        {canEdit && phase.status !== "completed" && (
          <Popover open={editing} onOpenChange={setEditing}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Edit deadline">
                <Pencil className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={draftDate}
                onSelect={(d) => d && setDraftDate(d)}
                fromDate={new Date(phase.start_date)}
              />
              {error && <p className="px-3 pb-2 text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 p-2 border-t">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run — expect pass**

**Step 5: Commit**

```bash
git add src/app/dashboard/cycles/[id]/phase-deadline-editor.tsx src/app/dashboard/cycles/[id]/__tests__/phase-deadline-editor.test.tsx
git commit -m "feat(cycles): inline per-phase deadline editor for cycle detail"
```

---

### Task 9: Add a "Phases" section to cycle detail page

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/page.tsx`

**Step 1: Import and render**

Find where phases are already loaded (`getCyclePhases` at line 44). Below the existing cycle metadata section, render:

```tsx
import { PhaseDeadlineEditor } from "./phase-deadline-editor";
import { isHROrAbove } from "@/lib/roles";

// ...inside the page component, after metadata cards:

const canEditPhases = isHROrAbove(workspace?.role) && cycle.status !== "completed";

<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      Phases & Deadlines
    </CardTitle>
    <CardDescription className="text-xs">
      Drag handles in the timeline view, or click the pencil to edit a deadline.
    </CardDescription>
  </CardHeader>
  <CardContent>
    {phases.map((p) => (
      <PhaseDeadlineEditor
        key={p.id}
        phase={p}
        canEdit={canEditPhases}
        cycleId={cycle.id}
      />
    ))}
  </CardContent>
</Card>
```

**Step 2: Manual smoke test**

```bash
npm run dev
```
Open an existing active cycle as HR. Confirm the Phases section renders with one row per phase, each with status badge, date range, and edit button. Edit a future phase, save — popover closes, date updates. Edit a past phase — confirm the edit button is hidden for status=completed.

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/[id]/page.tsx
git commit -m "feat(cycles): add per-phase deadline editor to cycle detail page"
```

---

## Track D: Reminder targeting — Nami uses phase deadlines

### Task 10: Add a feature flag for phase-based reminders

**Why:** Reminder logic is the riskiest change. We gate it behind a workspace flag so we can ship UI now and flip reminder semantics on a per-workspace basis.

**Files:**
- Create: `supabase/migrations/20260501_03_workspace_phase_deadline_flag.sql`

**Step 1: Write migration**

```sql
-- Workspace-level flag controlling whether Nami targets reminders at the
-- active phase's end_date (true) or the legacy cycles.review_deadline (false).
-- Default false during rollout; flip workspace-by-workspace.

alter table workspaces
  add column if not exists phase_deadline_reminders_enabled boolean not null default false;

comment on column workspaces.phase_deadline_reminders_enabled is
  'When true, Nami reminder cron uses cycle_phases.end_date for the active phase as the deadline target. When false, falls back to legacy cycles.review_deadline.';
```

**Step 2: Apply**

```bash
supabase db reset
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260501_03_workspace_phase_deadline_flag.sql
git commit -m "feat(cycles): workspace flag for phase-based reminders"
```

---

### Task 11: Update Nami reminder query to use active-phase deadline

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`

**Step 1: Locate the reminder query**

```bash
grep -n "review_deadline\|reminder\|escalation" supabase/functions/nami-bot/index.ts | head -30
```

**Step 2: Update the deadline source**

Wherever the function picks `review_deadline` from the cycle to compute "days until deadline", replace with this priority order:

```typescript
// Pseudo-code — adapt to actual function structure
async function getDeadlineForCycle(supabase, cycleId, workspaceId) {
  const { data: ws } = await supabase
    .from("workspaces")
    .select("phase_deadline_reminders_enabled")
    .eq("id", workspaceId)
    .single();

  if (ws?.phase_deadline_reminders_enabled) {
    const { data: activePhase } = await supabase
      .from("cycle_phases")
      .select("end_date")
      .eq("cycle_id", cycleId)
      .eq("status", "active")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (activePhase?.end_date) return new Date(activePhase.end_date);
  }
  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("review_deadline, end_date")
    .eq("id", cycleId)
    .single();
  return cycle?.review_deadline ? new Date(cycle.review_deadline) : new Date(cycle.end_date);
}
```

Use this helper everywhere the function currently reads `review_deadline`.

**Step 3: Deploy the function locally**

```bash
supabase functions serve nami-bot
```

**Step 4: Manually trigger a reminder against a test cycle with the flag on, observe logs**

```bash
curl -X POST 'http://localhost:54321/functions/v1/nami-bot' \
  -H 'Authorization: Bearer SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"action":"run_reminders"}'
```
Expected: log lines show the active-phase deadline is being used (after flag flip).

**Step 5: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat(nami): use active-phase deadline when workspace flag is on"
```

---

### Task 12: Vitest test for `getDeadlineForCycle` helper

**Files:**
- Refactor: extract `getDeadlineForCycle` into `supabase/functions/nami-bot/_lib/deadlines.ts`
- Create: `supabase/functions/nami-bot/_lib/__tests__/deadlines.test.ts`

**Step 1: Extract** the helper to a separate module so it's testable without HTTP mock.

**Step 2: Write the test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { getDeadlineForCycle } from "../deadlines";

function mockSupabase(data: Record<string, any>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: data[table] }),
          eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: data[table] }) }) }) }),
        }),
      }),
    }),
  };
}

describe("getDeadlineForCycle", () => {
  it("uses active phase end_date when flag enabled", async () => {
    const sb = mockSupabase({
      workspaces: { phase_deadline_reminders_enabled: true },
      cycle_phases: { end_date: "2026-08-15T00:00:00Z" },
    });
    const d = await getDeadlineForCycle(sb as any, "c1", "w1");
    expect(d.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("falls back to cycle.review_deadline when flag disabled", async () => {
    const sb = mockSupabase({
      workspaces: { phase_deadline_reminders_enabled: false },
      performance_cycles: { review_deadline: "2026-09-01T00:00:00Z", end_date: "2026-09-30T00:00:00Z" },
    });
    const d = await getDeadlineForCycle(sb as any, "c1", "w1");
    expect(d.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
```

**Step 3: Run — expect pass**

```bash
npm test -- deadlines.test
```

**Step 4: Commit**

```bash
git add supabase/functions/nami-bot/_lib/deadlines.ts supabase/functions/nami-bot/_lib/__tests__/deadlines.test.ts
git commit -m "test(nami): cover phase-deadline fallback logic"
```

---

## Track E: Verification + rollout

### Task 13: End-to-end manual verification

**Step 1:** Boot the app + a clean Supabase.

```bash
supabase db reset
npm run dev
```

**Step 2:** Walk through the full flow as HR:

1. Create a new cycle: name, dates (start = today, end = today + 90 days), submit Step 1.
2. Confirm timeline shows 6 colored bands with 5 drag handles.
3. Drag the handle between Self Assessment and Peer Review → Self Assessment band gets wider.
4. Continue through People, Questions, Nami, Review.
5. Launch the cycle.
6. On the cycle detail page, find the "Phases & Deadlines" section.
7. Confirm Self Assessment row shows the customized end_date (with "(customized)" italic label).
8. Click the pencil icon on Manager Review, push its deadline 7 days later, save → row updates.
9. Try setting Manager Review end before its start: error appears in popover.
10. Flip `workspaces.phase_deadline_reminders_enabled = true` for the test workspace.
11. Trigger a manual reminder run via the dashboard (or invoke nami-bot directly).
12. Inspect `notification_log` — entries should reference the active phase's end_date.

**Step 3:** Document any quirks found in `docs/sprint-1-test-notes.md` (delete before merge).

**Step 4:** Commit any incidental fixes.

---

### Task 14: Update docs and changelog

**Files:**
- Modify (or create): `README.md` cycle section, or wherever HR-facing cycle docs live
- Create entries for help-center docs if applicable

**Step 1:** Find the cycle docs.

```bash
grep -rln "review_deadline\|cycle deadline" docs/ src/app/help-center/ 2>/dev/null | head
```

**Step 2:** Add a short note: "As of Sprint 1, deadlines are configured per-phase in the cycle wizard timeline. The cycle-level Review Deadline is now optional and represents the final phase's end date."

**Step 3:** Commit.

```bash
git add docs/ src/app/help-center/
git commit -m "docs(cycles): per-phase deadlines"
```

---

### Task 15: Open the PR

**Step 1:** Push and open PR.

```bash
git push -u origin sprint-1-per-phase-deadlines
gh pr create --title "Sprint 1: Per-phase deadlines for review cycles" --body "$(cat <<'EOF'
## Summary
- Replace single global cycle deadline with editable per-phase deadlines
- Drag-to-resize timeline in cycle creation wizard
- Inline pencil-edit per phase on cycle detail page (HR/admin only)
- Workspace flag (`phase_deadline_reminders_enabled`) gates Nami's switch from cycle-level to phase-level deadline targeting

## Test plan
- [ ] `npm test` green
- [ ] Can drag timeline handles to customize phase boundaries
- [ ] Customized phases marked with "(customized)" badge
- [ ] RPC rejects out-of-order dates
- [ ] HR can edit future phase deadlines on detail page; non-HR cannot see edit button
- [ ] Reminders use phase deadline when flag is on; cycle deadline when flag is off

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 2:** Roll out: flip `phase_deadline_reminders_enabled = true` on internal/staging workspace first, then progressively for customers after one full reminder cycle (~24h) shows healthy logs.

---

## Notes for the implementing engineer

1. **Don't delete `cycles.review_deadline` yet.** It's still used by some reminder code paths and by the dashboard urgency banner. We'll deprecate in Sprint 5 once the flag has been on everywhere for two cycles.
2. **Soft enforcement is already correct.** `progress_cycle_phases()` advances phases past their `end_date` regardless of submissions. `review_responses` aren't blocked until the cycle status is `completed`. Don't introduce new blocking — that's the v2 "hold cycle open" feature in Sprint 5.
3. **Drag UX:** boundary handle is 8px wide and centered on the boundary; cursor changes to `ew-resize`. We're using raw pointer events not `@dnd-kit` here — the latter is overkill for 1-axis constrained drag. Keep it simple.
4. **Don't over-test the React drag behavior.** The pure helper (`computePhaseRanges`) covers the math. Component test only verifies render structure (handles count, band names). Real drag is a manual-test concern.
5. **TypeScript types:** if `is_user_customized` shows as missing on inserts, ensure types were regenerated (Task 3) and that any custom typed wrappers around the table include the new field.

---

## Estimated time

| Track | Tasks | Hours |
|---|---|---|
| A: Schema + RPC | 1–4 | 4 |
| B: Wizard timeline | 5–7 | 8 |
| C: Detail page editor | 8–9 | 4 |
| D: Reminder targeting | 10–12 | 6 |
| E: Verification/rollout | 13–15 | 4 |
| **Total** | | **~26h** = 1 sprint at 80% capacity |
