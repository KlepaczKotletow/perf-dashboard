import { describe, it, expect } from "vitest";
import { cycleStallState, phaseLabel, type StallPhase } from "../cycle-stall";

const NOW = new Date("2026-08-21T12:00:00Z");

function phase(over: Partial<StallPhase> = {}): StallPhase {
  return {
    phaseType: "manager_review",
    status: "pending",
    startDate: "2026-06-06T12:00:00Z",
    endDate: "2026-06-14T08:00:00Z",
    ...over,
  };
}

/** The shape of the real "Q2 2026" cycle that held for three months. */
function lapsedSchedule(): StallPhase[] {
  return [
    phase({ phaseType: "goal_setting", status: "active", startDate: "2026-05-14T00:00:00Z", endDate: "2026-05-17T22:00:00Z" }),
    phase({ phaseType: "self_assessment", startDate: "2026-05-17T22:00:00Z", endDate: "2026-05-25T18:00:00Z" }),
    phase({ phaseType: "manager_review", startDate: "2026-06-06T12:00:00Z", endDate: "2026-06-14T08:00:00Z" }),
    phase({ phaseType: "communication", startDate: "2026-06-22T04:00:00Z", endDate: "2026-06-30T00:00:00Z" }),
  ];
}

describe("cycleStallState", () => {
  it("flags a cycle whose whole schedule has lapsed with work outstanding", () => {
    const s = cycleStallState("active", lapsedSchedule(), NOW);
    expect(s.stalled).toBe(true);
    // The earliest unfinished started phase — the same one the nightly job
    // holds on, so the message matches what the database actually did.
    expect(s.heldPhase).toBe("goal_setting");
    expect(s.daysOverdue).toBe(95);
  });

  it("does not flag a cycle whose schedule is still live", () => {
    const phases = [
      phase({ phaseType: "goal_setting", status: "completed", startDate: "2026-08-01T00:00:00Z", endDate: "2026-08-10T00:00:00Z" }),
      phase({ phaseType: "manager_review", status: "active", startDate: "2026-08-15T00:00:00Z", endDate: "2026-08-30T00:00:00Z" }),
    ];
    expect(cycleStallState("active", phases, NOW).stalled).toBe(false);
  });

  it("does not flag a cycle that has not started yet", () => {
    const phases = [
      phase({ phaseType: "goal_setting", startDate: "2026-09-01T00:00:00Z", endDate: "2026-09-10T00:00:00Z" }),
    ];
    expect(cycleStallState("active", phases, NOW).stalled).toBe(false);
  });

  it("does not flag a cycle with no work left", () => {
    const phases = lapsedSchedule().map((p) => ({ ...p, status: "completed" }));
    expect(cycleStallState("active", phases, NOW).stalled).toBe(false);
  });

  it("only considers running cycles", () => {
    for (const status of ["closed", "completed", "draft", null]) {
      expect(cycleStallState(status, lapsedSchedule(), NOW).stalled).toBe(false);
    }
  });

  it("handles a cycle with no phases at all", () => {
    expect(cycleStallState("active", [], NOW).stalled).toBe(false);
  });

  it("reports no daysOverdue when the held phase has no end date", () => {
    const phases = [
      phase({ phaseType: "goal_setting", status: "active", startDate: "2026-05-14T00:00:00Z", endDate: null }),
    ];
    const s = cycleStallState("active", phases, NOW);
    expect(s.stalled).toBe(true);
    expect(s.daysOverdue).toBeNull();
  });

  it("ignores unparseable dates rather than throwing", () => {
    const phases = [phase({ startDate: "not-a-date", endDate: "also-not" })];
    expect(() => cycleStallState("active", phases, NOW)).not.toThrow();
  });

  it("treats a window boundary as live, not stalled", () => {
    // A phase ending exactly now is still open; the job will move it tomorrow.
    const phases = [
      phase({ phaseType: "manager_review", status: "active", startDate: "2026-08-01T00:00:00Z", endDate: NOW.toISOString() }),
    ];
    expect(cycleStallState("active", phases, NOW).stalled).toBe(false);
  });
});

describe("phaseLabel", () => {
  it("turns a phase_type into prose", () => {
    expect(phaseLabel("manager_review")).toBe("Manager review");
    expect(phaseLabel("self_assessment")).toBe("Self assessment");
    expect(phaseLabel(null)).toBe("This cycle");
  });
});
