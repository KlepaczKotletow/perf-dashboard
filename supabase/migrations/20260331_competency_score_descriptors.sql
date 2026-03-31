-- Create the competency_score_descriptors table
CREATE TABLE IF NOT EXISTS competency_score_descriptors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 1 AND score <= 5),
  description text NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (competency_id, score)
);

-- Enable RLS
ALTER TABLE competency_score_descriptors ENABLE ROW LEVEL SECURITY;

-- Policy: workspace members can read their own descriptors
CREATE POLICY "Workspace members can view score descriptors"
  ON competency_score_descriptors
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: workspace members can insert score descriptors
CREATE POLICY "Workspace members can insert score descriptors"
  ON competency_score_descriptors
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: workspace members can update their own score descriptors
CREATE POLICY "Workspace members can update score descriptors"
  ON competency_score_descriptors
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: workspace members can delete their own score descriptors
CREATE POLICY "Workspace members can delete score descriptors"
  ON competency_score_descriptors
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Index for fast lookups by competency
CREATE INDEX idx_score_descriptors_competency ON competency_score_descriptors(competency_id);
CREATE INDEX idx_score_descriptors_workspace ON competency_score_descriptors(workspace_id);
