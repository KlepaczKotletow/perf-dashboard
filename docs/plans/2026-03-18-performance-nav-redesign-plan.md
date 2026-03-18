# Performance Nav Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the "My Reviews" nav item with "Performance" — a two-tab page separating personal results from review tasks to complete.

**Architecture:** Rename route from `/dashboard/my-reviews` to `/dashboard/performance`. Keep all data fetching in the server component. Extract a client component `performance-tabs-client.tsx` to handle tab state. Results tab = all cycles where you are the reviewee. To Do tab = flat inbox of all pending actions (self-reviews, manager reviews, upward feedback) sorted by urgency.

**Tech Stack:** Next.js 14 App Router (server components + client components), shadcn/ui Tabs, existing Supabase queries (no changes needed)

---

### Task 1: Create the new `/dashboard/performance` route folder and redirect old route

**Files:**
- Create: `src/app/dashboard/performance/page.tsx` (initially just redirect)
- Modify: `src/app/dashboard/my-reviews/page.tsx` → replace with redirect

**Step 1: Create the new performance folder with an empty placeholder page**

Create `src/app/dashboard/performance/page.tsx`:
```tsx
export default function PerformancePage() {
  return <div>Performance</div>;
}
```

**Step 2: Replace old my-reviews page with a redirect**

Replace entire contents of `src/app/dashboard/my-reviews/page.tsx` with:
```tsx
import { redirect } from "next/navigation";

export default function MyReviewsRedirect() {
  redirect("/dashboard/performance");
}
```

**Step 3: Update nav in layout.tsx**

In `src/app/dashboard/layout.tsx` line 68, change:
```tsx
{ href: "/dashboard/my-reviews", label: "My Reviews", icon: ClipboardCheck, requiresManager: false, requiresAdmin: false },
```
to:
```tsx
{ href: "/dashboard/performance", label: "Performance", icon: ClipboardCheck, requiresManager: false, requiresAdmin: false },
```

**Step 4: Update all other references to `/dashboard/my-reviews`**

Files to update (replace all occurrences of `/dashboard/my-reviews` with `/dashboard/performance`):
- `src/app/dashboard/page.tsx` — 3 occurrences (lines 432, 604, 731; also update label "My Reviews" → "Performance" on line 731)
- `src/app/dashboard/reviews/[id]/page.tsx` — 1 occurrence (line 131)
- `src/app/dashboard/cycles/[id]/review/[assignmentId]/page.tsx` — 4 occurrences (lines 463, 496, 516, 687; also update any "Go to My Reviews" text → "Go to Performance")

**Step 5: Verify dev server loads without errors**

Run: `npm run dev` (or check existing server)
Navigate to `/dashboard/performance` — should show "Performance" placeholder.
Navigate to `/dashboard/my-reviews` — should redirect to `/dashboard/performance`.
Nav sidebar should show "Performance" instead of "My Reviews".

**Step 6: Commit**
```bash
git add src/app/dashboard/performance/ src/app/dashboard/my-reviews/ src/app/dashboard/layout.tsx src/app/dashboard/page.tsx src/app/dashboard/reviews src/app/dashboard/cycles
git commit -m "feat: rename my-reviews route to /performance, add redirect"
```

---

### Task 2: Create the `PerformanceTabsClient` component

This is a pure UI shell — accepts pre-fetched data as props and renders two tabs.

**Files:**
- Create: `src/app/dashboard/performance/performance-tabs-client.tsx`

**Step 1: Create the client component file**

Create `src/app/dashboard/performance/performance-tabs-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Props typed as `any` for now — will be tightened when we wire up data
interface PerformanceTabsClientProps {
  resultsContent: React.ReactNode;
  todoContent: React.ReactNode;
  todoCount: number; // badge count for pending To Do items
}

export function PerformanceTabsClient({
  resultsContent,
  todoContent,
  todoCount,
}: PerformanceTabsClientProps) {
  return (
    <Tabs defaultValue="todo" className="space-y-6">
      <TabsList className="h-9">
        <TabsTrigger value="todo" className="text-sm gap-2">
          To Do
          {todoCount > 0 && (
            <Badge className="text-[10px] h-4 px-1.5 bg-primary text-primary-foreground font-medium">
              {todoCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="results" className="text-sm">
          Results
        </TabsTrigger>
      </TabsList>
      <TabsContent value="todo" className="mt-0">
        {todoContent}
      </TabsContent>
      <TabsContent value="results" className="mt-0">
        {resultsContent}
      </TabsContent>
    </Tabs>
  );
}
```

Note: `defaultValue="todo"` — To Do is the default tab since it surfaces urgent actions first (matches Lattice / Culture Amp pattern).

**Step 2: Verify no import errors**

The Tabs component already exists at `src/components/ui/tabs.tsx` — no installation needed.

**Step 3: Commit**
```bash
git add src/app/dashboard/performance/performance-tabs-client.tsx
git commit -m "feat: add PerformanceTabsClient shell component"
```

---

### Task 3: Build the full performance page with data + tabs

Move all data-fetching logic from the old `my-reviews/page.tsx` into the new `performance/page.tsx`, then render it through two tabs.

**Files:**
- Modify: `src/app/dashboard/performance/page.tsx` (replace placeholder with full implementation)

**Step 1: Replace placeholder with full page**

Replace `src/app/dashboard/performance/page.tsx` with this complete implementation:

```tsx
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import {
  ClipboardCheck,
  Star,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  EyeOff,
  Medal,
  Users,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { PerformanceTabsClient } from "./performance-tabs-client";

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

  // Fetch all assignment types in parallel — same queries as before
  const [
    { data: myAssignments },
    { data: managerReviews },
    { data: upwardReviews },
  ] = await Promise.all([
    supabase
      .from("review_assignments")
      .select(`
        *,
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date, grades_released, review_deadline),
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

  // Check self-review submissions
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

  // Enrich my assignments with smart status — identical logic as before
  const enrichedAssignments = (myAssignments || []).map((a: any) => {
    const selfSubmitted = mySubmissions[a.id]?.has("self") || false;
    const gradesReleased = a.cycle?.grades_released || false;
    const cycleEnded = a.cycle?.status === "closed" || a.cycle?.status === "completed";

    let smartStatus: { label: string; description: string; variant: string; icon: string };

    if (cycleEnded && a.status !== "completed") {
      smartStatus = { label: "Cycle Ended", description: "This review cycle has ended without completion.", variant: "text-muted-foreground bg-muted", icon: "clock" };
    } else if (a.status === "pending" && !selfSubmitted) {
      smartStatus = { label: "Self-Review Required", description: "Complete your self-assessment to get started", variant: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10", icon: "alert" };
    } else if ((a.status === "in_progress" || a.status === "pending") && selfSubmitted) {
      smartStatus = a.manager_id
        ? { label: "Self-Review Submitted", description: "Waiting for your manager to complete their review", variant: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10", icon: "clock" }
        : { label: "Self-Review Submitted", description: "No manager assigned — an admin will complete your review", variant: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10", icon: "clock" };
    } else if (a.status === "completed" && !gradesReleased) {
      smartStatus = { label: "Review Complete", description: "Your review is complete. Results will be shared after calibration.", variant: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10", icon: "eyeoff" };
    } else if (a.status === "completed" && gradesReleased) {
      smartStatus = { label: "Results Available", description: "Your performance results have been released", variant: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10", icon: "check" };
    } else {
      smartStatus = { label: a.status === "in_progress" ? "In Progress" : a.status.charAt(0).toUpperCase() + a.status.slice(1), description: "", variant: "text-muted-foreground bg-muted", icon: "clock" };
    }

    return { ...a, selfSubmitted, gradesReleased, cycleEnded, smartStatus };
  });

  const sortByCompletion = (a: any, b: any) => {
    const aComplete = a.status === "completed";
    const bComplete = b.status === "completed";
    if (aComplete === bComplete) return 0;
    return aComplete ? 1 : -1;
  };

  const sortedMyAssignments = [...enrichedAssignments].sort(sortByCompletion);
  const sortedManagerReviews = [...(managerReviews || [])].sort(sortByCompletion);
  const sortedUpwardReviews = [...(upwardReviews || [])].sort(sortByCompletion);

  // ── To Do: pending self-reviews + all manager reviews + all upward ──
  const pendingSelfReviews = sortedMyAssignments.filter(
    (a: any) => !a.selfSubmitted && !a.cycleEnded && a.status !== "completed"
  );

  // Count of outstanding (non-completed) To Do items
  const todoCount =
    pendingSelfReviews.length +
    sortedManagerReviews.filter((r: any) => r.status !== "completed").length +
    sortedUpwardReviews.filter((r: any) => r.status !== "completed").length;

  const StatusIcon = ({ icon }: { icon: string }) => {
    switch (icon) {
      case "alert":  return <AlertCircle className="h-3.5 w-3.5" />;
      case "clock":  return <Clock className="h-3.5 w-3.5" />;
      case "eyeoff": return <EyeOff className="h-3.5 w-3.5" />;
      case "check":  return <CheckCircle2 className="h-3.5 w-3.5" />;
      default:       return <Clock className="h-3.5 w-3.5" />;
    }
  };

  // ── Results Tab Content ──
  const resultsContent = (
    <div className="space-y-1.5">
      {sortedMyAssignments.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-muted-foreground/30" />}
          title="No results yet"
          description="Your review results will appear here once a cycle is completed."
        />
      ) : (
        sortedMyAssignments.map((a: any, i: number) => {
          const isCompleted = a.status === "completed";
          const prevCompleted = i > 0 && sortedMyAssignments[i - 1].status === "completed";
          const showDivider = isCompleted && !prevCompleted && sortedMyAssignments.some((x: any) => x.status !== "completed");

          return (
            <div key={a.id}>
              {showDivider && <CompletedDivider />}
              <Card className={`border-border/60 transition-all ${isCompleted ? "opacity-60" : a.smartStatus.icon === "alert" ? "border-amber-200/60 bg-amber-50/20 dark:border-amber-400/10 dark:bg-amber-400/[0.02]" : ""}`}>
                <CardContent className="px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-foreground">{a.cycle?.name || "Unknown Cycle"}</h3>
                        <Badge className={`text-[10px] font-medium flex items-center gap-1 ${a.smartStatus.variant}`}>
                          <StatusIcon icon={a.smartStatus.icon} />
                          {a.smartStatus.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.manager_id ? `Reviewed by: ${a.manager?.slack_name || "Unknown"}` : "No manager assigned"}
                      </p>
                      {a.smartStatus.description && (
                        <p className="text-xs text-muted-foreground/70 mt-1">{a.smartStatus.description}</p>
                      )}
                      {a.cycle?.review_deadline && !isCompleted && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          Deadline: {format(new Date(a.cycle.review_deadline), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {a.gradesReleased && isCompleted && (
                        <>
                          {a.overall_rating && (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                              <span className="text-sm font-bold text-foreground">{a.overall_rating}/5</span>
                            </div>
                          )}
                          {a.final_grade && (
                            <Badge variant="outline" className="text-xs font-medium">
                              <Medal className="h-3 w-3 mr-1" />
                              {a.final_grade}
                            </Badge>
                          )}
                          <Button size="sm" variant="ghost" className="text-xs h-8" asChild>
                            <Link href={`/dashboard/reviews/${a.id}`}>View <ChevronRight className="h-3 w-3 ml-1" /></Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })
      )}
    </div>
  );

  // ── To Do Tab Content ──
  // Flat inbox: self-reviews first, then manager reviews, then upward feedback
  // Each item has a type badge so the user knows what kind of action it is

  const hasTodo =
    pendingSelfReviews.length > 0 ||
    sortedManagerReviews.length > 0 ||
    sortedUpwardReviews.length > 0;

  const todoContent = (
    <div className="space-y-1.5">
      {!hasTodo ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10 text-muted-foreground/30" />}
          title="All caught up"
          description="No pending reviews or feedback requests."
        />
      ) : (
        <>
          {/* Pending self-reviews */}
          {pendingSelfReviews.map((a: any) => (
            <Card key={`self-${a.id}`} className="border-amber-200/60 bg-amber-50/20 dark:border-amber-400/10 dark:bg-amber-400/[0.02] border-border/60">
              <CardContent className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{a.cycle?.name || "Unknown Cycle"}</span>
                      <Badge className="text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Self-Review
                      </Badge>
                    </div>
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
              </CardContent>
            </Card>
          ))}

          {/* Manager reviews */}
          {sortedManagerReviews.map((review: any, i: number) => {
            const isDone = review.status === "completed";
            const prevDone = i > 0 && sortedManagerReviews[i - 1].status === "completed";
            const showDivider = isDone && !prevDone && sortedManagerReviews.some((x: any) => x.status !== "completed");
            return (
              <div key={`mgr-${review.id}`}>
                {showDivider && <CompletedDivider />}
                <Card className={`border-border/60 transition-all ${isDone ? "opacity-60" : ""}`}>
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-primary">
                            {review.employee?.slack_name?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">{review.employee?.slack_name || "Unknown"}</p>
                            <Badge className="text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              Manager Review
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 flex-wrap">
                            {review.employee?.job_title || "No title"} &middot; {review.cycle?.name || "Unknown cycle"}
                            {review.cycle?.status && review.cycle.status !== "active" && (
                              <Badge variant="outline" className="text-[9px] font-normal text-muted-foreground capitalize">
                                {review.cycle.status}
                              </Badge>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDone ? (
                          <Badge className="text-[10px] text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {review.status === "in_progress" ? "In Progress" : "Pending"}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={(isDone || review.cycle?.status === "closed" || review.cycle?.status === "completed") ? "ghost" : "default"}
                          className="text-xs h-8"
                          asChild
                        >
                          <Link href={`/dashboard/reviews/${review.id}`}>
                            {isDone ? "View" : (review.cycle?.status === "closed" || review.cycle?.status === "completed") ? "View" : "Review Now"}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}

          {/* Upward feedback */}
          {sortedUpwardReviews.map((review: any, i: number) => {
            const isDone = review.status === "completed";
            const prevDone = i > 0 && sortedUpwardReviews[i - 1].status === "completed";
            const showDivider = isDone && !prevDone && sortedUpwardReviews.some((x: any) => x.status !== "completed");
            return (
              <div key={`upward-${review.id}`}>
                {showDivider && <CompletedDivider />}
                <Card className={`border-border/60 transition-all ${isDone ? "opacity-60" : ""}`}>
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-400/10 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">
                              Feedback for {review.employee?.slack_name || "Unknown"}
                            </p>
                            <Badge className="text-[10px] font-medium bg-violet-100 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400">
                              Upward Feedback
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{review.cycle?.name || "Unknown cycle"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDone ? (
                          <>
                            <Badge className="text-[10px] text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                            </Badge>
                            <Button size="sm" variant="ghost" className="text-xs h-8" asChild>
                              <Link href={`/dashboard/reviews/${review.id}`}>View <ChevronRight className="h-3 w-3 ml-1" /></Link>
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge className="text-[10px] text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {review.status === "in_progress" ? "In Progress" : "Pending"}
                            </Badge>
                            <Button size="sm" className="text-xs h-8" asChild>
                              <Link href={`/dashboard/cycles/${review.cycle?.id}/review/${review.id}`}>
                                Give Feedback <ArrowRight className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your review results and pending actions
        </p>
      </div>

      <PerformanceTabsClient
        todoCount={todoCount}
        resultsContent={resultsContent}
        todoContent={todoContent}
      />
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
    </div>
  );
}

function CompletedDivider() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Completed</span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}
```

**Step 2: Verify the page renders correctly**

Start dev server if not running. Navigate to `/dashboard/performance`.
- Page should show "Performance" heading
- Two tabs: "To Do" (default, active) and "Results"
- To Do tab: flat list of pending items with type badges (Self-Review / Manager Review / Upward Feedback)
- Results tab: list of your review cycles with status badges and grades
- Badge count on "To Do" tab showing number of outstanding items

**Step 3: Commit**
```bash
git add src/app/dashboard/performance/page.tsx
git commit -m "feat: build Performance page with Results and To Do tabs"
```

---

### Task 4: Deploy

**Step 1: Run build to verify no TypeScript/compilation errors**
```bash
npm run build
```
Expected: successful build with no errors.

**Step 2: Deploy to Vercel**
Use the `vercel:deploy` skill or run:
```bash
vercel --prod
```

**Step 3: Verify on production URL**
- Navigate to `/dashboard/performance`
- Test tab switching: To Do ↔ Results
- Test redirect: `/dashboard/my-reviews` → `/dashboard/performance`
- Verify nav shows "Performance" not "My Reviews"
