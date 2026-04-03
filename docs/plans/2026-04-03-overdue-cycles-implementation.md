# Overdue Cycle Management — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface overdue cycles with actionable summaries, clickable missing-review breakdowns, and an enhanced "Release Grades" flow with optional Slack notifications.

**Architecture:** Computed display status (no DB changes). A `getCycleDisplayStatus()` helper determines overdue vs active based on `end_date < now && !grades_released`. The cycles list page gets an overdue summary row with clickable missing counts. The release grades dialog gets a notification checkbox. Nami bot gets a new `release_grades` action.

**Tech Stack:** Next.js (App Router), Supabase, Tailwind CSS, shadcn/ui, Slack API via nami-bot edge function.

---

### Task 1: Add `getCycleDisplayStatus` helper to `status.ts`

**Files:**
- Modify: `src/lib/status.ts`

**Step 1: Add the overdue status config and helper function**

Add after `CYCLE_STATUS` (after line 60):

```typescript
export const CYCLE_OVERDUE_STATUS: StatusConfig = {
  label: "Overdue",
  badge: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
  dot: "bg-amber-500",
};
```

Add after `getCycleStatus` (after line 167):

```typescript
/**
 * Compute the display status for a performance cycle.
 * "Overdue" = active + past end_date + grades not released.
 */
export function getCycleDisplayStatus(cycle: {
  status: string;
  end_date?: string | null;
  grades_released?: boolean;
}): StatusConfig {
  if (cycle.grades_released) {
    return CYCLE_STATUS.completed;
  }
  if (
    cycle.status === "active" &&
    cycle.end_date &&
    new Date(cycle.end_date) < new Date()
  ) {
    return CYCLE_OVERDUE_STATUS;
  }
  return getCycleStatus(cycle.status);
}

/**
 * Returns true if the cycle is past its end date and grades haven't been released.
 */
export function isCycleOverdue(cycle: {
  status: string;
  end_date?: string | null;
  grades_released?: boolean;
}): boolean {
  return (
    cycle.status === "active" &&
    !!cycle.end_date &&
    new Date(cycle.end_date) < new Date() &&
    !cycle.grades_released
  );
}
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit src/lib/status.ts 2>&1 | grep -v node_modules`
Expected: No errors from status.ts

**Step 3: Commit**

```bash
git add src/lib/status.ts
git commit -m "feat: add getCycleDisplayStatus helper for overdue cycle detection"
```

---

### Task 2: Update cycles list page — overdue badge and sorting

**Files:**
- Modify: `src/app/dashboard/cycles/page.tsx`

**Step 1: Update imports**

Change line 8 from:
```typescript
import { getCycleStatus } from "@/lib/status";
```
to:
```typescript
import { getCycleDisplayStatus, isCycleOverdue } from "@/lib/status";
```

**Step 2: Sort overdue cycles to top**

After line 23 (`return data || [];`), before the return, add sorting:

```typescript
const sorted = (data || []).sort((a: any, b: any) => {
  const aOverdue = isCycleOverdue(a) ? 0 : 1;
  const bOverdue = isCycleOverdue(b) ? 0 : 1;
  if (aOverdue !== bOverdue) return aOverdue - bOverdue;
  return 0; // preserve existing order within groups
});
return sorted;
```

Remove the existing `return data || [];` line.

**Step 3: Update the status badge to use computed display status**

Change line 99 from:
```typescript
const config = getCycleStatus(cycle.status);
```
to:
```typescript
const config = getCycleDisplayStatus(cycle);
```

**Step 4: Add overdue summary line under cycle name**

After the description line (after line 141, inside the Name column `<div>`), add:

```tsx
{isCycleOverdue(cycle) && totalPeople > 0 && (
  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
    {totalPeople - selfDone > 0 && `${totalPeople - selfDone}/${totalPeople} self-reviews missing`}
    {totalPeople - selfDone > 0 && totalPeople - mgrDone > 0 && " · "}
    {totalPeople - mgrDone > 0 && `${totalPeople - mgrDone}/${totalPeople} manager reviews missing`}
    {!cycle.grades_released && " · Grades not released"}
  </p>
)}
```

**Step 5: Verify the page renders**

Start the dev server, navigate to `/dashboard/cycles`. Overdue cycles should show amber badge and summary.

**Step 6: Commit**

```bash
git add src/app/dashboard/cycles/page.tsx
git commit -m "feat: show overdue badge and missing review summary on cycles list"
```

---

### Task 3: Update cycle detail page — overdue banner with actions

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/page.tsx`

**Step 1: Update imports**

Change line 23 from:
```typescript
import { getCycleStatus } from "@/lib/status";
```
to:
```typescript
import { getCycleDisplayStatus, isCycleOverdue } from "@/lib/status";
```

**Step 2: Find where the status badge is rendered on the detail page**

Search for where `getCycleStatus` is called and replace with `getCycleDisplayStatus(cycle)`.

**Step 3: Add an overdue action banner**

After the page header area (after the breadcrumb/title section), add a conditional amber banner when the cycle is overdue. This should appear prominently at the top:

```tsx
{isCycleOverdue(cycle) && (
  <div className="rounded-lg border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/10 px-5 py-4">
    <div className="flex items-start gap-3">
      <TriangleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          This cycle is past its end date
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
          {selfMissing > 0 && `${selfMissing} self-review${selfMissing !== 1 ? "s" : ""}`}
          {selfMissing > 0 && mgrMissing > 0 && " and "}
          {mgrMissing > 0 && `${mgrMissing} manager review${mgrMissing !== 1 ? "s" : ""}`}
          {(selfMissing > 0 || mgrMissing > 0) ? " still pending. " : "All reviews submitted. "}
          {!cycle.grades_released && "Grades have not been released."}
        </p>
      </div>
    </div>
  </div>
)}
```

The variables `selfMissing` and `mgrMissing` should be computed from the existing assignment data already fetched on this page (same logic as the list page).

**Step 4: Verify the banner renders on an overdue cycle**

Navigate to `/dashboard/cycles/{overdue-cycle-id}`. The amber banner should show.

**Step 5: Commit**

```bash
git add src/app/dashboard/cycles/[id]/page.tsx
git commit -m "feat: add overdue action banner on cycle detail page"
```

---

### Task 4: Add clickable missing-reviews breakdown (cycles list)

**Files:**
- Create: `src/app/dashboard/cycles/missing-reviews-popover.tsx` (client component)
- Modify: `src/app/dashboard/cycles/page.tsx`

**Step 1: Create the MissingReviewsPopover client component**

This component receives the assignments array and renders a popover (using shadcn Popover) when clicked. It shows two sections: "Self-reviews missing" and "Manager reviews missing", each listing employee names.

```tsx
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { User2 } from "lucide-react";

interface MissingReviewsProps {
  selfMissing: { name: string; status: string }[];
  managerMissing: { name: string; managerName: string; status: string }[];
}

export function MissingReviewsPopover({ selfMissing, managerMissing }: MissingReviewsProps) {
  if (selfMissing.length === 0 && managerMissing.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer text-left">
          {selfMissing.length > 0 && `${selfMissing.length} self-reviews missing`}
          {selfMissing.length > 0 && managerMissing.length > 0 && " · "}
          {managerMissing.length > 0 && `${managerMissing.length} manager reviews missing`}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" onClick={(e) => e.preventDefault()}>
        <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
          {selfMissing.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Self-reviews missing ({selfMissing.length})
              </p>
              <div className="space-y-1.5">
                {selfMissing.map((person, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground">{person.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {person.status === "pending" ? "Not started" : "In progress"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {managerMissing.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Manager reviews missing ({managerMissing.length})
              </p>
              <div className="space-y-1.5">
                {managerMissing.map((person, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <User2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">{person.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      mgr: {person.managerName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Update query to include employee names for overdue cycles**

In `getPerformanceCycles()`, the current query fetches `assignments:review_assignments(status, assignment_type)`. For overdue cycles we need names. Update the select to include:

```typescript
assignments:review_assignments(
  status, assignment_type,
  employee:users!review_assignments_employee_id_fkey(slack_name),
  manager:users!review_assignments_manager_id_fkey(slack_name)
)
```

**Step 3: Replace the static summary text with the MissingReviewsPopover**

Replace the static overdue summary `<p>` tag (added in Task 2) with:

```tsx
{isCycleOverdue(cycle) && totalPeople > 0 && (() => {
  const selfMissing = standardAssignments
    .filter((a: any) => a.status === "pending")
    .map((a: any) => ({ name: a.employee?.slack_name || "Unknown", status: a.status }));
  const managerMissing = standardAssignments
    .filter((a: any) => a.status !== "completed" && a.manager_id)
    .map((a: any) => ({
      name: a.employee?.slack_name || "Unknown",
      managerName: a.manager?.slack_name || "Unknown",
      status: a.status,
    }));
  return <MissingReviewsPopover selfMissing={selfMissing} managerMissing={managerMissing} />;
})()}
```

Note: The cycles list page is a server component. The popover is a client component rendered inside it — this is standard Next.js composition (server component renders client component with props).

**Step 4: Prevent link navigation when clicking popover**

The cycle row is wrapped in a `<Link>`. The popover trigger needs `onClick={(e) => e.stopPropagation()}` and the `PopoverContent` also needs `onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}` to prevent the row link from navigating. Add `e.stopPropagation()` to the PopoverTrigger button as well.

**Step 5: Verify popover works**

Navigate to `/dashboard/cycles`. Click on the missing review count of an overdue cycle. The popover should show names without navigating to the cycle detail page.

**Step 6: Commit**

```bash
git add src/app/dashboard/cycles/missing-reviews-popover.tsx src/app/dashboard/cycles/page.tsx
git commit -m "feat: add clickable missing-reviews popover on overdue cycles"
```

---

### Task 5: Enhance "Release Grades" dialog with notification checkbox

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/cycle-actions.tsx`

**Step 1: Add state for the notification checkbox**

After line 49, add:

```typescript
const [notifyOnRelease, setNotifyOnRelease] = useState(true);
```

**Step 2: Update the `releaseGrades` function to optionally notify**

Replace the existing `releaseGrades` function (lines 276-295) with:

```typescript
async function releaseGrades() {
  setLoading(true);
  setActionError(null);
  try {
    const { error } = await supabase
      .from("performance_cycles")
      .update({ grades_released: true, status: "completed", updated_at: new Date().toISOString() })
      .eq("id", cycle.id)
      .eq("workspace_id", cycle.workspace_id);

    if (error) throw error;

    if (notifyOnRelease) {
      try {
        await supabase.functions.invoke("nami-bot", {
          body: { action: "release_grades", cycle_id: cycle.id },
        });
      } catch (notifErr) {
        console.error("Grade release notification failed:", notifErr);
        // Don't block — grades are released, notification is best-effort
      }
    }

    router.refresh();
  } catch (err) {
    console.error("Error releasing grades:", err);
    setActionError("Failed to release grades. Please try again.");
  } finally {
    setLoading(false);
    setShowReleaseDialog(false);
  }
}
```

Note: also sets `status: "completed"` so the cycle moves out of active/overdue.

**Step 3: Update the Release Grades dialog UI**

Replace the existing Release Grades AlertDialog (lines 472-491) with:

```tsx
<AlertDialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Release Grades to Employees?</AlertDialogTitle>
      <AlertDialogDescription asChild>
        <div className="space-y-3">
          <p>
            This will make all ratings and final grades visible to employees in &quot;{cycle.name}&quot;.
          </p>
          {(submittedCount !== undefined || pendingManagerCount !== undefined) && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">Summary</p>
              <p className="text-muted-foreground mt-1">
                {employeeCount} participant{employeeCount !== 1 ? "s" : ""}
                {submittedCount !== undefined && ` · ${submittedCount} completed`}
                {pendingManagerCount !== undefined && pendingManagerCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400"> · {pendingManagerCount} missing</span>
                )}
              </p>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyOnRelease}
              onChange={(e) => setNotifyOnRelease(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground">Notify employees via Slack</span>
          </label>
        </div>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={releaseGrades} disabled={loading}>
        {loading ? "Releasing…" : (
          <>
            <Medal className="h-4 w-4 mr-2" />
            Release Grades
          </>
        )}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 4: Also allow release from closed status**

Update line 362 to also show the Release Grades menu item when `status === "closed"`:

```typescript
{isHR && !cycle.grades_released && (cycle.status === "active" || cycle.status === "completed" || cycle.status === "closed") && (
```

**Step 5: Verify the dialog**

Navigate to an overdue cycle detail page. Click the dropdown → Release Grades. Verify the dialog shows the summary and checkbox.

**Step 6: Commit**

```bash
git add src/app/dashboard/cycles/[id]/cycle-actions.tsx
git commit -m "feat: enhance release grades dialog with notification checkbox and summary"
```

---

### Task 6: Add `release_grades` action to nami-bot edge function

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`

**Step 1: Read the existing nami-bot structure**

The nami-bot already handles `action: "launch_cycle"`. We need to add a new action `"release_grades"` that:
1. Fetches all standard review_assignments for the cycle
2. For each employee, gets their overall_rating and final_grade
3. Sends a Slack DM to each employee with their results

**Step 2: Add the `release_grades` handler**

Add a new case in the action routing (find the existing `if (action === "launch_cycle")` block and add an `else if` after it):

```typescript
else if (action === "release_grades") {
  const cycle_id = body.cycle_id;
  if (!cycle_id) {
    return new Response(JSON.stringify({ error: "cycle_id required" }), { status: 400 });
  }

  // Fetch cycle info
  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("id, name, workspace_id")
    .eq("id", cycle_id)
    .single();

  if (!cycle) {
    return new Response(JSON.stringify({ error: "Cycle not found" }), { status: 404 });
  }

  // Fetch workspace for bot token
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("bot_token, team_id")
    .eq("id", cycle.workspace_id)
    .single();

  if (!workspace?.bot_token) {
    return new Response(JSON.stringify({ error: "No bot token" }), { status: 500 });
  }

  // Fetch all standard assignments with employee info
  const { data: assignments } = await supabase
    .from("review_assignments")
    .select(`
      id, overall_rating, final_grade, status,
      employee:users!review_assignments_employee_id_fkey(id, slack_user_id, slack_name)
    `)
    .eq("cycle_id", cycle_id)
    .eq("assignment_type", "standard");

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const assignment of (assignments || [])) {
    const employee = assignment.employee as any;
    if (!employee?.slack_user_id) {
      skipped++;
      continue;
    }

    // Build message
    const ratingLine = assignment.overall_rating
      ? `*Overall rating:* ${assignment.overall_rating}`
      : null;
    const gradeLine = assignment.final_grade
      ? `*Final grade:* ${assignment.final_grade}`
      : null;

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📋 *Your ${cycle.name} review results are ready*`,
        },
      },
    ];

    if (ratingLine || gradeLine) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: [ratingLine, gradeLine].filter(Boolean).join("\n"),
        },
      });
    }

    const dashboardUrl = Deno.env.get("DASHBOARD_URL") || "https://nami-ochre.vercel.app";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${dashboardUrl}/dashboard|View your full review in the dashboard>`,
      },
    });

    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${workspace.bot_token}`,
        },
        body: JSON.stringify({
          channel: employee.slack_user_id,
          text: `Your ${cycle.name} review results are ready`,
          blocks,
        }),
      });
      const result = await res.json();
      if (result.ok) {
        sent++;
      } else {
        console.error(`Failed to notify ${employee.slack_name}:`, result.error);
        failed++;
      }
    } catch (err) {
      console.error(`Error notifying ${employee.slack_name}:`, err);
      failed++;
    }
  }

  return new Response(JSON.stringify({ sent, skipped, failed }), {
    headers: { "Content-Type": "application/json" },
  });
}
```

**Step 3: Deploy the updated function**

Run: `supabase functions deploy nami-bot` or use the MCP deploy tool.

**Step 4: Commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "feat: add release_grades action to nami-bot for Slack grade notifications"
```

---

### Task 7: Update cycle detail page status badge

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/page.tsx`

**Step 1: Ensure all references to `getCycleStatus` are replaced**

Search the file for any remaining `getCycleStatus(cycle.status)` calls and replace with `getCycleDisplayStatus(cycle)`.

**Step 2: Verify the detail page shows amber "Overdue" badge**

Navigate to an overdue cycle. The badge in the header should be amber.

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/[id]/page.tsx
git commit -m "feat: use computed display status on cycle detail page"
```

---

### Task 8: Soft-lock warning on review submission page

**Files:**
- Modify: `src/app/dashboard/reviews/[id]/page.tsx`

**Step 1: Add a banner when the review's cycle is past its end date**

The review detail page already fetches the cycle. Check if `cycle.end_date < now` and the cycle is still active. If so, show an amber banner at the top:

```tsx
{cycle.status === "active" && cycle.end_date && new Date(cycle.end_date) < new Date() && (
  <div className="rounded-lg border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/10 px-4 py-3 flex items-center gap-2">
    <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
    <p className="text-sm text-amber-700 dark:text-amber-400">
      This cycle&apos;s deadline has passed. Your submission may still be accepted.
    </p>
  </div>
)}
```

**Step 2: Add read-only banner when cycle is closed**

```tsx
{cycle.status === "closed" && (
  <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 flex items-center gap-2">
    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
    <p className="text-sm text-muted-foreground">
      This cycle has been closed. Reviews can no longer be submitted.
    </p>
  </div>
)}
```

**Step 3: Verify both banners render correctly**

Navigate to a review page for an overdue cycle and a closed cycle.

**Step 4: Commit**

```bash
git add src/app/dashboard/reviews/[id]/page.tsx
git commit -m "feat: add soft-lock warning and closed-cycle banner on review page"
```

---

### Task 9: Final integration test and cleanup

**Step 1: End-to-end verification**

1. Navigate to `/dashboard/cycles` — verify overdue cycles show amber badge, sort to top, show missing review summary
2. Click the missing count — verify popover shows names
3. Click into an overdue cycle — verify amber action banner
4. Click Release Grades — verify dialog shows summary + notification checkbox
5. Navigate to a review page for an overdue cycle — verify soft-lock warning

**Step 2: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: overdue cycle management with soft deadlines and grade release flow"
```
