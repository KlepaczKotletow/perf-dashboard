import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, CalendarClock, Lock, Users, ChevronRight } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { isManagerOrAbove } from "@/lib/roles";
import { getCycleStatus } from "@/lib/status";

async function getPerformanceCycles(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("performance_cycles")
    .select(`
      *,
      creator:users!performance_cycles_created_by_fkey(slack_name),
      employees:performance_cycle_employees(count),
      assignments:review_assignments(status, assignment_type)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) console.error("Failed to fetch performance cycles:", error.message);
  return data || [];
}

export default async function CyclesPage() {
  const workspace = await getUserWorkspace();

  if (!isManagerOrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
          Cycle management is available to managers and admins.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const cycles = await getPerformanceCycles(workspace!.workspaceId);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance Cycles</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage organisation-wide review periods</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard/cycles/new">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Cycle
          </Link>
        </Button>
      </div>

      {/* ── List ── */}
      {cycles.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No cycles yet</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            Before creating a cycle, make sure you&apos;ve synced your team, assigned managers, and set up competencies.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/competencies">Check Competencies</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/cycles/new">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Cycle
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/50 overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_100px_100px_160px_180px_40px] items-center gap-4 px-5 py-2.5 bg-muted/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">People</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Completion</span>
            <span />
          </div>

          {cycles.map((cycle: any) => {
            const config = getCycleStatus(cycle.status);
            const employeeCount = cycle.employees?.[0]?.count || 0;

            const allAssignments: any[] = cycle.assignments || [];
            const standardAssignments = allAssignments.filter((a: any) => a.assignment_type !== "upward");
            const totalPeople = standardAssignments.length;
            const selfDone = standardAssignments.filter((a: any) => a.status === "in_progress" || a.status === "completed").length;
            const mgrDone = standardAssignments.filter((a: any) => a.status === "completed").length;
            const selfPct = totalPeople > 0 ? Math.round((selfDone / totalPeople) * 100) : null;
            const mgrPct = totalPeople > 0 ? Math.round((mgrDone / totalPeople) * 100) : null;

            const isActive = cycle.status === "active";
            const endDate = cycle.end_date ? new Date(cycle.end_date) : null;
            const daysLeft = endDate && isActive ? differenceInDays(endDate, new Date()) : null;
            const deadlineLabel =
              daysLeft === null ? null
              : daysLeft < 0 ? "Overdue"
              : daysLeft === 0 ? "Due today"
              : daysLeft === 1 ? "1 day left"
              : `${daysLeft} days left`;
            const deadlineColor =
              daysLeft === null ? "text-muted-foreground"
              : daysLeft < 0 ? "text-red-600 dark:text-red-400"
              : daysLeft <= 3 ? "text-red-600 dark:text-red-400"
              : daysLeft <= 7 ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground";

            const isDraft = cycle.status === "draft";

            return (
              <Link
                key={cycle.id}
                href={isDraft ? `/dashboard/cycles/new?draft=${cycle.id}` : `/dashboard/cycles/${cycle.id}`}
                className="grid grid-cols-[1fr_100px_100px_160px_180px_40px] items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
              >
                {/* Name + description */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {cycle.name}
                  </p>
                  {cycle.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{cycle.description}</p>
                  )}
                </div>

                {/* Status badge */}
                <div>
                  <Badge className={`text-[11px] font-medium ${config.badge}`}>
                    {config.label}
                  </Badge>
                </div>

                {/* Employee count */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>{employeeCount}</span>
                </div>

                {/* Timeline + deadline */}
                <div>
                  <p className="text-sm text-muted-foreground">
                    {cycle.start_date && format(new Date(cycle.start_date), "MMM d")}
                    {" — "}
                    {endDate ? format(endDate, "MMM d, yyyy") : "—"}
                  </p>
                  {deadlineLabel && (
                    <p className={`text-xs font-medium mt-0.5 ${deadlineColor}`}>{deadlineLabel}</p>
                  )}
                </div>

                {/* Completion progress */}
                <div>
                  {selfPct !== null ? (
                    <div className="space-y-1.5">
                      {/* Self-review progress */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Self</span>
                          <span className="font-medium tabular-nums">{selfDone}/{totalPeople}</span>
                        </div>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${selfPct === 100 ? "bg-emerald-500" : "bg-sky-400"}`}
                            style={{ width: `${selfPct}%` }}
                          />
                        </div>
                      </div>
                      {/* Manager review progress */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Manager</span>
                          <span className="font-medium tabular-nums">{mgrDone}/{totalPeople}</span>
                        </div>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${mgrPct === 100 ? "bg-emerald-500" : "bg-primary"}`}
                            style={{ width: `${mgrPct!}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">No assignments</span>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors justify-self-end" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
