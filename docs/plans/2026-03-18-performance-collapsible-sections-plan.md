# Performance Collapsible Sections Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add named, collapsible sections to both tabs of the Performance page — grouping To Do items by review type (Self-Review / Reviews to Give / Upward Feedback) and Results by cycle cadence (Annual / Quarterly).

**Architecture:** A new `CollapsibleSection` client component accepts server-rendered `children` as ReactNode (Next.js composition pattern — no data fetching moves to client). The server `page.tsx` splits existing flat lists into sections and wraps them. No DB schema changes needed.

**Tech Stack:** Next.js 14 App Router, React useState, Tailwind CSS grid-rows trick for smooth height animation, lucide-react ChevronDown.

---

### Task 1: Create `CollapsibleSection` and `SectionEmptyNote` components

**Files:**
- Create: `src/app/dashboard/performance/collapsible-section.tsx`

**Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CollapsibleSectionProps {
  title: string;
  pendingCount?: number;   // amber badge when > 0
  allDone?: boolean;       // green "All done" badge — only shown when pendingCount is 0
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  pendingCount,
  allDone,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-2 group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
            {title}
          </span>
          {typeof pendingCount === "number" && pendingCount > 0 && (
            <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400 font-medium">
              {pendingCount}
            </Badge>
          )}
          {allDone && (typeof pendingCount === "undefined" || pendingCount === 0) && (
            <Badge className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400 font-medium">
              All done
            </Badge>
          )}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>
      <div className="h-px bg-border/50 mb-3" />
      {/* CSS grid trick: animates height from 0 to auto without JS measurement */}
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-1.5 pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SectionEmptyNote({ message }: { message: string }) {
  return (
    <p className="text-xs text-muted-foreground/60 italic py-1 px-1">{message}</p>
  );
}
```

**Step 2: Verify it compiles**

Navigate to `/dashboard/performance` in the dev server — it should still load fine (we haven't used the new component yet).

**Step 3: Commit**

```bash
git add src/app/dashboard/performance/collapsible-section.tsx
git commit -m "feat: add CollapsibleSection client component with animated height"
```

---

### Task 2: Refactor the To Do tab into 3 collapsible sections

**Files:**
- Modify: `src/app/dashboard/performance/page.tsx`

**Step 1: Add imports at top of page.tsx**

Add to the existing import block:
```tsx
import { CollapsibleSection, SectionEmptyNote } from "./collapsible-section";
```

**Step 2: Replace the `todoContent` JSX**

Find the block starting with `// ── To Do Tab ──` and ending with the closing `);` of `todoContent`. Replace the entire `todoContent` variable with:

```tsx
  // ── To Do Tab ──
  const todoContent = (
    <div className="space-y-2">

      {/* ── Self-Review ── */}
      <CollapsibleSection
        title="Self-Review"
        pendingCount={pendingSelfReviews.length}
        allDone={sortedMyAssignments.length > 0 && pendingSelfReviews.length === 0}
        defaultOpen={pendingSelfReviews.length > 0}
      >
        {pendingSelfReviews.length === 0 ? (
          <SectionEmptyNote message="No self-reviews due" />
        ) : (
          pendingSelfReviews.map((a: any) => (
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
          ))
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
          sortedManagerReviews.map((review: any, i: number) => {
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
          })
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
          sortedUpwardReviews.map((review: any, i: number) => {
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
          })
        )}
      </CollapsibleSection>

    </div>
  );
```

Also remove the now-unused `hasAnyItems` variable and the old global empty state check — sections handle their own empty states.

**Step 3: Verify in dev server**

Navigate to `/dashboard/performance` → To Do tab. Should see 3 labelled sections with chevrons. Clicking a header should collapse/expand with smooth animation.

**Step 4: Commit**

```bash
git add src/app/dashboard/performance/page.tsx
git commit -m "feat: split To Do tab into collapsible Self-Review / Reviews to Give / Upward Feedback sections"
```

---

### Task 3: Refactor the Results tab into collapsible sections by cycle type

**Files:**
- Modify: `src/app/dashboard/performance/page.tsx`

**Step 1: Add cycle-type split variables after the existing sort variables**

After the line `const sortedMyAssignments = [...enrichedAssignments].sort(sortByCompletion);`, add:

```tsx
  // Split results by cycle cadence
  const annualAssignments = sortedMyAssignments.filter((a: any) => a.cycle?.type === "annual");
  const quarterlyAssignments = sortedMyAssignments.filter((a: any) => a.cycle?.type === "quarterly");
  // Catch-all for assignments with no cycle type (or future types)
  const otherAssignments = sortedMyAssignments.filter(
    (a: any) => !["annual", "quarterly"].includes(a.cycle?.type)
  );
```

**Step 2: Extract a `ResultCard` render helper at module scope**

Add this function near the bottom of the file alongside `EmptyState`, `CompletedDivider`, and `StatusIcon`:

```tsx
function ResultCard({ assignment: a }: { assignment: any }) {
  const isCompleted = a.status === "completed";
  return (
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
  );
}
```

Note: `ResultCard` uses `format` from `date-fns`, `StatusIcon`, `Star`, `Medal`, `Badge`, `Button`, `Card`, `CardContent`, `Link`, `ChevronRight` — all already imported in `page.tsx`. Since `ResultCard` is a module-level function in the same file, it has access to all of these.

**Step 3: Replace the `resultsContent` JSX**

Find the block starting with `// ── Results Tab ──` and replace `resultsContent` with:

```tsx
  // ── Results Tab ──
  const resultsContent = (
    <div className="space-y-2">
      {sortedMyAssignments.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-muted-foreground/30" />}
          title="No results yet"
          description="Your review results will appear here once a cycle is completed."
        />
      ) : (
        <>
          {annualAssignments.length > 0 && (
            <CollapsibleSection title="Annual Reviews" defaultOpen={true}>
              <div className="space-y-1.5">
                {annualAssignments.map((a: any, i: number) => {
                  const prevCompleted = i > 0 && annualAssignments[i - 1].status === "completed";
                  const showDivider = a.status === "completed" && !prevCompleted && annualAssignments.some((x: any) => x.status !== "completed");
                  return (
                    <div key={a.id}>
                      {showDivider && <CompletedDivider />}
                      <ResultCard assignment={a} />
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {quarterlyAssignments.length > 0 && (
            <CollapsibleSection title="Quarterly Reviews" defaultOpen={true}>
              <div className="space-y-1.5">
                {quarterlyAssignments.map((a: any, i: number) => {
                  const prevCompleted = i > 0 && quarterlyAssignments[i - 1].status === "completed";
                  const showDivider = a.status === "completed" && !prevCompleted && quarterlyAssignments.some((x: any) => x.status !== "completed");
                  return (
                    <div key={a.id}>
                      {showDivider && <CompletedDivider />}
                      <ResultCard assignment={a} />
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {otherAssignments.length > 0 && (
            <CollapsibleSection title="Performance Reviews" defaultOpen={true}>
              <div className="space-y-1.5">
                {otherAssignments.map((a: any, i: number) => {
                  const prevCompleted = i > 0 && otherAssignments[i - 1].status === "completed";
                  const showDivider = a.status === "completed" && !prevCompleted && otherAssignments.some((x: any) => x.status !== "completed");
                  return (
                    <div key={a.id}>
                      {showDivider && <CompletedDivider />}
                      <ResultCard assignment={a} />
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );
```

Also remove the old inline Results JSX (the `sortedMyAssignments.map(...)` block with the card inline). It's been replaced by `ResultCard`.

**Step 4: Verify in dev server**

Navigate to `/dashboard/performance` → Results tab. Should show Annual Reviews and Quarterly Reviews as separate collapsible sections. Clicking headers should collapse/expand smoothly.

**Step 5: Commit**

```bash
git add src/app/dashboard/performance/page.tsx
git commit -m "feat: split Results tab into collapsible Annual Reviews / Quarterly Reviews sections"
```

---

### Task 4: Deploy

**Step 1: Run build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

**Step 2: Deploy**

```bash
vercel --prod
```

**Step 3: Verify on production**

- Performance → To Do: 3 collapsible sections, chevrons rotate, pending counts show
- Performance → Results: Annual / Quarterly sections, hidden when empty
- Old `/dashboard/my-reviews` still redirects correctly
