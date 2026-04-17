"use client";

import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ChevronRight, ChevronDown, Search, ArrowUpDown, Target, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  type GoalRow,
  type NormalizedGoalRow,
  type GoalNode,
  unwrap,
  calculateProgress,
  directionIcon,
  trackingConfig,
  buildTree,
  flattenTree,
} from "@/lib/goals-utils";

interface TeamGoalsTableProps {
  goals: GoalRow[];
  cycles: { id: string; name: string }[];
  employees: { id: string; slack_name: string }[];
}

type SortKey = "title" | "owner" | "progress" | "weight" | "cycle";

export default function TeamGoalsTable({ goals, cycles, employees }: TeamGoalsTableProps) {
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [cycleFilter, setCycleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("owner");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Normalize FK joins
  const normalized = useMemo<NormalizedGoalRow[]>(
    () =>
      goals.map((g) => ({
        ...g,
        employee: unwrap(g.employee),
        cycle: unwrap(g.cycle),
        suggested_by: unwrap(g.suggested_by),
      })),
    [goals]
  );

  // Filter
  const filtered = useMemo(() => {
    let result = normalized;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.employee?.slack_name.toLowerCase().includes(q)
      );
    }
    if (employeeFilter !== "all") result = result.filter((g) => g.employee?.id === employeeFilter);
    if (cycleFilter !== "all") result = result.filter((g) => g.cycle?.id === cycleFilter);
    if (statusFilter !== "all") result = result.filter((g) => g.tracking_status === statusFilter);
    return result;
  }, [normalized, search, employeeFilter, cycleFilter, statusFilter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title": cmp = a.title.localeCompare(b.title); break;
        case "owner": cmp = (a.employee?.slack_name || "").localeCompare(b.employee?.slack_name || ""); break;
        case "progress": cmp = (a.progress || 0) - (b.progress || 0); break;
        case "weight": cmp = (a.weight || 0) - (b.weight || 0); break;
        case "cycle": cmp = (a.cycle?.name || "").localeCompare(b.cycle?.name || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Tree or flat
  const hasFilters = search || employeeFilter !== "all" || cycleFilter !== "all" || statusFilter !== "all";
  const rows = useMemo<GoalNode[]>(() => {
    if (hasFilters) return sorted.map((g) => ({ ...g, children: [], depth: 0 }));
    return flattenTree(buildTree(sorted), expanded);
  }, [sorted, expanded, hasFilters]);

  // Stats
  const activeGoals = normalized.filter((g) => g.status === "active");
  const onTrack = activeGoals.filter((g) => g.tracking_status === "on_track" || g.tracking_status === "achieved").length;
  const atRisk = activeGoals.filter((g) => g.tracking_status === "at_risk").length;
  const delayed = activeGoals.filter((g) => g.tracking_status === "delayed").length;
  const weightedProgress = activeGoals.length > 0
    ? Math.round(
        activeGoals.reduce((sum, g) => sum + (g.progress || 0) * (g.weight || 1), 0) /
        activeGoals.reduce((sum, g) => sum + (g.weight || 1), 0)
      )
    : 0;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const SortHeader = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead className={className}>
      <button onClick={() => toggleSort(k)} className="flex items-center gap-1 text-xs hover:text-foreground">
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      {/* Compact stat strip — was 4 oversized cards, now a quiet row */}
      <div className="flex flex-wrap items-center gap-5 sm:gap-7 px-4 py-3 rounded-xl border border-border/60 bg-card">
        {[
          { label: "Active goals", value: activeGoals.length, icon: Target, iconClass: "text-primary", bgClass: "bg-primary/[0.08]" },
          { label: "Avg progress", value: `${weightedProgress}%`, icon: TrendingUp, iconClass: "text-sky-600 dark:text-sky-400", bgClass: "bg-sky-50 dark:bg-sky-400/10" },
          { label: "At risk", value: atRisk, icon: AlertTriangle, iconClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-50 dark:bg-amber-400/10" },
          { label: "On track", value: `${onTrack}/${activeGoals.length}`, icon: CheckCircle2, iconClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-50 dark:bg-emerald-400/10" },
        ].map((m, i) => (
          <div key={m.label} className="flex items-center gap-5 sm:gap-7">
            {i > 0 && <span className="h-8 w-px bg-border/60 hidden sm:block" aria-hidden="true" />}
            <div className="flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-lg ${m.bgClass} flex items-center justify-center shrink-0`}>
                <m.icon className={`h-4 w-4 ${m.iconClass}`} />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground leading-none tabular-nums">{m.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{m.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search goals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="All employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.slack_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cycleFilter} onValueChange={setCycleFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="All cycles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cycles</SelectItem>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="All health" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All health</SelectItem>
            {Object.entries(trackingConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-center py-10 text-sm text-muted-foreground">No goals match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHeader label="Goal" k="title" className="pl-5 min-w-[180px]" />
                  <SortHeader label="Owner" k="owner" className="w-[120px]" />
                  <SortHeader label="Cycle" k="cycle" className="w-[100px]" />
                  <TableHead className="w-[80px]">Status</TableHead>
                  <SortHeader label="Weight" k="weight" className="w-[60px] text-center" />
                  <TableHead className="w-[160px]">Metric</TableHead>
                  <SortHeader label="Progress" k="progress" className="w-[140px]" />
                  <TableHead className="w-[90px] pr-5">Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((g) => {
                  const tc = trackingConfig[g.tracking_status] || trackingConfig.on_track;
                  const pct = g.metric_target != null
                    ? calculateProgress(g.goal_direction, g.metric_start, g.metric_current, g.metric_target)
                    : g.progress || 0;
                  const hasChildren = g.children.length > 0;

                  return (
                    <TableRow key={g.id}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-1" style={{ paddingLeft: `${g.depth * 20}px` }}>
                          {hasChildren ? (
                            <button onClick={() => toggleExpand(g.id)} className="p-0.5 rounded hover:bg-muted">
                              {expanded.has(g.id)
                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                          ) : (
                            <span className="w-[18px]" />
                          )}
                          <Link href={`/dashboard/goals/${g.id}`} className="text-sm font-medium hover:underline truncate max-w-[250px]">
                            {g.title}
                          </Link>
                          {g.status === "draft" && (
                            <Badge variant="outline" className="text-[9px] ml-1">Draft</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{g.employee?.slack_name || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{g.cycle?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`text-[9px] font-medium ${
                          g.status === "active"
                            ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {g.status === "active" ? "Active" : g.status.charAt(0).toUpperCase() + g.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {g.weight !== 1 ? `${g.weight}×` : "1×"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {g.metric_target != null ? (
                          <span>
                            {g.metric_start ?? 0} {directionIcon(g.goal_direction)} {g.metric_current ?? "—"} → {g.metric_target}
                            {g.metric_unit ? ` ${g.metric_unit}` : ""}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${tc.barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-5">
                        <Badge className={`text-[9px] font-medium ${tc.color}`}>{tc.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
