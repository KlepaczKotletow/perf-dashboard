# Templates Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 built-in system templates, template editing, duplication, and integrate templates into the cycle creation wizard.

**Architecture:** Add `is_system` column to templates table. Seed system templates on first visit to templates page. Add edit mode to detail page. Add template picker dropdown in cycle wizard Step 3.

**Tech Stack:** Next.js 14, shadcn/ui, Supabase (Postgres), Tailwind CSS

---

### Task 1: Database Migration — Add is_system column

**Files:**
- Create: `supabase/migrations/YYYYMMDD_add_is_system_to_templates.sql`

**Step 1: Apply migration**

Use Supabase MCP `apply_migration`:

```sql
ALTER TABLE templates
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
```

**Step 2: Verify**

Run `execute_sql`: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'is_system';`

---

### Task 2: Seed system templates on templates page

**Files:**
- Modify: `src/app/dashboard/templates/page.tsx`

**Context:** The templates list page fetches templates at lines 9-18. We need to check if system templates exist for this workspace and seed them if not.

**Step 1: Define the 6 built-in templates as a constant**

Add at the top of the file (after imports):

```tsx
const SYSTEM_TEMPLATES = [
  {
    name: "Annual Performance Review",
    description: "Comprehensive yearly evaluation covering core competencies and growth areas",
    questions: [
      { id: "sys-1-1", type: "rating", text: "Leadership — ability to guide and inspire others", required: true },
      { id: "sys-1-2", type: "rating", text: "Communication — clarity and effectiveness in sharing information", required: true },
      { id: "sys-1-3", type: "rating", text: "Execution — ability to deliver results on time and at quality", required: true },
      { id: "sys-1-4", type: "rating", text: "Collaboration — works effectively with others across teams", required: true },
      { id: "sys-1-5", type: "rating", text: "Innovation — brings new ideas and improves processes", required: true },
      { id: "sys-1-6", type: "text", text: "What were this person's biggest accomplishments this year?", required: true },
      { id: "sys-1-7", type: "text", text: "What areas should they focus on for growth?", required: true },
    ],
  },
  {
    name: "Mid-Year Check-in",
    description: "Lightweight mid-cycle review to course-correct and celebrate progress",
    questions: [
      { id: "sys-2-1", type: "rating", text: "Goal Progress — on track to meet annual objectives", required: true },
      { id: "sys-2-2", type: "rating", text: "Collaboration — contributes positively to team dynamics", required: true },
      { id: "sys-2-3", type: "rating", text: "Initiative — proactively identifies and solves problems", required: true },
      { id: "sys-2-4", type: "text", text: "What's going well since the last review?", required: true },
      { id: "sys-2-5", type: "text", text: "What support do you need for the rest of the year?", required: true },
    ],
  },
  {
    name: "90-Day Probation Review",
    description: "Structured evaluation for new hires at the end of their probation period",
    questions: [
      { id: "sys-3-1", type: "rating", text: "Role Fit — demonstrates the skills needed for this position", required: true },
      { id: "sys-3-2", type: "rating", text: "Learning Agility — quickly adapts to new information and processes", required: true },
      { id: "sys-3-3", type: "rating", text: "Team Integration — builds positive working relationships", required: true },
      { id: "sys-3-4", type: "rating", text: "Work Quality — delivers accurate, thorough work", required: true },
      { id: "sys-3-5", type: "text", text: "How has this person adapted to their role and the team?", required: true },
      { id: "sys-3-6", type: "text", text: "Recommendation: extend, confirm, or end probation? Please explain.", required: true },
    ],
  },
  {
    name: "Quarterly Pulse",
    description: "Quick temperature check on engagement and workload every quarter",
    questions: [
      { id: "sys-4-1", type: "rating", text: "Engagement — feels motivated and connected to their work", required: true },
      { id: "sys-4-2", type: "rating", text: "Workload Balance — has a sustainable and manageable workload", required: true },
      { id: "sys-4-3", type: "rating", text: "Manager Support — receives adequate support from their manager", required: true },
      { id: "sys-4-4", type: "text", text: "One thing we should start, stop, or continue as a team?", required: true },
    ],
  },
  {
    name: "Manager Effectiveness",
    description: "Upward feedback template for evaluating management quality",
    questions: [
      { id: "sys-5-1", type: "rating", text: "Clear Communication — sets clear expectations and shares context", required: true },
      { id: "sys-5-2", type: "rating", text: "Provides Feedback — gives timely, actionable feedback regularly", required: true },
      { id: "sys-5-3", type: "rating", text: "Supports Growth — invests in career development and learning", required: true },
      { id: "sys-5-4", type: "rating", text: "Sets Direction — provides clear priorities and strategic vision", required: true },
      { id: "sys-5-5", type: "text", text: "What does your manager do well?", required: true },
      { id: "sys-5-6", type: "text", text: "How could your manager better support you?", required: true },
    ],
  },
  {
    name: "Peer Feedback",
    description: "Collect structured peer-to-peer feedback on collaboration and communication",
    questions: [
      { id: "sys-6-1", type: "rating", text: "Collaboration — easy to work with and shares knowledge", required: true },
      { id: "sys-6-2", type: "rating", text: "Reliability — follows through on commitments consistently", required: true },
      { id: "sys-6-3", type: "rating", text: "Communication — communicates clearly and listens actively", required: true },
      { id: "sys-6-4", type: "text", text: "What is this person's biggest strength?", required: true },
      { id: "sys-6-5", type: "text", text: "One suggestion for how they could improve?", required: false },
    ],
  },
];
```

**Step 2: Add seeding function**

Add a server-side function that checks and seeds system templates:

```tsx
async function seedSystemTemplates(supabase: any, workspaceId: string) {
  // Check if system templates already exist for this workspace
  const { data: existing } = await supabase
    .from("templates")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("is_system", true)
    .limit(1);

  if (existing && existing.length > 0) return; // Already seeded

  // Seed all system templates
  const rows = SYSTEM_TEMPLATES.map((t) => ({
    workspace_id: workspaceId,
    name: t.name,
    description: t.description,
    questions: t.questions,
    is_system: true,
    is_default: false,
    created_by: null,
  }));

  await supabase.from("templates").insert(rows);
}
```

Call this function in the page component before fetching templates.

**Step 3: Update template list rendering**

In the template card rendering (around lines 91-130), add:
- "System" badge for templates where `is_system === true` (blue badge)
- System templates should not link to edit — link to read-only detail view

**Step 4: Verify and commit**

```bash
git add src/app/dashboard/templates/page.tsx
git commit -m "feat(templates): seed 6 built-in system templates per workspace"
```

---

### Task 3: Template editing on detail page

**Files:**
- Modify: `src/app/dashboard/templates/[id]/page.tsx`

**Context:** Currently the detail page (lines 33-148) is read-only. Questions display at lines 109-145. We need to add an edit mode with the same form as the creation page.

**Step 1: Convert to client component with edit state**

The page is currently a server component. We need to make it a client component (or add a client component wrapper) with:

```tsx
const [editing, setEditing] = useState(false);
const [name, setName] = useState(template.name);
const [description, setDescription] = useState(template.description || "");
const [questions, setQuestions] = useState(template.questions || []);
const [saving, setSaving] = useState(false);
```

**Step 2: Add edit mode UI**

When `editing === true`, render:
- Editable name input
- Editable description textarea
- Questions list with: text input, type select (text/rating), required checkbox, delete button
- "Add Question" button
- "Save Changes" / "Cancel" buttons

When `editing === false`, render current read-only view.

**Step 3: Add edit button**

Add an "Edit" button (Pencil icon) in the header area. Only show for non-system templates (`!template.is_system`).

**Step 4: Add save handler**

```tsx
async function handleSave() {
  setSaving(true);
  const { error } = await supabase
    .from("templates")
    .update({ name, description, questions, updated_at: new Date().toISOString() })
    .eq("id", template.id)
    .eq("workspace_id", workspaceId);
  if (error) { setError(error.message); }
  else { setEditing(false); router.refresh(); }
  setSaving(false);
}
```

**Step 5: Add system template protection**

If `template.is_system`, hide the Edit button and show a subtle note: "System template — duplicate to customize"

**Step 6: Verify and commit**

```bash
git add "src/app/dashboard/templates/[id]/page.tsx"
git commit -m "feat(templates): add inline editing for custom templates"
```

---

### Task 4: Template duplication

**Files:**
- Modify: `src/app/dashboard/templates/[id]/template-actions.tsx`

**Context:** The actions dropdown (lines 89-111) has "Set as Default" and "Delete". Add "Duplicate" between them.

**Step 1: Add duplicate handler**

```tsx
async function handleDuplicate() {
  const { data, error } = await supabase
    .from("templates")
    .insert({
      workspace_id: workspaceId,
      name: `Copy of ${template.name}`,
      description: template.description,
      questions: template.questions,
      is_default: false,
      is_system: false,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) { toast.error("Failed to duplicate template"); return; }
  router.push(`/dashboard/templates/${data.id}`);
}
```

**Step 2: Add Duplicate menu item**

In the DropdownMenu (around line 96), add before the separator:

```tsx
<DropdownMenuItem onClick={handleDuplicate}>
  <Copy className="w-4 h-4 mr-2" /> Duplicate
</DropdownMenuItem>
```

**Step 3: Protect system templates from delete**

If `template.is_system`, hide the Delete menu item. Keep Set as Default and Duplicate available.

**Step 4: Verify and commit**

```bash
git add "src/app/dashboard/templates/[id]/template-actions.tsx"
git commit -m "feat(templates): add duplicate action, protect system templates from deletion"
```

---

### Task 5: Cycle wizard template picker in Step 3

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

**Context:** Step 3 (Questions) starts around line 843. It has competency checkboxes and text questions. Add a "Start from template" dropdown at the top of Step 3.

**Step 1: Fetch templates**

Add a state variable and fetch templates on mount:

```tsx
const [templates, setTemplates] = useState<any[]>([]);

// In the useEffect that fetches workspace data, also fetch templates:
const { data: tplData } = await supabase
  .from("templates")
  .select("id, name, description, questions, is_system")
  .eq("workspace_id", workspaceId)
  .order("is_system", { ascending: false })
  .order("name");
if (tplData) setTemplates(tplData);
```

**Step 2: Add template picker at top of Step 3**

Before the competency section (around line 849), add:

```tsx
{templates.length > 0 && (
  <div className="mb-6 p-4 rounded-lg border bg-muted/30">
    <Label className="text-sm font-medium mb-2 block">Start from a template</Label>
    <p className="text-xs text-muted-foreground mb-3">
      Pre-fill questions from an existing template, then customize as needed.
    </p>
    <div className="flex flex-wrap gap-2">
      {templates.map((tpl) => (
        <Button
          key={tpl.id}
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => applyTemplate(tpl)}
        >
          {tpl.is_system && <Sparkles className="w-3 h-3 mr-1" />}
          {tpl.name}
          <span className="ml-1 text-muted-foreground">
            ({Array.isArray(tpl.questions) ? tpl.questions.length : 0}q)
          </span>
        </Button>
      ))}
    </div>
  </div>
)}
```

**Step 3: Add applyTemplate function**

```tsx
function applyTemplate(tpl: any) {
  const questions = Array.isArray(tpl.questions) ? tpl.questions : [];
  // Extract text questions from template
  const textQs = questions
    .filter((q: any) => q.type === "text")
    .map((q: any) => ({ prompt: q.text, required: q.required ?? true }));
  setTextQuestions(textQs);

  // Note: rating questions from templates map to text questions in cycles
  // since cycles use competencies (from competencies table) for ratings
  // Template rating questions become text questions with their text preserved
  const ratingQs = questions
    .filter((q: any) => q.type === "rating")
    .map((q: any) => ({ prompt: q.text, required: q.required ?? true }));

  setTextQuestions([...ratingQs, ...textQs]);
}
```

Import `Sparkles` from lucide-react.

**Step 4: Verify and commit**

Navigate to cycle creation → Step 3. Template buttons should appear. Clicking one populates text questions.

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat(templates): add template picker to cycle wizard Step 3"
```

---

### Task 6: Final verification

**Step 1: Build check**

Run `npx next build` — should compile with 0 errors.

**Step 2: Manual test plan**

1. Navigate to `/dashboard/templates` — should see 6 system templates seeded
2. System templates show "System" badge
3. Click a system template — read-only, no Edit button, shows "duplicate to customize"
4. Click Duplicate — creates "Copy of ..." and navigates to it
5. Edit the copy — change name, add/remove questions, save
6. Delete the copy — works
7. Try deleting a system template — Delete option not shown
8. Go to cycle creation → Step 3 → template picker shows all templates
9. Click a template → text questions populated

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(templates): complete built-in templates, editing, duplication, and cycle integration"
```
