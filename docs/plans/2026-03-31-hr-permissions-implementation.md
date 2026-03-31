# HR Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow HR users to access Settings, Functions, and Forms — while keeping Billing admin-only.

**Architecture:** Three targeted changes. (1) Add `requiresHR` flag to the nav item type and update the filter logic + three nav items in `layout.tsx`. (2) Relax the Settings page guard from `isAdminOrAbove` to `isHROrAbove`. (3) Relax the Functions `canEdit` flag from `isAdminOrAbove` to `isHROrAbove`. Forms already allows HR at the action level — no page guard change needed there.

**Tech Stack:** Next.js 14 App Router, TypeScript, `src/lib/roles.ts` (role helpers already exist)

---

### Task 1: Update nav sidebar to show Settings/Functions/Forms to HR

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Add `requiresHR` to the NavSection item type and import `isHROrAbove`**

Change the import line (line 23):
```ts
import { isManagerOrAbove, isAdmin, ROLE_LABELS, UserRole, isHROrAbove } from "@/lib/roles";
```

Change the `NavSection` interface (lines 28–37) — add `requiresHR: boolean` to the items shape:
```ts
interface NavSection {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiresManager: boolean;
    requiresHR: boolean;
    requiresAdmin: boolean;
  }[];
}
```

**Step 2: Add `canAccessHRFeatures` derived variable**

After line 55 (`const canAccessAdminFeatures = isAdmin(workspace?.role);`), add:
```ts
const canAccessHRFeatures = isHROrAbove(workspace?.role);
```

**Step 3: Update all nav items to include `requiresHR`**

Every existing nav item currently has `requiresAdmin` and `requiresManager`. Add `requiresHR: false` to all items EXCEPT the three being unlocked for HR.

The full updated sections array (replace lines 57–93):
```ts
const sections: NavSection[] = [
  {
    label: "Personal",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, requiresManager: true, requiresHR: false, requiresAdmin: false },
      { href: "/dashboard/performance", label: "Performance", icon: ClipboardCheck, requiresManager: false, requiresHR: false, requiresAdmin: false },
      { href: "/dashboard/feedback", label: "Kudos", icon: MessageSquare, requiresManager: false, requiresHR: false, requiresAdmin: false },
      { href: "/dashboard/goals", label: "Goals", icon: Flag, requiresManager: false, requiresHR: false, requiresAdmin: false },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/dashboard/my-team", label: "My Team", icon: UsersRound, requiresManager: true, requiresHR: false, requiresAdmin: false },
      { href: "/dashboard/team", label: "Directory", icon: Users, requiresManager: true, requiresHR: false, requiresAdmin: false },
      { href: "/dashboard/reviews", label: "Reviews", icon: FileText, requiresManager: true, requiresHR: false, requiresAdmin: false },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/dashboard/cycles", label: "Cycles", icon: CalendarClock, requiresManager: true, requiresHR: false, requiresAdmin: false },
      { href: "/dashboard/surveys", label: "Surveys", icon: ClipboardList, requiresManager: true, requiresHR: false, requiresAdmin: false },
      { href: "/dashboard/templates", label: "Templates", icon: ListChecks, requiresManager: true, requiresHR: false, requiresAdmin: false },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, requiresManager: true, requiresHR: false, requiresAdmin: false },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings2, requiresManager: false, requiresHR: true, requiresAdmin: false },
      { href: "/dashboard/admin/functions", label: "Functions", icon: Briefcase, requiresManager: false, requiresHR: true, requiresAdmin: false },
      { href: "/dashboard/settings/forms", label: "Forms", icon: SlidersHorizontal, requiresManager: false, requiresHR: true, requiresAdmin: false },
      { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard, requiresManager: false, requiresHR: false, requiresAdmin: true },
    ],
  },
];
```

**Step 4: Update the filter logic to check `requiresHR`**

Replace the filter block (lines 96–105):
```ts
const filteredSections = sections
  .map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.requiresAdmin && !canAccessAdminFeatures) return false;
      if (item.requiresHR && !canAccessHRFeatures) return false;
      if (item.requiresManager && !canAccessManagerFeatures) return false;
      return true;
    }),
  }))
  .filter((section) => section.items.length > 0);
```

**Step 5: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: show Settings/Functions/Forms nav items to HR users"
```

---

### Task 2: Relax Settings page guard to HR

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

**Step 1: Change the import and guard**

Line 3 currently:
```ts
import { isAdminOrAbove } from "@/lib/roles";
```

Change to:
```ts
import { isHROrAbove } from "@/lib/roles";
```

Line 9 currently:
```ts
if (!workspace || !isAdminOrAbove(workspace.role)) redirect("/dashboard");
```

Change to:
```ts
if (!workspace || !isHROrAbove(workspace.role)) redirect("/dashboard");
```

**Step 2: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat: allow HR users to access Settings page"
```

---

### Task 3: Relax Functions canEdit to HR

**Files:**
- Modify: `src/app/dashboard/admin/functions/page.tsx`

**Step 1: Read the top of the file to find the exact lines**

```bash
head -20 "/Users/filipnowakowski/Test - Slack/feedback-app/src/app/dashboard/admin/functions/page.tsx"
```

**Step 2: Update the import and `canEdit` flag**

Current import (line 4):
```ts
import { isAdminOrAbove, isManagerOrAbove } from "@/lib/roles";
```

Change to:
```ts
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
```

Current `canEdit` line (line 15):
```ts
const canEdit = isAdminOrAbove(workspace.role);
```

Change to:
```ts
const canEdit = isHROrAbove(workspace.role);
```

**Step 3: Verify TypeScript**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Run a full build to confirm everything is clean**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx next build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully`

**Step 5: Commit**

```bash
git add src/app/dashboard/admin/functions/page.tsx
git commit -m "feat: allow HR users to edit Functions"
```
