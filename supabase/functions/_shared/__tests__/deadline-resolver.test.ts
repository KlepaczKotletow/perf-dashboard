import { describe, it, expect } from "vitest";
import { getDeadlineForCycle } from "../deadline-resolver";

// A minimal mock of the supabase client surface we use.
function mockSupabase(rows: Record<string, any>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, _val: any) => ({
          single: () => Promise.resolve({ data: rows[table] ?? null, error: null }),
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: rows[`${table}__active_phase`] ?? null, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("getDeadlineForCycle", () => {
  it("returns active phase end_date when flag is enabled and phase exists", async () => {
    const sb = mockSupabase({
      workspaces: { phase_deadline_reminders_enabled: true },
      cycle_phases__active_phase: { end_date: "2026-08-15T00:00:00Z" },
    });
    const d = await getDeadlineForCycle(sb as any, "cycle-1", "ws-1");
    expect(d?.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("falls back to cycle.review_deadline when flag is off", async () => {
    const sb = mockSupabase({
      workspaces: { phase_deadline_reminders_enabled: false },
      performance_cycles: { review_deadline: "2026-09-01T00:00:00Z", end_date: "2026-09-30T00:00:00Z" },
    });
    const d = await getDeadlineForCycle(sb as any, "cycle-1", "ws-1");
    expect(d?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("falls back to cycle.end_date when review_deadline is null (flag on, no active phase)", async () => {
    const sb = mockSupabase({
      workspaces: { phase_deadline_reminders_enabled: true },
      cycle_phases__active_phase: null,
      performance_cycles: { review_deadline: null, end_date: "2026-09-30T00:00:00Z" },
    });
    const d = await getDeadlineForCycle(sb as any, "cycle-1", "ws-1");
    expect(d?.toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });

  it("falls back to cycle.review_deadline when flag is on but no active phase", async () => {
    const sb = mockSupabase({
      workspaces: { phase_deadline_reminders_enabled: true },
      cycle_phases__active_phase: null,
      performance_cycles: { review_deadline: "2026-09-01T00:00:00Z", end_date: "2026-09-30T00:00:00Z" },
    });
    const d = await getDeadlineForCycle(sb as any, "cycle-1", "ws-1");
    expect(d?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("flag off + null review_deadline returns null (not cycle end_date)", async () => {
    const sb = mockSupabase({
      workspaces: { phase_deadline_reminders_enabled: false },
      performance_cycles: { review_deadline: null, end_date: "2026-09-30T00:00:00Z" },
    });
    const d = await getDeadlineForCycle(sb as any, "cycle-1", "ws-1");
    expect(d).toBeNull();
  });

  it("returns null when no source can resolve a date", async () => {
    const sb = mockSupabase({
      workspaces: { phase_deadline_reminders_enabled: false },
      performance_cycles: { review_deadline: null, end_date: null },
    });
    const d = await getDeadlineForCycle(sb as any, "cycle-1", "ws-1");
    expect(d).toBeNull();
  });
});
