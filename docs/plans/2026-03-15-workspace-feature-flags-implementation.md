# Workspace Feature Flags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `use_departments` and `use_career_framework` toggles to workspaces, surface them through `getUserWorkspace()`, conditionally show/hide nav items and UI elements, add a General Settings page for toggling, and add a first-run onboarding wizard.

**Architecture:** Two boolean columns on the `workspaces` table propagate through `getUserWorkspace()` to every server page. The dashboard layout reads the flags and conditionally renders nav items. Individual pages/components receive flags as props and hide irrelevant UI. An onboarding page at `/onboarding` runs once per workspace (`onboarding_completed = false`), then a General settings page lets admins change flags at any time.

**Tech Stack:** Next.js 14 App Router, Supabase SSR, shadcn/ui, Tailwind CSS, TypeScript

**Design doc:** `docs/plans/2026-03-15-workspace-feature-flags-design.md`

---

## Task 1: DB migration — add feature flag columns to workspaces

**Files:**
- Supabase MCP: run SQL directly

**Step 1: Run migration**

Use the Supabase MCP tool (project ref: `zhfvxfvmdlpdfgxrwtdn`) to execute:

```sql
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS use_departments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS use_career_framework boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Existing workspaces: mark onboarding as done so wizard never shows
UPDATE workspaces SET onboarding_completed = true WHERE onboarding_completed = false;
```

**Step 2: Verify**

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'workspaces'
  AND column_name IN ('use_departments', 'use_career_framework', 'onboarding_completed')
ORDER BY column_name;
```

Expected: 3 rows, all `boolean`, all NOT NULL.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add use_departments, use_career_framework, onboarding_completed to workspaces"
```

---

## Task 2: Extend `getUserWorkspace()` to return feature flags

**Files:**
- Modify: `src/lib/supabase-server.ts`

**Step 1: Read the current file**

Read `src/lib/supabase-server.ts` in full.

**Step 2: Update `getUserWorkspace()`**

The function currently returns workspace data from `user.user_metadata`. It needs to also fetch the flags from the `workspaces` table. Add a query inside `getUserWorkspace()`:

```ts
// After resolving workspaceId, fetch flags from workspaces table
const { data: wsData } = await supabase
  .from("workspaces")
  .select("use_departments, use_career_framework, onboarding_completed")
  .eq("id", workspaceId)
  .single();

const useDepartments = wsData?.use_departments ?? true;
const useCareerFramework = wsData?.use_career_framework ?? true;
const onboardingCompleted = wsData?.onboarding_completed ?? true;
```

Add these three fields to the return object:
```ts
return {
  userId,
  email,
  workspaceId,
  workspaceName: user.user_metadata?.workspace_name,
  name: user.user_metadata?.name,
  role,
  slackUserId: user.user_metadata?.slack_user_id,
  appUserId,
  useDepartments,
  useCareerFramework,
  onboardingCompleted,
}
```

**Step 3: TypeScript check**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npx tsc --noEmit 2>&1 | head -20
```

Fix any errors. Pre-existing job-families route error is acceptable.

**Step 4: Commit**

```bash
git add src/lib/supabase-server.ts
git commit -m "feat: expose use_departments, use_career_framework, onboarding_completed from getUserWorkspace"
```

---

## Task 3: Conditionally hide nav items in dashboard layout

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Read the current layout**

Read `src/app/dashboard/layout.tsx` in full.

**Step 2: Destructure flags from getUserWorkspace()**

`getUserWorkspace()` now returns `useDepartments` and `useCareerFramework`. Destructure them:

```ts
const workspace = await getUserWorkspace();
// existing destructure...
const { role, useDepartments, useCareerFramework } = workspace ?? {};
```

**Step 3: Add `requiresCareerFramework` and `requiresDepartments` to nav item type**

Find the nav item type/interface (or the inline object type) and add:
```ts
requiresCareerFramework?: boolean;
requiresDepartments?: boolean;
```

**Step 4: Tag the relevant nav items**

- Functions nav item: add `requiresCareerFramework: true`
- Departments nav item: add `requiresDepartments: true`
- General settings (new item, add now, will 404 until Task 5):
  ```ts
  { href: "/dashboard/settings/general", label: "General", icon: Settings2, requiresManager: false, requiresAdmin: true }
  ```
  Add `Settings2` to the lucide-react import.

**Step 5: Filter nav items by flags**

In the section/item filtering logic (where `requiresManager` and `requiresAdmin` are already checked), add:

```ts
if (item.requiresCareerFramework && !useCareerFramework) return false;
if (item.requiresDepartments && !useDepartments) return false;
```

**Step 6: Pass flags to children via a layout context OR use a middleware redirect for onboarding**

Add the onboarding redirect at the top of the layout server component:

```ts
if (workspace && !workspace.onboardingCompleted) {
  redirect("/onboarding");
}
```

**Step 7: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1 | head -20
git add src/app/dashboard/layout.tsx
git commit -m "feat: conditionally show Functions/Departments nav items based on workspace flags"
```

---

## Task 4: General Settings page — toggle flags UI

**Files:**
- Create: `src/app/dashboard/settings/general/page.tsx`
- Create: `src/app/dashboard/settings/general/general-client.tsx`
- Create: `src/app/dashboard/settings/general/loading.tsx`

**Step 1: Create `page.tsx`**

```tsx
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isAdminOrAbove } from "@/lib/roles";
import { GeneralClient } from "./general-client";

export default async function GeneralSettingsPage() {
  const workspace = await getUserWorkspace();
  if (!workspace || !isAdminOrAbove(workspace.role)) redirect("/dashboard");

  return (
    <GeneralClient
      workspaceId={workspace.workspaceId}
      useDepartments={workspace.useDepartments}
      useCareerFramework={workspace.useCareerFramework}
    />
  );
}
```

**Step 2: Create `general-client.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Building2, Briefcase, AlertTriangle } from "lucide-react";

interface Props {
  workspaceId: string;
  useDepartments: boolean;
  useCareerFramework: boolean;
}

export function GeneralClient({ workspaceId, useDepartments: initialDepts, useCareerFramework: initialCF }: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const [depts, setDepts] = useState(initialDepts);
  const [cf, setCf] = useState(initialCF);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(field: "use_departments" | "use_career_framework", value: boolean) {
    // Prevent turning both off
    if (field === "use_departments" && !value && !cf) return;
    if (field === "use_career_framework" && !value && !depts) return;

    if (field === "use_departments") setDepts(value);
    else setCf(value);

    setSaving(true);
    try {
      const { error: err } = await supabase
        .from("workspaces")
        .update({ [field]: value })
        .eq("id", workspaceId);
      if (err) throw err;
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
      // Roll back optimistic update
      if (field === "use_departments") setDepts(!value);
      else setCf(!value);
    } finally {
      setSaving(false);
    }
  }

  const bothWouldBeOff = (field: string, value: boolean) =>
    (field === "use_departments" && !value && !cf) ||
    (field === "use_career_framework" && !value && !depts);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">General Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure how your workspace is structured.</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="border border-border rounded-xl bg-card divide-y divide-border">
        {/* Departments toggle */}
        <div className="flex items-start justify-between px-5 py-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-medium">Departments</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track team members by department (Finance, Operations…).
                {!depts && <span className="text-amber-600 ml-1">Hidden from directory and bulk actions.</span>}
              </p>
              {bothWouldBeOff("use_departments", false) && depts && (
                <p className="text-xs text-destructive mt-1">At least one of Departments or Career Framework must be enabled.</p>
              )}
            </div>
          </div>
          <Switch
            checked={depts}
            disabled={saving || (!depts === false && bothWouldBeOff("use_departments", false))}
            onCheckedChange={(v) => toggle("use_departments", v)}
          />
        </div>

        {/* Career Framework toggle */}
        <div className="flex items-start justify-between px-5 py-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-medium">Career Framework</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enable job functions, levels and competency scorecards for performance management.
                {!cf && <span className="text-amber-600 ml-1">Performance scorecards hidden.</span>}
              </p>
              {bothWouldBeOff("use_career_framework", false) && cf && (
                <p className="text-xs text-destructive mt-1">At least one of Departments or Career Framework must be enabled.</p>
              )}
            </div>
          </div>
          <Switch
            checked={cf}
            disabled={saving || (!cf === false && bothWouldBeOff("use_career_framework", false))}
            onCheckedChange={(v) => toggle("use_career_framework", v)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Turning off a feature hides it from the UI but preserves all data. Re-enabling restores everything.
      </p>
    </div>
  );
}
```

**Step 3: Create `loading.tsx`**

```tsx
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
export default function Loading() {
  return <ListPageSkeleton rows={3} cols={2} />;
}
```

**Step 4: Add RLS policy so admins can update workspace flags**

Use Supabase MCP to run:

```sql
-- Allow workspace admins to update feature flags on their own workspace
CREATE POLICY IF NOT EXISTS "admins can update workspace settings"
  ON workspaces FOR UPDATE
  USING (id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'hr')
  ));
```

**Step 5: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1 | head -20
git add src/app/dashboard/settings/general/
git commit -m "feat: General Settings page with department and career framework toggles"
```

---

## Task 5: Onboarding wizard

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/onboarding/onboarding-client.tsx`

**Step 1: Create `page.tsx`**

```tsx
import { getUserWorkspace, createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const workspace = await getUserWorkspace();
  if (!workspace) redirect("/");

  // If already completed, skip to dashboard
  if (workspace.onboardingCompleted) redirect("/dashboard");

  return (
    <OnboardingClient
      workspaceId={workspace.workspaceId}
      workspaceName={workspace.workspaceName ?? ""}
    />
  );
}
```

**Step 2: Create `onboarding-client.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Building2, Briefcase, LayoutGrid, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

type Choice = "departments" | "career_framework" | "both";

export function OnboardingClient({ workspaceId, workspaceName }: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [saving, setSaving] = useState(false);

  const options: { id: Choice; icon: React.ReactNode; title: string; description: string }[] = [
    {
      id: "departments",
      icon: <Building2 className="h-6 w-6" />,
      title: "Departments only",
      description: "Organise your team by department — Finance, Operations, Marketing. Great for directory and org structure.",
    },
    {
      id: "career_framework",
      icon: <Briefcase className="h-6 w-6" />,
      title: "Career Framework only",
      description: "Set up job functions with levels and competency scorecards. Focus on growth and performance management.",
    },
    {
      id: "both",
      icon: <LayoutGrid className="h-6 w-6" />,
      title: "Both",
      description: "Use departments for org structure AND a career framework for performance. Ideal for growing teams.",
    },
  ];

  async function finish(c: Choice) {
    setSaving(true);
    const useDepartments = c === "departments" || c === "both";
    const useCareerFramework = c === "career_framework" || c === "both";

    await supabase.from("workspaces").update({
      use_departments: useDepartments,
      use_career_framework: useCareerFramework,
      onboarding_completed: true,
    }).eq("id", workspaceId);

    setSaving(false);
    setStep(3);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Welcome to {workspaceName || "Nami"} 👋</h1>
              <p className="text-muted-foreground">Let's get your workspace set up in 2 steps.</p>
            </div>
            <Button size="lg" className="gap-2" onClick={() => setStep(2)}>
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Choose structure */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">How do you organise your team?</h2>
              <p className="text-sm text-muted-foreground">You can change this at any time in Settings → General.</p>
            </div>

            <div className="space-y-3">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setChoice(opt.id)}
                  className={cn(
                    "w-full text-left flex items-start gap-4 px-5 py-4 rounded-xl border-2 transition-all",
                    choice === opt.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-border/80 hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                    choice === opt.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{opt.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                  {choice === opt.id && (
                    <CheckCircle2 className="h-5 w-5 text-primary ml-auto shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>

            <Button
              size="lg"
              className="w-full gap-2"
              disabled={!choice || saving}
              onClick={() => choice && finish(choice)}
            >
              {saving ? "Setting up…" : "Continue"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">You're all set!</h2>
              <p className="text-sm text-muted-foreground">
                You can change your structure settings at any time in{" "}
                <span className="font-medium">Settings → General</span>.
              </p>
            </div>
            <Button size="lg" className="gap-2" onClick={() => router.push("/dashboard")}>
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1 | head -20
git add src/app/onboarding/
git commit -m "feat: first-run onboarding wizard with structure choice"
```

---

## Task 6: Propagate flags through directory and bulk actions

**Files:**
- Modify: `src/app/dashboard/team/page.tsx`
- Modify: `src/app/dashboard/team/bulk-actions.tsx`

**Step 1: Read both files**

Read `src/app/dashboard/team/page.tsx` and `src/app/dashboard/team/bulk-actions.tsx` in full.

**Step 2: Pass flags from page.tsx to TeamList**

In `src/app/dashboard/team/page.tsx`, destructure flags from `getUserWorkspace()` and pass to `<TeamList>`:

```tsx
const workspace = await getUserWorkspace();
const { useDepartments, useCareerFramework } = workspace ?? { useDepartments: true, useCareerFramework: true };
// ...
return <TeamList users={users} useDepartments={useDepartments} useCareerFramework={useCareerFramework} ... />
```

Also pass the flags to `<BulkActions>` (TeamList renders BulkActions, so pass through).

**Step 3: Update BulkActions props**

In `bulk-actions.tsx`, add to the props interface:
```ts
useDepartments: boolean;
useCareerFramework: boolean;
```

Conditionally render:
- `"department"` action item: only when `useDepartments`
- `"function_level"` action item: only when `useCareerFramework`

```tsx
{useDepartments && <SelectItem value="department">Set Department</SelectItem>}
{useCareerFramework && <SelectItem value="function_level">Set Function & Level</SelectItem>}
```

And conditionally render the department/function_level picker panels:
```tsx
{action === "department" && useDepartments && (...)}
{action === "function_level" && useCareerFramework && (...)}
```

**Step 4: Update TeamList (or wherever BulkActions is rendered)**

Find where `<BulkActions>` is rendered (likely in `src/app/dashboard/team/team-list.tsx` or similar). Pass `useDepartments` and `useCareerFramework` through as props.

**Step 5: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1 | head -20
git add src/app/dashboard/team/
git commit -m "feat: conditional department and function bulk actions based on workspace flags"
```

---

## Task 7: Build check and deploy

**Step 1: Full build**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npm run build 2>&1 | grep -E "error|Error|✓ Compiled|Failed"
```

Expected: `✓ Compiled successfully`

**Step 2: Deploy**

```bash
vercel --prod 2>&1 | tail -5
```

**Step 3: Smoke test checklist**
- New workspace → `/onboarding` shows → pick "Both" → lands on dashboard
- Existing workspace → goes straight to dashboard (no onboarding)
- Settings → General → toggle off Career Framework → Functions disappears from nav
- Toggle off Career Framework → Set Function & Level gone from bulk actions
- Toggle it back on → everything returns
- Can't turn both off at the same time (switch is disabled)

Report deploy URL.
