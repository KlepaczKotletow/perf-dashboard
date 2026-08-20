import { redirect, permanentRedirect } from "next/navigation";
import { reviewHref } from "@/lib/review-links";

/**
 * Permanent redirect to the one review surface.
 *
 * This route used to render a second, divergent review form — amber stars,
 * localStorage drafts, its own authorization — for the same job as
 * /dashboard/reviews/[id]. Which form a reviewer got depended on which link
 * they clicked, and a draft started on one was invisible to the other.
 *
 * The route itself has to survive the merge rather than be deleted: it is
 * linked from pages users have bookmarked, and `permanentRedirect` keeps those
 * working while telling crawlers and the browser where the review really lives.
 *
 * No Slack edge function has ever emitted this URL — they all point at
 * /dashboard/reviews/${assignmentId} — so delivered DMs are unaffected. That is
 * what made this the route to fold, rather than the other one.
 */
export default async function CycleReviewRedirect({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;

  // A malformed URL should not become a redirect loop.
  if (!assignmentId) redirect(`/dashboard/cycles/${id}`);

  permanentRedirect(reviewHref(assignmentId, { from: "cycle", cycleId: id }));
}
