# Performance Tab Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Performance page as an expandable cycle journal with inline actions, performance summary hero, and historical results.

**Architecture:** Server component (`page.tsx`) fetches all cycle/assignment/rating data. Client component (`CycleCard`) handles expand/collapse. Data is grouped by cycle and passed to cards. The existing data queries are reused and restructured to group by cycle rather than by type (to-do / completed / received).

**Tech Stack:** Next.js App Router, Supabase, shadcn/ui (Card, Badge, Button), Tailwind CSS, Lucide icons, date-fns

---

### Task 1: Create the CycleCard Client Component (Expand/Collapse Shell)

**Files:**
- Create: `src/app/dashboard/performance/cycle-card.tsx`

**Step 1: Create the CycleCard component with expand/collapse**

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CycleCardProps {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  borderColor?: string; // Tailwind border class e.g. "border-l-primary"
}

export function CycleCard({
  header,
  children,
  defaultOpen = false,
  borderColor = "border-l-border",
}: CycleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={`border-border/60 border-l-4 ${borderColor} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">{header}</div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
        )}
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/50 px-4 py-4 space-y-4">
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
}
```

**Step 2: Verify the component renders correctly**

Import it in the page and render a single test card with placeholder content. Visually confirm expand/collapse works in the browser.

**Step 3: Commit**

```bash
git add src/app/dashboard/performance/cycle-card.tsx
git commit -m "feat(performance): add CycleCard expand/collapse component"
```

---

### Task 2: Create the PerformanceSummaryHero Component

**Files:**
- Create: `src/app/dashboard/performance/summary-hero.tsx`

**Step 1: Create the hero stat cards component**

```tsx
import { Star, TrendingUp, Award } from "lucide-react";

interface SummaryHeroProps {
  completedCycles: number;
  avgRating: number | null;
  latestGrade: string | null;
  ratingMax: number;
}

export function PerformanceSummaryHero({
  completedCycles,
  avgRating,
  latestGrade,
  ratingMax,
}: SummaryHeroProps) {
  if (completedCycles === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Cycles</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{completedCycles}</p>
        <p className="text-xs text-muted-foreground">completed</p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Star className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Avg Rating</span>
        </div>
        <p className="text-2xl font-bold text-foreground">
          {avgRating !== null ? avgRating.toFixed(1) : "—"}
        </p>
        <p className="text-xs text-muted-foreground">out of {ratingMax}</p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Award className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Latest</span>
        </div>
        <p className="text-lg font-bold text-foreground truncate">
          {latestGrade || "—"}
        </p>
        <p className="text-xs text-muted-foreground">grade</p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/performance/summary-hero.tsx
git commit -m "feat(performance): add PerformanceSummaryHero stat cards"
```

---

### Task 3: Create the ProgressStepper Sub-Component

This extracts the existing progress stepper from page.tsx into a reusable component that lives inside cycle cards.

**Files:**
- Create: `src/app/dashboard/performance/progress-stepper.tsx`

**Step 1: Extract and create ProgressStepper component**

```tsx
import { Check } from "lucide-react";
import { format, isPast } from "date-fns";

interface ProgressStep {
  label: string;
  done: boolean;
  active?: boolean;
  deadline: string | null;
}

interface ProgressStepperProps {
  steps: ProgressStep[];
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  if (steps.length === 0) return null;

  return (
    <div className="flex items-start w-full">
      {steps.map((step, idx) => {
        const isActive = step.active || (!step.done && (idx === 0 || steps[idx - 1].done));
        const deadlineDate = step.deadline ? new Date(step.deadline) : null;
        const isOverdue = deadlineDate && isPast(deadlineDate) && !step.done;

        return (
          <div key={step.label} className="flex items-start flex-1">
            <div className="flex flex-col items-center w-full">
              <div className="flex items-center w-full">
                {idx > 0 && (
                  <div className={`flex-1 h-0.5 ${
                    steps[idx - 1].done ? "bg-emerald-400 dark:bg-emerald-600" : "bg-border"
                  }`} />
                )}
                {idx === 0 && <div className="flex-1" />}

                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                    step.done
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>

                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${
                    step.done ? "bg-emerald-400 dark:bg-emerald-600" : "bg-border"
                  }`} />
                )}
                {idx === steps.length - 1 && <div className="flex-1" />}
              </div>

              <span className={`mt-2 text-xs text-center whitespace-nowrap ${
                isActive ? "font-semibold text-foreground" : step.done ? "font-medium text-foreground" : "text-muted-foreground"
              }`}>
                {step.label}
              </span>

              {deadlineDate && (
                <span className={`mt-0.5 text-[11px] text-center ${
                  isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground/70"
                }`}>
                  {isOverdue ? `Overdue · ${format(deadlineDate, "MMM d")}` : format(deadlineDate, "MMM d")}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/performance/progress-stepper.tsx
git commit -m "feat(performance): extract ProgressStepper into reusable component"
```

---

### Task 4: Create the ResultsSection Sub-Component

This component renders the "Your Results" section inside an expanded cycle card — overall rating, grade, competency breakdown, and feedback previews.

**Files:**
- Create: `src/app/dashboard/performance/results-section.tsx`

**Step 1: Create the ResultsSection component**

```tsx
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { gradeColor } from "@/lib/status";

interface CompetencyRating {
  name: string;
  rating: number;
}

interface FeedbackPreview {
  reviewerName: string;
  reviewerRole: string;
  comment: string | null;
  rating: number | null;
}

interface ResultsSectionProps {
  overallRating: number | null;
  grade: string | null;
  ratingMax: number;
  competencyRatings: CompetencyRating[];
  feedbackPreviews: FeedbackPreview[];
  gradesReleased: boolean;
}

export function ResultsSection({
  overallRating,
  grade,
  ratingMax,
  competencyRatings,
  feedbackPreviews,
  gradesReleased,
}: ResultsSectionProps) {
  if (!gradesReleased) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Star className="h-3 w-3" />
          Your Results
        </h4>
        <p className="text-sm text-muted-foreground italic">
          Grades not yet released for this cycle.
        </p>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    self: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10",
    manager: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
    upward: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
    peer: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Star className="h-3 w-3" />
        Your Results
      </h4>

      {/* Overall rating + grade */}
      {(overallRating || grade) && (
        <div className="flex items-center gap-4 mb-4">
          {overallRating && (
            <div className="flex items-center gap-1">
              {Array.from({ length: ratingMax }, (_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < overallRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/20"
                  }`}
                />
              ))}
              <span className="ml-1.5 text-sm font-semibold text-foreground">
                {overallRating.toFixed(1)}
              </span>
            </div>
          )}
          {grade && (
            <span className={`text-sm font-semibold ${gradeColor(grade)}`}>
              {grade}
            </span>
          )}
        </div>
      )}

      {/* Competency breakdown */}
      {competencyRatings.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-muted-foreground">Competency Breakdown</p>
          {competencyRatings.map((comp) => (
            <div key={comp.name} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{comp.name}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: ratingMax }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      i < comp.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/20"
                    }`}
                  />
                ))}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  {comp.rating.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback previews */}
      {feedbackPreviews.length > 0 && (
        <div className="space-y-2">
          {feedbackPreviews.map((fb, idx) => (
            <div key={idx} className="rounded-md border border-border/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground">{fb.reviewerName}</span>
                <Badge className={`text-[10px] font-medium ${roleColors[fb.reviewerRole] || roleColors.peer}`}>
                  {fb.reviewerRole.charAt(0).toUpperCase() + fb.reviewerRole.slice(1)}
                </Badge>
              </div>
              {fb.comment && (
                <p className="text-sm text-muted-foreground line-clamp-2">{fb.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/performance/results-section.tsx
git commit -m "feat(performance): add ResultsSection component with ratings and feedback"
```

---

### Task 5: Create the ActionRequiredSection Sub-Component

Shows pending tasks (self-review, manager reviews, upward feedback) with due dates and CTA buttons.

**Files:**
- Create: `src/app/dashboard/performance/action-required-section.tsx`

**Step 1: Create the component**

```tsx
import { Clock, ArrowRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, isPast } from "date-fns";

interface PendingTask {
  id: string;
  type: "self-review" | "manager-review" | "upward-feedback";
  label: string;
  cycleName: string;
  cycleId: string;
  dueDate: string | null;
  assignmentId: string;
}

interface ActionRequiredSectionProps {
  tasks: PendingTask[];
}

export function ActionRequiredSection({ tasks }: ActionRequiredSectionProps) {
  if (tasks.length === 0) return null;

  const getHref = (task: PendingTask) => {
    if (task.type === "self-review" || task.type === "upward-feedback") {
      return `/dashboard/cycles/${task.cycleId}/review/${task.assignmentId}`;
    }
    return `/dashboard/reviews/${task.assignmentId}`;
  };

  const getCtaLabel = (type: PendingTask["type"]) => {
    switch (type) {
      case "self-review": return "Start";
      case "manager-review": return "Review";
      case "upward-feedback": return "Give Feedback";
    }
  };

  const typeBadge: Record<PendingTask["type"], { label: string; className: string }> = {
    "self-review": { label: "Self-Review", className: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10" },
    "manager-review": { label: "Manager Review", className: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
    "upward-feedback": { label: "Upward", className: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
        <Clock className="h-3 w-3 text-amber-500" />
        Action Required
        <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400 font-medium">
          {tasks.length}
        </Badge>
      </h4>
      <div className="rounded-md border border-amber-200/50 dark:border-amber-400/10 bg-amber-50/30 dark:bg-amber-400/5 divide-y divide-amber-200/30 dark:divide-amber-400/10">
        {tasks.map((task) => {
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
          const overdue = dueDate && isPast(dueDate);
          const badge = typeBadge[task.type];

          return (
            <div key={task.id} className="px-3 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] font-medium ${badge.className}`}>
                    {badge.label}
                  </Badge>
                  <span className="text-sm font-medium text-foreground truncate">
                    {task.label}
                  </span>
                </div>
                {dueDate && (
                  <p className={`text-xs mt-0.5 ${overdue ? "text-red-500 font-semibold" : "text-muted-foreground/70"}`}>
                    {overdue ? "Overdue · " : "Due "}
                    {format(dueDate, "MMM d, yyyy")}
                  </p>
                )}
              </div>
              <Button size="sm" className="text-xs h-8 shrink-0" asChild>
                <Link href={getHref(task)}>
                  {getCtaLabel(task.type)}
                  {task.type === "self-review" ? (
                    <ArrowRight className="h-3 w-3 ml-1" />
                  ) : (
                    <ChevronRight className="h-3 w-3 ml-1" />
                  )}
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/performance/action-required-section.tsx
git commit -m "feat(performance): add ActionRequiredSection with inline tasks"
```

---

### Task 6: Create the CompletedSubmissionsSection Sub-Component

Shows what the employee has already submitted for a given cycle.

**Files:**
- Create: `src/app/dashboard/performance/completed-section.tsx`

**Step 1: Create the component**

```tsx
import { Check, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";

interface CompletedItem {
  id: string;
  type: "self" | "manager-review" | "upward";
  label: string;
  href: string;
  completedAt: string | null;
}

interface CompletedSectionProps {
  items: CompletedItem[];
}

export function CompletedSection({ items }: CompletedSectionProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Check className="h-3 w-3 text-emerald-500" />
        Completed
      </h4>
      <div className="rounded-md border border-border/40 divide-y divide-border/40">
        {items.map((item) => (
          <div key={item.id} className="px-3 py-2.5 flex items-center justify-between gap-3 opacity-70">
            <div className="flex items-center gap-2 min-w-0">
              <Badge className="text-[10px] font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10">
                {item.type === "self" ? "Self ✓" : item.type === "manager-review" ? "Review ✓" : "Upward ✓"}
              </Badge>
              <span className="text-sm text-foreground truncate">{item.label}</span>
            </div>
            <Button size="sm" variant="ghost" className="text-xs h-7 shrink-0" asChild>
              <Link href={item.href}>
                View <ChevronRight className="h-3 w-3 ml-0.5" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/performance/completed-section.tsx
git commit -m "feat(performance): add CompletedSection submissions component"
```

---

### Task 7: Restructure Data Processing in page.tsx

This is the core task — restructure the server component to group all data by cycle and prepare it for the new CycleCard layout.

**Files:**
- Modify: `src/app/dashboard/performance/page.tsx`

**Step 1: Add helper types and data grouping logic**

After the existing data fetching (keep all queries the same), replace the current filtering/rendering logic with a cycle-grouped data structure:

```tsx
// ── Group everything by cycle ──
interface CycleData {
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  startDate: string | null;
  endDate: string | null;
  reviewDeadline: string | null;
  gradesReleased: boolean;
  isCurrent: boolean;
  grade: string | null;
  rating: number | null;
  // Pending tasks for this cycle
  pendingTasks: PendingTask[];
  // Completed submissions for this cycle
  completedItems: CompletedItem[];
  // Results data for this cycle
  competencyRatings: CompetencyRating[];
  feedbackPreviews: FeedbackPreview[];
  // Progress steps (only for active cycles)
  progressSteps: ProgressStep[];
}
```

Group `myAssignments`, `managerReviews`, `upwardReviews`, and `reviewRatings` all by `cycle.id`. Build an array of `CycleData` objects sorted newest-first.

**Step 2: Compute summary hero stats**

```tsx
const completedCyclesWithGrades = cycles.filter(c => c.gradesReleased && c.rating);
const completedCount = completedCyclesWithGrades.length;
const avgRating = completedCount > 0
  ? completedCyclesWithGrades.reduce((sum, c) => sum + (c.rating || 0), 0) / completedCount
  : null;
const latestGrade = cycles.find(c => c.gradesReleased && c.grade)?.grade || null;
```

**Step 3: Determine auto-expand logic**

```tsx
// Cycles with pending tasks auto-expand; otherwise most recent auto-expands
const cyclesWithPending = cycles.filter(c => c.pendingTasks.length > 0);
const autoExpandIds = new Set(
  cyclesWithPending.length > 0
    ? cyclesWithPending.map(c => c.cycleId)
    : [cycles[0]?.cycleId].filter(Boolean)
);
```

**Step 4: Commit**

```bash
git add src/app/dashboard/performance/page.tsx
git commit -m "refactor(performance): group data by cycle for journal layout"
```

---

### Task 8: Rewrite the JSX Rendering in page.tsx

Replace the entire return block with the new layout using all the sub-components.

**Files:**
- Modify: `src/app/dashboard/performance/page.tsx`

**Step 1: Update imports**

Add imports for all new components:
```tsx
import { CycleCard } from "./cycle-card";
import { PerformanceSummaryHero } from "./summary-hero";
import { ProgressStepper } from "./progress-stepper";
import { ActionRequiredSection } from "./action-required-section";
import { CompletedSection } from "./completed-section";
import { ResultsSection } from "./results-section";
```

Remove imports for `CollapsibleSection`, `SectionEmptyNote`.

**Step 2: Replace the return JSX**

The new structure:

```tsx
return (
  <div className="space-y-6">
    {/* Header */}
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance</h1>
      <p className="text-sm text-muted-foreground mt-1">Your performance journey across review cycles</p>
    </div>

    {/* Summary Hero */}
    <PerformanceSummaryHero
      completedCycles={completedCount}
      avgRating={avgRating}
      latestGrade={latestGrade}
      ratingMax={ratingMax}
    />

    {/* Cycle Cards */}
    {cycles.length > 0 ? (
      <div className="space-y-3">
        {cycles.map((cycle) => (
          <CycleCard
            key={cycle.cycleId}
            defaultOpen={autoExpandIds.has(cycle.cycleId)}
            borderColor={
              cycle.isCurrent
                ? cycle.pendingTasks.some(t => t.dueDate && isPast(new Date(t.dueDate)))
                  ? "border-l-amber-500"
                  : "border-l-primary"
                : "border-l-emerald-500"
            }
            header={<CycleCardHeader cycle={cycle} ratingMax={ratingMax} />}
          >
            {/* Progress stepper (active cycles only) */}
            {cycle.isCurrent && cycle.progressSteps.length > 0 && (
              <ProgressStepper steps={cycle.progressSteps} />
            )}

            {/* Action Required */}
            <ActionRequiredSection tasks={cycle.pendingTasks} />

            {/* Completed Submissions */}
            <CompletedSection items={cycle.completedItems} />

            {/* Your Results */}
            <ResultsSection
              overallRating={cycle.rating}
              grade={cycle.grade}
              ratingMax={ratingMax}
              competencyRatings={cycle.competencyRatings}
              feedbackPreviews={cycle.feedbackPreviews}
              gradesReleased={cycle.gradesReleased}
            />
          </CycleCard>
        ))}
      </div>
    ) : (
      <div className="text-center py-12 text-muted-foreground">
        No performance cycles have been created yet. Check back when your organization starts a review cycle.
      </div>
    )}
  </div>
);
```

**Step 3: Create the CycleCardHeader helper**

This is a small inline component (can be in page.tsx or a separate file) that renders the collapsed summary row for each cycle card:

```tsx
function CycleCardHeader({ cycle, ratingMax }: { cycle: CycleData; ratingMax: number }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Status indicator */}
      {cycle.isCurrent ? (
        <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" />
      ) : (
        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
      )}

      {/* Cycle name */}
      <span className="text-sm font-semibold text-foreground">{cycle.cycleName}</span>

      {/* Status badge */}
      <Badge className={`text-[10px] font-medium ${
        cycle.isCurrent
          ? "text-primary bg-primary/10"
          : "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10"
      }`}>
        {cycle.cycleStatus === "active" ? "Active"
          : cycle.cycleStatus === "in_review" ? "In Review"
          : "Completed"}
      </Badge>

      {/* Pending task count (active cycles) */}
      {cycle.pendingTasks.length > 0 && (
        <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400 font-medium">
          {cycle.pendingTasks.length} due
        </Badge>
      )}

      {/* Rating + Grade (completed cycles with released grades) */}
      {cycle.gradesReleased && cycle.rating && (
        <span className="flex items-center gap-1 ml-auto">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-semibold text-foreground">{Number(cycle.rating).toFixed(1)}</span>
          {cycle.grade && (
            <span className={`text-sm font-semibold ml-1 ${gradeColor(cycle.grade)}`}>
              {cycle.grade}
            </span>
          )}
        </span>
      )}

      {/* Pending results indicator */}
      {!cycle.isCurrent && !cycle.gradesReleased && (
        <span className="text-xs text-muted-foreground ml-auto italic">Pending results</span>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/dashboard/performance/page.tsx
git commit -m "feat(performance): rewrite page with expandable cycle journal layout"
```

---

### Task 9: Clean Up Unused Files and Dead Code

**Files:**
- Modify: `src/app/dashboard/performance/page.tsx` (remove any leftover dead code)
- Potentially delete: `src/app/dashboard/performance/collapsible-section.tsx` (if no longer imported anywhere)

**Step 1: Check for any remaining imports of CollapsibleSection**

```bash
grep -r "collapsible-section" src/
```

If only the old performance page imported it, delete the file.

**Step 2: Remove any unused imports from page.tsx**

Check for `CollapsibleSection`, `SectionEmptyNote`, and any other imports that are no longer used.

**Step 3: Commit**

```bash
git add -A src/app/dashboard/performance/
git commit -m "chore(performance): remove unused collapsible-section and dead code"
```

---

### Task 10: Visual Verification and Polish

**Step 1: Start the dev server and open the Performance page**

```bash
npm run dev
```

Navigate to `/dashboard/performance` and verify:

1. Summary hero shows correct stats (or is hidden if no completed cycles)
2. All cycles appear as stacked cards, newest first
3. Cycles with pending tasks auto-expand
4. Collapsed cards show rating/grade inline for completed cycles
5. Expanding a card shows progress stepper (active), action required, completed, results
6. Clicking Start/Review/Give Feedback navigates to the correct page
7. Empty states render correctly (no cycles, no pending tasks, grades not released)

**Step 2: Test role-aware behavior**

- Test as a regular employee (should see own assignments only)
- Test as a manager (should see manager review tasks in action required)
- Verify dark mode looks correct

**Step 3: Fix any visual issues found**

Adjust spacing, colors, borders, or responsive behavior as needed.

**Step 4: Final commit**

```bash
git add -A
git commit -m "polish(performance): visual adjustments after manual testing"
```

---

## Summary

| Task | Component | Type |
|------|-----------|------|
| 1 | CycleCard (expand/collapse shell) | Create |
| 2 | PerformanceSummaryHero (stat cards) | Create |
| 3 | ProgressStepper (extracted) | Create |
| 4 | ResultsSection (ratings + feedback) | Create |
| 5 | ActionRequiredSection (inline tasks) | Create |
| 6 | CompletedSection (submissions) | Create |
| 7 | Restructure data processing in page.tsx | Modify |
| 8 | Rewrite JSX rendering in page.tsx | Modify |
| 9 | Clean up unused files | Delete/Modify |
| 10 | Visual verification and polish | Test |
