# Level Reorder — Design

**Date:** 2026-03-15
**Status:** Approved
**Scope:** `/dashboard/admin/functions` — level pills in the right panel

---

## Problem

Levels within a function have a `sort_order` column but no UI for reordering. Admins must delete and re-create levels to change their hierarchy, which also destroys all expected-score data attached to those levels.

---

## Approved Design

### Interaction & UX

- Each level pill gets a `⠿` drag handle on the left, visible when `canEdit`.
- Clicking the handle initiates drag; clicking the pill text still opens the inline rename as today.
- While dragging: active pill scales up slightly with a shadow; a placeholder gap shows the drop target.
- On `onDragEnd`, if the order changed, re-index all `sort_order` values (0, 1, 2 …) contiguously and batch-update Supabase.
- Reorder is only available when `canEdit`; read-only users see pills without handles.
- The scorecard table columns automatically reflect the new order after `router.refresh()`.

### Technical Implementation

**Library:** `@dnd-kit/core` + `@dnd-kit/sortable`

**Component changes in `functions-client.tsx`:**

1. Add `const [levels, setLevels] = useState(initialLevels)` — local mutable copy to support optimistic updates. Replace `initialLevels` with `levels` in the `functionLevels` derived value.

2. Extract a `<SortableLevel>` sub-component that calls `useSortable({ id: level.id })` and renders the existing pill JSX plus a drag handle button.

3. Wrap the pill row:
   ```tsx
   <DndContext onDragEnd={handleReorderLevels} collisionDetection={closestCenter}>
     <SortableContext items={functionLevels.map(l => l.id)} strategy={horizontalListSortingStrategy}>
       {functionLevels.map(level => <SortableLevel key={level.id} level={level} ... />)}
     </SortableContext>
   </DndContext>
   ```

4. `handleReorderLevels(event)`:
   - Use `arrayMove` to compute new order.
   - If unchanged, return early.
   - Optimistically call `setLevels(reordered)`.
   - Batch Supabase updates: for each level whose `sort_order` changed, fire `.update({ sort_order: newIndex }).eq("id", level.id).eq("workspace_id", workspaceId)`.
   - On any error: roll back `setLevels(originalLevels)` and `setError(...)`.
   - On success: `router.refresh()`.

**No schema changes required** — `sort_order` column already exists on the `levels` table.

---

## Out of Scope

- Reordering functions in the sidebar (separate concern, no sort_order on job_families yet)
- Drag-and-drop on the scorecard table columns (read-only reflow, driven by level order)
