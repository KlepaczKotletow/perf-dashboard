# Nav Simplification: Settings + Profile Dropdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the static sidebar footer with a clickable dropdown (profile + settings + sign out), add a `/dashboard/profile` page, remove the Departments nav item and useDepartments/useCareerFramework toggles, and simplify onboarding to a single step.

**Architecture:** Six self-contained tasks. Tasks 1–2 build the new footer dropdown and update the layout. Task 3 adds the profile page. Task 4 replaces the General settings page. Task 5 simplifies onboarding. Task 6 removes the feature-flag props from Directory components. No DB migrations needed — data is preserved, flags are just removed from the UI.

**Tech Stack:** Next.js 14 App Router, shadcn/ui (DropdownMenu, already installed), Supabase auth, Tailwind CSS, lucide-react icons.

---

## Key Files Reference

- `src/app/dashboard/layout.tsx` — sidebar nav + footer (server component)
- `src/app/dashboard/signout-button.tsx` — current standalone sign-out button
- `src/app/onboarding/onboarding-client.tsx` — onboarding flow (client)
- `src/app/dashboard/settings/general/page.tsx` + `general-client.tsx` — old General settings
- `src/app/dashboard/team/page.tsx`, `team-list.tsx`, `bulk-actions.tsx` — Directory (use useDepartments/useCareerFramework flags)
- `src/lib/supabase-server.ts` — `getUserWorkspace()` — returns `useDepartments`, `useCareerFramework`, `name`, `email`
- `src/components/ui/dropdown-menu.tsx` — already installed, use this for the footer popover

---

### Task 1: Footer dropdown client component

**Files:**
- Create: `src/app/dashboard/footer-dropdown.tsx`

No automated tests for this UI component — verify manually by running `npm run dev` and clicking the footer.

**Step 1: Create the file**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LogOut, User, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronUp } from "lucide-react";

interface Props {
  initials: string;
  name: string;
  role: string;
  roleLabel: string;
  isAdmin: boolean;
}

export function FooterDropdown({ initials, name, role, roleLabel, isAdmin }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-1 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors group"
        >
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-primary">{initials}</span>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[13px] font-medium text-sidebar-foreground truncate">{name}</p>
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 capitalize border-sidebar-border text-sidebar-foreground/50 font-normal"
            >
              {roleLabel}
            </Badge>
          </div>
          <ChevronUp className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0 group-data-[state=open]:rotate-180 transition-transform" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-48 mb-1">
        <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
          <User className="h-4 w-4 mr-2" />
          View Profile
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Verify it compiles**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `footer-dropdown.tsx`.

**Step 3: Commit**

```bash
git add src/app/dashboard/footer-dropdown.tsx
git commit -m "feat: add FooterDropdown client component with profile/settings/signout"
```

---

### Task 2: Update layout.tsx — new footer + remove Departments nav item

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Read the current file carefully** before editing. The full path is `src/app/dashboard/layout.tsx`.

**Step 2: Apply these changes**

a) Add `FooterDropdown` import (remove `SignOutButton` import):

```tsx
// Remove:
import { SignOutButton } from "./signout-button";
// Add:
import { FooterDropdown } from "./footer-dropdown";
```

b) Remove unused icons from the lucide import: `Building2` (Departments icon). Keep all others.

c) In the `sections` array, inside the `"Settings"` section items array, **remove** the Departments item entirely:

```tsx
// Remove this entire object:
{ href: "/dashboard/admin/departments", label: "Departments", icon: Building2, requiresManager: false, requiresAdmin: true, requiresDepartments: true },
```

d) Also remove the `requiresCareerFramework` filter from the Functions item — Functions always shows for admins now:

```tsx
// Change:
{ href: "/dashboard/admin/functions", label: "Functions", icon: Briefcase, requiresManager: false, requiresAdmin: true, requiresCareerFramework: true },
// To:
{ href: "/dashboard/admin/functions", label: "Functions", icon: Briefcase, requiresManager: false, requiresAdmin: true },
```

e) Change the General nav item href and label in the Settings section:

```tsx
// Change:
{ href: "/dashboard/settings/general", label: "General", icon: Settings2, requiresManager: false, requiresAdmin: true },
// To:
{ href: "/dashboard/settings", label: "Settings", icon: Settings2, requiresManager: false, requiresAdmin: true },
```

f) Remove the `requiresCareerFramework` and `requiresDepartments` fields from the `NavSection` type definition and from the filter logic:

```tsx
// In the NavSection interface, remove these two optional fields:
requiresCareerFramework?: boolean;
requiresDepartments?: boolean;
```

```tsx
// In the filter function, remove these two lines:
if (item.requiresCareerFramework && !useCareerFramework) return false;
if (item.requiresDepartments && !useDepartments) return false;
```

g) Remove `useDepartments` and `useCareerFramework` destructuring (no longer needed in layout):

```tsx
// Remove:
const { useDepartments, useCareerFramework } = {
  useDepartments: workspace?.useDepartments ?? true,
  useCareerFramework: workspace?.useCareerFramework ?? true,
};
```

h) Replace the `{/* User Footer */}` section at the bottom of the sidebar:

```tsx
{/* User Footer */}
<div className="border-t border-sidebar-border p-3">
  <FooterDropdown
    initials={initials}
    name={workspace?.name || workspace?.email || "User"}
    role={workspace?.role || "user"}
    roleLabel={ROLE_LABELS[workspace?.role as UserRole] || workspace?.role || "User"}
    isAdmin={canAccessAdminFeatures}
  />
</div>
```

**Step 3: Verify it compiles**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Quick smoke test**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. Footer should show avatar + name + role badge + ChevronUp. Click it — dropdown appears with "View Profile", "Settings" (if admin), separator, "Sign out".

**Step 5: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: replace static footer with FooterDropdown, remove Departments nav item"
```

---

### Task 3: Profile page

**Files:**
- Create: `src/app/dashboard/profile/page.tsx`

**Step 1: Create the file**

```tsx
import { getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, UserRole } from "@/lib/roles";
import { User, Mail } from "lucide-react";

export default async function ProfilePage() {
  const workspace = await getUserWorkspace();
  if (!workspace) redirect("/");

  const initials = workspace.name
    ? workspace.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : workspace.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal account details.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xl font-medium text-primary">{initials}</span>
        </div>
        <div>
          <p className="font-medium text-lg">{workspace.name || "—"}</p>
          <Badge variant="outline" className="text-xs capitalize mt-1">
            {ROLE_LABELS[workspace.role as UserRole] || workspace.role}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardContent className="divide-y divide-border p-0">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Full name</p>
              <p className="text-sm font-medium truncate">{workspace.name || "Not set"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate">{workspace.email || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Profile details are synced from your Slack workspace. Contact your admin to make changes.
      </p>
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 3: Manual check**

Navigate to `http://localhost:3000/dashboard/profile`. Should show avatar initials, name, role badge, email row. No errors.

**Step 4: Commit**

```bash
git add src/app/dashboard/profile/page.tsx
git commit -m "feat: add /dashboard/profile page accessible to all users"
```

---

### Task 4: Replace General settings page with new Settings page

**Files:**
- Create: `src/app/dashboard/settings/page.tsx`
- Modify: `src/app/dashboard/settings/general/page.tsx` (replace with redirect)

The new `/dashboard/settings` page shows workspace name (read-only from user metadata for now) and is a clean placeholder for future workspace config (logo, timezone, etc.). The old `/dashboard/settings/general` becomes a redirect.

**Step 1: Create `src/app/dashboard/settings/page.tsx`**

```tsx
import { getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isAdminOrAbove } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default async function SettingsPage() {
  const workspace = await getUserWorkspace();
  if (!workspace || !isAdminOrAbove(workspace.role)) redirect("/dashboard");

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Workspace configuration.</p>
      </div>

      <Card>
        <CardContent className="divide-y divide-border p-0">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Workspace name</p>
              <p className="text-sm font-medium truncate">{workspace.workspaceName || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        More workspace settings coming soon.
      </p>
    </div>
  );
}
```

**Step 2: Replace `src/app/dashboard/settings/general/page.tsx` with a redirect**

```tsx
import { redirect } from "next/navigation";
export default function GeneralSettingsRedirect() {
  redirect("/dashboard/settings");
}
```

**Step 3: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/dashboard/settings/page.tsx src/app/dashboard/settings/general/page.tsx
git commit -m "feat: replace General settings with clean Settings page, redirect old route"
```

---

### Task 5: Simplify onboarding (remove step 2)

**Files:**
- Modify: `src/app/onboarding/onboarding-client.tsx`

**Step 1: Read the full file** at `src/app/onboarding/onboarding-client.tsx` before editing.

**Step 2: Rewrite the file**

The new flow: step 1 = Welcome screen with "Get started" button that immediately calls `finish()`. Step 2 = success screen. No choice to make.

```tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export function OnboardingClient({ workspaceId, workspaceName }: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function finish() {
    setSaving(true);
    setSaveError(null);
    try {
      const { error: err } = await supabase.from("workspaces").update({
        use_departments: true,
        use_career_framework: true,
        onboarding_completed: true,
      }).eq("id", workspaceId);
      if (err) throw err;
      setStep(2);
    } catch {
      setSaveError("Failed to set up your workspace. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome to {workspaceName || "Nami"} 👋
              </h1>
              <p className="text-muted-foreground">
                Let&apos;s get your workspace set up.
              </p>
            </div>
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            <Button
              size="lg"
              className="gap-2"
              disabled={saving}
              onClick={finish}
            >
              {saving ? "Setting up…" : "Get started"}{" "}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">You&apos;re all set!</h2>
              <p className="text-sm text-muted-foreground">
                Your workspace is ready to go.
              </p>
            </div>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => router.push("/dashboard")}
            >
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/onboarding/onboarding-client.tsx
git commit -m "feat: simplify onboarding to single step, always enable departments + career framework"
```

---

### Task 6: Remove useDepartments / useCareerFramework from Directory components

**Files:**
- Modify: `src/app/dashboard/team/page.tsx`
- Modify: `src/app/dashboard/team/team-list.tsx`
- Modify: `src/app/dashboard/team/bulk-actions.tsx`

The flags are gone from the settings UI. Directory should always show department data and "Set Department" in bulk actions. Remove the props and hardcode the behaviour.

**Step 1: Update `src/app/dashboard/team/bulk-actions.tsx`**

Read the file first, then make these changes:
- Remove `useDepartments?: boolean` and `useCareerFramework?: boolean` from the `Props` interface
- Remove them from the function parameters
- Replace `{useDepartments && <SelectItem value="department">...` with just `<SelectItem value="department">...` (always show)
- Replace `{action === "department" && useDepartments && (` with `{action === "department" && (`
- Replace `{useCareerFramework && <SelectItem value="function_level">...` with just `<SelectItem value="function_level">...`
- Replace `{action === "function_level" && useCareerFramework && (` with `{action === "function_level" && (`

**Step 2: Update `src/app/dashboard/team/team-list.tsx`**

Read the file first, then:
- Remove `useDepartments?: boolean` and `useCareerFramework?: boolean` from the props interface
- Remove from the function destructuring
- Remove from the `BulkActions` prop pass-through (lines that pass `useDepartments={useDepartments}`)
- Any conditional rendering gated on `useDepartments` or `useCareerFramework` should be unwrapped (always render)

**Step 3: Update `src/app/dashboard/team/page.tsx`**

Read the file first, then:
- Remove lines `const useDepartments = workspace?.useDepartments ?? false;` and `const useCareerFramework = workspace?.useCareerFramework ?? false;`
- Remove `useDepartments={useDepartments}` and `useCareerFramework={useCareerFramework}` from the `<TeamList ... />` JSX

**Step 4: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. Fix any remaining prop references that TypeScript flags.

**Step 5: Commit**

```bash
git add src/app/dashboard/team/page.tsx src/app/dashboard/team/team-list.tsx src/app/dashboard/team/bulk-actions.tsx
git commit -m "feat: remove useDepartments/useCareerFramework flags from Directory, always enabled"
```

---

## Final Verification

After all 6 tasks:

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit && npm run build 2>&1 | tail -20
```

Expected: clean build, no TypeScript errors.

Then deploy:

```bash
vercel --prod
```
