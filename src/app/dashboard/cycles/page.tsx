import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, CalendarClock, Lock, Users, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { format, differenceInDays, isFuture } from "date-fns";
import { isManagerOrAbove } from "@/lib/roles";
import { getCycleStatus } from "@/lib/status";

async function getPerformanceCycles() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("performance_cycles")
    .select(`
      *,
      creator:users!performance_cycles_created_by_fkey(slack_name),
      employees:performance_cycle_employees(count),
      assignments:review_assignments(status)
    `)
    .order("created_at", { ascending: false });
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

  const cycles = await getPerformanceCycles();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance Cycles</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage organization-wide review periods</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard/cycles/new">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Cycle
          </Link>
        </Button>
      </div>

      {cycles.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
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
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {cycles.map((cycle: any) => {
            const config = getCycleStatus(cycle.status);
            const employeeCount = cycle.employees?.[0]?.count || 0;

            // Completion stats from assignments
            const allAssignments: any[] = cycle.assignments || [];
            const totalAssignments = allAssignments.length;
            const completedAssignments = allAssignments.filter((a: any) => a.status === "completed").length;
            const completionPct = totalAssignments > 0
              ? Math.round((completedAssignments / totalAssignments) * 100)
              : null;

            // Deadline countdown (only for active cycles)
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
              daysLeft === null ? ""
              : daysLeft <= 3 ? "text-red-600 dark:text-red-400"
              : daysLeft <= 7 ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground";

            return (
              <Link
                key={cycle.id}
                href={`/dashboard/cycles/${cycle.id}`}
                className="group block"
              >
                <Card className="border-border/60 hover:border-border hover:shadow-sm transition-all h-full">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {cycle.name}
                      </h3>
                      <Badge className={`shrink-0 ml-2 text-[11px] font-medium ${config.badge}`}>
                        {config.label}
                      </Badge>
                    </div>

                    {cycle.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {cycle.description}
                      </p>
                    )}

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        <span>{employeeCount} employee{employeeCount !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>
                          {cycle.start_date && format(new Date(cycle.start_date), "MMM d")}
                          {" — "}
                          {endDate && format(endDate, "MMM d, yyyy")}
                        </span>
                      </div>
                      {deadlineLabel && (
                        <div className={`flex items-center gap-2 font-medium ${deadlineColor}`}>
                          <CalendarClock className="h-3 w-3" />
                          <span>{deadlineLabel}</span>
                        </div>
                      )}
                    </div>

                    {/* Completion progress bar */}
                    {completionPct !== null && (
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{completedAssignments}/{totalAssignments} reviews</span>
                          </div>
                          <span className="font-medium">{completionPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              completionPct === 100
                                ? "bg-emerald-500"
                                : completionPct >= 60
                                ? "bg-sky-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground/50 group-hover:text-primary/60 transition-colors">
                      <span>View details</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
