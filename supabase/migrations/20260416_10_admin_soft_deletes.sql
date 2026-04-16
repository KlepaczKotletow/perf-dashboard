-- Phase 3: soft-delete columns on admin taxonomy entities so archiving a
-- Level / Department / Job Family no longer orphans referenced users or
-- competencies. Matches Lattice / Leapsome behaviour where taxonomy entities
-- are never hard-deleted — they're archived and excluded from new usage
-- while preserving historical integrity.

ALTER TABLE public.levels         ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.departments    ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.job_families   ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Partial indexes accelerate the common "show active only" list queries.
CREATE INDEX IF NOT EXISTS idx_levels_active_workspace
  ON public.levels (workspace_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_departments_active_workspace
  ON public.departments (workspace_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_families_active_workspace
  ON public.job_families (workspace_id) WHERE archived_at IS NULL;
