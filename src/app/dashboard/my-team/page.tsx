import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Users, Target, ClipboardCheck, AlertCircle, ArrowRight, Star, Pencil } from "lucide-react";
import { isManagerOrAbove } from "@/lib/roles";
import { getAssignmentStatus } from "@/lib/status";
import TeamGoalsTable from "./team-goals-table";
import { PageHeader } from "@/components/page-header";

export default async function MyTeamPage() {
  const workspace = await getUserWorkspace();

  if (!workspace?.appUserId || (!isManagerOrAbove(workspace?.role) && !workspace?.hasDirectReports)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mb-5">This page is for managers and above.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const userId = workspace.appUserId;

  // 1. Get direct reports
  const { data: directReports } = await supabase
    .from("users")
    .select(`
      id, slack_name, slack_email, job_title, department, role,
      level:levels!users_level_id_fkey(name, grade)
    `)
    .eq("manager_id", userId)
    .eq("workspace_id", workspace.workspaceId)
    .order("slack_name");

  const reportIds = (directReports || []).map((r: any) => r.id);

  // 2. Get active review assignments for direct reports
  let reviewAssignments: any[] = [];
  if (reportIds.length > 0) {
    const { data } = await supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name),
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, grades_released, workspace_id)
      `)
      .in("employee_id", reportIds)
      .eq("cycle.workspace_id", workspace.workspaceId)
      .order("created_at", { ascending: false });
    reviewAssignments = data || [];
  }

  // 3. Get goals for direct reports (full shape for team goals table)
  let teamGoals: any[] = [];
  if (reportIds.length > 0) {
    const { data } = await supabase
      .from("goals")
      .select(`
        id, parent_id, title, description, status, progress, weight,
        metric_start, metric_current, metric_target, metric_unit,
        tracking_status, scope, goal_direction, due_date, employee_id,
        employee:users!goals_employee_id_fkey(id, slack_name, department),
        cycle:performance_cycles!goals_cycle_id_fkey(id, name)
      `)
      .in("employee_id", reportIds)
      .eq("workspace_id", workspace.workspaceId)
      .in("status", ["active", "draft"])
      .order("due_date");
    teamGoals = data || [];
  }

  // 4. Get cycles for filter dropdown
  const { data: cycles } = await supabase
    .from("performance_cycles")
    .select("id, name")
    .eq("workspace_id", workspace.workspaceId)
    .order("created_at", { ascending: false });

  // Build aggregated view per employee
  const employeeSummaries = (directReports || []).map((emp: any) => {
    const assignments = reviewAssignments.filter((a: any) => a.employee_id === emp.id);
    // Only count pending reviews from *active* cycles — completed cycles are no longer actionable
    const pendingReviews = assignments.filter(
      (a: any) => a.status !== "completed" && a.cycle?.status === "active"
    ).length;
    const completedReviews = assignments.filter((a: any) => a.status === "completed").length;
    const latestRating = assignments.find((a: any) => a.overall_rating)?.overall_rating;

    const goals = teamGoals.filter((g: any) => g.employee_id === emp.id);
    const activeGoals = goals.filter((g: any) => g.status === "active").length;
    const avgProgress = goals.length > 0
      ? Math.round(goals.reduce((sum: number, g: any) => sum + (g.progress || 0), 0) / goals.length)
      : 0;

    return {
      ...emp,
      pendingReviews,
      completedReviews,
      latestRating,
      activeGoals,
      avgProgress,
      needsAction: pendingReviews > 0,
    };
  });

  const needsActionCount = employeeSummaries.filter((e) => e.needsAction).length;
  const totalPendingReviews = employeeSummaries.reduce((sum, e) => sum + e.pendingReviews, 0);
  const totalActiveGoals = employeeSummaries.reduce((sum, e) => sum + e.activeGoals, 0);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        hat="my-team"
        title="Team Overview"
        subtitle={`${directReports?.length || 0} direct report${(directReports?.length || 0) !== 1 ? "s" : ""}`}
      />

      {/* Compact stat strip — was 4 oversized cards; now one quiet row */}
      <div className="flex flex-wrap items-center gap-5 sm:gap-7 px-4 py-3 rounded-xl border border-border/60 bg-card">
        {[
          { label: "Direct reports", value: directReports?.length || 0, icon: Users, iconClass: "text-primary", bgClass: "bg-primary/[0.08]" },
          { label: "Need action", value: needsActionCount, icon: AlertCircle, iconClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-50 dark:bg-amber-400/10" },
          { label: "Pending reviews", value: totalPendingReviews, icon: ClipboardCheck, iconClass: "text-sky-600 dark:text-sky-400", bgClass: "bg-sky-50 dark:bg-sky-400/10" },
          { label: "Active goals", value: totalActiveGoals, icon: Target, iconClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-50 dark:bg-emerald-400/10" },
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

      {/* Team Members */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {employeeSummaries.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">
              No direct reports found. Assign reporting lines via the Team page.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead className="text-center">Reviews</TableHead>
                  <TableHead className="text-center">Goals</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeSummaries.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{getInitials(emp.slack_name)}</AvatarFallback>
                        </Avatar>
                        <Link href={`/dashboard/team/${emp.id}`} className="font-medium hover:underline text-sm">
                          {emp.slack_name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {emp.job_title || "—"}
                      {emp.department && <span className="text-muted-foreground/60"> · {emp.department}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {emp.level?.name || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {emp.latestRating ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="font-semibold text-sm">{emp.latestRating}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      <span className="font-semibold text-emerald-600">{emp.completedReviews}</span>
                      {emp.pendingReviews > 0 && (
                        <span className="text-amber-600 text-xs ml-1">({emp.pendingReviews} pending)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {emp.activeGoals > 0 ? (
                        <span>{emp.activeGoals} <span className="text-muted-foreground text-xs">({emp.avgProgress}%)</span></span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {emp.needsAction ? (
                        <Badge className="text-[10px] font-medium text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10">
                          Needs Review
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10">
                          On Track
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                          <Link href={`/dashboard/team/${emp.id}`}>View</Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/dashboard/team/${emp.id}/edit`}>
                            <Pencil className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Review Assignments for your team — active cycles only */}
      {(() => {
        const pending = reviewAssignments.filter((a: any) => a.status !== "completed" && a.cycle?.status === "active");
        if (pending.length === 0) return null;
        return (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">
              Pending Team Reviews
              <span className="ml-1.5 text-xs font-medium text-muted-foreground">· {pending.length}</span>
            </h2>
            <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
              {pending.map((assignment: any) => (
                <div key={assignment.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                    {assignment.employee?.slack_name || "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[160px]">
                    {assignment.cycle?.name || "Unknown Cycle"}
                  </span>
                  <Badge className={`text-[10px] font-medium shrink-0 ${getAssignmentStatus(assignment.status).badge}`}>
                    {getAssignmentStatus(assignment.status).label}
                  </Badge>
                  <Button size="sm" className="h-7 text-xs shrink-0" asChild>
                    <Link href={`/dashboard/cycles/${assignment.cycle?.id}/review/${assignment.id}`}>
                      Review <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Team Goals */}
      {teamGoals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">Team Goals</h2>
          <TeamGoalsTable
            goals={teamGoals}
            cycles={cycles || []}
            employees={(directReports || []).map((r: any) => ({
              id: r.id,
              slack_name: r.slack_name,
            }))}
          />
        </div>
      )}
    </div>
  );
}
