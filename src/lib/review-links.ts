/**
 * The one place a link to a review is built.
 *
 * There used to be two review URLs for one job:
 *
 *   /dashboard/reviews/[id]                          (5 call sites in src/)
 *   /dashboard/cycles/[id]/review/[assignmentId]     (5 call sites in src/)
 *
 * They rendered different forms with different rating controls, different
 * authorization and different draft stores, so which one you got depended on
 * which link you happened to click — start a review from Team Overview, come
 * back to it from Home, and you were looking at a blank form.
 *
 * `/dashboard/reviews/[id]` is the survivor, and the choice was not arbitrary:
 * every Slack deep link already points at it (7 sites in slack-interactivity,
 * one in cycle-notifications), and Slack DMs already delivered are permanent.
 * The cycles route is now a permanent redirect, which is also why this helper
 * exists — so the next new link site cannot quietly reintroduce the fork.
 */

export interface ReviewHrefOptions {
  /**
   * Where the reviewer came from, so the page can offer a back link that
   * returns there instead of guessing.
   */
  from?: "cycle";
  /** Required when `from` is "cycle" — the cycle to return to. */
  cycleId?: string | null;
}

export function reviewHref(assignmentId: string, options: ReviewHrefOptions = {}): string {
  const params = new URLSearchParams();
  if (options.from) params.set("from", options.from);
  if (options.cycleId) params.set("cycleId", options.cycleId);
  const query = params.toString();
  return `/dashboard/reviews/${assignmentId}${query ? `?${query}` : ""}`;
}
