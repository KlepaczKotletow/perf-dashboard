"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import {
  ArrowRight, Users, ArrowUpCircle, ChevronDown, ChevronRight,
  FileText, ArrowUpDown, AlertCircle, Plus,
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

function UserCell({ name, subtitle, avatarUrl }: { name: string; subtitle?: string; avatarUrl?: string }) {
  if (!name || name === "Unassigned") {
    return <span className="text-xs text-muted-foreground italic">Not assigned</span>;
  }
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-7 w-7">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
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
      <div className="rounded-xl border border-dashed border-border/60 bg-card py-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No review assignments yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Assignments are created when a performance cycle is launched.
        </p>
        <Button size="sm" className="mt-5 gap-1.5" asChild>
          <a href="/dashboard/cycles/new">
            <Plus className="h-3.5 w-3.5" />
            Launch a Cycle
          </a>
        </Button>
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
        const incompleteCount = [...standard, ...upward].filter(a => a.status !== "completed").length;
        const totalCount = standard.length + upward.length;

        return (
          <div key={cid} className="rounded-xl border border-border/60 bg-card overflow-hidden">
            {/* Cycle header */}
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
                {incompleteCount > 0 && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    {incompleteCount} not completed
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

            {/* Collapsed summary */}
            {isCollapsed && incompleteCount > 0 && (
              <div className="px-5 py-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                {incompleteCount} assignment{incompleteCount !== 1 ? "s" : ""} not completed
              </div>
            )}

            {/* Expanded: single table for all assignments */}
            {!isCollapsed && (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 w-[30%]">Employee</TableHead>
                    <TableHead className="w-[25%]">Reviewer</TableHead>
                    <TableHead className="w-[12%]">Type</TableHead>
                    <TableHead className="w-[13%] text-center">Status</TableHead>
                    <TableHead className="w-[10%] text-center">Rating</TableHead>
                    <TableHead className="pr-5 w-[5%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Standard reviews (self + manager) */}
                  {standard.length > 0 && (
                    <TableRow className="hover:bg-transparent bg-muted/10">
                      <TableCell colSpan={6} className="pl-5 py-1.5">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Standard Reviews · {standard.length}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {standard.map((a) => {
                    const config = getAssignmentStatus(a.status);
                    return (
                      <TableRow
                        key={a.id}
                        className="group cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/reviews/${a.id}`}
                      >
                        <TableCell className="pl-5">
                          <UserCell
                            name={a.employee?.slack_name || "Unknown"}
                            subtitle={a.employee?.department || a.employee?.job_title || undefined}
                            avatarUrl={a.employee?.avatar_url}
                          />
                        </TableCell>
                        <TableCell>
                          <UserCell
                            name={a.manager?.slack_name}
                            avatarUrl={a.manager?.avatar_url}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-medium">Standard</Badge>
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

                  {/* Upward reviews */}
                  {upward.length > 0 && (
                    <TableRow className="hover:bg-transparent bg-muted/10">
                      <TableCell colSpan={6} className="pl-5 py-1.5">
                        <div className="flex items-center gap-2">
                          <ArrowUpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Upward Reviews · {upward.length}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {upward.map((a) => {
                    const config = getAssignmentStatus(a.status);
                    return (
                      <TableRow
                        key={a.id}
                        className="group cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/reviews/${a.id}`}
                      >
                        <TableCell className="pl-5">
                          <UserCell
                            name={a.employee?.slack_name || "Unknown"}
                            subtitle={a.employee?.department || a.employee?.job_title || undefined}
                            avatarUrl={a.employee?.avatar_url}
                          />
                        </TableCell>
                        <TableCell>
                          <UserCell
                            name={a.reviewer?.slack_name}
                            avatarUrl={a.reviewer?.avatar_url}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-medium">Upward</Badge>
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
      })}
    </div>
  );
}
