# Level Reorder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let admins drag-and-drop level pills within a function to set their hierarchy, persisting the new order to the `sort_order` column in Supabase.

**Architecture:** Install `@dnd-kit/core` + `@dnd-kit/sortable`. Refactor `functionLevels` from a derived value to a local `useState` slice so optimistic updates work. Wrap the pill row in a `DndContext` + `SortableContext`; each pill becomes a `SortableLevel` sub-component. On drag end, batch-update `sort_order` in Supabase.

**Tech Stack:** Next.js 14 App Router, @dnd-kit/core ^6, @dnd-kit/sortable ^8, @dnd-kit/utilities ^3, Supabase, Tailwind CSS, lucide-react

---

### Task 1: Install dnd-kit packages

**Files:**
- Modify: `package.json` (via npm)

**Step 1: Install the three packages**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected output: packages added, no peer-dep warnings.

**Step 2: Verify they appear in package.json**

```bash
grep "dnd-kit" package.json
```

Expected:
```
"@dnd-kit/core": "^6.x.x",
"@dnd-kit/sortable": "^8.x.x",
"@dnd-kit/utilities": "^3.x.x",
```

**Step 3: Commit**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add package.json package-lock.json
git commit -m "chore: install @dnd-kit/core, sortable, utilities"
```

---

### Task 2: Lift levels into local state

**Files:**
- Modify: `src/app/dashboard/admin/functions/functions-client.tsx`

**Context:** Currently `functionLevels` is derived directly from the `initialLevels` prop. For optimistic updates to work during drag, we need a mutable local copy.

**Step 1: Add local levels state**

In `functions-client.tsx`, directly after the existing state declarations for levels (around line 119), add:

```tsx
const [levels, setLevels] = useState<Level[]>(initialLevels);
```

The `initialLevels` parameter is already destructured from props at line 92.

**Step 2: Replace `initialLevels` references in derived values**

Find these two lines (around 169–173):
```tsx
const functionLevels = initialLevels
  .filter((l) => l.job_family_id === selectedId)
  .sort((a, b) => a.sort_order - b.sort_order);
```

Replace with:
```tsx
const functionLevels = levels
  .filter((l) => l.job_family_id === selectedId)
  .sort((a, b) => a.sort_order - b.sort_order);
```

Also find this line in `memberCountByFunction` useMemo (around line 160):
```tsx
const level = initialLevels.find((l) => l.id === u.level_id);
```
Replace with:
```tsx
const level = levels.find((l) => l.id === u.level_id);
```

And update the dependency array of that useMemo from `[users, initialLevels]` to `[users, levels]`.

**Step 3: Sync local state when server data refreshes**

After the existing `matrixLookup` useMemo, add a `useEffect` to keep local levels in sync when the server refreshes the prop:

```tsx
// Keep local levels state in sync after router.refresh()
useEffect(() => {
  setLevels(initialLevels);
}, [initialLevels]);
```

Add `useEffect` to the import from "react" at the top of the file.

**Step 4: TypeScript check**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors (there's one pre-existing error about a removed job-families route which is unrelated).

**Step 5: Commit**

```bash
git add src/app/dashboard/admin/functions/functions-client.tsx
git commit -m "refactor: lift levels into local useState for optimistic updates"
```

---

### Task 3: Add SortableLevel sub-component and imports

**Files:**
- Modify: `src/app/dashboard/admin/functions/functions-client.tsx`

**Step 1: Add dnd-kit imports at the top of the file**

After the existing imports (after line 26 where DropdownMenu imports end), add:

```tsx
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
```

`GripVertical` is already available in `lucide-react` (which is already installed). Add it to the existing lucide import block instead of a separate import — just add `GripVertical` to the destructured list on line 10.

**Step 2: Add SortableLevel sub-component**

Add this component directly after the `ScorePicker` component (after line 86), before the `// ── Main Component` comment:

```tsx
// ── Sortable Level Pill ────────────────────────────────────────────────────

interface SortableLevelProps {
  level: Level;
  canEdit: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
  onRenameBlur: () => void;
  onStartRename: () => void;
  onDelete: () => void;
}

function SortableLevel({
  level,
  canEdit,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameKeyDown,
  onRenameBlur,
  onStartRename,
  onDelete,
}: SortableLevelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  if (isRenaming) {
    return (
      <div ref={setNodeRef} style={style}>
        <Input
          autoFocus
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={onRenameKeyDown}
          onBlur={onRenameBlur}
          className="h-7 text-xs w-28"
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/level relative"
    >
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-full border text-xs font-medium transition-colors ${
          canEdit
            ? "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
            : "border-border bg-muted/30"
        } ${isDragging ? "shadow-md" : ""}`}
      >
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <span
          className={canEdit ? "cursor-pointer" : ""}
          onClick={canEdit ? onStartRename : undefined}
        >
          {level.name}
        </span>
        {level.grade && (
          <span className="text-muted-foreground text-[10px]">{level.grade}</span>
        )}
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover/level:opacity-100 transition-opacity ml-0.5 hover:text-destructive"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

**Step 4: Commit**

```bash
git add src/app/dashboard/admin/functions/functions-client.tsx
git commit -m "feat: add SortableLevel pill sub-component with dnd-kit"
```

---

### Task 4: Wire DndContext and add handleReorderLevels

**Files:**
- Modify: `src/app/dashboard/admin/functions/functions-client.tsx`

**Step 1: Add sensors and handleReorderLevels handler**

In the main component body, after the `handleDeleteLevel` handler (around line 311), add:

```tsx
// ── Handlers: Level Reorder ────────────────────────────────────────────────

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }, // prevent accidental drags on click
  })
);

async function handleReorderLevels(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIndex = functionLevels.findIndex((l) => l.id === active.id);
  const newIndex = functionLevels.findIndex((l) => l.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return;

  // Compute new sorted array for this function only
  const reordered = arrayMove(functionLevels, oldIndex, newIndex);

  // Optimistically update local state — splice the reordered items back in
  const originalLevels = levels;
  setLevels((prev) => {
    const otherLevels = prev.filter((l) => l.job_family_id !== selectedId);
    const updatedLevels = reordered.map((l, i) => ({ ...l, sort_order: i }));
    return [...otherLevels, ...updatedLevels];
  });

  try {
    // Batch update only levels whose sort_order actually changed
    await Promise.all(
      reordered.map((level, i) => {
        if (level.sort_order === i) return Promise.resolve(); // unchanged
        return supabase
          .from("levels")
          .update({ sort_order: i })
          .eq("id", level.id)
          .eq("workspace_id", workspaceId)
          .then(({ error: err }) => {
            if (err) throw err;
          });
      })
    );
    router.refresh();
  } catch (e: any) {
    // Roll back optimistic update on error
    setLevels(originalLevels);
    setError(e.message ?? "Failed to reorder levels");
  }
}
```

**Step 2: Replace the pill row JSX with DndContext + SortableContext**

Find the existing pill rendering section (around line 594–638):
```tsx
{/* Levels */}
<div>
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">Levels</p>
  <div className="flex flex-wrap items-center gap-2">
    {functionLevels.map((level) => (
      <div key={level.id} className="group/level relative">
        {renamingLevelId === level.id ? (
          <Input
            autoFocus
            value={renameLevelValue}
            onChange={(e) => setRenameLevelValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameLevel(level.id);
              if (e.key === "Escape") setRenamingLevelId(null);
            }}
            onBlur={() => handleRenameLevel(level.id)}
            className="h-7 text-xs w-28"
          />
        ) : (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              canEdit
                ? "cursor-pointer hover:border-primary/40 hover:bg-primary/5 border-border bg-background"
                : "border-border bg-muted/30"
            }`}
            onClick={() => {
              if (!canEdit) return;
              setRenamingLevelId(level.id);
              setRenameLevelValue(level.name);
            }}
          >
            {level.name}
            {level.grade && <span className="text-muted-foreground text-[10px]">{level.grade}</span>}
            {canEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteLevel(level.id); }}
                className="opacity-0 group-hover/level:opacity-100 transition-opacity ml-0.5 hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}
      </div>
    ))}
```

Replace everything from `{functionLevels.map((level) => (` to the closing `)}` of the map (just before the `{/* Add level */}` comment) with:

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleReorderLevels}
>
  <SortableContext
    items={functionLevels.map((l) => l.id)}
    strategy={horizontalListSortingStrategy}
  >
    {functionLevels.map((level) => (
      <SortableLevel
        key={level.id}
        level={level}
        canEdit={canEdit}
        isRenaming={renamingLevelId === level.id}
        renameValue={renameLevelValue}
        onRenameChange={setRenameLevelValue}
        onRenameKeyDown={(e) => {
          if (e.key === "Enter") handleRenameLevel(level.id);
          if (e.key === "Escape") setRenamingLevelId(null);
        }}
        onRenameBlur={() => handleRenameLevel(level.id)}
        onStartRename={() => {
          setRenamingLevelId(level.id);
          setRenameLevelValue(level.name);
        }}
        onDelete={() => handleDeleteLevel(level.id)}
      />
    ))}
  </SortableContext>
</DndContext>
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Fix any type errors before proceeding.

**Step 4: Commit**

```bash
git add src/app/dashboard/admin/functions/functions-client.tsx
git commit -m "feat: wire DndContext for level pill drag-and-drop reordering"
```

---

### Task 5: Build check, deploy, smoke test

**Step 1: Full build check**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` with no errors (pre-existing job-families warning is acceptable).

**Step 2: Deploy to Vercel production**

```bash
vercel --prod 2>&1 | tail -5
```

**Step 3: Smoke test checklist (manual)**

Visit `https://nami-ochre.vercel.app/dashboard/admin/functions` as an admin and verify:

- [ ] Levels render as pills with a `⠿` grip handle on the left of each pill
- [ ] Dragging a pill to a new position shows the animated swap
- [ ] After drop, the order updates immediately (optimistic) and persists on reload
- [ ] Clicking the pill text (not the handle) still opens the inline rename
- [ ] The scorecard table columns reflect the new order after the page refreshes
- [ ] As a non-admin (read-only), no grip handle is visible

**Step 4: Commit if any last fixes were made**

```bash
git add -p
git commit -m "fix: post-deploy smoke test adjustments"
```
