"use client";

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { RoleSelector } from "./role-selector";
import { BulkActions } from "./bulk-actions";
import {
  ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, Users, Plus,
  Search, ChevronDown, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Status values from the users.employee_status check constraint.
// "Deactivated" is unchecked by default — directories typically hide
// terminated employees, and the seat-sync logic already excludes them
// from billable counts (see src/app/api/internal/seat-sync/route.ts).
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "inactive", label: "Inactive" },
  { value: "deactivated", label: "Deactivated" },
] as const;
const DEFAULT_STATUS = new Set(["active", "onboarding", "inactive"]);

// Roles from src/lib/roles.ts. "manager" is a legacy DB value still
// stored on some rows but no longer assignable; surface it grouped with
// "user" under the Employee label so legacy rows remain filterable.
const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "hr", label: "HR" },
  { value: "user", label: "Employee" },
  { value: "manager", label: "Employee (legacy)" },
] as const;
const DEFAULT_ROLES = new Set(["admin", "hr", "user", "manager"]);

// Sentinel for users with no department set, so the dropdown can offer
// a checkbox for them. Empty string keeps the filter map keyed cleanly.
const NO_DEPT = "";
// Same idea for Function: users with no level (and therefore no job family)
// stay filterable instead of being permanently in or out of every view.
const NO_FUNCTION = "";

/**
 * The Directory row, written down once.
 *
 * Density is the feature on this page — an admin comparing dozens of people
 * cannot buy calm with whitespace, so the columns stay tight and the variety
 * goes instead. The specifics, so they don't get re-derived per row:
 *
 *   ladder      name → +department → +function → +manager → +tenure → +role
 *   gutter      1rem at every step
 *   alignment   items-center; the name column owns the leading weight
 *   numerals    tabular, so tenure and dates line up down the column
 *
 * This string used to be duplicated verbatim between the header row and the
 * body row. The two had to stay byte-identical or the columns silently
 * desynced, which is the kind of bug that survives review because both halves
 * look right on their own.
 */
const ROW_GRID =
  "flex-1 min-w-0 grid gap-4 items-center tabular-nums " +
  "grid-cols-[1fr_auto] " +
  "sm:grid-cols-[1.5fr_0.8fr_auto] " +
  "md:grid-cols-[1.5fr_1fr_0.8fr_auto] " +
  "lg:grid-cols-[1.4fr_0.9fr_1fr_0.9fr_0.8fr_auto] " +
  "xl:grid-cols-[1.4fr_0.85fr_1fr_0.9fr_0.8fr_0.75fr_auto]";

/** Job family behind a user's level. PostgREST returns the embed as an object
 *  or a single-element array depending on the query shape, hence the guard. */
function familyOf(u: { level?: { job_family?: { name: string } | { name: string }[] | null } | null }): string | null {
  const jf = Array.isArray(u.level?.job_family) ? u.level?.job_family[0] : u.level?.job_family;
  return jf?.name ?? null;
}

interface TeamUser {
  id: string;
  slack_name: string | null;
  slack_email: string | null;
  avatar_url?: string | null;
  job_title: string | null;
  department: string | null;
  role: string | null;
  start_date?: string | null;
  employee_status?: string | null;
  is_department_head?: boolean | null;
  // Both drive readiness filters from the strip above the list. `manager` is
  // the resolved display name; `manager_id` is what "has no manager" tests.
  manager_id?: string | null;
  slack_user_id?: string | null;
  manager?: { slack_name: string | null } | null;
  level?: { name: string | null; grade: string | null; job_family?: { name: string } | { name: string }[] | null } | null;
}

interface TeamListProps {
  users: TeamUser[];
  isAdmin: boolean;
  currentUserId?: string;
  workspaceId?: string;
  /** "unassigned" | "no-manager" | "no-slack", from the readiness strip. */
  readinessFilter?: string | null;
}

type SortKey = "name" | "department" | "function" | "job_title" | "manager" | "start_date" | "role";
type SortDir = "asc" | "desc";

// Module-scope component (per react-hooks/static-components) — element type is
// stable across renders.
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

interface FilterDropdownProps {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: Set<string>;
  defaultSelected: Set<string>;
  onToggle: (value: string) => void;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function FilterDropdown({ label, options, selected, defaultSelected, onToggle }: FilterDropdownProps) {
  const isActive = !setsEqual(selected, defaultSelected);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 text-xs gap-1.5 ${isActive ? "border-primary/50 bg-primary/[0.04]" : ""}`}
        >
          {label}
          {isActive && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
              {selected.size}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Filter by {label.toLowerCase()}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value || "__none__"}
            checked={selected.has(opt.value)}
            // Keep the menu open while the user toggles multiple checkboxes.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => onToggle(opt.value)}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatTenure(startDate: string | null | undefined): string {
  if (!startDate) return "—";
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Not started";
  if (diffDays < 30) return `${diffDays}d`;
  const months = Math.floor(diffDays / 30.44);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`;
}

function formatStartDate(startDate: string | null | undefined): string {
  if (!startDate) return "";
  return new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TeamList({ users, isAdmin, currentUserId, workspaceId, readinessFilter }: TeamListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Department options are derived from the current user list. Users with
  // no department appear in a "(No department)" group so they remain
  // filterable rather than always-on or always-off.
  const departmentOptions = useMemo(() => {
    const named = [...new Set(users.map((u) => u.department).filter(Boolean) as string[])].sort();
    const hasNone = users.some((u) => !u.department);
    return [
      ...named.map((d) => ({ value: d, label: d })),
      ...(hasNone ? [{ value: NO_DEPT, label: "(No department)" }] : []),
    ];
  }, [users]);

  const functionOptions = useMemo(() => {
    const named = [...new Set(users.map(familyOf).filter(Boolean) as string[])].sort();
    const hasNone = users.some((u) => !familyOf(u));
    return [
      ...named.map((f) => ({ value: f, label: f })),
      ...(hasNone ? [{ value: NO_FUNCTION, label: "(No function)" }] : []),
    ];
  }, [users]);

  // Defaults: every option is selected, except deactivated under Status.
  const defaultDeptFilter = useMemo(
    () => new Set(departmentOptions.map((o) => o.value)),
    [departmentOptions],
  );
  const defaultFunctionFilter = useMemo(
    () => new Set(functionOptions.map((o) => o.value)),
    [functionOptions],
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => new Set(DEFAULT_STATUS));
  const [departmentFilter, setDepartmentFilter] = useState<Set<string>>(() => new Set(defaultDeptFilter));
  const [functionFilter, setFunctionFilter] = useState<Set<string>>(() => new Set(defaultFunctionFilter));
  const [roleFilter, setRoleFilter] = useState<Set<string>>(() => new Set(DEFAULT_ROLES));

  function toggleInSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter(new Set(DEFAULT_STATUS));
    setDepartmentFilter(new Set(defaultDeptFilter));
    setFunctionFilter(new Set(defaultFunctionFilter));
    setRoleFilter(new Set(DEFAULT_ROLES));
  }

  const isFiltered =
    search.trim().length > 0 ||
    !setsEqual(statusFilter, DEFAULT_STATUS) ||
    !setsEqual(departmentFilter, defaultDeptFilter) ||
    !setsEqual(functionFilter, defaultFunctionFilter) ||
    !setsEqual(roleFilter, DEFAULT_ROLES);

  const displayUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (readinessFilter === "unassigned" && u.level) return false;
      if (readinessFilter === "no-manager" && u.manager_id) return false;
      if (readinessFilter === "no-slack" && u.slack_user_id) return false;
      const status = u.employee_status || "active";
      if (!statusFilter.has(status)) return false;
      if (!departmentFilter.has(u.department || NO_DEPT)) return false;
      if (!functionFilter.has(familyOf(u) || NO_FUNCTION)) return false;
      if (!roleFilter.has(u.role || "user")) return false;
      if (q) {
        const haystack = [u.slack_name, u.slack_email, u.job_title, u.department, u.manager?.slack_name, familyOf(u), u.level?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [users, readinessFilter, search, statusFilter, departmentFilter, functionFilter, roleFilter]);

  const sortedUsers = useMemo(() => {
    const sorted = [...displayUsers].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (sortKey) {
        case "name":
          aVal = (a.slack_name || "").toLowerCase();
          bVal = (b.slack_name || "").toLowerCase();
          break;
        case "department":
          aVal = (a.department || "zzz").toLowerCase();
          bVal = (b.department || "zzz").toLowerCase();
          break;
        case "function":
          // Sort by family then level, so a function reads as a ladder.
          aVal = `${familyOf(a) || "zzz"} ${a.level?.name || ""}`.toLowerCase();
          bVal = `${familyOf(b) || "zzz"} ${b.level?.name || ""}`.toLowerCase();
          break;
        case "job_title":
          aVal = (a.job_title || "zzz").toLowerCase();
          bVal = (b.job_title || "zzz").toLowerCase();
          break;
        case "manager":
          aVal = (a.manager?.slack_name || "zzz").toLowerCase();
          bVal = (b.manager?.slack_name || "zzz").toLowerCase();
          break;
        case "start_date":
          aVal = a.start_date || "9999";
          bVal = b.start_date || "9999";
          break;
        case "role":
          aVal = a.role || "user";
          bVal = b.role || "user";
          break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [displayUsers, sortKey, sortDir]);

  const allSelected = sortedUsers.length > 0 && selected.size === sortedUsers.length;
  const someSelected = selected.size > 0 && selected.size < sortedUsers.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sortedUsers.map((u) => u.id)));
  }

  function toggleUser(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() { setSelected(new Set()); }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const colHeaderClass = "flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors select-none";

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, email, or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            aria-label="Search directory"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterDropdown
            label="Status"
            options={STATUS_OPTIONS}
            selected={statusFilter}
            defaultSelected={DEFAULT_STATUS}
            onToggle={(v) => toggleInSet(setStatusFilter, v)}
          />
          {departmentOptions.length > 0 && (
            <FilterDropdown
              label="Department"
              options={departmentOptions}
              selected={departmentFilter}
              defaultSelected={defaultDeptFilter}
              onToggle={(v) => toggleInSet(setDepartmentFilter, v)}
            />
          )}
          {functionOptions.length > 1 && (
            <FilterDropdown
              label="Function"
              options={functionOptions}
              selected={functionFilter}
              defaultSelected={defaultFunctionFilter}
              onToggle={(v) => toggleInSet(setFunctionFilter, v)}
            />
          )}
          <FilterDropdown
            label="Role"
            options={ROLE_OPTIONS}
            selected={roleFilter}
            defaultSelected={DEFAULT_ROLES}
            onToggle={(v) => toggleInSet(setRoleFilter, v)}
          />
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Result count when any filter (URL or in-page) is active */}
      {(isFiltered || readinessFilter) && (
        <p className="text-xs text-muted-foreground -mt-1 mb-2">
          Showing <span className="font-medium text-foreground">{displayUsers.length}</span> of {users.length} member{users.length !== 1 ? "s" : ""}
        </p>
      )}

      <div className="space-y-0">
        {/* Table header */}
        <div className="flex items-center gap-4 px-3 py-2 border-b border-border/60">
          {isAdmin && (
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              aria-label="Select all"
              className="shrink-0"
            />
          )}
          <div className="w-9 shrink-0" /> {/* Avatar spacer */}
          <div className={ROW_GRID}>
            <button onClick={() => handleSort("name")} className={colHeaderClass}>
              Name <SortIcon active={sortKey === "name"} dir={sortDir} />
            </button>
            <button onClick={() => handleSort("department")} className={`${colHeaderClass} hidden md:flex`}>
              Department <SortIcon active={sortKey === "department"} dir={sortDir} />
            </button>
            <button onClick={() => handleSort("function")} className={`${colHeaderClass} hidden lg:flex`}>
              Function <SortIcon active={sortKey === "function"} dir={sortDir} />
            </button>
            <button onClick={() => handleSort("manager")} className={`${colHeaderClass} hidden lg:flex`}>
              Manager <SortIcon active={sortKey === "manager"} dir={sortDir} />
            </button>
            <button onClick={() => handleSort("start_date")} className={`${colHeaderClass} hidden xl:flex`}>
              Start Date <SortIcon active={sortKey === "start_date"} dir={sortDir} />
            </button>
            <button onClick={() => handleSort("role")} className={`${colHeaderClass} hidden sm:flex`}>
              Role <SortIcon active={sortKey === "role"} dir={sortDir} />
            </button>
            <div className="w-8 shrink-0" /> {/* Action spacer */}
          </div>
        </div>

        {/* Rows */}
        {sortedUsers.map((user) => (
          <div
            key={user.id}
            className={`flex items-center gap-4 px-3 py-2.5 border-b border-border/30 transition-all ${
              selected.has(user.id)
                ? "bg-primary/[0.03]"
                : "hover:bg-muted/30"
            }`}
          >
            {isAdmin && (
              <Checkbox
                checked={selected.has(user.id)}
                onCheckedChange={() => toggleUser(user.id)}
                aria-label={`Select ${user.slack_name}`}
                className="shrink-0"
              />
            )}

            <Link href={`/dashboard/team/${user.id}`} className="shrink-0">
              <Avatar className="h-9 w-9">
                {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.slack_name || ""} />}
                <AvatarFallback className="text-xs bg-primary/[0.08] text-primary font-medium">
                  {getInitials(user.slack_name)}
                </AvatarFallback>
              </Avatar>
            </Link>

            <div className={ROW_GRID}>
              {/* Name + title */}
              <Link href={`/dashboard/team/${user.id}`} className="min-w-0 group">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {user.slack_name || "Unknown"}
                  </p>
                  {user.is_department_head && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 font-medium text-violet-600 border-violet-200 bg-violet-50 dark:text-violet-400 dark:border-violet-400/20 dark:bg-violet-400/10 shrink-0">
                      Head
                    </Badge>
                  )}
                  {user.employee_status && user.employee_status !== "active" && (
                    <Badge variant="outline" className={`text-xs px-1.5 py-0 font-medium shrink-0 ${
                      user.employee_status === "onboarding" ? "text-sky-600 border-sky-200 bg-sky-50 dark:text-sky-400 dark:border-sky-400/20 dark:bg-sky-400/10" :
                      user.employee_status === "inactive" ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-400/20 dark:bg-amber-400/10" :
                      "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-400/20 dark:bg-red-400/10"
                    }`}>
                      {user.employee_status === "onboarding" ? "Onboarding" : user.employee_status === "inactive" ? "Inactive" : "Deactivated"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {user.job_title || user.slack_email || "—"}
                </p>
              </Link>

              {/* Department — the informal team name, free text */}
              <div className="min-w-0 hidden md:block">
                <p className="text-xs text-muted-foreground truncate">{user.department || "—"}</p>
              </div>

              {/* Function — job family on top, level beneath. Its own column now
                  rather than a subtitle under Department: they are different
                  things (one is an informal team, the other the career ladder
                  that drives competency ratings) and conflating them hid
                  whichever mattered. */}
              <div className="min-w-0 hidden lg:block">
                {user.level ? (
                  <>
                    <p className="text-xs text-muted-foreground truncate" title={familyOf(user) || undefined}>
                      {familyOf(user) || "—"}
                    </p>
                    <p className="text-xs text-primary/50 truncate" title={user.level.name || undefined}>
                      {user.level.name}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-500/70 italic truncate">No competency bracket</p>
                )}
              </div>

              {/* Manager */}
              <div className="min-w-0 hidden lg:block">
                <p className="text-xs text-muted-foreground truncate">
                  {user.manager?.slack_name || <span className="text-muted-foreground/40">—</span>}
                </p>
              </div>

              {/* Start Date + Tenure */}
              <div className="min-w-0 hidden xl:block">
                {user.start_date ? (
                  <>
                    <p className="text-xs text-muted-foreground">{formatStartDate(user.start_date)}</p>
                    <p className="text-xs text-muted-foreground/60">{formatTenure(user.start_date)}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground/40">—</p>
                )}
              </div>

              {/* Role */}
              <div className="hidden sm:block shrink-0">
                <RoleSelector
                  userId={user.id}
                  currentRole={user.role || "user"}
                  canEdit={isAdmin && user.id !== currentUserId}
                  workspaceId={workspaceId}
                />
              </div>

              {/* Action arrow */}
              <Link
                href={`/dashboard/team/${user.id}`}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}

        {sortedUsers.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-card py-16 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            {isFiltered || readinessFilter ? (
              <>
                <p className="text-sm font-medium text-foreground mb-1">No matches</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  No directory members match the current filters.
                </p>
                <Button size="sm" variant="outline" onClick={clearFilters} className="mt-5 gap-1.5">
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mb-1">No team members yet</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Import your team from Slack to get started.
                </p>
                <Link href="/dashboard/team/import">
                  <Button size="sm" className="mt-5 gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Import from Slack
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {isAdmin && selected.size > 0 && (
        <BulkActions
          selectedIds={Array.from(selected)}
          users={displayUsers}
          currentUserId={currentUserId}
          onDone={clearSelection}
        />
      )}
    </>
  );
}
