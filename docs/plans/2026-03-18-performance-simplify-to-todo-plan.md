# Performance Page — Simplify to To Do Only

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the Results tab from the Performance page and restyle the three To Do sections (Self-Review, Reviews to Give, Upward Feedback) to match the Feedback tab's visual style.

**Architecture:** Pure rendering-layer change in `page.tsx` — no data-fetching changes. Remove the `PerformanceTabsClient` tab wrapper, render three `CollapsibleSection`s directly. Replace individual boxed `Card` per item with a single `Card` per section containing `divide-y divide-border` rows. Delete the now-unused `performance-tabs-client.tsx` file.

**Tech Stack:** Next.js 14 App Router, React Server Components, shadcn/ui (Card, Badge, Button), Tailwind CSS, Lucide icons.

---

### Task 1: Rewrite `page.tsx` — remove Results tab, restyle rows

**Files:**
- Modify: `src/app/dashboard/performance/page.tsx`

This is a UI rendering change to a Next.js server component. No unit tests to write. Verification is `npm run build` (TypeScript check) + visual browser check.

**Step 1: Replace the file with the new implementation**

Open `src/app/dashboard/performance/page.tsx` and replace the entire contents with the following:

```tsx
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, ChevronRight } from "lucide-react";
import { CollapsibleSection, SectionEmptyNote } from "./collapsible-section";

export default async function PerformancePage() {
  const workspace = await getUserWorkspace();
  if (!workspace?.appUserId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please sign in to view your performance.
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const userId = workspace.appUserId;

  const [
    { data: myAssignments },
    { data: managerReviews },
    { data: upwardReviews },
  ] = await Promise.all([
    supabase
      .from("review_assignments")
      .select(`
        *,
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, review_deadline),
        manager:users!review_assignments_manager_id_fkey(slack_name)
      `)
      .eq("employee_id", userId)
      .eq("assignment_type", "standard")
      .order("created_at", { ascending: false }),

    supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
      `)
      .eq("manager_id", userId)
      .eq("assignment_type", "standard")
      .neq("employee_id", userId)
      .order("created_at", { ascending: false }),

    supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
      `)
      .eq("reviewer_id", userId)
      .eq("assignment_type", "upward")
      .order("created_at", { ascending: false }),
  ]);

  const myAssignmentIds = (myAssignments || []).map((a: any) => a.id);
  let mySubmissions: Record<string, Set<string>> = {};
  if (myAssignmentIds.length > 0) {
    const { data: myResponses } = await supabase
      .from("review_responses")
      .select("id, assignment_id, reviewer_role")
      .eq("reviewer_id", userId)
      .in("assignment_id", myAssignmentIds);

    (myResponses || []).forEach((r: any) => {
      if (!mySubmissions[r.assignment_id]) {
        mySubmissions[r.assignment_id] = new Set();
      }
      mySubmissions[r.assignment_id].add(r.reviewer_role);
    });
  }

  const enrichedAssignments = (myAssignments || []).map((a: any) => {
    const selfSubmitted = mySubmissions[a.id]?.has("self") || false;
    const cycleEnded = a.cycle?.status === "closed" || a.cycle?.status === "completed";
    return { ...a, selfSubmitted, cycleEnded };
  });

  const sortByCompletion = (a: any, b: any) => {
    const aComplete = a.status === "completed";
    const bComplete = b.status === "completed";
    if (aComplete === bComplete) return 0;
    return aComplete ? 1 : -1;
  };

  const sortedManagerReviews = [...(managerReviews || [])].sort(sortByCompletion);
  const sortedUpwardReviews = [...(upwardReviews || [])].sort(sortByCompletion);

  const pendingSelfReviews = enrichedAssignments.filter(
    (a: any) => !a.selfSubmitted && !a.cycleEnded && a.status !== "completed"
  );
  const completedSelfReviewAssignments = enrichedAssignments.filter(
    (a: any) => a.selfSubmitted || a.status === "completed"
  );

  const pendingManagerReviews = sortedManagerReviews.filter((r: any) => r.status !== "completed");
  const pendingUpwardReviews = sortedUpwardReviews.filter((r: any) => r.status !== "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Your pending review actions</p>
      </div>

      <div className="space-y-2">

        {/* ── Self-Review ── */}
        <CollapsibleSection
          title="Self-Review"
          pendingCount={pendingSelfReviews.length}
          allDone={completedSelfReviewAssignments.length > 0 && pendingSelfReviews.length === 0}
          defaultOpen={pendingSelfReviews.length > 0}
        >
          {pendingSelfReviews.length === 0 ? (
            <SectionEmptyNote message="No self-reviews due" />
          ) : (
            <Card className="border-border/60">
              <CardContent>
                <div className="divide-y divide-border">
                  {pendingSelfReviews.map((a: any) => (
                    <div key={`self-${a.id}`} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {a.cycle?.name || "Unknown Cycle"}
                        </span>
                        {a.cycle?.review_deadline && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Deadline: {format(new Date(a.cycle.review_deadline), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                      <Button size="sm" className="text-xs h-8 shrink-0" asChild>
                        <Link href={`/dashboard/cycles/${a.cycle?.id}/review/${a.id}`}>
                          Start Self-Review <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CollapsibleSection>

        {/* ── Reviews to Give ── */}
        <CollapsibleSection
          title="Reviews to Give"
          pendingCount={pendingManagerReviews.length}
          allDone={sortedManagerReviews.length > 0 && pendingManagerReviews.length === 0}
          defaultOpen={pendingManagerReviews.length > 0}
        >
          {sortedManagerReviews.length === 0 ? (
            <SectionEmptyNote message="No reviews to give" />
          ) : (
            <Card className="border-border/60">
              <CardContent>
                <div className="divide-y divide-border">
                  {sortedManagerReviews.map((review: any) => {
                    const isDone = review.status === "completed";
                    return (
                      <div
                        key={`mgr-${review.id}`}
                        className={`py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 ${isDone ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-medium text-primary">
                              {review.employee?.slack_name?.[0]?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground truncate">
                                {review.employee?.slack_name || "Unknown"}
                              </span>
                              <Badge className={`shrink-0 text-[10px] font-medium ${isDone ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" : "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10"}`}>
                                {isDone ? "Completed" : review.status === "in_progress" ? "In Progress" : "Pending"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {review.cycle?.name || "Unknown cycle"}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isDone ? "ghost" : "default"}
                          className="text-xs h-8 shrink-0"
                          asChild
                        >
                          <Link href={`/dashboard/reviews/${review.id}`}>
                            {isDone ? "View" : "Review Now"}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </CollapsibleSection>

        {/* ── Upward Feedback ── */}
        <CollapsibleSection
          title="Upward Feedback"
          pendingCount={pendingUpwardReviews.length}
          allDone={sortedUpwardReviews.length > 0 && pendingUpwardReviews.length === 0}
          defaultOpen={pendingUpwardReviews.length > 0}
        >
          {sortedUpwardReviews.length === 0 ? (
            <SectionEmptyNote message="No upward feedback assigned" />
          ) : (
            <Card className="border-border/60">
              <CardContent>
                <div className="divide-y divide-border">
                  {sortedUpwardReviews.map((review: any) => {
                    const isDone = review.status === "completed";
                    return (
                      <div
                        key={`upward-${review.id}`}
                        className={`py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 ${isDone ? "opacity-60" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">
                              {review.employee?.slack_name || "Unknown"}
                            </span>
                            <Badge className={`shrink-0 text-[10px] font-medium ${isDone ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" : "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10"}`}>
                              {isDone ? "Submitted" : review.status === "in_progress" ? "In Progress" : "Pending"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {review.cycle?.name || "Unknown cycle"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isDone ? "ghost" : "default"}
                          className="text-xs h-8 shrink-0"
                          asChild
                        >
                          <Link
                            href={
                              isDone
                                ? `/dashboard/reviews/${review.id}`
                                : `/dashboard/cycles/${review.cycle?.id}/review/${review.id}`
                            }
                          >
                            {isDone ? "View" : "Give Feedback"}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </CollapsibleSection>

      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npm run build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors. If there are errors, fix them before continuing.

**Step 3: Commit**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/performance/page.tsx
git commit -m "feat: simplify Performance page to To Do only, restyle to Feedback layout"
```

---

### Task 2: Delete `performance-tabs-client.tsx`

**Files:**
- Delete: `src/app/dashboard/performance/performance-tabs-client.tsx`

**Step 1: Delete the file**

```bash
rm "/Users/filipnowakowski/Test - Slack/feedback-app/src/app/dashboard/performance/performance-tabs-client.tsx"
```

**Step 2: Verify build still passes**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npm run build 2>&1 | tail -20
```

Expected: build succeeds. The file is no longer imported anywhere (we removed the import in Task 1).

**Step 3: Commit**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add -A
git commit -m "chore: delete unused PerformanceTabsClient component"
```
