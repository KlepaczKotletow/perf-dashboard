/**
 * Who may write a review, and if not, why not.
 *
 * There were two review-writing surfaces with two different answers to this
 * question, and neither matched the database:
 *
 *   /dashboard/cycles/[id]/review/[assignmentId] enforced party + cycle-active
 *   + phase-lock, then defaulted a non-party's role to "peer".
 *
 *   /dashboard/reviews/[id] enforced none of it, and granted edit rights to
 *   `isWorkspaceManager && !isAssignmentEmployee` — any HR user or anyone with
 *   direct reports, on anyone's review. That form could never save: the INSERT
 *   policy `reviewer_role_matches_relationship_and_phase_active` requires the
 *   writer to BE the party whose role they claim, so an HR user editing a
 *   review they were not assigned got an editable form and a permission error
 *   on submit.
 *
 * This module is the single answer, and it is written to agree with that INSERT
 * policy exactly. If the two ever disagree the database wins — so when changing
 * one, change the other.
 *
 * Deliberately pure: it takes facts and returns a verdict, so the rules can be
 * tested without a database, a session, or a React tree.
 */

export type ReviewerRole = "self" | "manager" | "upward" | "peer";

/**
 * Why a review cannot be written. Exhaustive on purpose — every caller renders
 * from this union rather than inventing its own strings, which is how the
 * product ended up with fifteen different status labels.
 */
export type ReviewBlockedReason =
  | "not_a_party"
  | "cycle_closed"
  | "phase_closed"
  | "already_submitted"
  | "no_competencies";

export interface ReviewAssignmentFacts {
  employeeId: string | null;
  managerId: string | null;
  reviewerId: string | null;
  assignmentType: string | null;
  /** performance_cycles.status */
  cycleStatus: string | null;
  /** phase_type of every cycle_phases row currently status='active' on this cycle. */
  activePhaseTypes: string[];
  /** reviewer_roles this viewer has already submitted against this assignment. */
  submittedRoles: string[];
  /** How many competencies the form would render. */
  competencyCount: number;
}

export type ReviewAccess =
  | { canEdit: true; role: ReviewerRole }
  | { canEdit: false; role: ReviewerRole | null; reason: ReviewBlockedReason; message: string };

/**
 * The cycle_phases.phase_type that must be active for a given reviewer role.
 * Mirrors the CASE in the INSERT policy — upward feedback runs during the
 * manager-review phase, not a phase of its own.
 */
export function phaseTypeForRole(role: ReviewerRole): string {
  switch (role) {
    case "self":
      return "self_assessment";
    case "peer":
      return "peer_review";
    case "manager":
    case "upward":
      return "manager_review";
  }
}

/**
 * Which role this viewer legitimately holds on this assignment, or null if they
 * hold none. Null is the important case: the old cycles route defaulted to
 * "peer", which let a non-party submit a peer review against an assignment that
 * was not theirs.
 *
 * Precedence matters when someone holds two roles — a person who is both the
 * subject and the manager of record reviews themselves, so `self` wins.
 */
export function resolveReviewerRole(
  a: Pick<ReviewAssignmentFacts, "employeeId" | "managerId" | "reviewerId" | "assignmentType">,
  viewerId: string | null | undefined
): ReviewerRole | null {
  if (!viewerId) return null;

  if (a.assignmentType === "upward" && a.reviewerId === viewerId) return "upward";
  if (a.employeeId === viewerId) return "self";
  if (a.managerId === viewerId) return "manager";
  // A peer is the named reviewer on a standard assignment who is neither the
  // subject nor their manager. No code path creates these yet — assignment_type
  // is only ever 'standard' or 'upward' in production — but the rule matches the
  // policy so the surface works the day peer review ships.
  if (
    a.assignmentType === "standard" &&
    a.reviewerId === viewerId &&
    a.employeeId !== viewerId &&
    a.managerId !== viewerId
  ) {
    return "peer";
  }
  return null;
}

const BLOCKED_MESSAGE: Record<ReviewBlockedReason, string> = {
  not_a_party: "This review isn't assigned to you.",
  cycle_closed: "This cycle is closed, so reviews can no longer be submitted.",
  phase_closed:
    "This review's phase isn't open right now. Your draft is saved — an admin can reopen the phase.",
  already_submitted: "You've already submitted this review.",
  no_competencies:
    "No review questions are set up for this cycle yet. Ask an admin to add competencies or questions.",
};

/**
 * The one gate. Order is deliberate: identity first (never tell a stranger
 * anything about the cycle), then the reasons the reviewer can do nothing
 * about, then the ones they can.
 */
export function assertCanReview(
  a: ReviewAssignmentFacts,
  viewerId: string | null | undefined
): ReviewAccess {
  const role = resolveReviewerRole(a, viewerId);
  if (!role) {
    return { canEdit: false, role: null, reason: "not_a_party", message: BLOCKED_MESSAGE.not_a_party };
  }

  const block = (reason: ReviewBlockedReason): ReviewAccess => ({
    canEdit: false,
    role,
    reason,
    message: BLOCKED_MESSAGE[reason],
  });

  if (a.cycleStatus !== "active") return block("cycle_closed");
  if (!a.activePhaseTypes.includes(phaseTypeForRole(role))) return block("phase_closed");
  if (a.submittedRoles.includes(role)) return block("already_submitted");
  if (a.competencyCount <= 0) return block("no_competencies");

  return { canEdit: true, role };
}
