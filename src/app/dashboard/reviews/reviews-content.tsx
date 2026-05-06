"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import Link from "next/link";
import {
  ArrowRight, Users, ArrowUpCircle, ChevronDown, ChevronRight,
  FileText, ArrowUpDown, Plus,
} from "lucide-react";
import { getAssignmentStatus } from "@/lib/status";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CYCLE_STATUS_STYLE: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  draft:     "bg-muted text-muted-foreground",
  completed: "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-400",
  closed:    "bg-zinc-100 text-zinc-600 dark:bg-zinc-400/10 dark:text-zinc-400",
};

const SORT_OPTIONS = [
  { value: "newest",       label: "Newest cycle first" },
  { value: "oldest",       label: "Oldest cycle first" },
  { value: "active_first", label: "Active cycles first" },
  { value: "pending_first",label: "Most pending first" },
];

const STATUS_ORDER: Record<string, number> = { pending: 0, in_progress: 1, completed: 2 };
const CYCLE_STATUS_ORDER: Record<string, number> = { active: 0, draft: 1, completed: 2, closed: 3 };

function UserCell({
  name,
  subtitle,
  avatarUrl,
  compact = false,
}: {
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  compact?: boolean;
}) {
  if (!name || name === "Unassigned") {
    return <span className="text-xs text-muted-foreground italic">Not assigned</span>;
  }
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className={compact ? "h-6 w-6 shrink-0" : "h-7 w-7 shrink-0"}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

type UserRef = { id?: string; slack_name?: string | null; job_title?: string | null; department?: string | null; avatar_url?: string | null };
type CycleRef = { id: string; name: string; status: string; start_date: string | null; end_date: string | null };
type ReviewItem = {
  id: string;
  status: string;
  assignment_type?: string | null;
  employee?: UserRef | null;
  manager?: UserRef | null;
  reviewer?: UserRef | null;
};

type CycleGroup = { cycle: CycleRef | null; standard: ReviewItem[]; upward: ReviewItem[] };

export function ReviewsContent({ cycles: initialCycles }: { cycles: CycleGroup[] }) {
  const [sort, setSort] = useState("newest");

  // Collapse by default — only the first cycle (by current sort) stays expanded.
  // Users can still expand/collapse individual cycles, or use expand-all.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (initialCycles.length <= 1) return new Set();
    const sortedByStart = [...initialCycles].sort(
      (a, b) =>
        new Date(b.cycle?.start_date ?? 0).getTime() -
        new Date(a.cycle?.start_date ?? 0).getTime(),
    );
    // Everything except the first (newest) starts collapsed.
    return new Set(
      sortedByStart.slice(1).map((c) => c.cycle?.id ?? "__none__"),
    );
  });

  const sorted = useMemo(() => {
    const copy = [...initialCycles];
    switch (sort) {
      case "oldest":
        return copy.sort((a, b) =>
          new Date(a.cycle?.start_date ?? 0).getTime() - new Date(b.cycle?.start_date ?? 0).getTime()
        );
      case "active_first":
        return copy.sort((a, b) =>
          (CYCLE_STATUS_ORDER[a.cycle?.status ?? ""] ?? 9) - (CYCLE_STATUS_ORDER[b.cycle?.status ?? ""] ?? 9)
        );
      case "pending_first":
        return copy.sort((a, b) => {
          const aArr = [...a.standard, ...a.upward].map(x => STATUS_ORDER[x.status] ?? 9);
          const bArr = [...b.standard, ...b.upward].map(x => STATUS_ORDER[x.status] ?? 9);
          const aMin = aArr.length > 0 ? Math.min(...aArr) : Infinity;
          const bMin = bArr.length > 0 ? Math.min(...bArr) : Infinity;
          return aMin - bMin;
        });
      default: // newest
        return copy.sort((a, b) =>
          new Date(b.cycle?.start_date ?? 0).getTime() - new Date(a.cycle?.start_date ?? 0).getTime()
        );
    }
  }, [initialCycles, sort]);

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() { setCollapsed(new Set()); }
  function collapseAll() { setCollapsed(new Set(sorted.map(c => c.cycle?.id ?? "__none__"))); }

  if (initialCycles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card py-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No review assignments yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Assignments are created when a performance cycle is launched.
        </p>
        <Button size="sm" className="mt-5 gap-1.5" asChild>
          <Link href="/dashboard/cycles/new">
            <Plus className="h-3.5 w-3.5" />
            Launch a Cycle
          </Link>
        </Button>
      </div>
    );
  }

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "Sort";

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Expand all
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button onClick={collapseAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Collapse all
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {currentSortLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
              {SORT_OPTIONS.map(o => (
                <DropdownMenuRadioItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Cycles — no per-cycle border. Hairline divides each one. */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden divide-y divide-border/60">
        {sorted.map(({ cycle, standard, upward }) => {
          const cid = cycle?.id ?? "__none__";
          const isCollapsed = collapsed.has(cid);
          const incompleteCount = [...standard, ...upward].filter(a => a.status !== "completed").length;
          const totalCount = standard.length + upward.length;
          const hasBothTypes = standard.length > 0 && upward.length > 0;

          return (
            <div key={cid}>
              {/* Cycle header row */}
              <button
                onClick={() => toggleCollapse(cid)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left"
              >
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="text-sm font-semibold text-foreground truncate">
                  {cycle?.name ?? "Unknown Cycle"}
                </span>
                {cycle?.status && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${CYCLE_STATUS_STYLE[cycle.status] ?? CYCLE_STATUS_STYLE.draft}`}>
                    {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                  {incompleteCount > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {incompleteCount} pending
                    </span>
                  )}
                  <span>{totalCount} review{totalCount !== 1 ? "s" : ""}</span>
                  {cycle?.start_date && cycle?.end_date && (
                    <span className="hidden md:inline">
                      {format(new Date(cycle.start_date), "MMM d")} — {format(new Date(cycle.end_date), "MMM d, yyyy")}
                    </span>
                  )}
                </span>
              </button>

              {/* Expanded rows */}
              {!isCollapsed && (
                <div className="bg-muted/[0.04]">
                  {standard.length > 0 && (
                    <ReviewGroup
                      icon={Users}
                      label="Standard Reviews"
                      count={standard.length}
                      rows={standard}
                      kind="standard"
                      showLabel={hasBothTypes}
                    />
                  )}
                  {upward.length > 0 && (
                    <ReviewGroup
                      icon={ArrowUpCircle}
                      label="Upward Reviews"
                      count={upward.length}
                      rows={upward}
                      kind="upward"
                      showLabel={hasBothTypes}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Flat row group — replaces the per-cycle <Table> with a stack of     */
/*  link rows separated by hairline dividers.                            */
/* -------------------------------------------------------------------- */

function ReviewGroup({
  icon: Icon,
  label,
  count,
  rows,
  kind,
  showLabel = true,
}: {
  icon: typeof Users;
  label: string;
  count: number;
  rows: ReviewItem[];
  kind: "standard" | "upward";
  showLabel?: boolean;
}) {
  return (
    <div>
      {showLabel && (
        <div className="flex items-center gap-2 px-5 pt-3 pb-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label} · {count}
          </span>
        </div>
      )}
      <div className="divide-y divide-border/60">
        {rows.map((a) => {
          const config = getAssignmentStatus(a.status);
          const reviewer = kind === "upward" ? a.reviewer : a.manager;
          return (
            <Link
              key={a.id}
              href={`/dashboard/reviews/${a.id}`}
              className="flex items-center gap-3 px-5 py-2 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex-1 min-w-0 max-w-[44%]">
                <UserCell
                  name={a.employee?.slack_name || "Unknown"}
                  subtitle={a.employee?.department || a.employee?.job_title || undefined}
                  avatarUrl={a.employee?.avatar_url ?? undefined}
                />
              </div>
              <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                <span className="text-muted-foreground/50">→</span>
                <UserCell
                  name={reviewer?.slack_name || ""}
                  avatarUrl={reviewer?.avatar_url ?? undefined}
                  compact
                />
              </div>
              <Badge className={`text-[10px] font-medium shrink-0 ${config.badge}`}>
                {config.label}
              </Badge>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
