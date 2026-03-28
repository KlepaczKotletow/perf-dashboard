"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight, Users, ArrowUpCircle, ChevronDown, ChevronRight,
  FileText, ArrowUpDown, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { getAssignmentStatus } from "@/lib/status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

function SubSection({
  icon, label, count, items,
  hasBorderTop,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  items: any[];
  hasBorderTop?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className={hasBorderTop ? "border-t border-border/40" : ""}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-2 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
      >
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex-1">
          {label} · {count}
        </span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Employee</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Rating</TableHead>
              <TableHead className="pr-5 w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => {
              const config = getAssignmentStatus(a.status);
              const isUpward = a.assignment_type === "upward";
              const reviewerName = isUpward
                ? (a.reviewer?.slack_name ?? "Unassigned")
                : (a.manager?.slack_name ?? "Unassigned");
              const initials = (a.employee?.slack_name ?? "?")[0].toUpperCase();

              return (
                <TableRow key={a.id} className="group cursor-pointer" onClick={() => window.location.href = `/dashboard/reviews/${a.id}`}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">{initials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {a.employee?.slack_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.employee?.department || a.employee?.job_title || "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {reviewerName}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-[10px] font-medium ${config.badge}`}>
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium text-muted-foreground">
                    {a.overall_rating ? `${a.overall_rating}/5` : "—"}
                  </TableCell>
                  <TableCell className="pr-5">
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function ReviewsContent({ cycles: initialCycles }: { cycles: { cycle: any; standard: any[]; upward: any[] }[] }) {
  const [sort, setSort] = useState("newest");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const copy = [...initialCycles];
    switch (sort) {
      case "oldest":
        return copy.sort((a, b) =>
          new Date(a.cycle?.start_date ?? 0).getTime() - new Date(b.cycle?.start_date ?? 0).getTime()
        );
      case "active_first":
        return copy.sort((a, b) =>
          (CYCLE_STATUS_ORDER[a.cycle?.status] ?? 9) - (CYCLE_STATUS_ORDER[b.cycle?.status] ?? 9)
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
      <div className="rounded-xl border border-border/60 bg-card py-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No review assignments yet</p>
        <p className="text-sm text-muted-foreground">
          Assignments are created when a performance cycle is launched.
        </p>
      </div>
    );
  }

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "Sort";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
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

      {/* Cycle cards */}
      {sorted.map(({ cycle, standard, upward }) => {
        const cid = cycle?.id ?? "__none__";
        const isCollapsed = collapsed.has(cid);
        const pendingCount = [...standard, ...upward].filter(a => a.status !== "completed").length;
        const totalCount = standard.length + upward.length;

        return (
          <div key={cid} className="rounded-xl border border-border/60 bg-card overflow-hidden">
            {/* Cycle header — clickable to collapse */}
            <button
              onClick={() => toggleCollapse(cid)}
              className="w-full flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="text-sm font-semibold truncate">
                  {cycle?.name ?? "Unknown Cycle"}
                </span>
                {cycle?.status && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${CYCLE_STATUS_STYLE[cycle.status] ?? CYCLE_STATUS_STYLE.draft}`}>
                    {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {pendingCount > 0 && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    {pendingCount} pending
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{totalCount} review{totalCount !== 1 ? "s" : ""}</span>
                {cycle?.start_date && cycle?.end_date && (
                  <span className="text-xs text-muted-foreground hidden md:block">
                    {format(new Date(cycle.start_date), "MMM d")} — {format(new Date(cycle.end_date), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </button>

            {/* Collapsed view: just a summary bar */}
            {isCollapsed && pendingCount > 0 && (
              <div className="px-5 py-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                {pendingCount} assignment{pendingCount !== 1 ? "s" : ""} pending action
              </div>
            )}

            {/* Expanded content */}
            {!isCollapsed && (
              <>
                {standard.length > 0 && (
                  <SubSection
                    icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
                    label="Manager Reviews"
                    count={standard.length}
                    items={standard}
                  />
                )}
                {upward.length > 0 && (
                  <SubSection
                    icon={<ArrowUpCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                    label="Upward Reviews"
                    count={upward.length}
                    items={upward}
                    hasBorderTop={standard.length > 0}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
