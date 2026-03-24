# Cycle Creation Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-page cycle creation form with a 5-step wizard, fix all validation gaps, improve Nami bot reliability, and add draft auto-save.

**Architecture:** Refactor `cycles/new/page.tsx` into a step-based wizard (same pattern as `surveys/new/page.tsx`). Fix Nami notification queries from fuzzy LIKE to exact match. Add smart re-send that only targets users who weren't notified. Add `wizard_metadata` JSONB column for auto-save state.

**Tech Stack:** Next.js 14, shadcn/ui, Supabase (Postgres + Edge Functions), Tailwind CSS, date-fns

---

### Task 1: Database Migration — Add wizard_metadata column

**Files:**
- Create: `supabase/migrations/YYYYMMDD_add_wizard_metadata.sql` (use current timestamp)

**Step 1: Write the migration**

```sql
ALTER TABLE performance_cycles
ADD COLUMN IF NOT EXISTS wizard_metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN performance_cycles.wizard_metadata IS 'Stores wizard step progress and auto-save state for cycle creation';
```

**Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool with name `add_wizard_metadata` and the SQL above.

**Step 3: Verify**

Run `execute_sql`: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'performance_cycles' AND column_name = 'wizard_metadata';`

Expected: 1 row with `jsonb` type.

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(cycles): add wizard_metadata column for auto-save"
```

---

### Task 2: Refactor cycle creation into 5-step wizard shell

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

**Context:** The current file has all state at lines 140-179, validation at 208-223, form fields at 445-715, and Nami dialog at 742-790. The survey creation page (`src/app/dashboard/surveys/new/page.tsx`) uses `useState<1 | 2 | 3>` with conditional rendering — follow this exact pattern but with 5 steps.

**Step 1: Add step state and stepper UI**

At the top of the component (after existing state declarations around line 179), add:

```tsx
const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
```

Add a step indicator bar at the top of the return JSX (before the existing form content). Use this pattern:

```tsx
const steps = [
  { num: 1, label: "Basics & Dates" },
  { num: 2, label: "People" },
  { num: 3, label: "Questions" },
  { num: 4, label: "Nami Bot" },
  { num: 5, label: "Review & Launch" },
];

// In JSX, before the Card:
<div className="flex items-center justify-between mb-8">
  {steps.map((s, i) => (
    <div key={s.num} className="flex items-center">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
        step === s.num ? "bg-primary text-primary-foreground" :
        step > s.num ? "bg-primary/20 text-primary" :
        "bg-muted text-muted-foreground"
      }`}>
        {step > s.num ? "✓" : s.num}
      </div>
      <span className={`ml-2 text-sm ${step === s.num ? "font-medium" : "text-muted-foreground"}`}>
        {s.label}
      </span>
      {i < steps.length - 1 && <div className="w-12 h-px bg-border mx-3" />}
    </div>
  ))}
</div>
```

**Step 2: Wrap existing form sections in step conditionals**

Move the existing form sections into step-gated blocks:

- Lines 445-496 (name, type, dates, description) → `{step === 1 && (<Card>...</Card>)}`
- Lines 498-563 (people selection) → `{step === 2 && (<Card>...</Card>)}`
- Lines 565-691 (review questions) → `{step === 3 && (<Card>...</Card>)}`
- Create new Step 4 for Nami config (extract from the dialog at lines 742-790 into inline content)
- Create new Step 5 summary view

**Step 3: Add navigation buttons**

At the bottom of each step, add:

```tsx
<div className="flex justify-between mt-6">
  {step > 1 && (
    <Button variant="outline" onClick={() => setStep((step - 1) as any)}>
      <ArrowLeft className="w-4 h-4 mr-2" /> Back
    </Button>
  )}
  <div className="flex gap-2 ml-auto">
    <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
      Save Draft
    </Button>
    {step < 5 ? (
      <Button onClick={() => handleNextStep()} disabled={!canProceed()}>
        Next <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    ) : (
      <Button onClick={handleCreateAndLaunch} disabled={loading || !canLaunch()}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Launch Cycle
      </Button>
    )}
  </div>
</div>
```

**Step 4: Verify the shell renders**

Run the dev server, navigate to `/dashboard/cycles/new`. Each step should show the correct section when clicking Next/Back. No functionality changes yet.

**Step 5: Commit**

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat(cycles): refactor creation into 5-step wizard shell"
```

---

### Task 3: Step 1 — Cycle Basics & Dates with full validation

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

**Step 1: Add per-step validation**

Replace the existing `validateForDraft()` and `validateForLaunch()` (lines 208-223) with per-step validation:

```tsx
const canProceedStep1 = (): string | null => {
  if (!name.trim()) return "Cycle name is required";
  if (!startDate) return "Start date is required";
  if (!endDate) return "End date is required";
  if (startDate >= endDate) return "End date must be after start date";
  if (startDate < new Date(new Date().toDateString())) return "Start date must be in the future";
  if (reviewDeadline) {
    if (reviewDeadline < startDate) return "Review deadline cannot be before start date";
    if (reviewDeadline > endDate) return "Review deadline cannot be after end date";
  }
  return null;
};
```

**Step 2: Show inline validation errors**

Add `stepError` state and display it below the form fields:

```tsx
const [stepError, setStepError] = useState<string | null>(null);

const handleNextStep = () => {
  let err: string | null = null;
  if (step === 1) err = canProceedStep1();
  if (step === 2) err = canProceedStep2();
  if (step === 3) err = canProceedStep3();
  if (step === 4) err = canProceedStep4();
  if (err) { setStepError(err); return; }
  setStepError(null);
  setStep((step + 1) as any);
};
```

Show error: `{stepError && <p className="text-sm text-destructive mt-2">{stepError}</p>}`

**Step 3: Add phase timeline preview**

After the date fields in Step 1, add a visual phase bar:

```tsx
{startDate && endDate && startDate < endDate && (
  <div className="mt-6">
    <Label className="text-sm text-muted-foreground mb-2 block">Phase Timeline Preview</Label>
    <div className="flex rounded-lg overflow-hidden h-8 bg-muted">
      {["Goal Setting", "Self Assessment", "Peer Review", "Manager Review", "Calibration", "Communication"].map((phase, i) => {
        const weights = [0.15, 0.20, 0.20, 0.20, 0.15, 0.10];
        return (
          <div
            key={phase}
            className={`flex items-center justify-center text-xs font-medium border-r border-background last:border-r-0 ${
              i % 2 === 0 ? "bg-primary/10 text-primary" : "bg-primary/20 text-primary"
            }`}
            style={{ width: `${weights[i] * 100}%` }}
            title={phase}
          >
            {weights[i] >= 0.15 ? phase : ""}
          </div>
        );
      })}
    </div>
  </div>
)}
```

**Step 4: Verify**

Navigate to Step 1. Confirm:
- Cannot proceed without name + dates
- Error shows if end < start
- Error shows if deadline outside range
- Phase bar renders when valid dates entered

**Step 5: Commit**

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat(cycles): step 1 validation — dates, cross-field checks, phase preview"
```

---

### Task 4: Step 2 — People with Slack ID warnings

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

**Step 1: Add Slack ID check to user fetch**

When fetching users (existing query around line 186), ensure `slack_user_id` is included in the select. It likely already is — verify. Then add a computed value:

```tsx
const usersWithoutSlack = users.filter(
  (u: any) => selectedPeopleIds.has(u.id) && !u.slack_user_id
);
```

**Step 2: Add warning banner in Step 2**

After the people selector, show:

```tsx
{usersWithoutSlack.length > 0 && (
  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mt-4">
    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
    <div>
      <p className="text-sm font-medium text-amber-800">
        {usersWithoutSlack.length} employee{usersWithoutSlack.length > 1 ? "s" : ""} without Slack account
      </p>
      <p className="text-xs text-amber-600 mt-1">
        They won't receive Nami bot notifications. You can still include them — they'll need to complete reviews via the dashboard.
      </p>
      <div className="flex flex-wrap gap-1 mt-2">
        {usersWithoutSlack.map((u: any) => (
          <Badge key={u.id} variant="outline" className="text-xs text-amber-700 border-amber-300">
            {u.full_name || u.slack_name || u.email}
          </Badge>
        ))}
      </div>
    </div>
  </div>
)}
```

**Step 3: Add manager assignments preview**

After selecting people, show a preview table:

```tsx
{selectedPeopleIds.size > 0 && (
  <div className="mt-4">
    <Label className="text-sm text-muted-foreground mb-2 block">Assignment Preview</Label>
    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
      {users.filter((u: any) => selectedPeopleIds.has(u.id)).map((u: any) => {
        const mgr = users.find((m: any) => m.id === u.manager_id);
        return (
          <div key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{u.full_name || u.slack_name}</span>
            <span className="text-muted-foreground">
              {mgr ? `→ ${mgr.full_name || mgr.slack_name}` : "No manager"}
            </span>
          </div>
        );
      })}
    </div>
  </div>
)}
```

**Step 4: Add Step 2 validation**

```tsx
const canProceedStep2 = (): string | null => {
  if (selectedPeopleIds.size === 0) return "Select at least 1 employee";
  return null;
};
```

**Step 5: Verify and commit**

Confirm warning shows for users without Slack, assignments preview renders, can't proceed with 0 people.

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat(cycles): step 2 — people selection with Slack warnings & assignment preview"
```

---

### Task 5: Step 3 — Questions with minimum requirement

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

**Step 1: Add Step 3 validation**

```tsx
const canProceedStep3 = (): string | null => {
  if (selectedCompIds.size === 0 && textQuestions.length === 0) {
    return "Add at least 1 competency or text question — without questions, reviewers won't have anything to rate";
  }
  return null;
};
```

This is the **critical gap fix** — currently you can launch with 0 questions and Nami sends messages but reviews are empty.

**Step 2: Add a visual hint**

At the top of Step 3, add context:

```tsx
<p className="text-sm text-muted-foreground">
  Choose competencies to rate and/or add custom questions. These will be sent to reviewers via Nami.
</p>
```

**Step 3: Verify and commit**

Confirm: cannot proceed to Step 4 without at least 1 competency or question.

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat(cycles): step 3 — require min 1 question/competency before launch"
```

---

### Task 6: Step 4 — Nami Bot inline configuration

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

**Context:** Currently Nami config is a dialog (lines 742-790) that opens after the cycle is created. Move it inline as Step 4 content.

**Step 1: Move Nami config from dialog to Step 4**

Extract the Nami dialog content into Step 4 inline. Calculate send counts when entering Step 4:

```tsx
{step === 4 && (
  <Card>
    <CardHeader>
      <CardTitle>Nami Bot Notifications</CardTitle>
      <CardDescription>Configure when and how Nami sends review prompts via Slack</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Send counts preview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
          <p className="text-2xl font-bold text-blue-700">{selfReviewCount}</p>
          <p className="text-xs text-blue-600">Self-review prompts</p>
        </div>
        <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center">
          <p className="text-2xl font-bold text-purple-700">{managerReviewCount}</p>
          <p className="text-xs text-purple-600">Manager review prompts</p>
        </div>
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
          <p className="text-2xl font-bold text-green-700">{upwardReviewCount}</p>
          <p className="text-xs text-green-600">Upward feedback prompts</p>
        </div>
      </div>

      {/* Missing Slack warning (reuse from Step 2) */}
      {usersWithoutSlack.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            ⚠ {usersWithoutSlack.length} employee(s) will be skipped — no Slack account
          </p>
        </div>
      )}

      {/* Send mode */}
      <div className="space-y-3">
        <Label>When to send notifications</Label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={namiScheduleMode === "now"} onChange={() => setNamiScheduleMode("now")} />
            <span className="text-sm">Send immediately on launch</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={namiScheduleMode === "schedule"} onChange={() => setNamiScheduleMode("schedule")} />
            <span className="text-sm">Schedule for later</span>
          </label>
        </div>
        {namiScheduleMode === "schedule" && (
          <Input
            type="datetime-local"
            value={namiScheduleDate}
            onChange={(e) => setNamiScheduleDate(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
        )}
      </div>

      {/* Skip option */}
      <Button variant="ghost" size="sm" className="text-muted-foreground"
        onClick={() => { setSkipNami(true); setStep(5); }}>
        Skip Nami — I'll notify people manually
      </Button>
    </CardContent>
  </Card>
)}
```

**Step 2: Add Step 4 validation**

```tsx
const [skipNami, setSkipNami] = useState(false);

const canProceedStep4 = (): string | null => {
  if (skipNami) return null;
  if (namiScheduleMode === "schedule") {
    if (!namiScheduleDate) return "Select a schedule date";
    if (new Date(namiScheduleDate) <= new Date()) return "Schedule date must be in the future";
  }
  return null;
};
```

**Step 3: Calculate send counts**

Add computed values (calculate from selected people and their managers):

```tsx
const selectedUsers = users.filter((u: any) => selectedPeopleIds.has(u.id));
const selfReviewCount = selectedUsers.length;
const managersWithEmployees = selectedUsers.filter((u: any) => u.manager_id);
const uniqueManagers = new Set(managersWithEmployees.map((u: any) => u.manager_id));
const managerReviewCount = uniqueManagers.size;
const upwardReviewCount = managersWithEmployees.filter((u: any) =>
  selectedPeopleIds.has(u.manager_id)
).length;
```

**Step 4: Verify and commit**

Confirm: send counts display correctly, schedule validation works, Skip Nami goes to Step 5.

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat(cycles): step 4 — inline Nami config with send preview & schedule validation"
```

---

### Task 7: Step 5 — Review & Launch summary

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

**Step 1: Build summary view**

```tsx
{step === 5 && (
  <Card>
    <CardHeader>
      <CardTitle>Review & Launch</CardTitle>
      <CardDescription>Confirm everything looks right before launching</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Section: Basics */}
      <div className="flex justify-between items-start p-4 rounded-lg border">
        <div>
          <h4 className="font-medium text-sm">Cycle Basics</h4>
          <p className="text-sm mt-1">{name} ({cycleType || "custom"})</p>
          <p className="text-xs text-muted-foreground mt-1">
            {startDate ? format(startDate, "MMM d, yyyy") : "—"} → {endDate ? format(endDate, "MMM d, yyyy") : "—"}
            {reviewDeadline && ` · Deadline: ${format(reviewDeadline, "MMM d, yyyy")}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Edit</Button>
      </div>

      {/* Section: People */}
      <div className="flex justify-between items-start p-4 rounded-lg border">
        <div>
          <h4 className="font-medium text-sm">People</h4>
          <p className="text-sm mt-1">{selectedPeopleIds.size} employees enrolled</p>
          {usersWithoutSlack.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {usersWithoutSlack.length} without Slack
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStep(2)}>Edit</Button>
      </div>

      {/* Section: Questions */}
      <div className="flex justify-between items-start p-4 rounded-lg border">
        <div>
          <h4 className="font-medium text-sm">Review Questions</h4>
          <p className="text-sm mt-1">
            {selectedCompIds.size} competencies, {textQuestions.length} text questions
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStep(3)}>Edit</Button>
      </div>

      {/* Section: Nami */}
      <div className="flex justify-between items-start p-4 rounded-lg border">
        <div>
          <h4 className="font-medium text-sm">Nami Bot</h4>
          <p className="text-sm mt-1">
            {skipNami ? "Skipped — manual notification" :
             namiScheduleMode === "now" ? "Send immediately on launch" :
             `Scheduled for ${namiScheduleDate}`}
          </p>
          {!skipNami && (
            <p className="text-xs text-muted-foreground mt-1">
              {selfReviewCount + managerReviewCount + upwardReviewCount} total messages
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStep(4)}>Edit</Button>
      </div>
    </CardContent>
  </Card>
)}
```

**Step 2: Update submit handler**

Modify `handleCreateAndLaunch()` to:
- Remove the old Nami dialog trigger — now Nami config is already set in Step 4
- Set `nami_confirmed` and `nami_send_at` based on Step 4 state directly during cycle insert
- Call `sendNotifications()` only if `namiScheduleMode === "now"` and `!skipNami`

**Step 3: Remove old Nami dialog**

Delete the Nami confirmation dialog (lines 742-790) since it's replaced by Step 4 inline content.

**Step 4: Verify and commit**

Full flow test: fill all 5 steps, review summary, launch. Confirm:
- Summary shows correct data from all steps
- Edit buttons jump to correct step
- Launch creates cycle + assignments + triggers Nami

```bash
git add src/app/dashboard/cycles/new/page.tsx
git commit -m "feat(cycles): step 5 — review summary with edit links, clean launch flow"
```

---

### Task 8: Draft auto-save

**Files:**
- Modify: `src/app/dashboard/cycles/new/page.tsx`

**Step 1: Add auto-save on step transitions**

```tsx
const autoSaveDraft = async () => {
  if (!name.trim()) return; // Need at least a name
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const wizardState = {
    step,
    cycleType, description, showDescription,
    selectedPeopleIds: Array.from(selectedPeopleIds),
    selectedCompIds: Array.from(selectedCompIds),
    textQuestions,
    namiScheduleMode, namiScheduleDate, skipNami,
  };

  if (pendingCycleId) {
    // Update existing draft
    await supabase.from("performance_cycles").update({
      name, description,
      type: cycleType || "custom",
      start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
      end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      review_deadline: reviewDeadline ? format(reviewDeadline, "yyyy-MM-dd") : null,
      wizard_metadata: wizardState,
      updated_at: new Date().toISOString(),
    }).eq("id", pendingCycleId);
  } else {
    // Create new draft
    const { data } = await supabase.from("performance_cycles").insert({
      name, description,
      type: cycleType || "custom",
      start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
      end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      review_deadline: reviewDeadline ? format(reviewDeadline, "yyyy-MM-dd") : null,
      status: "draft",
      workspace_id: workspaceId,
      created_by: userId,
      wizard_metadata: wizardState,
    }).select("id").single();
    if (data) setPendingCycleId(data.id);
  }
};
```

**Step 2: Call auto-save on step transitions**

In `handleNextStep()`, add `autoSaveDraft()` call after validation passes:

```tsx
const handleNextStep = async () => {
  // ... validation ...
  setStepError(null);
  await autoSaveDraft();
  setStep((step + 1) as any);
};
```

**Step 3: Restore draft state on page load**

If URL has `?draft=<id>`, load the draft and restore wizard state:

```tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const draftId = params.get("draft");
  if (draftId) {
    loadDraft(draftId);
  }
}, []);

const loadDraft = async (id: string) => {
  const { data } = await supabase
    .from("performance_cycles")
    .select("*")
    .eq("id", id)
    .eq("status", "draft")
    .single();
  if (!data) return;

  setPendingCycleId(id);
  setName(data.name || "");
  setCycleType(data.type || "custom");
  setDescription(data.description || "");
  if (data.start_date) setStartDate(new Date(data.start_date));
  if (data.end_date) setEndDate(new Date(data.end_date));
  if (data.review_deadline) setReviewDeadline(new Date(data.review_deadline));

  const meta = data.wizard_metadata;
  if (meta) {
    if (meta.step) setStep(meta.step);
    if (meta.selectedPeopleIds) setSelectedPeopleIds(new Set(meta.selectedPeopleIds));
    if (meta.selectedCompIds) setSelectedCompIds(new Set(meta.selectedCompIds));
    if (meta.textQuestions) setTextQuestions(meta.textQuestions);
    if (meta.namiScheduleMode) setNamiScheduleMode(meta.namiScheduleMode);
    if (meta.namiScheduleDate) setNamiScheduleDate(meta.namiScheduleDate);
    if (meta.skipNami) setSkipNami(meta.skipNami);
  }
};
```

**Step 4: Link drafts from cycles list page**

In `src/app/dashboard/cycles/page.tsx`, make draft cycle rows link to `/dashboard/cycles/new?draft=<id>` instead of `/dashboard/cycles/<id>`.

**Step 5: Verify and commit**

Test: create a draft, navigate away, come back via draft link. Confirm state restored.

```bash
git add src/app/dashboard/cycles/new/page.tsx src/app/dashboard/cycles/page.tsx
git commit -m "feat(cycles): auto-save drafts with wizard state restoration"
```

---

### Task 9: Fix notification_log fuzzy LIKE query

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/page.tsx` (lines 117-130)

**Step 1: Replace fuzzy LIKE with exact match**

Current code (around line 121-127):
```tsx
// Build OR filter with LIKE patterns
.or(assignments.map(a => `reference_id.like.%${id}%`).join(","))
```

Replace with:
```tsx
// Build exact match filter using cycle_id directly
.eq("reference_id", id)
// OR if reference_id contains assignment-level info:
.or(assignments.map(a => `reference_id.eq.${a.id}`).join(","))
```

Read the actual file first to understand the exact reference_id format used by the nami-bot edge function, then match accordingly.

**Step 2: Verify and commit**

Confirm the Nami Status table still shows correct data on a cycle detail page.

```bash
git add src/app/dashboard/cycles/[id]/page.tsx
git commit -m "fix(cycles): use exact match for notification_log queries instead of fuzzy LIKE"
```

---

### Task 10: Smart re-send Nami notifications

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/cycle-actions.tsx` (sendNotifications function, lines 80-98)

**Step 1: Update sendNotifications to support targeted re-send**

```tsx
const sendNotifications = async (mode: "all" | "missed" = "all") => {
  try {
    const { data, error } = await supabase.functions.invoke("nami-bot", {
      body: {
        action: "launch_cycle",
        cycle_id: cycleId,
        mode, // "all" for initial launch, "missed" for re-send
      },
    });
    if (error) throw error;

    const result = data;
    if (result?.sent > 0) {
      toast.success(`Sent ${result.sent} notification${result.sent > 1 ? "s" : ""}${
        result.skipped > 0 ? ` (${result.skipped} skipped — no Slack)` : ""
      }`);
    } else if (result?.skipped > 0) {
      toast.warning(`All ${result.skipped} employees skipped — no Slack accounts`);
    } else {
      toast.info("All employees already notified");
    }
    setNotificationSent(true);
  } catch (err: any) {
    setNotificationError(err.message || "Failed to send Slack notifications");
  }
};
```

**Step 2: Update re-send button to use "missed" mode**

In the dropdown menu (around line 320), change:
```tsx
onClick={() => sendNotifications("missed")}
```

**Step 3: Update nami-bot edge function to support "missed" mode**

In `supabase/functions/nami-bot/index.ts`, in the `handleCycleLaunch` function:
- If `mode === "missed"`: check notification_log for existing entries, only send to users NOT in the log
- If `mode === "all"` (default): existing behavior

**Step 4: Verify and commit**

Test: launch cycle, then re-send. Should show "All employees already notified" if all were sent.

```bash
git add src/app/dashboard/cycles/[id]/cycle-actions.tsx supabase/functions/nami-bot/index.ts
git commit -m "feat(cycles): smart re-send — only notify users who weren't reached"
```

---

### Task 11: Nami bot error recovery

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`

**Step 1: Wrap per-user sends in try/catch**

In the loop that sends Slack messages, catch errors per-user instead of failing the whole batch:

```tsx
const results = { sent: 0, skipped: 0, failed: 0, failedUsers: [] as string[] };

for (const assignment of assignments) {
  try {
    // ... existing send logic ...
    results.sent++;
  } catch (err) {
    console.error(`Failed to send to ${assignment.employee_id}:`, err);
    results.failed++;
    results.failedUsers.push(assignment.employee_id);
    // Don't rollback notification_log — leave it so we can track the attempt
  }
}
```

**Step 2: Return detailed results**

Return `results` object so the frontend can display per-user status.

**Step 3: Verify and commit**

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "fix(nami): continue sending on per-user failures, return detailed results"
```

---

### Task 12: Missing Slack badges on cycle detail page

**Files:**
- Modify: `src/app/dashboard/cycles/[id]/page.tsx`

**Step 1: Add Slack ID check to employee query**

Ensure the employees query includes `slack_user_id`. Then in the employee/assignment table, add a badge:

```tsx
{!employee.slack_user_id && (
  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 ml-2">
    No Slack
  </Badge>
)}
```

**Step 2: Add per-user notification status column to Nami Status table**

In the existing Nami Status table (around lines 717-722), add a "Delivery" column showing:
- "Sent" (green) — has notification_log entry
- "Failed" (red) — has error log
- "Skipped" (amber) — no Slack ID
- "Pending" (gray) — has Slack ID but no log entry yet

**Step 3: Verify and commit**

```bash
git add src/app/dashboard/cycles/[id]/page.tsx
git commit -m "feat(cycles): show Slack badges and per-user notification delivery status"
```

---

### Task 13: Final integration test

**Step 1: Full end-to-end test**

1. Navigate to `/dashboard/cycles/new`
2. Fill Step 1: name, type, valid dates
3. Fill Step 2: select employees (include some without Slack)
4. Fill Step 3: add competencies + text question
5. Fill Step 4: configure Nami (send now)
6. Step 5: review summary, launch
7. Verify cycle appears in list as "active"
8. Verify Nami messages sent (check notification_log)
9. Navigate back, verify draft auto-saved link works
10. Test re-send on cycle detail page

**Step 2: Edge case testing**

- Try proceeding without required fields — blocked
- Try past dates — blocked
- Try 0 questions — blocked
- Try scheduling Nami in the past — blocked
- Test draft restore

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(cycles): complete wizard with validation, Nami fixes, and auto-save"
```
