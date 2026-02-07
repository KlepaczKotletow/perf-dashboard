import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Users, Target, ClipboardCheck, AlertCircle, ArrowRight, Star, Pencil } from "lucide-react";
import { isManagerOrAbove } from "@/lib/roles";

const statusConfig: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
  in_progress: { label: "In Progress", badge: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
  completed: { label: "Completed", badge: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
  draft: { label: "Draft", badge: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10" },
  active: { label: "Active", badge: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
  cancelled: { label: "Cancelled", badge: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-400/10" },
};

export default async function MyTeamPage() {
  const workspace = await getUserWorkspace();

  if (!workspace?.appUserId || !isManagerOrAbove(workspace?.role)) {
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
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
      `)
      .in("employee_id", reportIds)
      .order("created_at", { ascending: false });
    reviewAssignments = data || [];
  }

  // 3. Get goals for direct reports
  let teamGoals: any[] = [];
  if (reportIds.length > 0) {
    const { data } = await supabase
      .from("goals")
      .select("id, title, status, progress, employee_id, due_date")
      .in("employee_id", reportIds)
      .in("status", ["active", "draft"])
      .order("due_date");
    teamGoals = data || [];
  }

  // Build aggregated view per employee
  const employeeSummaries = (directReports || []).map((emp: any) => {
    const assignments = reviewAssignments.filter((a: any) => a.employee_id === emp.id);
    const pendingReviews = assignments.filter((a: any) => a.status !== "completed").length;
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {directReports?.length || 0} direct report{(directReports?.length || 0) !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Direct Reports", value: directReports?.length || 0, icon: Users, color: "text-primary bg-primary/[0.08]" },
          { label: "Need Action", value: needsActionCount, icon: AlertCircle, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
          { label: "Pending Reviews", value: totalPendingReviews, icon: ClipboardCheck, color: "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
          { label: "Active Goals", value: totalActiveGoals, icon: Target, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
        ].map((m) => (
          <Card key={m.label} className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
                  <p className="text-2xl font-semibold mt-1 text-foreground">{m.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${m.color}`}>
                  <m.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Members</CardTitle>
          <CardDescription>Direct reports with review and goal status</CardDescription>
        </CardHeader>
        <CardContent>
          {employeeSummaries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No direct reports found. Assign reporting lines via the Team page.
            </p>
          ) : (
            <div className="space-y-4">
              {employeeSummaries.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm">{getInitials(emp.slack_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/team/${emp.id}`} className="font-medium hover:underline">
                          {emp.slack_name}
                        </Link>
                        {emp.needsAction && (
                          <Badge className="text-[11px] font-medium text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10">
                            Action Needed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {emp.job_title || "No title"}
                        {emp.department && ` · ${emp.department}`}
                        {emp.level && ` · ${emp.level.name}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Latest Rating */}
                    <div className="text-center min-w-[60px]">
                      {emp.latestRating ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-bold text-sm">{emp.latestRating}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No rating</span>
                      )}
                    </div>

                    {/* Review Status */}
                    <div className="text-center min-w-[80px]">
                      <p className="text-xs text-muted-foreground">Reviews</p>
                      <p className="text-sm">
                        <span className="font-bold text-green-600">{emp.completedReviews}</span>
                        {emp.pendingReviews > 0 && (
                          <span className="text-yellow-600"> / {emp.pendingReviews} pending</span>
                        )}
                      </p>
                    </div>

                    {/* Goal Progress */}
                    <div className="text-center min-w-[80px]">
                      <p className="text-xs text-muted-foreground">Goals</p>
                      <p className="text-sm">
                        {emp.activeGoals > 0 ? (
                          <span>{emp.activeGoals} active ({emp.avgProgress}%)</span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/team/${emp.id}`}>
                          View <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/team/${emp.id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Review Assignments for your team */}
      {reviewAssignments.filter((a: any) => a.status !== "completed").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Team Reviews</CardTitle>
            <CardDescription>Outstanding reviews for your direct reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reviewAssignments
                .filter((a: any) => a.status !== "completed")
                .map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{assignment.employee?.slack_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">
                        {assignment.cycle?.name || "Unknown Cycle"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`text-[11px] font-medium ${(statusConfig[assignment.status] || statusConfig.pending).badge}`}>
                        {(statusConfig[assignment.status] || statusConfig.pending).label}
                      </Badge>
                      <Button size="sm" asChild>
                        <Link href={`/dashboard/cycles/${assignment.cycle?.id}/review/${assignment.id}`}>
                          Review <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
