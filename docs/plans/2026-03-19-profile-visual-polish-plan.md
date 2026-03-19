# Profile Visual Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the employee profile page look like Revolut People — clear hierarchy, bold hero moment, circular indicators, inline metadata, less visual noise — while keeping the light theme and all existing data/permission logic untouched.

**Architecture:** All changes are in a single file: `src/app/dashboard/team/[id]/page.tsx`. Two pure helper functions are added at the top of the file (SVG ring components, grade color mapper). No new dependencies. No structural or data changes.

**Tech Stack:** Next.js 14 (server component), Tailwind CSS, shadcn/ui (Card, Badge, Button, Avatar), inline SVG for circular indicators

---

## Task 1: Add helper functions (SVG rings + grade color)

**Files:**
- Modify: `src/app/dashboard/team/[id]/page.tsx` — add helpers after the `feedbackTypeBadge` constant

### Step 1: Read the current file

Confirm the `feedbackTypeBadge` constant ends around line 28. The new helpers go immediately after it.

### Step 2: Add the three helper functions

Insert after the `feedbackTypeBadge` block:

```tsx
// ── Visual helpers ─────────────────────────────────────────────────────────

function gradeColor(grade: string | null | undefined): string {
  if (!grade) return "text-foreground";
  const g = grade.toLowerCase();
  if (g.includes("exceed") || g.includes("outstanding") || g.includes("exceptional"))
    return "text-emerald-600 dark:text-emerald-400";
  if (g.includes("performing") || g.includes("meeting") || g.includes("meets"))
    return "text-primary";
  if (g.includes("developing") || g.includes("below") || g.includes("needs"))
    return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}

function getQuarterLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const q = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${q} '${String(date.getFullYear()).slice(2)}`;
}

function RatingRing({ rating, size = 80, strokeWidth = 8 }: {
  rating: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = rating ? circumference - (rating / 5) * circumference : circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={strokeWidth}
        className="stroke-muted"
      />
      {rating && (
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-primary transition-all duration-500"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

function GoalRing({ progress, trackingStatus }: {
  progress: number;
  trackingStatus: string;
}) {
  const size = 32;
  const strokeWidth = 4;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;
  const color =
    trackingStatus === "on_track" || trackingStatus === "achieved"
      ? "stroke-emerald-500"
      : trackingStatus === "at_risk"
        ? "stroke-amber-500"
        : "stroke-red-500";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={strokeWidth}
        className="stroke-muted"
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={color}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
```

### Step 3: TypeScript check

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

### Step 4: Commit

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/team/[id]/page.tsx
git commit -m "feat: add RatingRing, GoalRing, gradeColor helpers to profile page"
```

---

## Task 2: Header banner

**Files:**
- Modify: `src/app/dashboard/team/[id]/page.tsx` — replace section 1 (Header)

### Step 1: Find and replace the header section

The header currently starts with `{/* ── 1. Header` and ends just before `{/* ── 2. KPI Strip`. Replace the entire section with:

```tsx
      {/* ── 1. Header ──────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-primary/[0.04] p-6">
        <div className="flex items-start gap-5">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href="/dashboard/team">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <Avatar className="h-24 w-24 shrink-0">
            <AvatarFallback className="text-3xl bg-primary/[0.08] text-primary font-medium">
              {getInitials(user.slack_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {user.slack_name || "Unknown"}
                </h1>
                {user.job_title && (
                  <p className="text-base text-muted-foreground mt-0.5">{user.job_title}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  {[user.department, levelLabel, user.role || "user"].filter(Boolean).join(" · ")}
                </p>
                {manager?.slack_name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Reports to{" "}
                    <Link
                      href={`/dashboard/team/${manager.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {manager.slack_name}
                    </Link>
                  </p>
                )}
                {user.slack_email && (
                  <a
                    href={`mailto:${user.slack_email}`}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1 w-fit"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {user.slack_email}
                  </a>
                )}
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" className="text-xs shrink-0" asChild>
                  <Link href={`/dashboard/team/${id}/edit`}>
                    <Pencil className="h-3 w-3 mr-1.5" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
```

### Step 2: TypeScript check

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

### Step 3: Commit

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/team/[id]/page.tsx
git commit -m "feat: redesign profile header — tinted banner, larger avatar, inline metadata"
```

---

## Task 3: Performance hero card (replace 4 KPI tiles)

**Files:**
- Modify: `src/app/dashboard/team/[id]/page.tsx` — replace section 2 (KPI Strip)

### Step 1: Find and replace the KPI strip

The section currently starts with `{/* ── 2. KPI Strip` and ends just before `{/* ── 3. At-a-Glance Row`. Replace the entire section with:

```tsx
      {/* ── 2. Performance Hero ────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex items-center gap-8">
            {/* Circular rating ring */}
            <div className="relative shrink-0 flex items-center justify-center" style={{ width: 80, height: 80 }}>
              <RatingRing rating={showRating && overallAvg ? parseFloat(overallAvg) : null} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-foreground leading-none">
                  {showRating && overallAvg ? overallAvg : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Overall</span>
              </div>
            </div>

            {/* Grade + inline stats */}
            <div className="flex-1 min-w-0">
              {latestReview?.final_grade &&
                (canSeeAllRatings || latestReview.cycle?.grades_released) && (
                  <p className={`text-2xl font-bold leading-tight ${gradeColor(latestReview.final_grade)}`}>
                    {latestReview.final_grade}
                  </p>
                )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2">
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{reviewAssignments.length}</span>{" "}
                  {reviewAssignments.length === 1 ? "review" : "reviews"}
                </span>
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {onTrackGoals.length}/{activeGoals.length > 0 ? activeGoals.length : goals.length}
                  </span>{" "}
                  goals on track
                </span>
                {showFeedbackSection && (
                  <span className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{continuousFeedback.length}</span>{" "}
                    feedback
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
```

### Step 2: TypeScript check

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

### Step 3: Commit

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/team/[id]/page.tsx
git commit -m "feat: replace 4-tile KPI strip with performance hero card (SVG ring + colored grade)"
```

---

## Task 4: Circular goal indicators

**Files:**
- Modify: `src/app/dashboard/team/[id]/page.tsx` — replace flat progress bars in sections 3 (at-a-glance) and 7 (full goals list)

### Step 1: Replace progress bars in the At-a-Glance Active Goals card

Find the goals snapshot inside section 3 (`{/* Active Goals snapshot */}`). Replace the inner goal row content. The current row renders a flat bar div inside a `div.flex items-center gap-2`. Replace each goal row with:

```tsx
                  return (
                    <div key={goal.id} className="flex items-center gap-3">
                      <GoalRing progress={goal.progress || 0} trackingStatus={goal.tracking_status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{goal.title}</p>
                          <Badge className={`text-[10px] shrink-0 ${tracking.badge}`}>
                            {tracking.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{goal.progress || 0}%</p>
                      </div>
                    </div>
                  );
```

Remove the `barColor` variable — it's no longer needed in this section (GoalRing handles color).

### Step 2: Replace progress bars in the full Goals list (section 7)

In section 7 (`{/* ── 7. All Goals`), each goal row has a progress bar block inside `<div className="flex items-center gap-4">`. Replace the entire row content with:

```tsx
                  return (
                    <div key={goal.id} className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <GoalRing progress={goal.progress || 0} trackingStatus={goal.tracking_status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-medium text-foreground truncate">{goal.title}</p>
                          <Badge className={`text-[10px] font-medium shrink-0 ml-2 ${tracking.badge}`}>
                            {tracking.label}
                          </Badge>
                        </div>
                        {goal.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{goal.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">{goal.progress || 0}%</span>
                          {goal.metric_target && goal.metric_unit && (
                            <span className="text-xs text-muted-foreground">
                              {goal.metric_current ?? goal.metric_start ?? 0} / {goal.metric_target} {goal.metric_unit}
                            </span>
                          )}
                          {goal.due_date && (
                            <span className="text-[11px] text-muted-foreground">
                              Due {format(new Date(goal.due_date), "MMM d")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
```

Note: the outer `<div key={goal.id} className="p-3 rounded-lg border border-border/60">` wrapper is replaced — the new row is self-contained with hover state instead of a static border.

Also remove the `<div className="space-y-2">` wrapper's inner border styling — change it to `<div className="space-y-1">`.

### Step 3: TypeScript check

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

### Step 4: Commit

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/team/[id]/page.tsx
git commit -m "feat: replace flat progress bars with circular SVG goal indicators"
```

---

## Task 5: Reviews list + typography/border cleanup

**Files:**
- Modify: `src/app/dashboard/team/[id]/page.tsx` — sections 4 (competencies), 5 (feedback), 6 (reviews), 8 (direct reports) + section titles throughout

### Step 1: Reviews list — quarter chips + colored grades

In section 6 (`{/* ── 6. All Reviews`), replace each review row. The current row is a `flex justify-between p-3 border`. Replace with:

```tsx
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      {/* Quarter chip */}
                      <div className="w-14 shrink-0">
                        <span className="inline-block rounded-md bg-muted px-2 py-1 text-xs font-mono font-medium text-foreground">
                          {getQuarterLabel(a.cycle?.start_date)}
                        </span>
                      </div>
                      {/* Cycle info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {a.cycle?.name || "Unknown Cycle"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.manager?.slack_name || "Unassigned"}
                        </p>
                      </div>
                      {/* Grade + status */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {a.final_grade && (canSeeAllRatings || a.cycle?.grades_released) && (
                          <span className={`text-sm font-semibold ${gradeColor(a.final_grade)}`}>
                            {a.final_grade}
                          </span>
                        )}
                        {!a.final_grade && a.overall_rating && (canSeeAllRatings || a.cycle?.grades_released) && (
                          <span className="text-sm font-semibold text-foreground">
                            {a.overall_rating}/5
                          </span>
                        )}
                        <Badge className={`text-[10px] font-medium ${config.badge}`}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  );
```

Change the `<div className="space-y-2">` wrapper to `<div className="space-y-1">`.

### Step 2: Section titles — larger, no icon on every title

Update all `CardTitle` elements to `text-lg font-semibold`:

- Section 4 (Competencies): `<CardTitle className="text-lg font-semibold flex items-center gap-2">` — keep Star icon (useful)
- Section 5 (Feedback): `<CardTitle className="text-lg font-semibold flex items-center gap-2">` — keep MessageSquare icon (useful)
- Section 6 (Reviews): `<CardTitle className="text-lg font-semibold">Performance Reviews</CardTitle>` — remove FileText icon (redundant — it's obvious)
- Section 7 (Goals): `<CardTitle className="text-lg font-semibold">Goals</CardTitle>` — remove Target icon
- Section 8 (Direct Reports): `<CardTitle className="text-lg font-semibold flex items-center gap-2">` — keep Users icon (useful for this section)

Also update the At-a-Glance card titles in section 3:
- Latest Review: `<CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Latest Review</CardTitle>` — remove FileText icon
- Active Goals: `<CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active Goals</CardTitle>` — remove Target icon

### Step 3: Inner rows — swap borders for hover state

**Competency rows** (section 4): change each row from:
```tsx
className="flex items-center justify-between p-3 rounded-lg border border-border/60"
```
to:
```tsx
className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors"
```

**Feedback rows** (section 5): change each row from:
```tsx
className="p-3 rounded-lg border border-border/60"
```
to:
```tsx
className="px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors"
```

**Direct Reports chips** (section 8): the existing `border border-border/60 hover:border-border hover:shadow-sm` is fine — keep it, these are clickable link chips that benefit from a visible border.

### Step 4: Remove unused imports

After all edits, check if `Target` and `FileText` are still used (they may still appear in At-a-Glance section titles — if removed there, check if used anywhere else). Remove from the lucide-react import line if unused.

```bash
grep -n "Target\|FileText" "/Users/filipnowakowski/Test - Slack/feedback-app/src/app/dashboard/team/[id]/page.tsx"
```

Remove any that are no longer referenced.

### Step 5: TypeScript check

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

### Step 6: Commit

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/team/[id]/page.tsx
git commit -m "feat: reviews quarter chips, colored grades, hover rows, larger section titles"
```

---

## Task 6: Push + deploy

### Step 1: Push to GitHub

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && git push
```

### Step 2: Deploy

Use the `vercel:deploy` skill to deploy to production.

### Step 3: Smoke test checklist

Open https://nami-ochre.vercel.app → Team → click any member.

- [ ] Header sits on a tinted panel, avatar is 96px, name is large and bold
- [ ] No badge cluster in header — single metadata line with dots
- [ ] Performance hero card shows SVG ring + rating + grade (colored) + 3 inline stats
- [ ] Goals show circular donuts (not flat bars) in both At-a-Glance and full Goals list
- [ ] Reviews list shows Q-chip on left, colored grade on right, no per-row borders
- [ ] Section titles are larger; Reviews and Goals have no icon prefix
- [ ] Competency and Feedback rows have no border, hover shows subtle bg
