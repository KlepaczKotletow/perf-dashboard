# Logic Gaps & UX Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate impossible system states (manager-less review assignments, admin wipeout, circular managers) and clean up redundant UX.

**Architecture:** Fix validation at the point of action — cycle launch, bulk role changes, manager assignment. Fix UX by consolidating repeated data into a single canonical display. No schema changes needed; all fixes are application-level guards.

**Tech Stack:** Next.js 16, Supabase client, React server/client components, TypeScript

---

## P0 — Critical Logic Fixes

### Task 1: Skip manager review for employees with no manager

When `manager_id` is null, the system should still create the standard assignment (for the self-review), but mark it so the UI knows no manager review is expected. The "Waiting for your manager" message should show "No manager assigned" instead.

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/cycle-actions.tsx:126-132`
- Modify: `src/app/dashboard/cycles/new/page.tsx:301-305`
- Modify: `src/app/dashboard/my-reviews/page.tsx:118-124`
- Modify: `src/app/dashboard/page.tsx:372-376`
- Modify: `src/app/dashboard/cycles/[id]/page.tsx:476-489` (manager column in participants table)

**Step 1: Fix cycle launch — skip manager_id when null, mark no-manager assignments**

In `cycle-actions.tsx`, the `launchCycle` function creates standard assignments. When `manager_id` is null, still create the assignment but keep `manager_id: null`. The assignment works as self-review-only.

No code change needed in the assignment creation itself — it already sets `manager_id: null`. The real fix is in the **status logic** and **UI messaging**.

**Step 2: Fix "my-reviews" smart status for manager-less assignments**

In `src/app/dashboard/my-reviews/page.tsx`, around line 118-124, when `a.status === "in_progress" || a.status === "pending"` and `selfSubmitted` is true, the current message says "Waiting for your manager to complete their review". Change this:

```typescript
// Replace lines 118-124 with:
} else if ((a.status === "in_progress" || a.status === "pending") && selfSubmitted) {
  smartStatus = a.manager_id
    ? {
        label: "Self-Review Submitted",
        description: "Waiting for your manager to complete their review",
        variant: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
        icon: "clock",
      }
    : {
        label: "Self-Review Submitted",
        description: "No manager assigned — an admin will complete your review",
        variant: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
        icon: "clock",
      };
```

**Step 3: Fix "Reviewed by" line on my-reviews page**

In `src/app/dashboard/my-reviews/page.tsx`, line 229:

```typescript
// Replace:
Reviewed by: {a.manager?.slack_name || "Unassigned"}
// With:
Reviewed by: {a.manager?.slack_name || (a.manager_id ? "Unknown" : "No manager assigned")}
```

**Step 4: Fix dashboard overview "Waiting on manager" for user view**

In `src/app/dashboard/page.tsx`, around lines 372-376, the status label says "Waiting on manager" for self-submitted reviews. Add the same manager-null check:

```typescript
// Replace the selfSubmitted branch (around line 372-375):
} else if (a.selfSubmitted) {
  statusLabel = a.manager_id ? "Waiting on manager" : "Self-review submitted";
  statusClass = "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10";
  StatusIcon = Clock;
```

And line 396:
```typescript
// Replace:
Reviewed by: {a.manager?.slack_name || "Unassigned"}
// With:
{a.manager_id ? `Reviewed by: ${a.manager?.slack_name || "Unknown"}` : "No manager assigned"}
```

**Step 5: Fix manager column in cycle detail participants table**

In `src/app/dashboard/cycles/[id]/page.tsx`, the Manager pill column (lines 478-489) shows "Pending" for null managers. When `manager_id` is null, show "N/A" instead:

```typescript
{/* Manager pill */}
<div className="flex justify-center">
  {!assignment.manager_id ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      N/A
    </span>
  ) : managerDone ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Done
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
      <Circle className="h-3.5 w-3.5" />
      Pending
    </span>
  )}
</div>
```

**Step 6: Fix cycle detail stats to exclude manager-less from manager review count**

In `src/app/dashboard/cycles/[id]/page.tsx`, adjust the computed stats (around lines 165-191) to count manager-less employees separately:

```typescript
// After line 166:
const assignmentsWithManager = standardAssignments.filter((a: any) => a.manager_id);
const assignmentsWithoutManager = standardAssignments.filter((a: any) => !a.manager_id);

// Change managerDoneCount to only count from those WITH a manager:
const managerDoneCount = assignmentsWithManager.filter(
  (a: any) => a.status === "completed"
).length;
const pendingManagerCount = assignmentsWithManager.length - managerDoneCount;

// Update managerCompletionRate:
const managerCompletionRate = assignmentsWithManager.length > 0
  ? Math.round((managerDoneCount / assignmentsWithManager.length) * 100)
  : 0;
```

Update the stat card label for Mgr Reviews:
```typescript
<p className="text-xl font-bold text-foreground leading-none">
  {managerDoneCount}/{assignmentsWithManager.length}
</p>
```

Update progress bar label:
```typescript
<span>Manager review progress ({assignmentsWithoutManager.length > 0 ? `${assignmentsWithoutManager.length} without manager` : ""})</span>
```

Update urgency banner to use `assignmentsWithManager.length` instead of `standardAssignments.length`.

**Step 7: Commit**

```bash
git add src/app/dashboard/cycles/[id]/cycle-actions.tsx \
        src/app/dashboard/cycles/new/page.tsx \
        src/app/dashboard/my-reviews/page.tsx \
        src/app/dashboard/page.tsx \
        src/app/dashboard/cycles/[id]/page.tsx
git commit -m "fix: handle manager-less employees correctly in review assignments and UI"
```

---

### Task 2: Prevent removing all admins via bulk role change

**Files:**
- Modify: `src/app/dashboard/team/bulk-actions.tsx:65-93`

**Step 1: Add admin count validation before applying role change**

In `bulk-actions.tsx`, inside the `apply()` function, before executing the update, add a check:

```typescript
async function apply() {
  if (!action || !value) return;
  setApplying(true);
  setApplyError(null);

  // Guard: prevent removing all admins
  if (action === "role" && value !== "admin") {
    const selectedAdmins = selectedIds.filter((id) =>
      users.find((u) => u.id === id)
    );
    // We need to know how many admins exist total and how many are being changed
    const { count: adminCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    // Count how many of the selected users are currently admins
    const { data: selectedUserRoles } = await supabase
      .from("users")
      .select("id, role")
      .in("id", selectedIds);

    const selectedAdminCount = (selectedUserRoles || []).filter(
      (u: any) => u.role === "admin"
    ).length;

    if ((adminCount || 0) - selectedAdminCount < 1) {
      setApplyError("Cannot remove all admins. At least one admin must remain.");
      setApplying(false);
      return;
    }
  }

  // ... rest of apply function unchanged
```

**Step 2: Commit**

```bash
git add src/app/dashboard/team/bulk-actions.tsx
git commit -m "fix: prevent removing all admins via bulk role change"
```

---

## P1 — Important Logic Fixes

### Task 3: Prevent circular manager references

**Files:**
- Modify: `src/app/dashboard/team/bulk-actions.tsx:65-93`
- Modify: `src/app/dashboard/team/[id]/edit/page.tsx` (individual edit)

**Step 1: Add circular reference check in bulk-actions**

In `bulk-actions.tsx`, when `action === "manager"`, check that no selected user is the new manager or an ancestor of the new manager:

```typescript
// After the admin guard, add:
if (action === "manager" && value !== "none") {
  // Prevent setting a manager to someone who reports to any of the selected users
  // Simple check: the new manager cannot be one of the selected users
  if (selectedIds.includes(value)) {
    setApplyError("Cannot set a person as their own manager.");
    setApplying(false);
    return;
  }

  // Walk up the chain from the new manager to detect cycles
  let currentId = value;
  const visited = new Set(selectedIds); // treat selected users as if they already report to `value`
  for (let depth = 0; depth < 20; depth++) {
    if (visited.has(currentId)) {
      setApplyError("This would create a circular reporting chain.");
      setApplying(false);
      return;
    }
    const mgr = allUsers.find((u) => u.id === currentId);
    // allUsers is already loaded (line 25); need to load manager_id too
    // We'll need to fetch the manager chain from the DB
    break; // simplified — see Step 2 for full implementation
  }
}
```

**Step 2: Implement chain-walk via DB query**

Better approach — fetch the manager chain for the target manager to ensure none of the selected users appear in it:

```typescript
if (action === "manager" && value !== "none") {
  if (selectedIds.includes(value)) {
    setApplyError("Cannot set a person as their own manager.");
    setApplying(false);
    return;
  }

  // Walk up from the proposed manager to check for cycles
  const selectedSet = new Set(selectedIds);
  let currentId: string | null = value;
  for (let depth = 0; depth < 20 && currentId; depth++) {
    const { data: mgrRow } = await supabase
      .from("users")
      .select("manager_id")
      .eq("id", currentId)
      .single();
    currentId = mgrRow?.manager_id || null;
    if (currentId && selectedSet.has(currentId)) {
      setApplyError("This would create a circular reporting chain.");
      setApplying(false);
      return;
    }
  }
}
```

**Step 3: Add the same check in the individual user edit page**

In `src/app/dashboard/team/[id]/edit/page.tsx`, when saving a manager change, add the same cycle detection. Walk up from the new manager's chain to ensure the edited user doesn't appear.

**Step 4: Commit**

```bash
git add src/app/dashboard/team/bulk-actions.tsx src/app/dashboard/team/[id]/edit/page.tsx
git commit -m "fix: prevent circular manager references"
```

---

### Task 4: Validate enrolled employees still exist at cycle launch

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/cycle-actions.tsx:104-119`

**Step 1: Add existence check after fetching users**

In `cycle-actions.tsx`, after line 117 where users are fetched, validate that all enrolled employees were found:

```typescript
if (usersError) throw usersError;

// Validate all enrolled employees still exist
const foundIds = new Set((users || []).map((u: any) => u.id));
const missingIds = employeeIds.filter((id: string) => !foundIds.has(id));
if (missingIds.length > 0) {
  // Remove missing employees from the cycle enrollment
  await supabase
    .from("performance_cycle_employees")
    .delete()
    .in("employee_id", missingIds)
    .eq("performance_cycle_id", cycle.id);

  // If no valid employees remain, abort
  if (foundIds.size === 0) {
    throw new Error("No valid employees found. All enrolled employees may have been removed.");
  }
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/cycles/[id]/cycle-actions.tsx
git commit -m "fix: validate enrolled employees exist before cycle launch"
```

---

### Task 5: Default null-role users to "user" role

**Files:**
- Modify: `src/lib/supabase-server.ts:46`

**Step 1: Default role to "user" when null**

In `getUserWorkspace()`, line 46:

```typescript
// Replace:
let role = user.user_metadata?.role || 'user'
// This already defaults to 'user', but if the DB returns null explicitly:
```

After fetching from DB (line 54-56), ensure we default:

```typescript
if (dbUser?.role) {
  role = dbUser.role;
} else if (appUserId && !dbUser?.role) {
  // DB has null role — default to 'user'
  role = 'user';
}
```

This is already effectively handled, but to be safe, add an explicit default after line 56:

```typescript
role = role || 'user';
```

**Step 2: Commit**

```bash
git add src/lib/supabase-server.ts
git commit -m "fix: ensure null-role users default to 'user' role"
```

---

## P2 — UX Deduplication

### Task 6: Consolidate cycle detail page metrics

Remove the urgency banner's redundant count text. The banner should only show the deadline urgency, not repeat completion stats already shown in the stat cards and progress bar.

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/page.tsx:231-243`

**Step 1: Simplify urgency banner to only show deadline urgency**

```typescript
{cycle.status === "active" && (isDeadlineUrgent || isDeadlineOverdue) && (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium ${
    isDeadlineOverdue
      ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-400/10 dark:border-red-400/20 dark:text-red-400"
      : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-400"
  }`}>
    <TriangleAlert className="h-4 w-4 shrink-0" />
    {isDeadlineOverdue
      ? `Review deadline passed ${Math.abs(daysUntilDeadline!)} day${Math.abs(daysUntilDeadline!) !== 1 ? "s" : ""} ago`
      : `${daysUntilDeadline} day${daysUntilDeadline !== 1 ? "s" : ""} until review deadline`
    }
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/cycles/[id]/page.tsx
git commit -m "fix: simplify cycle urgency banner, remove redundant completion counts"
```

---

### Task 7: Deduplicate active cycles on HR/admin dashboard

The HR/admin dashboard shows "Active cycles" in a sidebar card AND metric cards show the active cycle count. Remove the sidebar card and let the "Active Cycles" metric card link to the cycles list.

**Files:**
- Modify: `src/app/dashboard/page.tsx:821-856` (active cycles sidebar)

**Step 1: Remove the Active Cycles sidebar card from HR/admin view**

Replace the entire `lg:col-span-2` div (lines 821-856) with nothing, and change the quick access section from `lg:col-span-3` to full width:

```typescript
// Replace the grid from lines 798-857:
<div className="space-y-3">
  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Quick access</h2>
  <div className="grid gap-2 sm:grid-cols-2">
    {quickLinks.map((link) => (
      // ... same link cards, now in a 2-col grid
    ))}
  </div>
</div>
```

**Step 2: Make the "Active Cycles" metric card clickable**

Wrap the Active Cycles metric card in a Link to `/dashboard/cycles`:

```typescript
// In the metrics array, the Active Cycles card should link:
<Link href="/dashboard/cycles" key={m.label}>
  <Card className="border-border/60 hover:border-border hover:shadow-sm transition-all">
    ...
  </Card>
</Link>
```

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "fix: remove duplicate active cycles section from admin dashboard"
```

---

### Task 8: Unify review status badges on my-reviews page

Remove the cycle status badge (lines 218-222) which duplicates the smart status badge. The smart status already accounts for cycle state (via "Cycle Ended" status).

**Files:**
- Modify: `src/app/dashboard/my-reviews/page.tsx:218-222`

**Step 1: Remove redundant cycle status badge**

Delete lines 218-222 in the my-reviews page:

```typescript
// Remove this block:
{a.cycle?.status && a.cycle.status !== "active" && (
  <Badge variant="outline" className="text-[9px] font-normal text-muted-foreground capitalize">
    {a.cycle.status}
  </Badge>
)}
```

The smart status badge already shows "Cycle Ended" when the cycle is closed/completed.

**Step 2: Commit**

```bash
git add src/app/dashboard/my-reviews/page.tsx
git commit -m "fix: remove redundant cycle status badge from my-reviews"
```

---

## Execution Order

1. Task 1 — Manager-less employees (P0, largest change)
2. Task 2 — Admin wipeout guard (P0, small)
3. Task 3 — Circular manager guard (P1)
4. Task 4 — Missing employee validation (P1, small)
5. Task 5 — Null role default (P1, tiny)
6. Task 6 — Cycle detail banner cleanup (P2)
7. Task 7 — Dashboard dedup (P2)
8. Task 8 — My-reviews badge cleanup (P2)
