// Default phase weights (in 12ths). Rebalanced 2026-05-02 to match 15Five's
// published timeline guidance: calibration is committee-scheduling-bound
// (cross-manager meetings) so the previous 1/12 (~3 days on a 6-week cycle)
// was too tight; 2/12 (~1 week) matches the published minimum. The opening
// phase drops to 1/12 since most cycles ratify pre-existing OKRs rather than
// write goals from scratch — the modern HBR consensus (Cappelli, Buckingham)
// and Gallup decouple goal-setting cadence from review cadence.
//
// Naming: phase_type "goal_setting" stays as the DB key for backward compat,
// but the user-facing label is "Goal Check-in" — the phase is a brief moment
// to confirm or refresh existing goals at the start of a review cycle, not
// from-scratch goal authoring (which lives outside the review cadence in the
// modern playbook).
export const DEFAULT_PHASES = [
  { phase_type: "goal_setting" as const,    name: "Goal Check-in",         proportion: 1 / 12 },
  { phase_type: "self_assessment" as const, name: "Self Assessment",        proportion: 2 / 12 },
  { phase_type: "peer_review" as const,     name: "Peer Review",            proportion: 3 / 12 },
  { phase_type: "manager_review" as const,  name: "Manager Review",         proportion: 2 / 12 },
  { phase_type: "calibration" as const,     name: "Calibration",            proportion: 2 / 12 },
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
