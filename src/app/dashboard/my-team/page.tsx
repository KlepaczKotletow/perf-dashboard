import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Users, ArrowRight, Star, Pencil } from "lucide-react";
import { isManagerOrAbove } from "@/lib/roles";
import { getAssignmentStatus } from "@/lib/status";
import TeamGoalsTable from "./team-goals-table";
import type { GoalRow as GoalRowFull } from "@/lib/goals-utils";
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

  type DirectReportRow = {
    id: string;
    slack_name: string | null;
    slack_email: string | null;
    job_title: string | null;
    department: string | null;
    role: string | null;
    level: { name: string | null; grade: string | null } | null;
  };
  type AssignmentRow = {
    id: string;
    employee_id: string;
    status: string;
    overall_rating: number | null;
    // Two assignments can exist for the same employee in the same cycle — the
    // manager's ("standard") and an upward one owned by a named reviewer.
    // Without these the rows render identically and only one is yours to do.
    assignment_type: string | null;
    reviewer_id: string | null;
    manager_id: string | null;
    cycle?: { id: string; name: string | null; status: string | null; grades_released?: boolean; workspace_id?: string | null } | null;
    employee?: { id: string; slack_name: string | null } | null;
    reviewer?: { id: string; slack_name: string | null } | null;
    manager?: { id: string; slack_name: string | null } | null;
  };
  type TeamGoalRow = GoalRowFull & { employee_id: string };

  const reportIds = ((directReports || []) as unknown as DirectReportRow[]).map((r) => r.id);

  // 2. Get active review assignments for direct reports
  let reviewAssignments: AssignmentRow[] = [];
  if (reportIds.length > 0) {
    const { data } = await supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name),
        reviewer:users!review_assignments_reviewer_id_fkey(id, slack_name),
        manager:users!review_assignments_manager_id_fkey(id, slack_name),
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, grades_released, workspace_id)
      `)
      .in("employee_id", reportIds)
      .eq("cycle.workspace_id", workspace.workspaceId)
      .order("created_at", { ascending: false });
    reviewAssignments = (data || []) as unknown as AssignmentRow[];
  }

  // 3. Get goals for direct reports (full shape for team goals table)
  let teamGoals: TeamGoalRow[] = [];
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
    teamGoals = (data || []) as unknown as TeamGoalRow[];
  }

  // 4. Get cycles for filter dropdown
  const { data: cycles } = await supabase
    .from("performance_cycles")
    .select("id, name")
    .eq("workspace_id", workspace.workspaceId)
    .order("created_at", { ascending: false });

  // Build aggregated view per employee
  const employeeSummaries = ((directReports || []) as unknown as DirectReportRow[]).map((emp) => {
    const assignments = reviewAssignments.filter((a) => a.employee_id === emp.id);
    // Only count pending reviews from *active* cycles — completed cycles are no longer actionable
    const pendingReviews = assignments.filter(
      (a) => a.status !== "completed" && a.cycle?.status === "active"
    ).length;
    const completedReviews = assignments.filter((a) => a.status === "completed").length;
    const latestRating = assignments.find((a) => a.overall_rating)?.overall_rating;

    const goals = teamGoals.filter((g) => g.employee_id === emp.id);
    const activeGoals = goals.filter((g) => g.status === "active").length;
    const avgProgress = goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
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

      {/* Inline stat strip — no container. Quieter than any card treatment. */}
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-sm">
        {[
          { label: "direct reports", value: directReports?.length || 0, tone: "text-primary" },
          { label: "need action", value: needsActionCount, tone: needsActionCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground" },
          { label: "pending reviews", value: totalPendingReviews, tone: totalPendingReviews > 0 ? "text-sky-700 dark:text-sky-400" : "text-muted-foreground" },
          { label: "active goals", value: totalActiveGoals, tone: "text-emerald-700 dark:text-emerald-400" },
        ].map((m, i) => (
          <span key={m.label} className="inline-flex items-baseline gap-1.5">
            {i > 0 && <span className="text-muted-foreground/30 mr-5" aria-hidden="true">·</span>}
            <span className={`text-xl font-semibold tabular-nums ${m.tone}`}>{m.value}</span>
            <span className="text-xs text-muted-foreground">{m.label}</span>
          </span>
        ))}
      </div>

      {/* Team Members — flat row list, no Card / no Table chrome */}
      {employeeSummaries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No direct reports found. Assign reporting lines via the Team page.
        </p>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
          {employeeSummaries.map((emp) => (
            <div key={emp.id} className="flex items-center gap-4 px-4 py-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs">{getInitials(emp.slack_name)}</AvatarFallback>
              </Avatar>

              {/* Name + meta (role · department · level) */}
              <div className="flex-1 min-w-0">
                <Link href={`/dashboard/team/${emp.id}`} className="text-sm font-medium text-foreground hover:underline truncate block">
                  {emp.slack_name}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  {[emp.job_title, emp.department, emp.level?.name].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>

              {/* Inline metrics */}
              <div className="hidden md:flex items-center gap-5 text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                {emp.latestRating ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-foreground tabular-nums">{emp.latestRating}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground/50 tabular-nums">—</span>
                )}
                <span className="tabular-nums">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{emp.completedReviews}</span>
                  {emp.pendingReviews > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 ml-1">({emp.pendingReviews} pending)</span>
                  )}
                  <span className="ml-1">reviews</span>
                </span>
                <span className="tabular-nums">
                  {emp.activeGoals > 0 ? (
                    <>
                      <span className="font-semibold text-foreground">{emp.activeGoals}</span>
                      <span className="ml-1">goals · {emp.avgProgress}%</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/50">no goals</span>
                  )}
                </span>
              </div>

              <Badge
                className={`text-[10px] font-medium shrink-0 ${
                  emp.needsAction
                    ? "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10"
                    : "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10"
                }`}
              >
                {emp.needsAction ? "Needs Review" : "On Track"}
              </Badge>

              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <Link href={`/dashboard/team/${emp.id}`}>View</Link>
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <Link href={`/dashboard/team/${emp.id}/edit`}>
                    <Pencil className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Review Assignments for your team — active cycles only */}
      {(() => {
        const pending = reviewAssignments.filter((a) => a.status !== "completed" && a.cycle?.status === "active");
        if (pending.length === 0) return null;
        return (
          <section className="space-y-2">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Team Reviews
              <span className="ml-1.5 text-xs font-medium text-muted-foreground">· {pending.length}</span>
            </h2>
            <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
              {pending.map((assignment) => {
                // An employee can have two pending assignments in one cycle:
                // the manager review and an upward review owned by a named
                // reviewer. They used to render identically, so the only way to
                // tell them apart was to open one — and the upward one isn't
                // the manager's to complete.
                const isUpward = assignment.assignment_type === "upward";
                const ownerId = isUpward ? assignment.reviewer_id : assignment.manager_id;
                const isMine = ownerId === userId;
                const ownerName = (isUpward ? assignment.reviewer : assignment.manager)?.slack_name;

                return (
                  <div key={assignment.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground block truncate">
                        {assignment.employee?.slack_name || "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground block truncate">
                        {isUpward ? "Upward review" : "Manager review"}
                        {" · "}
                        {isMine
                          ? "yours to complete"
                          : ownerName
                            ? `waiting on ${ownerName}`
                            : "no reviewer assigned"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[160px]">
                      {assignment.cycle?.name || "Unknown Cycle"}
                    </span>
                    <Badge className={`text-[10px] font-medium shrink-0 ${getAssignmentStatus(assignment.status).badge}`}>
                      {getAssignmentStatus(assignment.status).label}
                    </Badge>
                    {/* Only the owner gets the action. Everyone else keeps the
                        row for visibility (so a manager can chase it) but with
                        no button that would open someone else's review. */}
                    {isMine ? (
                      <Button size="sm" className="h-7 text-xs shrink-0" asChild>
                        <Link href={`/dashboard/cycles/${assignment.cycle?.id}/review/${assignment.id}`}>
                          Review <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    ) : (
                      <span className="h-7 flex items-center text-xs text-muted-foreground/60 shrink-0 px-2">
                        Not yours
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Team Goals */}
      {teamGoals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Team Goals</h2>
          <TeamGoalsTable
            goals={teamGoals}
            cycles={cycles || []}
            employees={((directReports || []) as unknown as DirectReportRow[]).map((r) => ({
              id: r.id,
              slack_name: r.slack_name ?? "Unknown",
            }))}
          />
        </div>
      )}
    </div>
  );
}
