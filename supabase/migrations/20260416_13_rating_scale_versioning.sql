-- Phase 3: rating-scale versioning. Cycles freeze their scale at launch so
-- that changing the workspace's scale later no longer retroactively relabels
-- historical reviews. Matches Lattice / Leapsome behaviour where cycles pin
-- their review configuration at kickoff.

CREATE TABLE IF NOT EXISTS public.rating_scales (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  min_value    integer NOT NULL,
  max_value    integer NOT NULL,
  labels       jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz,
  CONSTRAINT rating_scales_bounds_ok CHECK (max_value > min_value)
);

CREATE INDEX IF NOT EXISTS idx_rating_scales_workspace
  ON public.rating_scales (workspace_id) WHERE archived_at IS NULL;

ALTER TABLE public.rating_scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rating_scales_select_workspace"
  ON public.rating_scales FOR SELECT TO authenticated
  USING (workspace_id = auth_workspace_id());

CREATE POLICY "rating_scales_write_hr_admin"
  ON public.rating_scales FOR ALL TO authenticated
  USING (workspace_id = auth_workspace_id() AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text]))
  WITH CHECK (workspace_id = auth_workspace_id() AND auth_user_role() = ANY (ARRAY['admin'::text, 'hr'::text]));

-- Point-in-time stamps on cycles and workspaces.
ALTER TABLE public.performance_cycles
  ADD COLUMN IF NOT EXISTS rating_scale_id uuid REFERENCES public.rating_scales(id) ON DELETE SET NULL;
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS active_rating_scale_id uuid REFERENCES public.rating_scales(id) ON DELETE SET NULL;

-- Backfill: one rating_scales row per workspace, seeded from the current
-- rating_scale jsonb. Then point every existing cycle at its workspace's scale,
-- and mark that scale as the workspace's active one.
DO $$
DECLARE
  ws RECORD;
  v_scale_id uuid;
  v_min int;
  v_max int;
  v_labels jsonb;
BEGIN
  FOR ws IN SELECT id, rating_scale FROM public.workspaces WHERE active_rating_scale_id IS NULL LOOP
    v_min    := COALESCE((ws.rating_scale->>'min')::int, 1);
    v_max    := COALESCE((ws.rating_scale->>'max')::int, 5);
    v_labels := COALESCE(ws.rating_scale->'labels', '{}'::jsonb);

    INSERT INTO public.rating_scales (workspace_id, min_value, max_value, labels)
    VALUES (ws.id, v_min, v_max, v_labels)
    RETURNING id INTO v_scale_id;

    UPDATE public.workspaces
    SET active_rating_scale_id = v_scale_id
    WHERE id = ws.id;

    UPDATE public.performance_cycles
    SET rating_scale_id = v_scale_id
    WHERE workspace_id = ws.id AND rating_scale_id IS NULL;
  END LOOP;
END $$;
