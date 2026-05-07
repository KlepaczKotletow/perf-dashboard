"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ArrowUpDown, ArrowUp, ArrowDown, Search, X, ChevronDown, FileText, Plus,
  Users as UsersIcon, ArrowUpCircle,
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
};

type CycleRef = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type CycleGroup = {
  cycle: CycleRef | null;
  standard: ReviewItem[];
  upward: ReviewItem[];
};

type ReviewItem = {
  id: string;
  status: string;
  assignment_type?: string | null;
  employee?: UserRef | null;
  manager?: UserRef | null;
  reviewer?: UserRef | null;
};

// Flattened row used by the table — easier to sort and filter than the nested
// CycleGroup that the page hands us.
interface FlatRow {
  id: string;
  employee: UserRef | null;
  reviewer: UserRef | null;
  reviewerKind: "manager" | "peer";
  cycle: CycleRef | null;
  type: "standard" | "upward";
  status: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "upward", label: "Upward" },
] as const;

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
] as const;

const CYCLE_STATUS_TONE: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20",
  draft:     "bg-muted text-muted-foreground border-border",
  completed: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-400 dark:border-sky-400/20",
  closed:    "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-400/10 dark:text-zinc-400 dark:border-zinc-400/20",
};

const TYPE_TONE: Record<FlatRow["type"], string> = {
  standard: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-400 dark:border-sky-400/20",
  upward:   "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-400/10 dark:text-violet-400 dark:border-violet-400/20",
};

type SortKey = "employee" | "reviewer" | "type" | "cycle" | "status";
type SortDir = "asc" | "desc";

// ── Helpers ──────────────────────────────────────────────────────────────────

function flatten(cycles: CycleGroup[]): FlatRow[] {
  const out: FlatRow[] = [];
  for (const g of cycles) {
    for (const r of g.standard) {
      out.push({
        id: r.id,
        employee: r.employee ?? null,
        reviewer: r.manager ?? null,
        reviewerKind: "manager",
        cycle: g.cycle,
        type: "standard",
        status: r.status,
      });
    }
    for (const r of g.upward) {
      out.push({
        id: r.id,
        employee: r.employee ?? null,
        reviewer: r.reviewer ?? null,
        reviewerKind: "peer",
        cycle: g.cycle,
        type: "upward",
        status: r.status,
      });
    }
  }
  return out;
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
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

// ── User cell ────────────────────────────────────────────────────────────────

function UserCell({
  user,
  unassignedHint = "Not assigned",
}: {
  user: UserRef | null;
  unassignedHint?: string;
}) {
  if (!user || !user.slack_name) {
    return <span className="text-xs text-muted-foreground italic">{unassignedHint}</span>;
  }
  const initials = initialsOf(user.slack_name);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="h-7 w-7 shrink-0">
        {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.slack_name} />}
        <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{user.slack_name}</p>
        {user.department || user.job_title ? (
          <p className="text-[11px] text-muted-foreground truncate">
            {user.department || user.job_title}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Main table ───────────────────────────────────────────────────────────────

export function ReviewsContent({ cycles }: { cycles: CycleGroup[] }) {
  const router = useRouter();

  const allRows = useMemo(() => flatten(cycles), [cycles]);

  // Cycle and Type options derived from current data — Cycle multi-select
  // populates from whichever cycles actually have assignments in this slice.
  const cycleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of allRows) {
      if (r.cycle) seen.set(r.cycle.id, r.cycle.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ value: id, label: name }));
  }, [allRows]);

  // ── Filter / sort state (client-only — server already returned the full
  // page slice; URL params for search and status were captured in page.tsx).
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [cycleFilter, setCycleFilter] = useState<Set<string>>(new Set());

  const [sortKey, setSortKey] = useState<SortKey>("cycle");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "cycle" ? "desc" : "asc");
    }
  }

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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false;
      if (typeFilter.size > 0 && !typeFilter.has(r.type)) return false;
      if (cycleFilter.size > 0 && !cycleFilter.has(r.cycle?.id ?? "")) return false;
      if (q) {
        const hay = [
          r.employee?.slack_name,
          r.reviewer?.slack_name,
          r.cycle?.name,
          r.employee?.department,
          r.employee?.job_title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, search, statusFilter, typeFilter, cycleFilter]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "employee":
          cmp = (a.employee?.slack_name ?? "zzz").localeCompare(b.employee?.slack_name ?? "zzz");
          break;
        case "reviewer":
          cmp = (a.reviewer?.slack_name ?? "zzz").localeCompare(b.reviewer?.slack_name ?? "zzz");
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "cycle": {
          // Sort by cycle start date (recency); fall back to name.
          const at = new Date(a.cycle?.start_date ?? 0).getTime();
          const bt = new Date(b.cycle?.start_date ?? 0).getTime();
          cmp = at === bt
            ? (a.cycle?.name ?? "").localeCompare(b.cycle?.name ?? "")
            : at - bt;
          break;
        }
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sortKey, sortDir]);

  // ── Empty state (true zero — no assignments at all) ────────────────────────
  if (allRows.length === 0) {
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

  const colHeaderClass =
    "flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors select-none";

  return (
    <>
      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by employee, reviewer, or cycle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            aria-label="Search team reviews"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MultiFilter
            label="Status"
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          <MultiFilter
            label="Type"
            options={TYPE_OPTIONS}
            selected={typeFilter}
            onChange={setTypeFilter}
          />
          {cycleOptions.length > 1 && (
            <MultiFilter
              label="Cycle"
              options={cycleOptions}
              selected={cycleFilter}
              onChange={setCycleFilter}
            />
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

      {isFiltered && (
        <p className="text-xs text-muted-foreground -mt-1 mb-2">
          Showing <span className="font-medium text-foreground">{sortedRows.length}</span> of {allRows.length}{" "}
          review{allRows.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/10">
              <tr className="text-left">
                <th className="px-4 py-2.5 whitespace-nowrap" scope="col">
                  <button onClick={() => handleSort("employee")} className={colHeaderClass}>
                    Employee <SortIcon active={sortKey === "employee"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-2.5 whitespace-nowrap" scope="col">
                  <button onClick={() => handleSort("reviewer")} className={colHeaderClass}>
                    Reviewer <SortIcon active={sortKey === "reviewer"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-2.5 whitespace-nowrap" scope="col">
                  <button onClick={() => handleSort("type")} className={colHeaderClass}>
                    Type <SortIcon active={sortKey === "type"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-2.5 whitespace-nowrap" scope="col">
                  <button onClick={() => handleSort("cycle")} className={colHeaderClass}>
                    Cycle <SortIcon active={sortKey === "cycle"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-2.5 whitespace-nowrap" scope="col">
                  <button onClick={() => handleSort("status")} className={colHeaderClass}>
                    Status <SortIcon active={sortKey === "status"} dir={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-foreground mb-1">No matches</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      No reviews match the current filters.
                    </p>
                    <Button size="sm" variant="outline" onClick={clearFilters} className="gap-1.5">
                      <X className="h-3.5 w-3.5" /> Clear filters
                    </Button>
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => {
                  const status = getAssignmentStatus(r.status);
                  const cycleTone =
                    CYCLE_STATUS_TONE[r.cycle?.status ?? ""] ?? CYCLE_STATUS_TONE.draft;
                  const TypeIcon = r.type === "upward" ? ArrowUpCircle : UsersIcon;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/dashboard/reviews/${r.id}`)}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 align-middle">
                        <UserCell user={r.employee} unassignedHint="Unknown" />
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <UserCell user={r.reviewer} />
                      </td>
                      <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${TYPE_TONE[r.type]}`}
                        >
                          <TypeIcon className="h-3 w-3" />
                          {r.type === "upward" ? "Upward" : "Standard"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground truncate max-w-[160px]">
                            {r.cycle?.name ?? "—"}
                          </span>
                          {r.cycle?.status && (
                            <span
                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${cycleTone}`}
                            >
                              {r.cycle.status.charAt(0).toUpperCase() + r.cycle.status.slice(1)}
                            </span>
                          )}
                        </div>
                        {r.cycle?.start_date && r.cycle?.end_date && (
                          <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                            {format(new Date(r.cycle.start_date), "MMM d")} —{" "}
                            {format(new Date(r.cycle.end_date), "MMM d, yyyy")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                        <Badge className={`text-[10px] font-medium ${status.badge}`}>
                          {status.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
