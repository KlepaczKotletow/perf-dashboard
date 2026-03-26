"use client";

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { RoleSelector } from "./role-selector";
import { BulkActions } from "./bulk-actions";
import { ArrowUpDown, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";

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
  is_department_head?: boolean;
  manager: { slack_name: string } | null;
  level: { name: string; grade: string | null; job_family: { name: string } | null } | null;
}

interface TeamListProps {
  users: TeamUser[];
  isAdmin: boolean;
  currentUserId?: string;
  workspaceId?: string;
  filterUnassigned?: boolean;
}

type SortKey = "name" | "department" | "job_title" | "manager" | "start_date" | "role";
type SortDir = "asc" | "desc";

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

export function TeamList({ users, isAdmin, currentUserId, workspaceId, filterUnassigned }: TeamListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const displayUsers = filterUnassigned ? users.filter(u => !u.level) : users;

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

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const colHeaderClass = "flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors select-none";

  return (
    <>
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
          <div className="flex-1 min-w-0 grid grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr_auto] gap-4 items-center">
            <button onClick={() => handleSort("name")} className={colHeaderClass}>
              Name <SortIcon col="name" />
            </button>
            <button onClick={() => handleSort("department")} className={`${colHeaderClass} hidden md:flex`}>
              Department <SortIcon col="department" />
            </button>
            <button onClick={() => handleSort("manager")} className={`${colHeaderClass} hidden lg:flex`}>
              Manager <SortIcon col="manager" />
            </button>
            <button onClick={() => handleSort("start_date")} className={`${colHeaderClass} hidden lg:flex`}>
              Start Date <SortIcon col="start_date" />
            </button>
            <button onClick={() => handleSort("role")} className={`${colHeaderClass} hidden sm:flex`}>
              Role <SortIcon col="role" />
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

            <div className="flex-1 min-w-0 grid grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr_auto] gap-4 items-center">
              {/* Name + title */}
              <Link href={`/dashboard/team/${user.id}`} className="min-w-0 group">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {user.slack_name || "Unknown"}
                  </p>
                  {user.is_department_head && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium text-violet-600 border-violet-200 bg-violet-50 dark:text-violet-400 dark:border-violet-400/20 dark:bg-violet-400/10 shrink-0">
                      Head
                    </Badge>
                  )}
                  {user.employee_status && user.employee_status !== "active" && (
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-medium shrink-0 ${
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

              {/* Department + Competency bracket */}
              <div className="min-w-0 hidden md:block">
                <p className="text-xs text-muted-foreground truncate">{user.department || "—"}</p>
                {user.level ? (
                  <p className="text-[10px] text-primary/50 truncate" title={`${user.level.job_family?.name ? user.level.job_family.name + " · " : ""}${user.level.name}`}>
                    {user.level.job_family?.name ? `${user.level.job_family.name} · ` : ""}{user.level.name}
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-500/70 italic truncate">No competency bracket</p>
                )}
              </div>

              {/* Manager */}
              <div className="min-w-0 hidden lg:block">
                <p className="text-xs text-muted-foreground truncate">
                  {user.manager?.slack_name || <span className="text-muted-foreground/40">—</span>}
                </p>
              </div>

              {/* Start Date + Tenure */}
              <div className="min-w-0 hidden lg:block">
                {user.start_date ? (
                  <>
                    <p className="text-xs text-muted-foreground">{formatStartDate(user.start_date)}</p>
                    <p className="text-[10px] text-muted-foreground/60">{formatTenure(user.start_date)}</p>
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
          <div className="py-12 text-center text-sm text-muted-foreground">
            No employees found.
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {isAdmin && selected.size > 0 && (
        <BulkActions
          selectedIds={Array.from(selected)}
          users={displayUsers}
          onDone={clearSelection}
        />
      )}
    </>
  );
}
