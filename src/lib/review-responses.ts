/**
 * What counts as reviewer input worth persisting.
 *
 * There are two review-writing surfaces — /dashboard/reviews/[id] (1-5 pills)
 * and /dashboard/cycles/[id]/review/[assignmentId] (stars) — and both used to
 * decide this inline, both the same wrong way: they only persisted a
 * competency when it had a `rating`, so a comment typed against an unrated
 * competency was silently discarded. On the pills surface the UI then showed a
 * green "Saved" and cleared its unsaved-changes guard; on the stars surface the
 * comment survived in the autosaved draft right up until submit, then vanished
 * from the submitted review for good.
 *
 * The rule lives here so the two surfaces cannot drift apart again, and so it
 * can be tested without standing up a React tree and a Supabase mock.
 *
 * Schema note: `review_responses.rating` is nullable and its CHECK constraint
 * (rating >= 1 AND rating <= 5) passes on NULL, and the INSERT policy
 * `reviewer_role_matches_relationship_and_phase_active` does not reference
 * rating at all — so a comment-only row is legal at every layer.
 */

/**
 * A comment reduced to what should reach the database: `null` unless the
 * reviewer actually typed something. Whitespace-only input is not input.
 *
 * The original (non-trimmed) text is returned rather than the trimmed copy, so
 * a reviewer's deliberate formatting — indented lists, blank lines between
 * paragraphs — survives the round trip.
 */
export function normalizeComment(comment: string | null | undefined): string | null {
  return comment?.trim() ? comment : null;
}

/**
 * Should this competency produce a row?
 *
 * Yes if the reviewer supplied a rating, or a comment, or if a row already
 * exists — an existing row must still be written so that *clearing* a rating
 * or a comment persists the clearance rather than silently leaving the old
 * value behind.
 */
export function shouldPersistResponse(input: {
  rating: number | null;
  comment: string | null | undefined;
  hasExistingRow?: boolean;
}): boolean {
  return (
    input.rating !== null ||
    normalizeComment(input.comment) !== null ||
    input.hasExistingRow === true
  );
}
