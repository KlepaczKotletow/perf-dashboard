"use client";

import { Fragment, useState, useMemo, useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown, ChevronRight, X, Search, ScrollText, Calendar, ArrowDown,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: { id: string; slack_name: string | null } | null;
}

export interface AuditLogTableProps {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  // Filter dropdown options.
  actionOptions: ReadonlyArray<{ value: string; label: string }>;
  actorOptions: ReadonlyArray<{ id: string; name: string }>;
  // Current filter values (parsed from URL on the server).
  current: {
    actions: string[];
    actors: string[];
    range: RangeKey;
    q: string;
  };
}

const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;
export type RangeKey = (typeof RANGE_OPTIONS)[number]["value"];

const ACTION_LABELS: Record<string, string> = {
  "cycle.status_change": "Cycle status",
  "cycle.release_grades": "Grades released",
  "assignment.calibrate": "Grade calibrated",
  "user.role_change": "Role changed",
};

const ACTION_TONES: Record<string, string> = {
  "cycle.status_change": "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-400 dark:border-sky-400/20",
  "cycle.release_grades": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20",
  "assignment.calibrate": "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-400/10 dark:text-violet-400 dark:border-violet-400/20",
  "user.role_change": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function describeTarget(action: string, md: Record<string, unknown>): string {
  switch (action) {
    case "cycle.status_change":
      return String(md.cycle_name ?? "—");
    case "cycle.release_grades":
      return String(md.cycle_name ?? "—");
    case "assignment.calibrate":
      return "Review assignment";
    case "user.role_change":
      return String(md.target_slack_name ?? "—");
    default:
      return "—";
  }
}

function describeChange(action: string, md: Record<string, unknown>): string | null {
  switch (action) {
    case "cycle.status_change":
    case "user.role_change":
    case "assignment.calibrate":
      if (md.from !== undefined || md.to !== undefined) {
        return `${md.from ?? "–"} → ${md.to ?? "–"}`;
      }
      return null;
    case "cycle.release_grades":
      return "Grades published";
    default:
      return null;
  }
}

function formatTimestamp(iso: string): { date: string; time: string; relative: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  let relative: string;
  if (mins < 1) relative = "just now";
  else if (mins < 60) relative = `${mins}m ago`;
  else if (hours < 24) relative = `${hours}h ago`;
  else if (days < 30) relative = `${days}d ago`;
  else relative = date;
  return { date, time, relative };
}

// ── Filter dropdown (multi-select with checkbox items) ──────────────────────

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
          <p className="px-2 py-3 text-xs text-muted-foreground">No options yet</p>
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

// ── Single-value filter (date range) ─────────────────────────────────────────

interface SingleFilterProps {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  defaultValue: string;
  onChange: (next: string) => void;
}

function SingleFilter({ label, options, value, defaultValue, onChange }: SingleFilterProps) {
  const isActive = value !== defaultValue;
  const selectedLabel = options.find((o) => o.value === value)?.label ?? label;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 text-xs gap-1.5 ${isActive ? "border-primary/50 bg-primary/[0.04]" : ""}`}
        >
          <Calendar className="h-3 w-3 opacity-70" />
          {selectedLabel}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main table ───────────────────────────────────────────────────────────────

export function AuditLogTable({
  rows,
  total,
  page,
  pageSize,
  actionOptions,
  actorOptions,
  current,
}: AuditLogTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state shadows the URL so the search input feels instant. URL is the
  // source of truth for what's actually fetched — we push to it on commit
  // (actions/actors/range) or via a debounced effect on the search box (q).
  const [searchInput, setSearchInput] = useState(current.q);
  const actionsSet = useMemo(() => new Set(current.actions), [current.actions]);
  const actorsSet = useMemo(() => new Set(current.actors), [current.actors]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ── URL plumbing ──────────────────────────────────────────────────────────

  const pushParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      // Filter changes always reset pagination to the first page.
      next.delete("page");
      const qs = next.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [pathname, router, searchParams],
  );

  const setActions = useCallback(
    (next: Set<string>) => {
      pushParams((p) => {
        if (next.size === 0) p.delete("action");
        else p.set("action", [...next].join(","));
      });
    },
    [pushParams],
  );

  const setActors = useCallback(
    (next: Set<string>) => {
      pushParams((p) => {
        if (next.size === 0) p.delete("actor");
        else p.set("actor", [...next].join(","));
      });
    },
    [pushParams],
  );

  const setRange = useCallback(
    (next: string) => {
      pushParams((p) => {
        if (next === "all") p.delete("range");
        else p.set("range", next);
      });
    },
    [pushParams],
  );

  const commitSearch = useCallback(
    (next: string) => {
      pushParams((p) => {
        if (!next.trim()) p.delete("q");
        else p.set("q", next.trim());
      });
    },
    [pushParams],
  );

  function clearAll() {
    setSearchInput("");
    pushParams((p) => {
      p.delete("action");
      p.delete("actor");
      p.delete("range");
      p.delete("q");
    });
  }

  const isFiltered =
    actionsSet.size > 0 ||
    actorsSet.size > 0 ||
    current.range !== "all" ||
    current.q.length > 0;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <form
          className="relative flex-1 max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            commitSearch(searchInput);
          }}
        >
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by actor, target, or details…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onBlur={() => {
              if (searchInput !== current.q) commitSearch(searchInput);
            }}
            className="pl-8 h-9 text-sm"
            aria-label="Search audit log"
          />
        </form>
        <div className="flex items-center gap-2 flex-wrap">
          <MultiFilter
            label="Action"
            options={actionOptions}
            selected={actionsSet}
            onChange={setActions}
          />
          <MultiFilter
            label="Actor"
            options={actorOptions.map((a) => ({ value: a.id, label: a.name }))}
            selected={actorsSet}
            onChange={setActors}
          />
          <SingleFilter
            label="Date range"
            options={RANGE_OPTIONS}
            value={current.range}
            defaultValue="all"
            onChange={(v) => setRange(v as RangeKey)}
          />
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-9 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      <Card className={isPending ? "opacity-70 transition-opacity" : "transition-opacity"}>
        <CardHeader className="border-b border-border/60 bg-muted/20 py-2.5 px-4">
          <p className="text-xs text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">{total}</span>{" "}
            event{total !== 1 ? "s" : ""}
            {isFiltered ? <> · matching the current filters</> : <> recorded</>}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="py-16 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                <ScrollText className="h-5 w-5 text-muted-foreground" />
              </div>
              {isFiltered ? (
                <>
                  <p className="text-sm font-medium text-foreground mb-1">No matches</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    No audit entries match the current filters.
                  </p>
                  <Button size="sm" variant="outline" onClick={clearAll} className="mt-5 gap-1.5">
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground mb-1">No events recorded yet</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Sensitive actions (cycle launches, grade releases, calibrations, role changes)
                    will be logged here as they happen.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/10">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 font-semibold w-8" aria-label="Expand"></th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        When <ArrowDown className="h-3 w-3 opacity-60" />
                      </span>
                    </th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Actor</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Action</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Target</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rows.map((r) => {
                    const ts = formatTimestamp(r.created_at);
                    const actor = r.actor?.slack_name ?? "System";
                    const tone = ACTION_TONES[r.action] ?? "bg-muted text-muted-foreground border-border";
                    const isOpen = expanded.has(r.id);
                    return (
                      <Fragment key={r.id}>
                        <tr
                          onClick={() => toggleExpanded(r.id)}
                          className={`cursor-pointer transition-colors ${
                            isOpen ? "bg-muted/30" : "hover:bg-muted/20"
                          }`}
                        >
                          <td className="px-4 py-2.5 align-top">
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 align-top whitespace-nowrap">
                            <div className="text-foreground tabular-nums">{ts.relative}</div>
                            <div className="text-[11px] text-muted-foreground tabular-nums" title={`${ts.date} ${ts.time}`}>
                              {ts.date}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-top whitespace-nowrap">
                            <span className="font-medium text-foreground">{actor}</span>
                          </td>
                          <td className="px-4 py-2.5 align-top whitespace-nowrap">
                            <Badge variant="outline" className={`text-[10px] font-normal ${tone}`}>
                              {ACTION_LABELS[r.action] ?? r.action}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <span className="text-foreground">{describeTarget(r.action, r.metadata)}</span>
                          </td>
                          <td className="px-4 py-2.5 align-top whitespace-nowrap">
                            <span className="text-muted-foreground tabular-nums">
                              {describeChange(r.action, r.metadata) ?? "—"}
                            </span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-muted/20">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs max-w-2xl">
                                <div>
                                  <span className="text-muted-foreground">Exact time: </span>
                                  <span className="font-medium tabular-nums">
                                    {ts.date} · {ts.time}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Entity type: </span>
                                  <span className="font-mono text-[11px]">{r.entity_type}</span>
                                </div>
                                {r.entity_id && (
                                  <div className="sm:col-span-2 truncate">
                                    <span className="text-muted-foreground">Entity ID: </span>
                                    <span className="font-mono text-[11px]">{r.entity_id}</span>
                                  </div>
                                )}
                                <div className="sm:col-span-2">
                                  <span className="text-muted-foreground block mb-1">Metadata:</span>
                                  <pre className="font-mono text-[11px] bg-muted/40 rounded p-2 overflow-x-auto">
                                    {JSON.stringify(r.metadata, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/dashboard/admin/audit"
        searchParams={Object.fromEntries(
          Array.from(searchParams.entries()).filter(([k]) => k !== "page"),
        )}
      />
    </>
  );
}

