"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CyclesComparisonData } from "./page";

interface AnalyticsCyclesProps {
  data: CyclesComparisonData;
}

type BreakdownView = "department" | "function" | "manager";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  in_review: "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  completed: "bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-400/10 dark:text-gray-400",
};

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return "—";
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export function AnalyticsCycles({ data }: AnalyticsCyclesProps) {
  const [breakdownView, setBreakdownView] = useState<BreakdownView>("department");
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");

  if (data.cycles.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-16 text-center">
          <p className="text-sm font-semibold text-foreground mb-1">No cycle data available</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Launch a performance cycle to start tracking comparison data across cycles.
          </p>
          <Button asChild className="mt-5" variant="outline" size="sm">
            <Link href="/dashboard/cycles">Go to Cycles</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Cycle Comparison</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Performance metrics across your last review cycles, including the current one
        </p>
      </div>

      {/* Main comparison table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Cycle</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead className="w-[120px] text-right">Completion</TableHead>
                  <TableHead className="w-[100px] text-right">Avg Rating</TableHead>
                  <TableHead className="w-[100px] text-right">Participants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cycles.map((cycle, idx) => (
                  <TableRow key={cycle.id} className={idx % 2 === 1 ? "bg-muted/10" : ""}>
                    <TableCell className="font-medium text-foreground">{cycle.name}</TableCell>
                    <TableCell>
                      <Badge className={`text-[11px] font-medium ${STATUS_BADGE[cycle.status] || ""}`}>
                        {cycle.status === "in_review" ? "In Review" : cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateRange(cycle.startDate, cycle.endDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[60px]">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${cycle.completionRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold tabular-nums">{cycle.completionRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {cycle.avgRating !== null ? cycle.avgRating.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {cycle.participants}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.hasMore && (
            <div className="px-6 py-4 border-t border-border/40 text-center">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/analytics?tab=cycles&showAll=true">Show all cycles</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown toggle */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {([
          { id: "department" as const, label: "Department" },
          { id: "function" as const, label: "Function" },
          { id: "manager" as const, label: "Manager" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setBreakdownView(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              breakdownView === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Department breakdown */}
      {breakdownView === "department" && (
        <Card className="border-border/60">
          <div className="px-6 pt-6 pb-4">
            <h3 className="text-base font-semibold text-foreground">By Department</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Completion rates and average ratings broken down by department for each cycle
            </p>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Department</TableHead>
                    {data.cycles.map((c) => (
                      <TableHead key={c.id} className="text-center" colSpan={2}>
                        {c.name}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="bg-muted/20">
                    <TableHead />
                    {data.cycles.map((c) => (
                      <SubHeaders key={c.id} />
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getDepartmentRows(data).map((dept, idx) => (
                    <TableRow key={dept} className={idx % 2 === 1 ? "bg-muted/10" : ""}>
                      <TableCell className="font-medium text-foreground">{dept}</TableCell>
                      {data.cycles.map((c) => {
                        const row = (data.byDepartment[c.id] || []).find((r) => r.name === dept);
                        return (
                          <BreakdownCells key={c.id} completionRate={row?.completionRate} avgRating={row?.avgRating} />
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Function breakdown */}
      {breakdownView === "function" && (
        <Card className="border-border/60">
          <div className="px-6 pt-6 pb-4">
            <h3 className="text-base font-semibold text-foreground">By Function</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Completion rates and average ratings broken down by function for each cycle
            </p>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Function</TableHead>
                    {data.cycles.map((c) => (
                      <TableHead key={c.id} className="text-center" colSpan={2}>
                        {c.name}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="bg-muted/20">
                    <TableHead />
                    {data.cycles.map((c) => (
                      <SubHeaders key={c.id} />
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFunctionRows(data).map((func, idx) => (
                    <TableRow key={func} className={idx % 2 === 1 ? "bg-muted/10" : ""}>
                      <TableCell className="font-medium text-foreground">{func}</TableCell>
                      {data.cycles.map((c) => {
                        const row = (data.byFunction[c.id] || []).find((r) => r.name === func);
                        return (
                          <BreakdownCells key={c.id} completionRate={row?.completionRate} avgRating={row?.avgRating} />
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager breakdown */}
      {breakdownView === "manager" && (
        <div className="space-y-6">
          <Card className="border-border/60">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold text-foreground">By Manager</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Select a manager to see their team&apos;s performance across cycles
              </p>
              <div className="mt-3 max-w-xs">
                <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a manager..." />
                  </SelectTrigger>
                  <SelectContent>
                    {data.allManagers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedManagerId && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Cycle</TableHead>
                        <TableHead className="text-right w-[120px]">Completion</TableHead>
                        <TableHead className="text-right w-[100px]">Avg Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.cycles.map((c, idx) => {
                        const mgrRow = (data.byManager[c.id] || []).find(
                          (r) => r.managerId === selectedManagerId
                        );
                        return (
                          <TableRow key={c.id} className={idx % 2 === 1 ? "bg-muted/10" : ""}>
                            <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                            <TableCell className="text-right">
                              {mgrRow ? (
                                <span className="text-sm font-semibold tabular-nums">{mgrRow.completionRate}%</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {mgrRow?.avgRating != null ? (
                                <span className="text-sm font-semibold tabular-nums">{mgrRow.avgRating.toFixed(1)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Top 5 / Bottom 5 */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/60">
              <div className="px-6 pt-6 pb-2">
                <h3 className="text-base font-semibold text-foreground">Top Performers</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Managers with the highest team completion rates in the current cycle
                </p>
              </div>
              <CardContent>
                {data.topManagers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {data.topManagers.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{m.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden w-16">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${m.completionRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-green-600 dark:text-green-400">
                            {m.completionRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <div className="px-6 pt-6 pb-2">
                <h3 className="text-base font-semibold text-foreground">Needs Attention</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Managers with the lowest team completion rates in the current cycle
                </p>
              </div>
              <CardContent>
                {data.bottomManagers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {data.bottomManagers.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{m.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden w-16">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${m.completionRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                            {m.completionRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper components ─────────────────────────────────────────────────────────

function SubHeaders() {
  return (
    <>
      <TableHead className="text-center text-xs text-muted-foreground">Completion</TableHead>
      <TableHead className="text-center text-xs text-muted-foreground">Avg Rating</TableHead>
    </>
  );
}

function BreakdownCells({ completionRate, avgRating }: { completionRate?: number; avgRating?: number | null }) {
  return (
    <>
      <TableCell className="text-center text-sm tabular-nums">
        {completionRate !== undefined ? `${completionRate}%` : "—"}
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums">
        {avgRating != null ? avgRating.toFixed(1) : "—"}
      </TableCell>
    </>
  );
}

// ─── Data helpers ──────────────────────────────────────────────────────────────

function getDepartmentRows(data: CyclesComparisonData): string[] {
  const deptSet = new Set<string>();
  for (const rows of Object.values(data.byDepartment)) {
    for (const r of rows) deptSet.add(r.name);
  }
  return [...deptSet].sort();
}

function getFunctionRows(data: CyclesComparisonData): string[] {
  const funcSet = new Set<string>();
  for (const rows of Object.values(data.byFunction)) {
    for (const r of rows) funcSet.add(r.name);
  }
  return [...funcSet].sort();
}
