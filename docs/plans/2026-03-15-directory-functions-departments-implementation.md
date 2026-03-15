# Directory: Functions & Departments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Set Function & Level" bulk action to the team directory and a managed Departments admin page backed by a proper `departments` table.

**Architecture:** Four independent tasks — DB migration, departments admin page, sidebar nav update, and bulk-actions component update. No new shared utilities needed; all patterns follow existing admin pages (functions page pattern for the admin UI, bulk-actions pattern for the directory changes).

**Tech Stack:** Next.js 14 App Router, Supabase (MCP tool for migration), Tailwind CSS, shadcn/ui, lucide-react

---

### Task 1: DB migration — create departments table

**Files:**
- No local files — run via Supabase MCP

**Step 1: Create the departments table**

Use the Supabase MCP tool (`mcp__e1e21cfb-a8b7-4fda-9a99-9f6b1a80d231__execute_sql` or `mcp__supabase__execute_sql`) with project ref `zhfvxfvmdlpdfgxrwtdn`:

```sql
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can read departments"
  ON departments FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "admins can manage departments"
  ON departments FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'hr')
  ));
```

**Step 2: Verify**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'departments'
ORDER BY ordinal_position;
```

Expected: id, workspace_id, name, created_at columns all present.

**Step 3: Commit**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add -A
git commit -m "feat: create departments table with RLS policies"
```

---

### Task 2: Departments admin page

**Files:**
- Create: `src/app/dashboard/admin/departments/page.tsx`
- Create: `src/app/dashboard/admin/departments/departments-client.tsx`
- Create: `src/app/dashboard/admin/departments/loading.tsx`

**Step 1: Create the server page**

Create `src/app/dashboard/admin/departments/page.tsx`:

```tsx
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isAdminOrAbove } from "@/lib/roles";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const supabase = await createServerSupabaseClient();
  const workspace = await getUserWorkspace();

  if (!workspace || !isAdminOrAbove(workspace.role)) redirect("/dashboard");

  // Seed departments from users if the table is empty for this workspace
  const { data: existing } = await supabase
    .from("departments")
    .select("id")
    .eq("workspace_id", workspace.workspaceId)
    .limit(1);

  if (!existing || existing.length === 0) {
    const { data: users } = await supabase
      .from("users")
      .select("department")
      .eq("workspace_id", workspace.workspaceId)
      .not("department", "is", null);

    const uniqueDepts = [...new Set((users || []).map((u: any) => u.department).filter(Boolean))] as string[];

    if (uniqueDepts.length > 0) {
      await supabase.from("departments").insert(
        uniqueDepts.map((name) => ({ name, workspace_id: workspace.workspaceId }))
      );
    }
  }

  const [{ data: departments }, { data: users }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name")
      .eq("workspace_id", workspace.workspaceId)
      .order("name"),
    supabase
      .from("users")
      .select("id, department")
      .eq("workspace_id", workspace.workspaceId),
  ]);

  // Compute member count per department name
  const memberCounts: Record<string, number> = {};
  (users || []).forEach((u: any) => {
    if (u.department) memberCounts[u.department] = (memberCounts[u.department] || 0) + 1;
  });

  return (
    <DepartmentsClient
      departments={departments ?? []}
      memberCounts={memberCounts}
      workspaceId={workspace.workspaceId}
    />
  );
}
```

**Step 2: Create the client component**

Create `src/app/dashboard/admin/departments/departments-client.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Pencil, Check, Building2 } from "lucide-react";

interface Department { id: string; name: string; }

interface DepartmentsClientProps {
  departments: Department[];
  memberCounts: Record<string, number>;
  workspaceId: string;
}

export function DepartmentsClient({ departments: initialDepartments, memberCounts: initialCounts, workspaceId }: DepartmentsClientProps) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );

  const [error, setError] = useState<string | null>(null);

  // Add
  const [showAdd, setShowAdd] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleAdd() {
    if (!addValue.trim()) return;
    setAddLoading(true);
    try {
      const { error: err } = await supabase.from("departments").insert({
        name: addValue.trim(),
        workspace_id: workspaceId,
      });
      if (err) throw err;
      setAddValue("");
      setShowAdd(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to add department");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRename(dept: Department) {
    if (!renameValue.trim() || renameValue.trim() === dept.name) {
      setRenamingId(null);
      return;
    }
    const newName = renameValue.trim();
    try {
      // Rename the department row
      const { error: err } = await supabase
        .from("departments")
        .update({ name: newName })
        .eq("id", dept.id)
        .eq("workspace_id", workspaceId);
      if (err) throw err;

      // Propagate to users
      await supabase
        .from("users")
        .update({ department: newName })
        .eq("department", dept.name)
        .eq("workspace_id", workspaceId);

      setRenamingId(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to rename department");
    }
  }

  async function handleDelete(dept: Department) {
    const count = initialCounts[dept.name] || 0;
    const msg = count > 0
      ? `${count} ${count === 1 ? "person is" : "people are"} in "${dept.name}". Deleting will unassign them. Continue?`
      : `Delete "${dept.name}"?`;
    if (!confirm(msg)) return;

    try {
      // Unassign users
      if (count > 0) {
        await supabase
          .from("users")
          .update({ department: null })
          .eq("department", dept.name)
          .eq("workspace_id", workspaceId);
      }
      const { error: err } = await supabase
        .from("departments")
        .delete()
        .eq("id", dept.id)
        .eq("workspace_id", workspaceId);
      if (err) throw err;
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to delete department");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Departments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {initialDepartments.length} department{initialDepartments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Department
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* List */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {initialDepartments.length === 0 && !showAdd ? (
          <div className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No departments yet</p>
            <p className="text-sm text-muted-foreground">Add your first department to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {initialDepartments.map((dept) => (
              <li key={dept.id} className="group flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                {renamingId === dept.id ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(dept);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => handleRename(dept)}
                    className="h-7 text-sm w-48"
                  />
                ) : (
                  <span className="text-sm font-medium text-foreground">{dept.name}</span>
                )}
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    {initialCounts[dept.name] || 0} {(initialCounts[dept.name] || 0) === 1 ? "member" : "members"}
                  </Badge>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setRenamingId(dept.id); setRenameValue(dept.name); }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}

            {/* Inline add row */}
            {showAdd && (
              <li className="flex items-center gap-2 px-5 py-3">
                <Input
                  autoFocus
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") { setShowAdd(false); setAddValue(""); }
                  }}
                  placeholder="Department name…"
                  className="h-7 text-sm w-48"
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={addLoading || !addValue.trim()}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAdd(false); setAddValue(""); }}>
                  Cancel
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create loading skeleton**

Create `src/app/dashboard/admin/departments/loading.tsx`:

```tsx
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
export default function Loading() {
  return <ListPageSkeleton rows={5} cols={2} />;
}
```

**Step 4: TypeScript check**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

**Step 5: Commit**

```bash
git add src/app/dashboard/admin/departments/
git commit -m "feat: departments admin page with inline add/rename/delete"
```

---

### Task 3: Add Departments to sidebar nav

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Read layout.tsx and find the Settings section**

The Settings section currently looks like:
```tsx
{
  label: "Settings",
  items: [
    { href: "/dashboard/admin/functions", label: "Functions", icon: Briefcase, requiresManager: false, requiresAdmin: true },
    { href: "/dashboard/settings/forms", label: "Forms", icon: SlidersHorizontal, requiresManager: false, requiresAdmin: true },
    { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard, requiresManager: false, requiresAdmin: true },
  ],
},
```

**Step 2: Add Departments nav item**

Add `Building2` to the lucide-react import at the top of layout.tsx (check what icons are already imported there first and add to existing list).

Insert the Departments link after Functions:

```tsx
{ href: "/dashboard/admin/departments", label: "Departments", icon: Building2, requiresManager: false, requiresAdmin: true },
```

So the Settings section becomes:
```tsx
{
  label: "Settings",
  items: [
    { href: "/dashboard/admin/functions", label: "Functions", icon: Briefcase, requiresManager: false, requiresAdmin: true },
    { href: "/dashboard/admin/departments", label: "Departments", icon: Building2, requiresManager: false, requiresAdmin: true },
    { href: "/dashboard/settings/forms", label: "Forms", icon: SlidersHorizontal, requiresManager: false, requiresAdmin: true },
    { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard, requiresManager: false, requiresAdmin: true },
  ],
},
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: add Departments to sidebar nav"
```

---

### Task 4: Update bulk-actions — Set Function & Level + departments from DB

**Files:**
- Modify: `src/app/dashboard/team/bulk-actions.tsx`

**Context:** The current component:
- Loads `levels` from DB with job_family join
- Loads `departments` by scraping user rows
- Has "Set Level" action with a flat level dropdown
- Has "Set Department" with a select + free-text input

Changes:
1. Load `functions` (job_families) from DB in the same `useEffect`
2. Load `departments` from the `departments` table instead of scraping users
3. Add `selectedFunctionId` state for the two-step Function & Level picker
4. Replace "Set Level" SelectItem with "Set Function & Level"
5. When action is "function_level": show function select → then level select filtered by that function
6. Remove the free-text "New dept..." Input from the department section
7. The `apply()` function: for "function_level" action, `updateData.level_id = value`

**Step 1: Rewrite bulk-actions.tsx**

Replace the entire file content with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Check } from "lucide-react";

interface BulkActionsProps {
  selectedIds: string[];
  users: { id: string; slack_name: string | null; department: string | null }[];
  onDone: () => void;
}

export function BulkActions({ selectedIds, users, onDone }: BulkActionsProps) {
  const [action, setAction] = useState<string>("");
  const [value, setValue] = useState("");
  const [applying, setApplying] = useState(false);

  const [allUsers, setAllUsers] = useState<{ id: string; slack_name: string }[]>([]);
  const [functions, setFunctions] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string; grade: string | null; job_family_id: string | null }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const [
        { data: usersData },
        { data: functionsData },
        { data: levelsData },
        { data: deptsData },
      ] = await Promise.all([
        supabase.from("users").select("id, slack_name").order("slack_name"),
        supabase.from("job_families").select("id, name").order("name"),
        supabase.from("levels").select("id, name, grade, job_family_id").order("sort_order"),
        supabase.from("departments").select("id, name").order("name"),
      ]);
      setAllUsers(usersData || []);
      setFunctions(functionsData || []);
      setLevels(levelsData || []);
      setDepartments(deptsData || []);
    }
    load();
  }, []);

  // Levels filtered to the selected function
  const functionLevels = selectedFunctionId
    ? levels.filter((l) => l.job_family_id === selectedFunctionId)
    : [];

  async function apply() {
    if (!action || !value) return;
    setApplying(true);

    const updateData: any = { updated_at: new Date().toISOString() };

    if (action === "department") updateData.department = value;
    if (action === "manager") updateData.manager_id = value === "none" ? null : value;
    if (action === "function_level") updateData.level_id = value === "none" ? null : value;
    if (action === "role") updateData.role = value;

    for (const id of selectedIds) {
      await supabase.from("users").update(updateData).eq("id", id);
    }

    setApplying(false);
    setAction("");
    setValue("");
    setSelectedFunctionId("");
    onDone();
    window.location.reload();
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border shadow-xl rounded-xl px-4 py-3 animate-in slide-in-from-bottom-4">
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        {selectedIds.length} selected
      </span>

      <div className="h-5 w-px bg-border" />

      <Select value={action} onValueChange={(v) => { setAction(v); setValue(""); setSelectedFunctionId(""); }}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue placeholder="Bulk action..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="department">Set Department</SelectItem>
          <SelectItem value="manager">Set Manager</SelectItem>
          <SelectItem value="function_level">Set Function & Level</SelectItem>
          <SelectItem value="role">Set Role</SelectItem>
        </SelectContent>
      </Select>

      {/* Set Department */}
      {action === "department" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Select department..." />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Set Manager */}
      {action === "manager" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Select manager..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Manager</SelectItem>
            {allUsers
              .filter((u) => !selectedIds.includes(u.id))
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.slack_name || "Unknown"}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}

      {/* Set Function & Level — two-step */}
      {action === "function_level" && (
        <>
          <Select value={selectedFunctionId} onValueChange={(v) => { setSelectedFunctionId(v); setValue(""); }}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Function..." />
            </SelectTrigger>
            <SelectContent>
              {functions.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedFunctionId && (
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Level..." />
              </SelectTrigger>
              <SelectContent>
                {functionLevels.length === 0 ? (
                  <SelectItem value="_none" disabled>No levels configured</SelectItem>
                ) : (
                  functionLevels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.grade ? ` (${l.grade})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </>
      )}

      {/* Set Role */}
      {action === "role" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Select role..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="hr">HR</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Button
        size="sm"
        className="h-8 text-xs"
        disabled={!action || !value || applying || (action === "function_level" && !selectedFunctionId)}
        onClick={apply}
      >
        {applying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <Check className="h-3.5 w-3.5 mr-1" />
            Apply
          </>
        )}
      </Button>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDone}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npx tsc --noEmit 2>&1 | head -20
```

Fix any type errors before committing.

**Step 3: Commit**

```bash
git add src/app/dashboard/team/bulk-actions.tsx
git commit -m "feat: Set Function & Level two-step picker, departments from DB"
```

---

### Task 5: Build check and deploy

**Step 1: Full build**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
npm run build 2>&1 | grep -E "error|Error|✓ Compiled" | head -10
```

Expected: `✓ Compiled successfully`

**Step 2: Deploy**

```bash
vercel --prod 2>&1 | tail -5
```

**Step 3: Smoke test checklist**

- [ ] `/dashboard/admin/departments` loads, shows seeded departments from existing user data
- [ ] Add a new department — appears in list immediately
- [ ] Rename a department — all users with old name get updated on next team page load
- [ ] Delete a department — users with that dept get `null` on next load
- [ ] `/dashboard/team` → select 2 users → bulk action "Set Function & Level" → pick function → level select appears with that function's levels only
- [ ] "Set Department" bulk action shows dropdown from `departments` table (no free-text input)
- [ ] Sidebar shows "Departments" link under Settings for admins
