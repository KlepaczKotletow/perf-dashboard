"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COL_HEADER, HEAD_SHELL, ROW_SHELL, SortIcon, PersonAvatar, NoSlackBadge,
} from "@/components/data-list";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import {
  Search, X, ChevronDown, ChevronRight, FileText, Plus, ArrowRight, Star,
} from "lucide-react";
import Link from "next/link";
import { getAssignmentStatus } from "@/lib/status";

// ── Types ────────────────────────────────────────────────────────────────────

type UserRef = {
  id?: string;
  slack_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  slack_user_id?: string | null;
};

type CycleRef = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type ReviewItem = {
  id: string;
  status: string;
  assignment_type?: string | null;
  overall_rating?: number | null;
  employee_id?: string | null;
  manager_id?: string | null;
  reviewer_id?: string | null;
  employee?: UserRef | null;
  manager?: UserRef | null;
  reviewer?: UserRef | null;
};

type CycleGroup = {
  cycle: CycleRef | null;
  items: ReviewItem[];
};

interface FlatRow {
  id: string;
  employee: UserRef | null;
  reviewer: UserRef | null;
  type: "standard" | "upward";
  status: string;
  rating: number | null;
  /** The signed-in user owes this one — drives the "Yours" affordance. */
  mine: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "upward", label: "Upward" },
] as const;

const STATUS_OPTIONS = [
  // "pending" is the live initial assignment status; badges label it "Not Started"
  { value: "pending", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
] as const;

const CYCLE_STATUS_TONE: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20",
  draft:     "bg-muted text-muted-foreground border-border",
  completed: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-400 dark:border-sky-400/20",
  closed:    "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-400/10 dark:text-zinc-400 dark:border-zinc-400/20",
};

const CYCLE_STATUS_ORDER: Record<string, number> = {
  active: 0, draft: 1, completed: 2, closed: 3,
};

type SortKey = "employee" | "reviewer" | "status" | "rating" | "type";
type SortDir = "asc" | "desc";

// ── Helpers ──────────────────────────────────────────────────────────────────

// A standard row is owned by the employee's manager; an upward row by the
// named reviewer. Collapsing both into one "reviewer" field lets the two
// review kinds share a single table instead of being split into two.
function flattenCycle(g: CycleGroup, currentUserId: string): FlatRow[] {
  return g.items.map((r) => {
    const isUpward = r.assignment_type === "upward";
    const ownerId = isUpward ? r.reviewer_id : r.manager_id;
    return {
      id: r.id,
      employee: r.employee ?? null,
      reviewer: (isUpward ? r.reviewer : r.manager) ?? null,
      type: isUpward ? ("upward" as const) : ("standard" as const),
      status: r.status,
      rating: r.overall_rating ?? null,
      mine: !!ownerId && ownerId === currentUserId,
    };
  });
}

// ── Multi-select filter dropdown ─────────────────────────────────────────────

interface MultiFilterProps {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

function MultiFilter({ label, options, selected, onChange }: MultiFilterProps) {
  const isActive = selected.size > 0;
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
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {selected.size}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Filter by {label.toLowerCase()}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No options</p>
        ) : (
          options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={selected.has(opt.value)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => {
                const next = new Set(selected);
                if (next.has(opt.value)) next.delete(opt.value);
                else next.add(opt.value);
                onChange(next);
              }}
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────

// Column count per breakpoint must match the number of visible cells, in DOM
// order: Employee, Type, Reviewer, Rating, Status, arrow.
const GRID =
  "flex-1 min-w-0 grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1.5fr_1fr_auto_auto] md:grid-cols-[1.5fr_0.5fr_1fr_auto_auto] lg:grid-cols-[1.5fr_0.5fr_1fr_0.6fr_auto_auto] gap-4 items-center";

function PersonCell({ user, hint }: { user: UserRef | null; hint: string }) {
  if (!user || !user.slack_name) {
    return <span className="text-xs text-muted-foreground/50 italic truncate">{hint}</span>;
  }
  return (
    <div className="min-w-0">
      <p className="text-xs text-foreground truncate">{user.slack_name}</p>
      {(user.department || user.job_title) && (
        <p className="text-[10px] text-muted-foreground/60 truncate">
          {user.department || user.job_title}
        </p>
      )}
    </div>
  );
}

function ReviewTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  ratingMax,
  onRowClick,
}: {
  rows: FlatRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  ratingMax: number;
  onRowClick: (id: string) => void;
}) {
  return (
    <div className="space-y-0">
      <div className={`${HEAD_SHELL} bg-muted/[0.04]`}>
        <div className="w-8 shrink-0" />
        <div className={GRID}>
          <button onClick={() => onSort("employee")} className={COL_HEADER}>
            Employee <SortIcon active={sortKey === "employee"} dir={sortDir} />
          </button>
          <button onClick={() => onSort("type")} className={`${COL_HEADER} hidden md:flex`}>
            Type <SortIcon active={sortKey === "type"} dir={sortDir} />
          </button>
          <button onClick={() => onSort("reviewer")} className={`${COL_HEADER} hidden sm:flex`}>
            Reviewer <SortIcon active={sortKey === "reviewer"} dir={sortDir} />
          </button>
          <button onClick={() => onSort("rating")} className={`${COL_HEADER} hidden lg:flex`}>
            Rating <SortIcon active={sortKey === "rating"} dir={sortDir} />
          </button>
          <button onClick={() => onSort("status")} className={COL_HEADER}>
            Status <SortIcon active={sortKey === "status"} dir={sortDir} />
          </button>
          <div className="w-8 shrink-0" />
        </div>
      </div>

      {rows.map((r) => {
        const status = getAssignmentStatus(r.status);
        return (
          <div
            key={r.id}
            onClick={() => onRowClick(r.id)}
            className={`${ROW_SHELL} cursor-pointer ${r.mine ? "bg-primary/[0.03]" : ""}`}
          >
            <PersonAvatar
              name={r.employee?.slack_name}
              avatarUrl={r.employee?.avatar_url}
              className="h-8 w-8"
            />

            <div className={GRID}>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.employee?.slack_name || "Unknown"}
                  </p>
                  {r.employee && !r.employee.slack_user_id && <NoSlackBadge />}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {r.employee?.job_title || r.employee?.department || "—"}
                </p>
              </div>

              {/* Type — replaces the two separate tables this page used to have */}
              <div className="hidden md:block min-w-0">
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${
                    r.type === "upward"
                      ? "text-violet-600 border-violet-200 bg-violet-50 dark:text-violet-400 dark:border-violet-400/20 dark:bg-violet-400/10"
                      : "text-muted-foreground border-border bg-muted/50"
                  }`}
                >
                  {r.type === "upward" ? "Upward" : "Manager"}
                </span>
              </div>

              <div className="hidden sm:block min-w-0">
                <PersonCell user={r.reviewer} hint="No reviewer assigned" />
                {/* Only an outstanding review is "yours to complete" — saying it
                    on a finished one reads as an action that is still owed. */}
                {r.mine && r.status !== "completed" && (
                  <span className="text-[10px] font-medium text-primary">Yours to complete</span>
                )}
                {r.mine && r.status === "completed" && (
                  <span className="text-[10px] text-muted-foreground/60">Reviewed by you</span>
                )}
              </div>

              <div className="hidden lg:block min-w-0">
                {r.rating != null ? (
                  <p className="text-xs text-foreground font-medium tabular-nums flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                    {r.rating.toFixed(1)}
                    <span className="text-muted-foreground font-normal">/ {ratingMax}</span>
                  </p>
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </div>

              <Badge className={`text-[10px] font-medium shrink-0 ${status.badge}`}>
                {status.label}
              </Badge>

              <Link
                href={`/dashboard/reviews/${r.id}`}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open review for ${r.employee?.slack_name ?? "team member"}`}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ReviewsContent({
  cycles,
  currentUserId,
  ratingMax = 5,
}: {
  cycles: CycleGroup[];
  currentUserId: string;
  ratingMax?: number;
}) {
  const router = useRouter();

  // ── Filters (client-side, page-level) ──────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [cycleFilter, setCycleFilter] = useState<Set<string>>(new Set());

  // Sort applies per-table (each cycle/type table sorts independently of
  // siblings using this single global key). Default: Status, ascending —
  // pending bubbles to top.
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Cycle filter options derived from current data.
  const cycleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of cycles) {
      if (g.cycle) seen.set(g.cycle.id, g.cycle.name);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [cycles]);

  const isFiltered =
    search.trim().length > 0 ||
    statusFilter.size > 0 ||
    typeFilter.size > 0 ||
    cycleFilter.size > 0;

  function clearFilters() {
    setSearch("");
    setStatusFilter(new Set());
    setTypeFilter(new Set());
    setCycleFilter(new Set());
  }

  // ── Apply filters and sorting per cycle ────────────────────────────────────

  const q = search.trim().toLowerCase();

  function rowMatches(r: FlatRow): boolean {
    if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false;
    if (typeFilter.size > 0 && !typeFilter.has(r.type)) return false;
    if (q) {
      const hay = [
        r.employee?.slack_name,
        r.reviewer?.slack_name,
        r.employee?.department,
        r.employee?.job_title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function sortRows(rows: FlatRow[]): FlatRow[] {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "employee":
          cmp = (a.employee?.slack_name ?? "zzz").localeCompare(b.employee?.slack_name ?? "zzz");
          break;
        case "reviewer":
          cmp = (a.reviewer?.slack_name ?? "zzz").localeCompare(b.reviewer?.slack_name ?? "zzz");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "rating":
          // Unrated last regardless of direction is wrong for a sortable
          // column, so treat null as the lowest value and let dir flip it.
          cmp = (b.rating ?? -1) - (a.rating ?? -1);
          break;
      }
      // Reviews the signed-in user owes break ties to the top — that is the
      // only row on this page they can actually act on.
      if (cmp === 0 && a.mine !== b.mine) return a.mine ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }

  // Build per-cycle filtered+sorted view. Cycles are kept in stable order
  // (active → draft → completed → closed, then by start_date desc).
  const orderedCycles = useMemo(() => {
    const copy = [...cycles];
    copy.sort((a, b) => {
      const so = (CYCLE_STATUS_ORDER[a.cycle?.status ?? ""] ?? 9) - (CYCLE_STATUS_ORDER[b.cycle?.status ?? ""] ?? 9);
      if (so !== 0) return so;
      return new Date(b.cycle?.start_date ?? 0).getTime() - new Date(a.cycle?.start_date ?? 0).getTime();
    });
    return copy;
  }, [cycles]);

  const cyclesView = orderedCycles.map((g) => {
    const cid = g.cycle?.id ?? "__none__";
    const cycleAllowed = cycleFilter.size === 0 || (g.cycle && cycleFilter.has(g.cycle.id));
    const flat = flattenCycle(g, currentUserId);
    const filtered = cycleAllowed ? flat.filter(rowMatches) : [];
    const rows = sortRows(filtered);
    const totalAll = flat.length;
    const totalFiltered = rows.length;
    const completed = filtered.filter((r) => r.status === "completed").length;
    const pending = totalFiltered - completed;
    const progress = totalFiltered === 0 ? 0 : Math.round((completed / totalFiltered) * 100);
    return { cid, group: g, rows, totalAll, totalFiltered, completed, pending, progress };
  });

  // Default-collapse anything that isn't `active`. Re-evaluate when cycles
  // arrive (e.g. fresh navigation).
  const initialCollapsed = useMemo(() => {
    return new Set(
      orderedCycles
        .filter((g) => g.cycle?.status !== "active")
        .map((g) => g.cycle?.id ?? "__none__"),
    );
  }, [orderedCycles]);

  const [collapsed, setCollapsed] = useState<Set<string>>(initialCollapsed);

  function toggleCollapsed(cid: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  }
  function expandAll() { setCollapsed(new Set()); }
  function collapseAll() { setCollapsed(new Set(orderedCycles.map((g) => g.cycle?.id ?? "__none__"))); }

  // ── Empty state (true zero — no assignments at all) ────────────────────────

  if (cycles.length === 0 || cycles.every((g) => g.items.length === 0)) {
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
            Launch a cycle
          </Link>
        </Button>
      </div>
    );
  }

  const visibleCycles = cyclesView.filter((c) => c.totalFiltered > 0 || (cycleFilter.size === 0 && !isFiltered));
  const totalFilteredAll = cyclesView.reduce((sum, c) => sum + c.totalFiltered, 0);
  const totalAll = cyclesView.reduce((sum, c) => sum + c.totalAll, 0);

  return (
    <>
      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by employee, reviewer, or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            aria-label="Search team reviews"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MultiFilter label="Status" options={STATUS_OPTIONS} selected={statusFilter} onChange={setStatusFilter} />
          <MultiFilter label="Type" options={TYPE_OPTIONS} selected={typeFilter} onChange={setTypeFilter} />
          {cycleOptions.length > 1 && (
            <MultiFilter label="Cycle" options={cycleOptions} selected={cycleFilter} onChange={setCycleFilter} />
          )}
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

      {/* ── Toolbar (counts + expand/collapse) ─────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          {isFiltered ? (
            <>Showing <span className="font-medium text-foreground">{totalFilteredAll}</span> of {totalAll} review{totalAll !== 1 ? "s" : ""}</>
          ) : (
            <>{totalAll} review{totalAll !== 1 ? "s" : ""} across {orderedCycles.length} cycle{orderedCycles.length !== 1 ? "s" : ""}</>
          )}
        </p>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={expandAll} className="text-muted-foreground hover:text-foreground transition-colors">
            Expand all
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button onClick={collapseAll} className="text-muted-foreground hover:text-foreground transition-colors">
            Collapse all
          </button>
        </div>
      </div>

      {/* ── Cycle accordion ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden divide-y divide-border/60">
        {visibleCycles.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground mb-1">No matches</p>
            <p className="text-xs text-muted-foreground mb-4">
              No reviews in any cycle match the current filters.
            </p>
            <Button size="sm" variant="outline" onClick={clearFilters} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          </div>
        )}

        {visibleCycles.map(({ cid, group, rows, totalFiltered, totalAll, pending, progress }) => {
          const isCollapsed = collapsed.has(cid);
          const cycleStatus = group.cycle?.status ?? "draft";
          const tone = CYCLE_STATUS_TONE[cycleStatus] ?? CYCLE_STATUS_TONE.draft;
          const datesLabel = group.cycle?.start_date && group.cycle?.end_date
            ? `${format(new Date(group.cycle.start_date), "MMM d")} — ${format(new Date(group.cycle.end_date), "MMM d, yyyy")}`
            : null;

          return (
            <section key={cid}>
              {/* Cycle header */}
              <button
                onClick={() => toggleCollapsed(cid)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/15 transition-colors text-left"
                aria-expanded={!isCollapsed}
              >
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}

                <span className="text-sm font-semibold text-foreground truncate">
                  {group.cycle?.name ?? "Unknown cycle"}
                </span>

                {group.cycle?.status && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${tone}`}>
                    {cycleStatus.charAt(0).toUpperCase() + cycleStatus.slice(1)}
                  </span>
                )}

                <span className="ml-auto flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                  {pending > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {pending} pending
                    </span>
                  )}
                  <span>
                    {isFiltered && totalFiltered !== totalAll
                      ? <>{totalFiltered} of {totalAll} review{totalAll !== 1 ? "s" : ""}</>
                      : <>{totalAll} review{totalAll !== 1 ? "s" : ""}</>}
                  </span>
                  {datesLabel && <span className="hidden md:inline tabular-nums">{datesLabel}</span>}
                  {/* Progress bar — borrowed from Culture Amp / 15Five. Always shown
                      so collapsed cycles still convey completion at a glance. */}
                  <span
                    className="hidden sm:inline-flex w-20 h-1.5 rounded-full bg-muted overflow-hidden"
                    aria-label={`${progress}% complete`}
                  >
                    <span
                      className="h-full rounded-full bg-primary/80 transition-[width]"
                      style={{ width: `${progress}%` }}
                    />
                  </span>
                </span>
              </button>

              {/* Expanded body */}
              {!isCollapsed && (
                <div className="bg-muted/[0.02]">
                  {rows.length === 0 ? (
                    <p className="px-6 py-6 text-xs text-center text-muted-foreground">
                      No reviews in this cycle match the current filters.
                    </p>
                  ) : (
                    <ReviewTable
                      rows={rows}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      ratingMax={ratingMax}
                      onRowClick={(id) => router.push(`/dashboard/reviews/${id}`)}
                    />
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
