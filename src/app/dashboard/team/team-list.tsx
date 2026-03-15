"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { RoleSelector } from "./role-selector";
import { BulkActions } from "./bulk-actions";
import { ArrowRight } from "lucide-react";

interface TeamUser {
  id: string;
  slack_name: string | null;
  slack_email: string | null;
  job_title: string | null;
  department: string | null;
  role: string | null;
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
  useDepartments?: boolean;
  useCareerFramework?: boolean;
}

export function TeamList({ users, isAdmin, currentUserId, workspaceId, filterUnassigned, useDepartments = false, useCareerFramework = false }: TeamListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const displayUsers = filterUnassigned ? users.filter(u => !u.level) : users;

  const allSelected = displayUsers.length > 0 && selected.size === displayUsers.length;
  const someSelected = selected.size > 0 && selected.size < displayUsers.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayUsers.map((u) => u.id)));
    }
  }

  function toggleUser(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <>
      <div className="space-y-2">
        {/* Select all header */}
        {isAdmin && displayUsers.length > 0 && (
          <div className="flex items-center gap-3 px-3 py-1.5">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            <span className="text-xs text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} selected`
                : "Select all"}
            </span>
          </div>
        )}

        {displayUsers.map((user) => (
          <div
            key={user.id}
            className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
              selected.has(user.id)
                ? "border-primary/40 bg-primary/[0.03] shadow-sm"
                : "border-border/60 bg-card hover:border-border hover:shadow-sm"
            }`}
          >
            {isAdmin && (
              <Checkbox
                checked={selected.has(user.id)}
                onCheckedChange={() => toggleUser(user.id)}
                aria-label={`Select ${user.slack_name}`}
              />
            )}

            <Link href={`/dashboard/team/${user.id}`} className="shrink-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs bg-primary/[0.08] text-primary font-medium">
                  {getInitials(user.slack_name)}
                </AvatarFallback>
              </Avatar>
            </Link>

            <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-center">
              {/* Name + email */}
              <Link href={`/dashboard/team/${user.id}`} className="min-w-0 group">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {user.slack_name || "Unknown"}
                  </p>
                  {user.is_department_head && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium text-violet-600 border-violet-200 bg-violet-50 dark:text-violet-400 dark:border-violet-400/20 dark:bg-violet-400/10 shrink-0">
                      Dept Head
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {user.job_title || user.slack_email || "—"}
                </p>
              </Link>

              {/* Department + Level */}
              <div className="min-w-0 hidden md:block">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {user.department && (
                    <span className="text-xs text-muted-foreground truncate">{user.department}</span>
                  )}
                  {user.level ? (
                    <span className="text-xs text-muted-foreground/60">
                      {user.department ? " · " : ""}
                      {user.level.job_family?.name ? `${user.level.job_family.name} · ` : ""}
                      {user.level.name}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-500 dark:text-amber-400">
                      {user.department ? " · " : ""}Unassigned
                    </span>
                  )}
                </div>
              </div>

              {/* Manager */}
              <div className="min-w-0 hidden lg:block">
                {user.manager?.slack_name ? (
                  <span className="text-xs text-muted-foreground">Reports to {user.manager.slack_name}</span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">No manager</span>
                )}
              </div>

              {/* Role + Action */}
              <div className="flex items-center gap-3 shrink-0">
                <RoleSelector
                  userId={user.id}
                  currentRole={user.role || "user"}
                  canEdit={isAdmin && user.id !== currentUserId}
                />
                <Link
                  href={`/dashboard/team/${user.id}`}
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk action bar */}
      {isAdmin && selected.size > 0 && (
        <BulkActions
          selectedIds={Array.from(selected)}
          users={displayUsers}
          onDone={clearSelection}
          useDepartments={useDepartments}
          useCareerFramework={useCareerFramework}
        />
      )}
    </>
  );
}
