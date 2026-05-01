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
    const overrides = [{ phase_type: "self_assessment" as const, end_date: new Date("2026-07-15T00:00:00Z") }];
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

  it("phase widths match DEFAULT_PHASES proportions when no overrides", () => {
    const phases = computePhaseRanges(start, end, []);
    const totalMs = end.getTime() - start.getTime();
    for (let i = 0; i < phases.length; i++) {
      const widthMs = phases[i].end_date.getTime() - phases[i].start_date.getTime();
      const expectedRatio = DEFAULT_PHASES[i].proportion;
      const actualRatio = widthMs / totalMs;
      // Allow tiny float drift (1ms tolerance over a 92-day window)
      expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.001);
      expect(phases[i].phase_type).toBe(DEFAULT_PHASES[i].phase_type);
    }
  });
});
