# Job Families UX Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make creating job families + levels instant (no sub-page navigation), link people's department to real DB records, and show a visible warning for anyone missing a level assignment.

**Architecture:** Three independent changes — (1) inline level editing on the job families page, (2) unassigned banner + filter on the team page, (3) linked job-family → level dropdowns on the edit-person form. No DB schema changes.

**Tech Stack:** Next.js App Router, Supabase browser client, shadcn/ui (Badge, Button, Input, Select, Card), Tailwind CSS, TypeScript, Lucide icons.

---

## Task 1: Rewrite Job Families page — inline level management

**Files:**
- Modify: `src/app/dashboard/admin/job-families/page.tsx` (full rewrite)
- Delete: `src/app/dashboard/admin/job-families/[id]/levels/page.tsx` (and its directory)

### Context

Currently the page shows family cards with a "Manage Levels →" link that navigates to a separate page. We want levels to be editable inline — no navigation ever needed.

The Supabase `job_families` table has: `id`, `name`, `description`, `workspace_id`.
The `levels` table has: `id`, `name`, `grade`, `sort_order`, `job_family_id`, `workspace_id`.

### Step 1: Replace the file with the new implementation

Write `src/app/dashboard/admin/job-families/page.tsx` with the following complete content:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Plus, Pencil, Trash2, Briefcase, ArrowLeft, Check, X, Loader2, Users,
} from "lucide-react";
import Link from "next/link";

interface Level {
  id: string;
  name: string;
  grade: string | null;
  sort_order: number;
}

interface JobFamily {
  id: string;
  name: string;
  description: string | null;
  levels: Level[];
  member_count?: number;
}

export default function JobFamiliesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [families, setFamilies] = useState<JobFamily[]>([]);
  const [loading, setLoading] = useState(true);

  // New family form
  const [showNewFamily, setShowNewFamily] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilyDesc, setNewFamilyDesc] = useState("");
  const [savingFamily, setSavingFamily] = useState(false);

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Add level state: keyed by family id
  const [addingLevelFor, setAddingLevelFor] = useState<string | null>(null);
  const [newLevelName, setNewLevelName] = useState("");
  const [newLevelGrade, setNewLevelGrade] = useState("");
  const [savingLevel, setSavingLevel] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: fams }, { data: lvls }, { data: members }] = await Promise.all([
      supabase
        .from("job_families")
        .select("id, name, description")
        .order("name"),
      supabase
        .from("levels")
        .select("id, name, grade, sort_order, job_family_id")
        .order("sort_order"),
      supabase
        .from("users")
        .select("level_id, levels!users_level_id_fkey(job_family_id)"),
    ]);

    // Count members per job family
    const memberCountByFamily: Record<string, number> = {};
    (members || []).forEach((u: any) => {
      const jfId = u.levels?.job_family_id;
      if (jfId) memberCountByFamily[jfId] = (memberCountByFamily[jfId] || 0) + 1;
    });

    const levelsByFamily: Record<string, Level[]> = {};
    (lvls || []).forEach((l: any) => {
      if (!levelsByFamily[l.job_family_id]) levelsByFamily[l.job_family_id] = [];
      levelsByFamily[l.job_family_id].push(l);
    });

    setFamilies(
      (fams || []).map((f: any) => ({
        ...f,
        levels: levelsByFamily[f.id] || [],
        member_count: memberCountByFamily[f.id] || 0,
      }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Create family ──────────────────────────────────────────────
  async function handleCreateFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    setSavingFamily(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("job_families").insert({
      name: newFamilyName.trim(),
      description: newFamilyDesc.trim() || null,
      workspace_id: user?.user_metadata?.workspace_id,
    });
    setNewFamilyName("");
    setNewFamilyDesc("");
    setShowNewFamily(false);
    setSavingFamily(false);
    load();
  }

  // ── Rename family ──────────────────────────────────────────────
  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    await supabase.from("job_families").update({ name: renameValue.trim() }).eq("id", id);
    setRenamingId(null);
    load();
  }

  // ── Delete family ──────────────────────────────────────────────
  async function handleDeleteFamily(family: JobFamily) {
    const msg = family.member_count && family.member_count > 0
      ? `Delete "${family.name}"? ${family.member_count} people are assigned to levels in this family — they will lose their level assignment.`
      : `Delete "${family.name}"? Its ${family.levels.length} levels will also be deleted.`;
    if (!confirm(msg)) return;
    await supabase.from("job_families").delete().eq("id", family.id);
    load();
  }

  // ── Add level ──────────────────────────────────────────────────
  async function handleAddLevel(familyId: string) {
    if (!newLevelName.trim()) return;
    setSavingLevel(true);
    const { data: { user } } = await supabase.auth.getUser();
    const family = families.find(f => f.id === familyId);
    const nextOrder = family ? (Math.max(0, ...family.levels.map(l => l.sort_order)) + 1) : 0;
    await supabase.from("levels").insert({
      name: newLevelName.trim(),
      grade: newLevelGrade.trim() || null,
      job_family_id: familyId,
      sort_order: nextOrder,
      workspace_id: user?.user_metadata?.workspace_id,
    });
    setNewLevelName("");
    setNewLevelGrade("");
    setAddingLevelFor(null);
    setSavingLevel(false);
    load();
  }

  // ── Delete level ──────────────────────────────────────────────
  async function handleDeleteLevel(levelId: string, levelName: string) {
    if (!confirm(`Remove level "${levelName}"?`)) return;
    await supabase.from("levels").delete().eq("id", levelId);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/team"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Job Families & Levels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define career tracks and seniority levels</p>
        </div>
        <Button size="sm" onClick={() => { setShowNewFamily(true); setNewFamilyName(""); setNewFamilyDesc(""); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Job Family
        </Button>
      </div>

      {/* Inline new-family form */}
      {showNewFamily && (
        <Card className="border-primary/30 bg-primary/[0.02]">
          <CardContent className="pt-5">
            <form onSubmit={handleCreateFamily} className="space-y-3">
              <div className="flex gap-3">
                <Input
                  autoFocus
                  placeholder="Family name, e.g. Engineering"
                  value={newFamilyName}
                  onChange={e => setNewFamilyName(e.target.value)}
                  className="flex-1"
                  required
                />
                <Input
                  placeholder="Description (optional)"
                  value={newFamilyDesc}
                  onChange={e => setNewFamilyDesc(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewFamily(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={savingFamily || !newFamilyName.trim()}>
                  {savingFamily ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Family"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {families.length === 0 && !showNewFamily && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No job families yet</p>
            <p className="text-sm text-muted-foreground mb-5">
              Create your first job family to start building your career framework.
            </p>
            <Button size="sm" onClick={() => setShowNewFamily(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Job Family
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Family cards */}
      <div className="space-y-3">
        {families.map(family => (
          <Card key={family.id} className="border-border/60">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {renamingId === family.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        className="h-7 text-sm font-semibold"
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRename(family.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleRename(family.id)}>
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setRenamingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{family.name}</h3>
                      {family.member_count !== undefined && family.member_count > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users className="h-3 w-3" />{family.member_count}
                        </span>
                      )}
                      {family.description && (
                        <span className="text-xs text-muted-foreground">— {family.description}</span>
                      )}
                    </div>
                  )}
                </div>
                {renamingId !== family.id && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => { setRenamingId(family.id); setRenameValue(family.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => handleDeleteFamily(family)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="px-5 pb-4 pt-0">
              {/* Level pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {family.levels.length === 0 && addingLevelFor !== family.id && (
                  <span className="text-xs text-muted-foreground/60 italic">No levels yet — add one below</span>
                )}
                {family.levels.map(level => (
                  <span
                    key={level.id}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border/60 group"
                  >
                    {level.name}{level.grade ? ` (${level.grade})` : ""}
                    <button
                      onClick={() => handleDeleteLevel(level.id, level.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${level.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Inline add-level form */}
              {addingLevelFor === family.id ? (
                <div className="flex gap-2 items-center">
                  <Input
                    autoFocus
                    placeholder="Level name, e.g. Senior Engineer"
                    value={newLevelName}
                    onChange={e => setNewLevelName(e.target.value)}
                    className="h-7 text-xs flex-1"
                    onKeyDown={e => {
                      if (e.key === "Enter") handleAddLevel(family.id);
                      if (e.key === "Escape") setAddingLevelFor(null);
                    }}
                  />
                  <Input
                    placeholder="Grade (optional)"
                    value={newLevelGrade}
                    onChange={e => setNewLevelGrade(e.target.value)}
                    className="h-7 text-xs w-28"
                    onKeyDown={e => {
                      if (e.key === "Enter") handleAddLevel(family.id);
                      if (e.key === "Escape") setAddingLevelFor(null);
                    }}
                  />
                  <Button
                    size="sm" className="h-7 px-2.5 text-xs"
                    onClick={() => handleAddLevel(family.id)}
                    disabled={savingLevel || !newLevelName.trim()}
                  >
                    {savingLevel ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-7 px-2.5 text-xs"
                    onClick={() => { setAddingLevelFor(null); setNewLevelName(""); setNewLevelGrade(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingLevelFor(family.id); setNewLevelName(""); setNewLevelGrade(""); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add level
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### Step 2: Delete the now-unused levels sub-page

```bash
rm -rf "/Users/filipnowakowski/Test - Slack/feedback-app/src/app/dashboard/admin/job-families/[id]"
```

### Step 3: Verify TypeScript is clean

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors (or only pre-existing unrelated errors).

### Step 4: Commit

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/admin/job-families/page.tsx
git rm -r "src/app/dashboard/admin/job-families/[id]"
git commit -m "feat: inline level management on job families page, remove sub-page"
```

---

## Task 2: Team page — Unassigned banner + filter

**Files:**
- Modify: `src/app/dashboard/team/page.tsx`
- Modify: `src/app/dashboard/team/team-list.tsx`

### Context

`TeamPage` is a server component. It receives a `searchParams` prop from Next.js App Router.
`TeamList` is a client component that receives the `users` array.
An unassigned user is one where `level === null` (already fetched in the existing query).

### Step 1: Update `team/page.tsx` — add searchParams, unassigned count, banner

Replace the `TeamPage` function (lines 57–152) with this updated version. The `getUsers` and `getSubscription` functions above it stay unchanged:

```tsx
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filterUnassigned = params.filter === "unassigned";

  const [users, workspace, subscription] = await Promise.all([
    getUsers(),
    getUserWorkspace(),
    getSubscription(),
  ]);
  const isAdmin = canManageUsers(workspace?.role);
  const seatLimit = subscription?.user_limit || 5;
  const seatUsed = users.length;
  const seatPercent = Math.min(Math.round((seatUsed / seatLimit) * 100), 100);

  const departments = [...new Set(users.map((u: any) => u.department).filter(Boolean))].sort();
  const unassignedCount = users.filter((u: any) => !u.level_id).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} member{users.length !== 1 ? "s" : ""}{departments.length > 0 ? ` across ${departments.length} department${departments.length !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Seat usage indicator */}
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/50">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">
                {seatUsed} / {seatLimit}
              </span>
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    seatPercent >= 90
                      ? "bg-red-500"
                      : seatPercent >= 70
                      ? "bg-yellow-500"
                      : "bg-primary"
                  }`}
                  style={{ width: `${seatPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">seats</span>
            </div>
          </div>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                <Link href="/dashboard/team/import">
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV
                </Link>
              </Button>
              <SyncButton workspaceId={workspace?.workspaceId} />
              <Link href="/dashboard/admin/job-families" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Manage Job Families
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Unassigned warning banner */}
      {isAdmin && unassignedCount > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-400 text-sm">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            <span>
              <strong>{unassignedCount} {unassignedCount === 1 ? "person has" : "people have"} no job level assigned</strong>
              {" "}— their reviews won&apos;t have a competency baseline.
            </span>
          </div>
          {filterUnassigned ? (
            <Link href="/dashboard/team" className="shrink-0 text-xs font-medium underline underline-offset-2">
              Show all
            </Link>
          ) : (
            <Link href="/dashboard/team?filter=unassigned" className="shrink-0 text-xs font-medium underline underline-offset-2">
              Show unassigned →
            </Link>
          )}
        </div>
      )}

      {users.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No team members yet</p>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              Import your Slack workspace members to get started.
            </p>
            {isAdmin && (
              <div className="flex items-center gap-3 justify-center">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/team/import">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Import CSV
                  </Link>
                </Button>
                <SyncButton workspaceId={workspace?.workspaceId} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <TeamList
          users={users}
          isAdmin={isAdmin}
          currentUserId={workspace?.appUserId}
          workspaceId={workspace?.workspaceId}
          filterUnassigned={filterUnassigned}
        />
      )}
    </div>
  );
}
```

### Step 2: Update `team/team-list.tsx` — accept filterUnassigned prop

Add `filterUnassigned?: boolean` to the `TeamListProps` interface and filter the users at the top of the component:

Replace the interface and component opening:
```tsx
interface TeamListProps {
  users: TeamUser[];
  isAdmin: boolean;
  currentUserId?: string;
  workspaceId?: string;
  filterUnassigned?: boolean;
}

export function TeamList({ users, isAdmin, currentUserId, workspaceId, filterUnassigned }: TeamListProps) {
  const displayUsers = filterUnassigned ? users.filter(u => !u.level) : users;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = displayUsers.length > 0 && selected.size === displayUsers.length;
  const someSelected = selected.size > 0 && selected.size < displayUsers.length;
```

Then replace every reference to `users` within the JSX with `displayUsers` (the `toggleAll` function, the count text, and the `.map()` call).

The level column (lines 126–141 in current file) already shows `user.level.name`. Add an "Unassigned" indicator for users where `!user.level`:

```tsx
{/* Department + Level */}
<div className="min-w-0 hidden md:block">
  <div className="flex items-center gap-1.5">
    {user.department && (
      <span className="text-xs text-muted-foreground truncate">{user.department}</span>
    )}
    {user.level ? (
      <span className="text-xs text-muted-foreground/60">
        {user.department && " · "}
        {user.level.job_family?.name ? `${user.level.job_family.name} · ` : ""}
        {user.level.name}
      </span>
    ) : (
      <span className="text-xs text-amber-500 dark:text-amber-400">
        {user.department && " · "}Unassigned
      </span>
    )}
  </div>
</div>
```

Also update `toggleAll` and the count span to use `displayUsers`:
```tsx
function toggleAll() {
  if (allSelected) {
    setSelected(new Set());
  } else {
    setSelected(new Set(displayUsers.map((u) => u.id)));
  }
}
// ...
<span className="text-xs text-muted-foreground">
  {selected.size > 0 ? `${selected.size} selected` : "Select all"}
</span>
// ...
{displayUsers.map((user) => (
```

### Step 3: Verify TypeScript

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -40
```

### Step 4: Commit

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add src/app/dashboard/team/page.tsx src/app/dashboard/team/team-list.tsx
git commit -m "feat: unassigned banner and filter on team page, amber level indicator"
```

---

## Task 3: Edit-person form — linked Job Family → Level dropdowns

**Files:**
- Modify: `src/app/dashboard/team/[id]/edit/page.tsx`

### Context

Currently the form has:
- `department`: free-text `<Input>` (stays as an informal label)
- `level`: `<Select>` of all levels across all families, unsorted

We're adding:
- `jobFamilyId`: new `<Select>` of job families from DB
- When `jobFamilyId` changes, the `levelId` `<Select>` auto-filters to only that family's levels
- No DB schema change — `level_id` on `users` already encodes the job family implicitly

### Step 1: Add `jobFamilyId` state and load job families

In the `useEffect` load function, add a query for job families and load the existing user's job family from their level:

```tsx
// Inside the useEffect load():
const { data: familiesData } = await supabase
  .from("job_families")
  .select("id, name")
  .order("name");
setJobFamilies(familiesData || []);

// Derive the user's current job family from their level
if (userData.level_id && levelsData) {
  const currentLevel = levelsData.find((l: any) => l.id === userData.level_id);
  setJobFamilyId(currentLevel?.job_family_id || "");
}
```

Add state at the top of the component:
```tsx
const [jobFamilies, setJobFamilies] = useState<{ id: string; name: string }[]>([]);
const [jobFamilyId, setJobFamilyId] = useState<string>("");
```

Update the levels query to also fetch `job_family_id`:
```tsx
const { data: levelsData } = await supabase
  .from("levels")
  .select("id, name, grade, job_family_id, job_family:job_families(name)")
  .order("sort_order");
setLevels(
  (levelsData || []).map((l: any) => ({
    id: l.id,
    name: l.name,
    grade: l.grade,
    job_family_id: l.job_family_id,
    job_family_name: l.job_family?.name || "",
  }))
);
```

Update the `levels` state type:
```tsx
const [levels, setLevels] = useState<{
  id: string; name: string; grade: string | null;
  job_family_id: string; job_family_name: string;
}[]>([]);
```

### Step 2: Replace the department + level fields in the JSX form

Replace the existing `department` Input and `level` Select with:

```tsx
{/* Job Family */}
<div className="space-y-2">
  <Label htmlFor="jobFamily">Job Family</Label>
  <Select
    value={jobFamilyId}
    onValueChange={(val) => {
      setJobFamilyId(val);
      setLevelId(""); // reset level when family changes
    }}
  >
    <SelectTrigger id="jobFamily">
      <SelectValue placeholder="Select job family" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">No job family</SelectItem>
      {jobFamilies.map((f) => (
        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
  {jobFamilies.length === 0 && (
    <p className="text-xs text-muted-foreground">
      No job families yet.{" "}
      <Link href="/dashboard/admin/job-families" target="_blank" className="text-primary underline underline-offset-2">
        Create one →
      </Link>
    </p>
  )}
</div>

{/* Level — filtered to selected family */}
<div className="space-y-2">
  <Label htmlFor="level">Job Level</Label>
  <Select value={levelId} onValueChange={setLevelId} disabled={!jobFamilyId}>
    <SelectTrigger id="level">
      <SelectValue placeholder={jobFamilyId ? "Select level" : "Select a job family first"} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">No level</SelectItem>
      {levels
        .filter((l) => l.job_family_id === jobFamilyId)
        .map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.name}{l.grade ? ` (${l.grade})` : ""}
          </SelectItem>
        ))}
    </SelectContent>
  </Select>
</div>

{/* Informal department label */}
<div className="space-y-2">
  <Label htmlFor="department">Team / Squad name <span className="text-muted-foreground font-normal">(optional)</span></Label>
  <Input
    id="department"
    value={department}
    onChange={(e) => setDepartment(e.target.value)}
    placeholder="e.g. Squad Falcon or Platform Team"
  />
  <p className="text-xs text-muted-foreground">Informal name — not linked to job families</p>
</div>
```

### Step 3: Verify TypeScript

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npx tsc --noEmit 2>&1 | head -40
```

### Step 4: Build check

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npm run build 2>&1 | tail -20
```

### Step 5: Commit

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app"
git add "src/app/dashboard/team/[id]/edit/page.tsx"
git commit -m "feat: linked job family + level dropdowns on edit person form"
```

---

## Final Verification Checklist

1. Job Families page: Create a new family inline — no page navigation
2. Add 3 levels inline — they appear as pills immediately
3. Hover a level pill → × appears → can delete it
4. Rename a family inline (pencil → type → Enter)
5. Team page: user without `level_id` → amber "Unassigned" text in level column
6. "Show unassigned →" filters list to only those people
7. "Show all" resets the filter
8. Edit person: selecting a job family → level dropdown filters to only that family's levels
9. Selecting a different job family → level resets to blank
10. `npx tsc --noEmit` → clean
11. `npm run build` → clean
