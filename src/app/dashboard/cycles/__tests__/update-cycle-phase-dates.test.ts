import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// These tests run against a local Supabase. Skip if NEXT_PUBLIC_SUPABASE_URL
// points to a remote (.supabase.co) — safety guard so we never write to prod.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const skip = !url || !serviceKey || url.includes(".supabase.co");

(skip ? describe.skip : describe)("update_cycle_phase_dates RPC", () => {
  // Construct lazily so a missing url/serviceKey (skip path) doesn't throw at load time.
  const supabase = createClient(url ?? "http://localhost", serviceKey ?? "anon", { auth: { persistSession: false } });

  let cycleId: string;
  let phaseIds: string[] = [];
  const testWorkspaceId = "00000000-0000-0000-0000-000000000001"; // seed fixture; create if missing

  beforeAll(async () => {
    // Ensure a workspace fixture exists. Use upsert to be idempotent.
    await supabase.from("workspaces").upsert({ id: testWorkspaceId, name: "Test workspace" }, { onConflict: "id" });

    // Create a test cycle with 3 phases
    const { data: cycle } = await supabase
      .from("performance_cycles")
      .insert({
        workspace_id: testWorkspaceId,
        name: "RPC test cycle " + Date.now(),
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

  it("returns structured error for non-array input", async () => {
    const { data } = await supabase.rpc("update_cycle_phase_dates", {
      p_cycle_id: cycleId,
      p_phase_dates: null as any,
    });
    expect(data.updated).toBe(0);
    expect(data.errors[0]).toMatch(/must be a JSON array/);
  });
});
