import { describe, it, expect } from "vitest";
import {
  assertCanReview,
  resolveReviewerRole,
  phaseTypeForRole,
  type ReviewAssignmentFacts,
} from "../review-access";

const EMP = "emp-1";
const MGR = "mgr-1";
const OTHER = "other-1";

/** An assignment a manager can review right now. */
function facts(over: Partial<ReviewAssignmentFacts> = {}): ReviewAssignmentFacts {
  return {
    employeeId: EMP,
    managerId: MGR,
    reviewerId: null,
    assignmentType: "standard",
    cycleStatus: "active",
    activePhaseTypes: ["manager_review"],
    submittedRoles: [],
    competencyCount: 7,
    ...over,
  };
}

describe("resolveReviewerRole", () => {
  it("gives the subject 'self' and the manager of record 'manager'", () => {
    expect(resolveReviewerRole(facts(), EMP)).toBe("self");
    expect(resolveReviewerRole(facts(), MGR)).toBe("manager");
  });

  it("gives the named reviewer on an upward assignment 'upward'", () => {
    const a = facts({ assignmentType: "upward", reviewerId: OTHER });
    expect(resolveReviewerRole(a, OTHER)).toBe("upward");
  });

  it("returns null for a non-party rather than defaulting to peer", () => {
    // The old cycles route defaulted to "peer", which let a stranger submit a
    // peer review against an assignment that was not theirs.
    expect(resolveReviewerRole(facts(), OTHER)).toBeNull();
  });

  it("returns null for an anonymous viewer", () => {
    expect(resolveReviewerRole(facts(), null)).toBeNull();
    expect(resolveReviewerRole(facts(), undefined)).toBeNull();
  });

  it("prefers self when the subject is also the manager of record", () => {
    const a = facts({ managerId: EMP });
    expect(resolveReviewerRole(a, EMP)).toBe("self");
  });

  it("only calls someone a peer on a standard assignment they are named on", () => {
    const peerable = facts({ reviewerId: OTHER });
    expect(resolveReviewerRole(peerable, OTHER)).toBe("peer");

    // Named reviewer who is actually the subject is not a peer.
    expect(resolveReviewerRole(facts({ reviewerId: EMP }), EMP)).toBe("self");
    // Named reviewer who is actually the manager is not a peer.
    expect(resolveReviewerRole(facts({ reviewerId: MGR }), MGR)).toBe("manager");
  });
});

describe("phaseTypeForRole", () => {
  it("runs upward feedback during the manager-review phase, as the INSERT policy does", () => {
    expect(phaseTypeForRole("upward")).toBe("manager_review");
    expect(phaseTypeForRole("manager")).toBe("manager_review");
    expect(phaseTypeForRole("self")).toBe("self_assessment");
    expect(phaseTypeForRole("peer")).toBe("peer_review");
  });
});

describe("assertCanReview", () => {
  it("lets the manager write during an active manager-review phase", () => {
    const access = assertCanReview(facts(), MGR);
    expect(access).toEqual({ canEdit: true, role: "manager" });
  });

  it("blocks a non-party without revealing anything about the cycle", () => {
    // Even though this cycle is closed AND has no active phase, a stranger is
    // told only that it isn't theirs.
    const a = facts({ cycleStatus: "closed", activePhaseTypes: [] });
    const access = assertCanReview(a, OTHER);
    expect(access.canEdit).toBe(false);
    if (access.canEdit) throw new Error("unreachable");
    expect(access.reason).toBe("not_a_party");
    expect(access.role).toBeNull();
  });

  it("blocks when the cycle is not active", () => {
    for (const cycleStatus of ["closed", "completed", "draft", null]) {
      const access = assertCanReview(facts({ cycleStatus }), MGR);
      expect(access.canEdit).toBe(false);
      if (!access.canEdit) expect(access.reason).toBe("cycle_closed");
    }
  });

  it("blocks when the phase for that role is not open", () => {
    // Self-assessment is open, but this viewer is the manager.
    const a = facts({ activePhaseTypes: ["self_assessment"] });
    const access = assertCanReview(a, MGR);
    expect(access.canEdit).toBe(false);
    if (!access.canEdit) {
      expect(access.reason).toBe("phase_closed");
      // The role is still reported, so the UI can say which phase is needed.
      expect(access.role).toBe("manager");
    }
  });

  it("lets the subject self-review only while self-assessment is open", () => {
    const selfOpen = facts({ activePhaseTypes: ["self_assessment"] });
    expect(assertCanReview(selfOpen, EMP).canEdit).toBe(true);
    expect(assertCanReview(facts(), EMP).canEdit).toBe(false);
  });

  it("blocks a second submission of the same role but not a different one", () => {
    const a = facts({ submittedRoles: ["manager"] });
    const asManager = assertCanReview(a, MGR);
    expect(asManager.canEdit).toBe(false);
    if (!asManager.canEdit) expect(asManager.reason).toBe("already_submitted");

    // The subject has not submitted their self-review, so they are unaffected.
    const selfOpen = facts({ submittedRoles: ["manager"], activePhaseTypes: ["self_assessment"] });
    expect(assertCanReview(selfOpen, EMP).canEdit).toBe(true);
  });

  it("blocks when the cycle has no questions configured", () => {
    const access = assertCanReview(facts({ competencyCount: 0 }), MGR);
    expect(access.canEdit).toBe(false);
    if (!access.canEdit) expect(access.reason).toBe("no_competencies");
  });

  it("lets an upward reviewer write during the manager-review phase", () => {
    const a = facts({ assignmentType: "upward", reviewerId: OTHER, managerId: null });
    const access = assertCanReview(a, OTHER);
    expect(access).toEqual({ canEdit: true, role: "upward" });
  });

  it("carries a message for every blocked reason", () => {
    const cases: ReviewAssignmentFacts[] = [
      facts({ cycleStatus: "closed" }),
      facts({ activePhaseTypes: [] }),
      facts({ submittedRoles: ["manager"] }),
      facts({ competencyCount: 0 }),
    ];
    for (const c of cases) {
      const access = assertCanReview(c, MGR);
      if (!access.canEdit) expect(access.message.length).toBeGreaterThan(0);
    }
    const stranger = assertCanReview(facts(), OTHER);
    if (!stranger.canEdit) expect(stranger.message.length).toBeGreaterThan(0);
  });
});
