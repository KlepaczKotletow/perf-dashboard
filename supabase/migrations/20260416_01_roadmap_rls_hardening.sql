-- Phase 1, audit fix 1.4: close the anon-delete-any-vote hole and bound inserts.
-- Intentional behavior change: votes become append-only until we add nonce-based
-- unvoting. The existing roadmap frontend still attempts DELETE on toggle-off;
-- those calls now silently affect zero rows, and the in-memory toggle reverts on
-- page reload. Tracked as a Phase 6 follow-up.

DROP POLICY IF EXISTS "Public delete own roadmap_votes" ON public.roadmap_votes;

-- Prevent double-voting from a single browser fingerprint on the same item.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vote_per_fingerprint
  ON public.roadmap_votes (item_id, fingerprint);

-- Bound insert sizes (previously WITH CHECK (true), advisor-flagged).
DROP POLICY IF EXISTS "Public insert roadmap_suggestions" ON public.roadmap_suggestions;
CREATE POLICY "public_insert_roadmap_suggestions_bounded"
  ON public.roadmap_suggestions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(title) BETWEEN 1 AND 200
    AND char_length(COALESCE(description, '')) <= 2000
    AND char_length(COALESCE(email, '')) <= 320
  );

DROP POLICY IF EXISTS "Public insert roadmap_votes" ON public.roadmap_votes;
CREATE POLICY "public_insert_roadmap_votes_bounded"
  ON public.roadmap_votes
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    fingerprint IS NOT NULL
    AND char_length(fingerprint) BETWEEN 8 AND 128
  );
