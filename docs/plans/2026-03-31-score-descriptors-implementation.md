# Score Descriptors Per Competency — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow HR, admins, and managers to define what each score (1–5) means for each competency, displayed below the expected scores matrix on the function detail page.

**Architecture:** New `competency_score_descriptors` table with RLS. Server-side data fetching in `functions/page.tsx` passes descriptors to the client component. Client component renders a collapsible accordion per competency with 5 editable textarea rows (auto-save on blur via upsert). Tenant isolation via `workspace_id` on every row + RLS policies.

**Tech Stack:** Supabase (PostgreSQL + RLS), Next.js 14 App Router, React, shadcn/ui (Textarea), Tailwind CSS

---

### Task 1: Create the database table and RLS policies

**Files:**
- Create: `supabase/migrations/20260331_competency_score_descriptors.sql`

**Step 1: Create the migration file**

```sql
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
```

**Step 2: Apply the migration via Supabase MCP**

Run the SQL above using the Supabase MCP `apply_migration` tool with name `create_competency_score_descriptors`.

**Step 3: Verify the table exists**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'competency_score_descriptors'
ORDER BY ordinal_position;
```

Expected: 7 columns (id, competency_id, score, description, workspace_id, created_at, updated_at).

**Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260331_competency_score_descriptors.sql
git commit -m "feat: add competency_score_descriptors table with RLS"
```

---

### Task 2: Fetch score descriptors in the functions page

**Files:**
- Modify: `src/app/dashboard/admin/functions/page.tsx`
- Modify: `src/app/dashboard/admin/functions/functions-client.tsx` (types only)

**Step 1: Add the ScoreDescriptor type to functions-client.tsx**

After the existing `LevelCompetency` interface (line 50), add:

```ts
interface ScoreDescriptor { id: string; competency_id: string; score: number; description: string; workspace_id: string; }
```

Update `FunctionsClientProps` (lines 53–61) to include:

```ts
interface FunctionsClientProps {
  functions: JobFamily[];
  levels: Level[];
  competencies: Competency[];
  levelCompetencies: LevelCompetency[];
  scoreDescriptors: ScoreDescriptor[];
  users: User[];
  canEdit: boolean;
  workspaceId: string;
}
```

**Step 2: Fetch descriptors in page.tsx**

In `src/app/dashboard/admin/functions/page.tsx`, add a 6th query to the `Promise.all` (lines 17–29):

```ts
const [
  { data: functions },
  { data: levels },
  { data: competencies },
  { data: levelCompetencies },
  { data: users },
  { data: scoreDescriptors },
] = await Promise.all([
  supabase.from("job_families").select("id, name, description").eq("workspace_id", workspace.workspaceId).order("name"),
  supabase.from("levels").select("id, name, grade, sort_order, job_family_id").eq("workspace_id", workspace.workspaceId).order("sort_order"),
  supabase.from("competencies").select("id, name, description, category, is_core, job_family_id, workspace_id").eq("workspace_id", workspace.workspaceId).order("name"),
  supabase.from("level_competencies").select("id, level_id, competency_id, expected_level, workspace_id").eq("workspace_id", workspace.workspaceId),
  supabase.from("users").select("id, level_id").eq("workspace_id", workspace.workspaceId),
  supabase.from("competency_score_descriptors").select("id, competency_id, score, description, workspace_id").eq("workspace_id", workspace.workspaceId),
]);
```

Pass it to the client component:

```tsx
<FunctionsClient
  functions={functions ?? []}
  levels={levels ?? []}
  competencies={competencies ?? []}
  levelCompetencies={levelCompetencies ?? []}
  scoreDescriptors={scoreDescriptors ?? []}
  users={users ?? []}
  canEdit={canEdit}
  workspaceId={workspace.workspaceId}
/>
```

**Step 3: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/dashboard/admin/functions/page.tsx src/app/dashboard/admin/functions/functions-client.tsx
git commit -m "feat: fetch score descriptors and pass to FunctionsClient"
```

---

### Task 3: Add Score Descriptors UI section to the function detail view

**Files:**
- Modify: `src/app/dashboard/admin/functions/functions-client.tsx`

This is the main UI task. Add a "Score Descriptors" section below the existing scorecard (after line ~1047).

**Step 1: Add Textarea import**

At the top of the file, add to the existing shadcn imports:

```ts
import { Textarea } from "@/components/ui/textarea";
```

**Step 2: Destructure `scoreDescriptors` from props in the main component**

In the `FunctionsClient` function, destructure the new prop:

```ts
export function FunctionsClient({
  functions: initialFunctions,
  levels: initialLevels,
  competencies: initialCompetencies,
  levelCompetencies: initialLevelCompetencies,
  scoreDescriptors: initialScoreDescriptors,
  users: initialUsers,
  canEdit,
  workspaceId,
}: FunctionsClientProps) {
```

Add state for descriptors alongside the existing state:

```ts
const [scoreDescriptors, setScoreDescriptors] = useState<ScoreDescriptor[]>(initialScoreDescriptors);
```

**Step 3: Add the descriptor lookup and save handler**

After the existing `matrixLookup` useMemo (around line 269), add:

```ts
// Score descriptor lookup: "competencyId-score" -> descriptor
const descriptorLookup = useMemo(() => {
  const lookup: Record<string, ScoreDescriptor> = {};
  for (const sd of scoreDescriptors) {
    lookup[`${sd.competency_id}-${sd.score}`] = sd;
  }
  return lookup;
}, [scoreDescriptors]);

// Save a score descriptor (upsert)
async function handleSaveDescriptor(competencyId: string, score: number, description: string) {
  const trimmed = description.trim();
  const key = `${competencyId}-${score}`;
  const existing = descriptorLookup[key];

  // If empty and no existing record, nothing to do
  if (!trimmed && !existing) return;

  // If empty and existing, delete it
  if (!trimmed && existing) {
    const { error } = await supabase
      .from("competency_score_descriptors")
      .delete()
      .eq("id", existing.id);
    if (!error) {
      setScoreDescriptors((prev) => prev.filter((sd) => sd.id !== existing.id));
    }
    return;
  }

  // Upsert
  if (existing) {
    // Update
    if (existing.description === trimmed) return; // no change
    const { error } = await supabase
      .from("competency_score_descriptors")
      .update({ description: trimmed, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (!error) {
      setScoreDescriptors((prev) =>
        prev.map((sd) => sd.id === existing.id ? { ...sd, description: trimmed } : sd)
      );
    }
  } else {
    // Insert
    const { data, error } = await supabase
      .from("competency_score_descriptors")
      .insert({
        competency_id: competencyId,
        score,
        description: trimmed,
        workspace_id: workspaceId,
      })
      .select("id, competency_id, score, description, workspace_id")
      .single();
    if (!error && data) {
      setScoreDescriptors((prev) => [...prev, data]);
    }
  }
}
```

**Step 4: Add state for expanded descriptor accordions**

With the other state declarations:

```ts
const [expandedDescriptorId, setExpandedDescriptorId] = useState<string | null>(null);
```

**Step 5: Add the Score Descriptors section in the JSX**

After the closing `</div>` of the Scorecard section (the one containing the `{/* Scorecard */}` comment, around line 1047), and before the final closing `</div>` tags, add:

```tsx
{/* Score Descriptors */}
{(functionSkills.length > 0 || coreSkills.length > 0) && (
  <div>
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
      Score Descriptors
    </p>
    <div className="rounded-xl border border-border/60 divide-y divide-border/30 overflow-hidden">
      {[...functionSkills, ...coreSkills].map((skill) => {
        const isExpanded = expandedDescriptorId === skill.id;
        const hasDescriptors = scoreDescriptors.some((sd) => sd.competency_id === skill.id);
        return (
          <div key={`desc-${skill.id}`}>
            <button
              type="button"
              onClick={() => setExpandedDescriptorId(isExpanded ? null : skill.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              <span className="text-xs font-medium text-foreground">{skill.name}</span>
              {skill.is_core && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/30 text-primary">Core</Badge>
              )}
              {!hasDescriptors && (
                <span className="text-[10px] text-muted-foreground/50 ml-auto">not defined</span>
              )}
              {hasDescriptors && (
                <span className="text-[10px] text-muted-foreground/50 ml-auto">
                  {scoreDescriptors.filter((sd) => sd.competency_id === skill.id).length}/5 defined
                </span>
              )}
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 space-y-2 bg-muted/10">
                {!hasDescriptors && canEdit && (
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Define what each score means for {skill.name}
                  </p>
                )}
                {[1, 2, 3, 4, 5].map((score) => {
                  const key = `${skill.id}-${score}`;
                  const descriptor = descriptorLookup[key];
                  return (
                    <div key={score} className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 mt-1 border ${proficiencyColors[score]}`}>
                        {score}
                      </div>
                      {canEdit ? (
                        <Textarea
                          defaultValue={descriptor?.description ?? ""}
                          placeholder={`What does a ${score} in ${skill.name} look like?`}
                          className="text-xs min-h-[56px] resize-none flex-1"
                          rows={2}
                          onBlur={(e) => handleSaveDescriptor(skill.id, score, e.target.value)}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground py-2 flex-1">
                          {descriptor?.description || <span className="text-muted-foreground/40 italic">Not defined</span>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
```

**Step 6: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

**Step 7: Run a full build**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx next build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully`

**Step 8: Commit**

```bash
git add src/app/dashboard/admin/functions/functions-client.tsx
git commit -m "feat: add Score Descriptors section with per-competency editable descriptions"
```
