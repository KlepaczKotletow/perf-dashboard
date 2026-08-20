import { resolveReviewerRole } from "./review-access";

/**
 * "Which reviews do I owe?" — defined once.
 *
 * Four surfaces answered this question and no two agreed:
 *
 *   /dashboard/performance   self + manager + upward, every pending assignment
 *   /dashboard/my-team       manager reviews only, direct reports only, and
 *                            `.find()` — so ONE assignment per report, meaning a
 *                            report with assignments in two active cycles was
 *                            counted once
 *   /dashboard/reviews       every assignment in the viewer's subtree, grouped
 *                            by cycle, with a 500-row cap
 *   /dashboard               its own summary
 *
 * The counts are what users notice: a manager reads "3 reviews you owe" on one
 * page and sees four rows on another, and stops trusting both.
 *
 * This does not try to unify what each surface *shows* — Team Overview is about
 * a team and the personal queue is about a person, and that difference is real.
 * It unifies what "owed" means, so the numbers can differ in scope without
 * differing in definition.
 */

export interface OwedReviewInput {
  employeeId: string | null;
  managerId: string | null;
  reviewerId: string | null;
  assignmentType: string | null;
  /** review_assignments.status */
  status: string | null;
  /** performance_cycles.status */
  cycleStatus: string | null;
}

/**
 * Do I still owe this review?
 *
 * Three conditions, and all three are load-bearing:
 *  - I hold a real reviewer role on it (reusing the same resolver the review
 *    form and its authorization gate use, so "owed" can never include something
 *    the form would refuse to open),
 *  - the cycle is still active — a closed cycle is not work, it is history,
 *  - it is not already finished.
 *
 * Deliberately NOT checking the phase lock. Phase state changes under the user
 * and a review whose phase is briefly shut is still work they owe; hiding it
 * from the count would make the number flicker. The form is where a closed
 * phase gets explained.
 */
export function isOwedBy(a: OwedReviewInput, viewerId: string | null | undefined): boolean {
  if (!viewerId) return false;
  if (a.cycleStatus !== "active") return false;
  if (a.status === "completed") return false;
  return resolveReviewerRole(a, viewerId) !== null;
}

/** Every review in `list` that `viewerId` still owes. */
export function owedBy<T extends OwedReviewInput>(list: T[], viewerId: string | null | undefined): T[] {
  return list.filter((a) => isOwedBy(a, viewerId));
}
