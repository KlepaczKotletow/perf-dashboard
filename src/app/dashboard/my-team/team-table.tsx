"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Star, UsersRound, X } from "lucide-react";
import { getAssignmentStatus } from "@/lib/status";
import {
  COL_HEADER,
  HEAD_SHELL,
  ROW_SHELL,
  SortIcon,
  PersonAvatar,
  NameCell,
  StackedCell,
  Blank,
  HeadBadge,
  EmployeeStatusBadge,
  NoSlackBadge,
  EmptyState,
  type SortDir,
} from "@/components/data-list";

export interface ReportRow {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  employeeStatus: string | null;
  isDepartmentHead: boolean;
  hasSlack: boolean;
  /** "Engineering · Senior Engineer", or null when no level is assigned. */
  levelLabel: string | null;
  /** The report's own review in the current active cycle, if one exists. */
  review: {
    assignmentId: string;
    cycleId: string;
    cycleName: string | null;
    status: string;
    /** True when the signed-in manager is the one who owes this review. */
    mine: boolean;
    /** Name of whoever owes it, when it isn't the signed-in manager. */
    waitingOn: string | null;
  } | null;
  rating: number | null;
  ratingCycle: string | null;
  ratingMax: number;
  activeGoals: number;
  avgProgress: number;
}

// Columns share the Directory's progressive-disclosure approach: the name is
// always present, everything else appears as the viewport allows. DOM order
// must match the grid order, since hidden cells drop out of the grid flow.
const GRID =
  "flex-1 min-w-0 grid grid-cols-[1fr_auto] sm:grid-cols-[1.6fr_1fr_auto] md:grid-cols-[1.6fr_1fr_1fr_auto] lg:grid-cols-[1.6fr_1fr_1fr_0.7fr_0.9fr_auto] gap-4 items-center";

type SortKey = "name" | "review" | "department" | "rating" | "goals";

// Ordered so "needs your attention" sorts to the top ascending.
const REVIEW_RANK: Record<string, number> = { pending: 0, in_progress: 1, completed: 2 };

export function TeamTable({ reports }: { reports: ReportRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? reports.filter((r) =>
          [r.name, r.jobTitle, r.department, r.email, r.levelLabel]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))
        )
      : reports;

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "");
          break;
        case "review": {
          // No review at all sorts last — there is nothing to act on.
          const ra = a.review ? REVIEW_RANK[a.review.status] ?? 3 : 4;
          const rb = b.review ? REVIEW_RANK[b.review.status] ?? 3 : 4;
          cmp = ra - rb;
          break;
        }
        case "department":
          cmp = (a.department || "").localeCompare(b.department || "");
          break;
        case "rating":
          cmp = (b.rating ?? -1) - (a.rating ?? -1);
          break;
        case "goals":
          cmp = b.activeGoals - a.activeGoals;
          break;
      }
      if (cmp === 0) cmp = (a.name || "").localeCompare(b.name || "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [reports, search, sortKey, sortDir]);

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title="No direct reports"
        description="Nobody reports to you yet. Reporting lines are set from the Directory."
        action={
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/team">Open Directory</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      {reports.length > 5 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your team by name, title, or department…"
            aria-label="Search your team"
            className="pl-9 h-9 text-sm"
          />
        </div>
      )}

      {search && (
        <p className="text-xs text-muted-foreground -mt-1 mb-2">
          Showing <span className="font-medium text-foreground">{visible.length}</span> of {reports.length}
        </p>
      )}

      <div className="space-y-0">
        <div className={HEAD_SHELL}>
          <div className="w-9 shrink-0" />
          <div className={GRID}>
            <button onClick={() => handleSort("name")} className={COL_HEADER}>
              Name <SortIcon active={sortKey === "name"} dir={sortDir} />
            </button>
            <button onClick={() => handleSort("review")} className={`${COL_HEADER} hidden sm:flex`}>
              Review <SortIcon active={sortKey === "review"} dir={sortDir} />
            </button>
            <button onClick={() => handleSort("department")} className={`${COL_HEADER} hidden md:flex`}>
              Department <SortIcon active={sortKey === "department"} dir={sortDir} />
            </button>
            <button onClick={() => handleSort("rating")} className={`${COL_HEADER} hidden lg:flex`}>
              Rating <SortIcon active={sortKey === "rating"} dir={sortDir} />
            </button>
            <button onClick={() => handleSort("goals")} className={`${COL_HEADER} hidden lg:flex`}>
              Goals <SortIcon active={sortKey === "goals"} dir={sortDir} />
            </button>
            <div className="w-8 shrink-0" />
          </div>
        </div>

        {visible.map((r) => {
          const status = r.review ? getAssignmentStatus(r.review.status) : null;
          return (
            <div key={r.id} className={ROW_SHELL}>
              <PersonAvatar
                name={r.name}
                avatarUrl={r.avatarUrl}
                href={`/dashboard/team/${r.id}`}
              />

              <div className={GRID}>
                <NameCell
                  name={r.name}
                  href={`/dashboard/team/${r.id}`}
                  subtitle={r.jobTitle || r.email || "—"}
                  badges={
                    <>
                      {r.isDepartmentHead && <HeadBadge />}
                      <EmployeeStatusBadge status={r.employeeStatus} />
                      {!r.hasSlack && <NoSlackBadge />}
                    </>
                  }
                />

                {/* Review — the manager's primary question: do I owe this one? */}
                <div className="min-w-0 hidden sm:block">
                  {status && r.review ? (
                    <>
                      <Badge className={`text-[10px] font-medium ${status.badge}`}>{status.label}</Badge>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {r.review.status === "completed"
                          ? r.review.cycleName || "—"
                          : r.review.mine
                            ? "Yours to complete"
                            : r.review.waitingOn
                              ? `Waiting on ${r.review.waitingOn}`
                              : "No reviewer assigned"}
                      </p>
                    </>
                  ) : (
                    <Blank label="No active cycle" />
                  )}
                </div>

                <StackedCell
                  className="hidden md:block"
                  primary={r.department || "—"}
                  secondary={r.levelLabel ?? "No competency bracket"}
                  secondaryTone={r.levelLabel ? "text-primary/50" : "text-amber-500/70 italic"}
                  title={r.levelLabel ?? undefined}
                />

                {/* Rating — always labelled with its scale so "1.8" is readable */}
                <div className="min-w-0 hidden lg:block">
                  {r.rating != null ? (
                    <>
                      <p className="text-xs text-foreground font-medium tabular-nums flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                        {r.rating.toFixed(1)}
                        <span className="text-muted-foreground font-normal">/ {r.ratingMax}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 truncate">
                        {r.ratingCycle || "Last review"}
                      </p>
                    </>
                  ) : (
                    <Blank label="Not rated yet" />
                  )}
                </div>

                {/* Goals */}
                <div className="min-w-0 hidden lg:block">
                  {r.activeGoals > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {r.activeGoals} active
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="h-1 w-10 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${r.avgProgress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                          {r.avgProgress}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <Blank label="No goals" />
                  )}
                </div>

                <Link
                  href={`/dashboard/team/${r.id}`}
                  aria-label={`Open ${r.name ?? "team member"}`}
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">No one on your team matches “{search}”.</p>
            <Button size="sm" variant="outline" onClick={() => setSearch("")} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Clear search
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
