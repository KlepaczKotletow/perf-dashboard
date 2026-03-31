# Easy-Use Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add one-click "Use Template" actions to Cycle Profiles (dialog → draft cycle), Review Templates (smart link auto-applies questions in wizard), and Goal Templates (smart link pre-fills goal form).

**Architecture:** Three independent changes. (1) New `CycleImportDialog` client component modelled on `function-import-dialog.tsx`. (2) URL param `?reviewTemplate=<id>` handled in the new-cycle wizard's `useEffect`. (3) URL param `?templateId=<id>` handled in the new-goal page's `useEffect`. All inserts go client-side via Supabase. No new DB tables.

**Tech Stack:** Next.js 14 App Router, React, Supabase JS client, shadcn/ui (Dialog, Button, Input, Label, Popover/Calendar for dates)

---

## Task 1: CycleImportDialog component

**Files:**
- Create: `src/app/dashboard/templates/cycle-import-dialog.tsx`

This dialog lets a user pick a name + start/end dates for a new draft cycle, then creates it in one click.

**Step 1: Create the file with the full component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CalendarClock, Layers, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { getClientIdentity } from "@/lib/client-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CycleProfileContent {
  cycle_type?: string;
  suggested_description?: string;
  suggested_competency_categories?: string[];
  review_template_name?: string;
}

interface CycleImportDialogProps {
  template: {
    id: string;
    name: string;
    description: string | null;
    content: any;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CYCLE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  mid_year: "Mid-Year",
  quarterly: "Quarterly",
  probation: "Probation",
  custom: "Custom",
};

const CYCLE_TYPE_COLORS: Record<string, string> = {
  annual: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  mid_year: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800",
  quarterly: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
  probation: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
  custom: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
};

// ── Main dialog ──────────────────────────────────────────────────────────────

export function CycleImportDialog({
  template,
  open,
  onOpenChange,
}: CycleImportDialogProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cycleName, setCycleName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const content = template.content as CycleProfileContent | undefined;
  const cycleType = content?.cycle_type || "custom";
  const categories = content?.suggested_competency_categories ?? [];

  // ── Create draft cycle ──────────────────────────────────────────────────

  async function handleCreate() {
    const trimmedName = cycleName.trim();
    if (!trimmedName) { setError("Cycle name is required."); return; }
    if (!startDate) { setError("Start date is required."); return; }
    if (!endDate) { setError("End date is required."); return; }
    if (new Date(endDate) <= new Date(startDate)) {
      setError("End date must be after start date.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const supabase = createClient();
      const identity = await getClientIdentity(supabase);
      if (!identity) throw new Error("Not authenticated");

      const { data: cycle, error: insertError } = await supabase
        .from("performance_cycles")
        .insert({
          name: trimmedName,
          description: content?.suggested_description || null,
          type: cycleType,
          status: "draft",
          start_date: startDate,
          end_date: endDate,
          workspace_id: identity.workspaceId,
          created_by: identity.userId,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      onOpenChange(false);
      router.push(`/dashboard/cycles/${cycle.id}`);
      router.refresh();
    } catch (err: any) {
      console.error("Error creating cycle:", err);
      setError(err?.message || "Failed to create cycle. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // ── Reset on close ──────────────────────────────────────────────────────

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setCycleName("");
      setStartDate("");
      setEndDate("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  // Pre-fill name from template when dialog opens
  function handleOpenChangeWrapper(nextOpen: boolean) {
    if (nextOpen && !cycleName) {
      setCycleName(template.name);
    }
    handleOpenChange(nextOpen);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeWrapper}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            {template.name}
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        {/* ── Profile preview ── */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] capitalize ${CYCLE_TYPE_COLORS[cycleType] || CYCLE_TYPE_COLORS.custom}`}
            >
              {CYCLE_TYPE_LABELS[cycleType] || cycleType}
            </Badge>
          </div>
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span>
                Competency focus:{" "}
                <span className="text-foreground font-medium">
                  {categories.join(", ")}
                </span>
              </span>
            </div>
          )}
          {content?.review_template_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>
                Review template:{" "}
                <span className="text-foreground font-medium">
                  {content.review_template_name}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ── Form ── */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cycle-name">Cycle Name</Label>
            <Input
              id="cycle-name"
              value={cycleName}
              onChange={(e) => setCycleName(e.target.value)}
              placeholder="e.g. Q2 2026 Performance Review"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {creating ? "Creating..." : "Create Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify the file exists and TypeScript compiles**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to the new file.

**Step 3: Commit**

```bash
git add src/app/dashboard/templates/cycle-import-dialog.tsx
git commit -m "feat: add CycleImportDialog for one-click draft cycle creation"
```

---

## Task 2: Wire CycleProfileCard to use the dialog

**Files:**
- Modify: `src/app/dashboard/templates/templates-client.tsx`

Replace the "Use in Wizard" link button with a "Use Template" button that opens `CycleImportDialog`.

**Step 1: Add the import at the top of templates-client.tsx**

After the existing import line:
```tsx
import { FunctionImportDialog } from "./function-import-dialog";
```

Add:
```tsx
import { CycleImportDialog } from "./cycle-import-dialog";
```

**Step 2: Refactor CycleProfileCard to own dialog state**

Replace the current `CycleProfileCard` function (lines ~273–355) with this version that adds state + dialog:

```tsx
function CycleProfileCard({ template, workspaceId }: { template: Template; workspaceId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const content = template.content as {
    cycle_type: string;
    suggested_description: string;
    suggested_competency_categories: string[];
    review_template_name: string;
    phase_weights: number[];
  } | null;

  const cycleType = content?.cycle_type || "custom";
  const categories = content?.suggested_competency_categories || [];

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground">
                  {template.name}
                </span>
                {template.is_system && (
                  <Badge
                    variant="outline"
                    className="text-[10px] shrink-0 border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400"
                  >
                    System
                  </Badge>
                )}
              </div>
              {template.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge
                variant="outline"
                className={`text-[10px] capitalize ${CYCLE_TYPE_COLORS[cycleType] || CYCLE_TYPE_COLORS.custom}`}
              >
                {cycleType}
              </Badge>
            </div>
          </div>

          {/* Details */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span>
                Review template:{" "}
                <span className="font-medium text-foreground">
                  {content?.review_template_name || "None"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3 w-3" />
              <span>
                Categories:{" "}
                {categories.map((cat, i) => (
                  <span key={cat}>
                    {i > 0 && ", "}
                    <span className="font-medium text-foreground">{cat}</span>
                  </span>
                ))}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 px-5 py-2.5 flex items-center justify-end">
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            Use Template
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      <CycleImportDialog
        template={template}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
```

Note: `CycleProfileCard` in `templates-client.tsx` currently receives only `{ template }`. The `workspaceId` prop isn't used by the dialog (it gets it from `getClientIdentity`), so the signature can stay as `{ template: Template }` — just don't add `workspaceId` if the dialog doesn't need it. Check how the card is called in the grid; it passes only `template`.

**Step 3: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/dashboard/templates/templates-client.tsx
git commit -m "feat: replace cycle profile 'Use in Wizard' link with CycleImportDialog"
```

---

## Task 3: Add "Use Template" button to ReviewTemplateRow

**Files:**
- Modify: `src/app/dashboard/templates/templates-client.tsx`

The `ReviewTemplateRow` component is currently a `<Link>` that wraps the entire row. We need to keep the row clickable for "View" but add a separate "Use Template" button.

**Step 1: Refactor ReviewTemplateRow**

Replace the current `ReviewTemplateRow` function (currently a single `<Link>` wrapping the whole row) with a version that has two actions — a row link to view, and a "Use Template" button:

```tsx
function ReviewTemplateRow({ template }: { template: Template }) {
  return (
    <div className="grid grid-cols-[1fr_80px_140px_120px_140px] items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group">
      {/* Name + description + badges — clicking navigates to detail */}
      <Link href={`/dashboard/templates/${template.id}`} className="min-w-0 block">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {template.name}
          </span>
          {template.is_default && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              Default
            </Badge>
          )}
          {template.is_system && (
            <Badge
              variant="outline"
              className="text-[10px] shrink-0 border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400"
            >
              System
            </Badge>
          )}
        </div>
        {template.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {template.description}
          </p>
        )}
      </Link>

      {/* Question count */}
      <span className="text-sm text-foreground text-center tabular-nums">
        {Array.isArray(template.questions) ? template.questions.length : 0}
      </span>

      {/* Creator */}
      <span className="text-sm text-muted-foreground truncate">
        {template.creator?.slack_name || "System"}
      </span>

      {/* Date */}
      <span className="text-sm text-muted-foreground">
        {format(new Date(template.created_at), "MMM d, yyyy")}
      </span>

      {/* Use Template button */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="default" size="sm" className="h-7 text-xs" asChild>
          <Link href={`/dashboard/cycles/new?reviewTemplate=${template.id}`}>
            Use Template
          </Link>
        </Button>
      </div>
    </div>
  );
}
```

Also update the column header row in the reviews tab to match the new grid — change the last column from the arrow to "Actions":

Find the header row inside the Reviews tab content (it's a `<div className="grid grid-cols-[1fr_80px_140px_120px_40px]...">` above the `.map()`) and update it to `grid-cols-[1fr_80px_140px_120px_140px]` with "Actions" as the last header.

**Step 2: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/dashboard/templates/templates-client.tsx
git commit -m "feat: add 'Use Template' button to review template rows"
```

---

## Task 4: Auto-apply review template in new-cycle wizard

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

When `?reviewTemplate=<id>` is in the URL, auto-call `applyTemplate()` after templates are loaded.

**Step 1: Add param handling in the `load()` useEffect**

In the `load()` function inside the `useEffect` (around line 326, right after the `?profile=` handling block), add:

```ts
// ── Auto-apply review template if ?reviewTemplate=<id> ──
const reviewTemplateId = searchParams.get("reviewTemplate");
if (reviewTemplateId && (tplData || []).length > 0) {
  const tpl = (tplData as Template[]).find((t) => t.id === reviewTemplateId);
  if (tpl) {
    // Apply it (sets textQuestions and shows templateApplied toast)
    const mapped: TextQuestion[] = (tpl.questions || []).map((q: any) => ({
      prompt: q.prompt || q.text,
      required: q.required !== false,
    }));
    setTextQuestions(mapped);
    setTemplateApplied(tpl.name);
    setTimeout(() => setTemplateApplied(null), 2500);
  }
}
```

Note: Place this AFTER the `?profile=` block and BEFORE the `return` statement that exits early on draft restore. It should only run on fresh loads (no draft restore), same as the profile handling.

Actually — look at the code flow:
- Lines 278–323: draft restore (returns early if draft found)
- Lines 327–328: default selection
- Lines 330–337: `?profile=` auto-apply

Add the `?reviewTemplate` block right after `?profile=` at line 337:

```ts
// ── Auto-apply review template if ?reviewTemplate=<id> ──
const reviewTemplateId = searchParams.get("reviewTemplate");
if (reviewTemplateId) {
  const loadedTemplates = (tplData || []) as Template[];
  const tpl = loadedTemplates.find((t) => t.id === reviewTemplateId);
  if (tpl) {
    const mapped: TextQuestion[] = (tpl.questions || []).map((q: any) => ({
      prompt: q.prompt || q.text,
      required: q.required !== false,
    }));
    setTextQuestions(mapped);
    setTemplateApplied(tpl.name);
    setTimeout(() => setTemplateApplied(null), 2500);
  }
}
```

**Step 2: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat: auto-apply review template in new-cycle wizard via ?reviewTemplate param"
```

---

## Task 5: Add "Use Template" button to goal template cards

**Files:**
- Modify: `src/app/dashboard/templates/templates-client.tsx`

Replace the "View" button on each goal template card with "Use Template" linking to `/dashboard/goals/new?templateId=<id>`.

**Step 1: Update the goal templates card rendering**

Find the goal templates section in `TemplatesClient` (around line 643, inside `goalTemplates.map()`). Replace the footer buttons:

Current code:
```tsx
<div className="flex gap-2 pt-1">
  <Button size="sm" variant="outline" className="text-xs h-7" asChild>
    <Link href={`/dashboard/templates/${tpl.id}`}>View</Link>
  </Button>
</div>
```

Replace with:
```tsx
<div className="flex gap-2 pt-1">
  <Button size="sm" variant="outline" className="text-xs h-7" asChild>
    <Link href={`/dashboard/templates/${tpl.id}`}>View</Link>
  </Button>
  <Button size="sm" variant="default" className="text-xs h-7" asChild>
    <Link href={`/dashboard/goals/new?templateId=${tpl.id}`}>
      Use Template
    </Link>
  </Button>
</div>
```

**Step 2: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/dashboard/templates/templates-client.tsx
git commit -m "feat: add 'Use Template' button to goal template cards"
```

---

## Task 6: Auto-apply goal template in new-goal form

**Files:**
- Modify: `src/app/dashboard/goals/new/page.tsx`

When `?templateId=<id>` is in the URL, auto-apply that template after the workspace templates load.

**Step 1: Read the searchParam and call applyWorkspaceTemplate**

The `load()` function in the `useEffect` (lines 55–86) already loads `workspaceGoalTemplates` from the DB. After setting state (line 76 `setWorkspaceGoalTemplates(goalTpls || [])`), add:

```ts
// ── Auto-apply goal template if ?templateId=<id> ──
const templateId = searchParams.get("templateId");
if (templateId && goalTpls && goalTpls.length > 0) {
  const tpl = (goalTpls as any[]).find((t) => t.id === templateId);
  if (tpl) {
    const content = tpl.content || {};
    if (content.title) setTitle(content.title);
    if (content.scope) setScope(content.scope);
    if (content.metric_start != null) {
      setMetricStart(String(content.metric_start));
      setShowAdvanced(true);
    }
    if (content.metric_target != null) {
      setMetricTarget(String(content.metric_target));
      setShowAdvanced(true);
    }
    if (content.metric_unit) {
      setMetricUnit(content.metric_unit);
      setShowAdvanced(true);
    }
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }
}
```

**Step 2: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Do a build to confirm everything works end-to-end**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx next build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` with no type errors.

**Step 4: Commit**

```bash
git add src/app/dashboard/goals/new/page.tsx
git commit -m "feat: auto-apply goal template in new-goal form via ?templateId param"
```

---

## Summary of all commits

1. `feat: add CycleImportDialog for one-click draft cycle creation`
2. `feat: replace cycle profile 'Use in Wizard' link with CycleImportDialog`
3. `feat: add 'Use Template' button to review template rows`
4. `feat: auto-apply review template in new-cycle wizard via ?reviewTemplate param`
5. `feat: add 'Use Template' button to goal template cards`
6. `feat: auto-apply goal template in new-goal form via ?templateId param`
