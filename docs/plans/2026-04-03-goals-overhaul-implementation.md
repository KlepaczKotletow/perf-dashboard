# Goals Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the goal detail 404 bug, add goal direction (increase/decrease/maintain), replace full-page creation with a side panel, add delete and duplicate-to-cycle actions, and display direction indicators in the goals list.

**Architecture:** One DB migration adds `goal_direction` column. Side panel uses shadcn Sheet component. Progress calculation updated to respect direction. Duplicate-to-cycle copies goals with new baseline. All changes are in the goals dashboard pages and types.

**Tech Stack:** Next.js (App Router), Supabase, Tailwind CSS, shadcn/ui (Sheet, Select, Dialog).

---

### Task 1: Fix the 404 bug on goal detail page

**Files:**
- Modify: `src/app/dashboard/goals/[id]/page.tsx`

**Step 1: Add early workspace validation**

At line 9 (after `const workspace = await getUserWorkspace();`), add:

```typescript
if (!workspace?.workspaceId) notFound();
```

This prevents the empty-string workspace_id fallback (`workspace?.workspaceId ?? ""`) from being used in queries, which always returns zero results and triggers a 404.

**Step 2: Also add `goal_direction` to the select query**

Update the select string at line 13-19 to include `goal_direction`:

```typescript
.select(`
  id, parent_id, title, description, status, progress,
  weight, metric_start, metric_current, metric_target, metric_unit,
  tracking_status, scope, due_date, goal_direction, created_at, updated_at,
  employee:users!goals_employee_id_fkey(id, slack_name, department),
  cycle:performance_cycles!goals_cycle_id_fkey(id, name),
  parent:goals!goals_parent_id_fkey(id, title)
`)
```

**Step 3: Verify the fix**

Navigate to `/dashboard/goals/{existing-goal-id}`. Should load instead of 404.

**Step 4: Commit**

```bash
git add "src/app/dashboard/goals/[id]/page.tsx"
git commit -m "fix: goal detail 404 caused by empty workspace_id fallback"
```

---

### Task 2: Add `goal_direction` column via migration

**Files:**
- Create: Supabase migration (via MCP)

**Step 1: Run the migration**

Use the Supabase MCP `apply_migration` tool:

```sql
ALTER TABLE goals ADD COLUMN IF NOT EXISTS goal_direction text NOT NULL DEFAULT 'increase';
```

Migration name: `add_goal_direction`

**Step 2: Update TypeScript types**

In `src/lib/types.ts`, after line 259 (after `GoalScope`), add:

```typescript
export type GoalDirection = 'increase' | 'decrease' | 'above' | 'below'
```

In the `Goal` interface (around line 261-282), add after `scope`:

```typescript
goal_direction: GoalDirection
```

**Step 3: Update GoalRow interface in goals-client.tsx**

In `src/app/dashboard/goals/goals-client.tsx`, in the `GoalRow` interface (around line 66-84), add:

```typescript
goal_direction?: string;
```

Also add it to the `NormalizedGoalRow` type — since it extends `GoalRow` via `Omit` (only omitting employee/cycle), it will inherit `goal_direction` automatically.

**Step 4: Commit**

```bash
git add src/lib/types.ts src/app/dashboard/goals/goals-client.tsx
git commit -m "feat: add goal_direction column and TypeScript types"
```

---

### Task 3: Update progress calculation to respect direction

**Files:**
- Modify: `src/app/dashboard/goals/goals-client.tsx`
- Modify: `src/app/dashboard/goals/[id]/goal-detail-client.tsx`

**Step 1: Create a progress calculation helper**

In `src/app/dashboard/goals/goals-client.tsx`, add a helper function after the `unwrap` function (after line 97):

```typescript
/** Calculate progress based on goal direction */
function calculateProgress(
  direction: string | undefined,
  start: number | null,
  current: number | null,
  target: number | null
): number {
  if (current == null || target == null) return 0;
  const s = start ?? 0;

  switch (direction) {
    case "decrease":
      if (s === target) return current <= target ? 100 : 0;
      return Math.min(100, Math.max(0, Math.round(((s - current) / (s - target)) * 100)));
    case "above":
      return current >= target ? 100 : 0;
    case "below":
      return current <= target ? 100 : 0;
    case "increase":
    default:
      if (s === target) return current >= target ? 100 : 0;
      return Math.min(100, Math.max(0, Math.round(((current - s) / (target - s)) * 100)));
  }
}
```

**Step 2: Add direction indicators in the goals list table**

Find where the metric progress is displayed in the table (look for `metric_target` rendering). Add a direction arrow before the target value:

```typescript
const directionIcon = (d: string | undefined) => {
  switch (d) {
    case "decrease": return "↓";
    case "above": return "≥";
    case "below": return "≤";
    default: return "↑";
  }
};
```

Use it in the metric display: `{directionIcon(goal.goal_direction)} {goal.metric_target}{goal.metric_unit}`

**Step 3: Update the goals query to include goal_direction**

In `src/app/dashboard/goals/page.tsx`, find the goals select query and add `goal_direction` to the selected columns.

**Step 4: Apply the same progress helper in goal-detail-client.tsx**

Read `src/app/dashboard/goals/[id]/goal-detail-client.tsx` and find where progress is calculated from metrics. Replace with the `calculateProgress` helper. Either import it from a shared location or duplicate it in the detail client.

**Step 5: Commit**

```bash
git add src/app/dashboard/goals/goals-client.tsx src/app/dashboard/goals/page.tsx "src/app/dashboard/goals/[id]/goal-detail-client.tsx"
git commit -m "feat: calculate goal progress based on direction (increase/decrease/above/below)"
```

---

### Task 4: Add side panel goal creation (Sheet)

**Files:**
- Modify: `src/app/dashboard/goals/goals-client.tsx`

**Step 1: Add Sheet imports**

Add to imports:

```typescript
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
```

Also add to lucide imports: `TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight`

**Step 2: Add state for the side panel**

In the component, add state:

```typescript
const [showCreatePanel, setShowCreatePanel] = useState(false);
const [newGoal, setNewGoal] = useState({
  title: "",
  employee_id: "",
  goal_direction: "increase" as string,
  metric_target: "" as string,
  metric_unit: "",
  metric_start: "" as string,
  cycle_id: "" as string,
  due_date: "" as string,
  scope: "individual" as string,
  parent_id: "" as string,
  description: "",
  weight: "1",
});
const [showAdvanced, setShowAdvanced] = useState(false);
const [createLoading, setCreateLoading] = useState(false);
```

**Step 3: Add the create handler**

```typescript
async function handleCreate() {
  if (!newGoal.title || !newGoal.employee_id) return;
  setCreateLoading(true);
  try {
    const { error } = await supabase.from("goals").insert({
      title: newGoal.title,
      employee_id: newGoal.employee_id,
      workspace_id: workspaceId,
      goal_direction: newGoal.goal_direction,
      metric_target: newGoal.metric_target ? Number(newGoal.metric_target) : null,
      metric_unit: newGoal.metric_unit || null,
      metric_start: newGoal.metric_start ? Number(newGoal.metric_start) : null,
      cycle_id: newGoal.cycle_id || null,
      due_date: newGoal.due_date || null,
      scope: newGoal.scope,
      parent_id: newGoal.parent_id || null,
      description: newGoal.description || null,
      weight: Number(newGoal.weight) || 1,
      status: "active",
      progress: 0,
    });
    if (error) throw error;
    setShowCreatePanel(false);
    setNewGoal({ title: "", employee_id: "", goal_direction: "increase", metric_target: "", metric_unit: "", metric_start: "", cycle_id: "", due_date: "", scope: "individual", parent_id: "", description: "", weight: "1" });
    router.refresh();
  } catch (err) {
    console.error("Failed to create goal:", err);
  } finally {
    setCreateLoading(false);
  }
}
```

**Step 4: Update the "New Goal" button**

Find the existing "New Goal" button (it currently links to `/dashboard/goals/new`). Change it from a Link to an onClick that opens the panel:

```tsx
<Button size="sm" onClick={() => setShowCreatePanel(true)}>
  <Plus className="h-3.5 w-3.5 mr-1.5" />
  New Goal
</Button>
```

**Step 5: Add the Sheet panel JSX**

Add at the end of the component, before the closing fragment/div:

```tsx
<Sheet open={showCreatePanel} onOpenChange={setShowCreatePanel}>
  <SheetContent className="sm:max-w-md overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Create Goal</SheetTitle>
      <SheetDescription>Set a KPI target for your team or individual.</SheetDescription>
    </SheetHeader>
    <div className="space-y-4 py-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label>Goal title *</Label>
        <Input
          placeholder="e.g. Increase quarterly revenue"
          value={newGoal.title}
          onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
        />
      </div>

      {/* Owner */}
      <div className="space-y-1.5">
        <Label>Owner *</Label>
        <Select value={newGoal.employee_id} onValueChange={(v) => setNewGoal({ ...newGoal, employee_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
          <SelectContent>
            {(employees || []).map((e: any) => (
              <SelectItem key={e.id} value={e.id}>{e.slack_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Direction + Target */}
      <div className="space-y-1.5">
        <Label>KPI Target</Label>
        <div className="flex gap-2">
          <Select value={newGoal.goal_direction} onValueChange={(v) => setNewGoal({ ...newGoal, goal_direction: v })}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="increase">↑ Increase to</SelectItem>
              <SelectItem value="decrease">↓ Decrease to</SelectItem>
              <SelectItem value="above">≥ Stay above</SelectItem>
              <SelectItem value="below">≤ Stay below</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Target"
            value={newGoal.metric_target}
            onChange={(e) => setNewGoal({ ...newGoal, metric_target: e.target.value })}
            className="w-24"
          />
          <Input
            placeholder="Unit"
            value={newGoal.metric_unit}
            onChange={(e) => setNewGoal({ ...newGoal, metric_unit: e.target.value })}
            className="w-20"
          />
        </div>
      </div>

      {/* Advanced options toggle */}
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        More options
      </button>

      {showAdvanced && (
        <div className="space-y-4 pl-1 border-l-2 border-border/50 ml-1">
          {/* Cycle */}
          <div className="space-y-1.5">
            <Label>Performance Cycle</Label>
            <Select value={newGoal.cycle_id} onValueChange={(v) => {
              const cycle = cycles.find((c) => c.id === v);
              setNewGoal({
                ...newGoal,
                cycle_id: v,
                due_date: (cycle as any)?.end_date || newGoal.due_date,
              });
            }}>
              <SelectTrigger><SelectValue placeholder="None (standalone)" /></SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input
              type="date"
              value={newGoal.due_date}
              onChange={(e) => setNewGoal({ ...newGoal, due_date: e.target.value })}
            />
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={newGoal.scope} onValueChange={(v) => setNewGoal({ ...newGoal, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Parent goal */}
          <div className="space-y-1.5">
            <Label>Parent goal</Label>
            <Select value={newGoal.parent_id} onValueChange={(v) => setNewGoal({ ...newGoal, parent_id: v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                {goals.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Baseline */}
          <div className="space-y-1.5">
            <Label>Baseline value</Label>
            <Input
              type="number"
              placeholder="Starting value"
              value={newGoal.metric_start}
              onChange={(e) => setNewGoal({ ...newGoal, metric_start: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="What does success look like?"
              value={newGoal.description}
              onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <Label>Weight</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={newGoal.weight}
              onChange={(e) => setNewGoal({ ...newGoal, weight: e.target.value })}
              className="w-24"
            />
          </div>
        </div>
      )}
    </div>
    <SheetFooter>
      <Button onClick={handleCreate} disabled={createLoading || !newGoal.title || !newGoal.employee_id}>
        {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
        Create Goal
      </Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

**Step 6: Verify the panel opens and creates a goal**

Click "New Goal" on the goals page. Fill in title, owner, direction, target. Click Create. The goal should appear in the list.

**Step 7: Commit**

```bash
git add src/app/dashboard/goals/goals-client.tsx
git commit -m "feat: replace full-page goal creation with side panel quick-create"
```

---

### Task 5: Add delete action to goals

**Files:**
- Modify: `src/app/dashboard/goals/goals-client.tsx`

**Step 1: Add delete state and handler**

Add state:
```typescript
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [goalToDelete, setGoalToDelete] = useState<NormalizedGoalRow | null>(null);
```

Add handler:
```typescript
async function handleDelete() {
  if (!goalToDelete) return;
  try {
    // Unlink children first (make them standalone)
    await supabase.from("goals").update({ parent_id: null }).eq("parent_id", goalToDelete.id).eq("workspace_id", workspaceId);
    // Delete the goal
    const { error } = await supabase.from("goals").delete().eq("id", goalToDelete.id).eq("workspace_id", workspaceId);
    if (error) throw error;
    router.refresh();
  } catch (err) {
    console.error("Failed to delete goal:", err);
  } finally {
    setShowDeleteDialog(false);
    setGoalToDelete(null);
  }
}
```

**Step 2: Add Delete menu item**

In the actions dropdown (around line 795, after the Duplicate DropdownMenuItem), add:

```tsx
<DropdownMenuItem
  onClick={() => { setGoalToDelete(goal); setShowDeleteDialog(true); }}
  className="text-destructive focus:text-destructive"
>
  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
</DropdownMenuItem>
```

Add `Trash2` to the lucide imports.

**Step 3: Add delete confirmation dialog**

Add after the Sheet:

```tsx
<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete Goal?</DialogTitle>
      <DialogDescription>
        This will permanently delete &quot;{goalToDelete?.title}&quot;. This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 4: Commit**

```bash
git add src/app/dashboard/goals/goals-client.tsx
git commit -m "feat: add delete action to goals with confirmation dialog"
```

---

### Task 6: Add "Duplicate to Cycle" action

**Files:**
- Modify: `src/app/dashboard/goals/goals-client.tsx`

**Step 1: Add state for duplicate-to-cycle dialog**

```typescript
const [showDupCycleDialog, setShowDupCycleDialog] = useState(false);
const [goalToDuplicate, setGoalToDuplicate] = useState<NormalizedGoalRow | null>(null);
const [dupTargetCycleId, setDupTargetCycleId] = useState("");
```

**Step 2: Add the handler**

```typescript
async function handleDuplicateToCycle() {
  if (!goalToDuplicate || !dupTargetCycleId) return;
  setCreateLoading(true);
  try {
    // Find the target cycle's end_date for the due_date
    const targetCycle = cycles.find((c) => c.id === dupTargetCycleId);

    const { error } = await supabase.from("goals").insert({
      title: goalToDuplicate.title,
      description: goalToDuplicate.description,
      employee_id: goalToDuplicate.employee?.id ?? null,
      cycle_id: dupTargetCycleId,
      parent_id: goalToDuplicate.parent_id,
      scope: goalToDuplicate.scope,
      goal_direction: goalToDuplicate.goal_direction || "increase",
      metric_unit: goalToDuplicate.metric_unit,
      metric_start: goalToDuplicate.metric_current ?? goalToDuplicate.metric_start, // new baseline = old current
      metric_target: goalToDuplicate.metric_target,
      metric_current: null,
      weight: goalToDuplicate.weight,
      workspace_id: workspaceId,
      status: "active",
      progress: 0,
      tracking_status: null,
      due_date: (targetCycle as any)?.end_date || null,
    });
    if (error) throw error;
    setShowDupCycleDialog(false);
    setGoalToDuplicate(null);
    setDupTargetCycleId("");
    router.refresh();
  } catch (err) {
    console.error("Failed to duplicate goal to cycle:", err);
  } finally {
    setCreateLoading(false);
  }
}
```

**Step 3: Add "Duplicate to Cycle" menu item**

In the actions dropdown, after the existing Duplicate item, add:

```tsx
<DropdownMenuItem onClick={() => { setGoalToDuplicate(goal); setShowDupCycleDialog(true); }}>
  <ArrowUpDown className="h-3.5 w-3.5 mr-2" /> Duplicate to Cycle
</DropdownMenuItem>
```

**Step 4: Add the dialog**

```tsx
<Dialog open={showDupCycleDialog} onOpenChange={setShowDupCycleDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Duplicate to Cycle</DialogTitle>
      <DialogDescription>
        Copy &quot;{goalToDuplicate?.title}&quot; to a new cycle. The current value will become the new baseline.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <Label>Target cycle</Label>
        <Select value={dupTargetCycleId} onValueChange={setDupTargetCycleId}>
          <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
          <SelectContent>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {goalToDuplicate?.metric_current != null && (
        <p className="text-xs text-muted-foreground">
          New baseline: {goalToDuplicate.metric_current}{goalToDuplicate.metric_unit || ""} (carried from current value)
        </p>
      )}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowDupCycleDialog(false)}>Cancel</Button>
      <Button onClick={handleDuplicateToCycle} disabled={!dupTargetCycleId || createLoading}>
        {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
        Duplicate
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 5: Update the cycles query to include end_date**

In `src/app/dashboard/goals/page.tsx`, the `getCycles` function needs to include `end_date` in the select so the duplicate-to-cycle handler can set the due_date:

```typescript
.select("id, name, end_date")
```

**Step 6: Commit**

```bash
git add src/app/dashboard/goals/goals-client.tsx src/app/dashboard/goals/page.tsx
git commit -m "feat: add duplicate-to-cycle action for carrying goals across cycles"
```

---

### Task 7: Update goal detail page with direction support

**Files:**
- Modify: `src/app/dashboard/goals/[id]/goal-detail-client.tsx`

**Step 1: Read the full file to understand the edit form structure**

The detail client has view and edit modes. Find where:
- Progress is displayed and calculated from metrics
- The edit form fields are rendered

**Step 2: Add direction field to the edit form**

Add a direction selector in the edit form, near the metric fields:

```tsx
<div className="space-y-1.5">
  <Label>Direction</Label>
  <Select value={editData.goal_direction || "increase"} onValueChange={(v) => setEditData({ ...editData, goal_direction: v })}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="increase">↑ Increase to</SelectItem>
      <SelectItem value="decrease">↓ Decrease to</SelectItem>
      <SelectItem value="above">≥ Stay above</SelectItem>
      <SelectItem value="below">≤ Stay below</SelectItem>
    </SelectContent>
  </Select>
</div>
```

**Step 3: Add direction to the save/update logic**

Find the update call and add `goal_direction` to the fields being saved.

**Step 4: Display direction in view mode**

In the goal details card (view mode), show the direction alongside the metric:

```tsx
{goal.goal_direction === "decrease" && "↓ "}
{goal.goal_direction === "above" && "≥ "}
{goal.goal_direction === "below" && "≤ "}
{goal.goal_direction === "increase" && "↑ "}
{goal.metric_target}{goal.metric_unit}
```

**Step 5: Add delete and duplicate-to-cycle buttons to detail page**

Add a "Delete" button and "Duplicate to Cycle" button in the header actions area.

**Step 6: Commit**

```bash
git add "src/app/dashboard/goals/[id]/goal-detail-client.tsx"
git commit -m "feat: add direction support and actions to goal detail page"
```

---

### Task 8: Final integration verification

**Step 1: Build check**

Run `npx next build` and verify no compilation errors.

**Step 2: End-to-end verification**

1. Navigate to `/dashboard/goals` — list loads
2. Click "New Goal" — side panel opens
3. Create a goal with direction "Decrease to" — goal appears in list with ↓ indicator
4. Click on a goal — detail page loads (no more 404)
5. Edit a goal — direction field visible and saveable
6. Duplicate to cycle — dialog shows, creates copy with new baseline
7. Delete a goal — confirmation, goal removed

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: goals overhaul with KPI directions, side panel creation, and cycle duplication"
```
