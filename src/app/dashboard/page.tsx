import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FileText,
  MessageSquare,
  Users,
  TrendingUp,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  Target,
  CheckCircle2,
  Circle,
  Slack,
  GitBranch,
  Layers,
  Rocket,
  AlertCircle,
  Clock,
  EyeOff,
  Star,
  Medal,
  ChevronRight,
} from "lucide-react";
import { isManagerOrAbove, canManageUsers, isHROrAbove } from "@/lib/roles";
import { DashboardCharts, type DashboardChartData } from "./dashboard-charts";
import { STATUS_COLORS } from "@/components/charts/chart-utils";

// ─── Data fetchers ─────────────────────────────────────────────────────────────

async function getPersonalData(userId: string) {
  const supabase = await createServerSupabaseClient();

  const [assignmentsRes, feedbackRes] = await Promise.all([
    supabase
      .from("review_assignments")
      .select(`
        *,
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, review_deadline, grades_released)
      `)
      .eq("employee_id", userId)
      .eq("assignment_type", "standard")
      .order("created_at", { ascending: false }),
    supabase
      .from("continuous_feedback")
      .select(`*, sender:users!continuous_feedback_from_user_id_fkey(slack_name, job_title)`)
      .eq("to_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  // Fix: filter by cycle status in app since the join filter above may not work directly
  const allAssignments = assignmentsRes.data || [];
  const activeAssignments = allAssignments.filter(
    (a: any) => a.cycle?.status === "active" || a.cycle?.status === "in_progress"
  );

  // Check self submissions
  const assignmentIds = activeAssignments.map((a: any) => a.id);
  let selfSubmitted: Set<string> = new Set();
  if (assignmentIds.length > 0) {
    const { data: responses } = await supabase
      .from("review_responses")
      .select("assignment_id, reviewer_role")
      .eq("reviewer_id", userId)
      .eq("reviewer_role", "self")
      .in("assignment_id", assignmentIds);
    (responses || []).forEach((r: any) => selfSubmitted.add(r.assignment_id));
  }

  const enriched = activeAssignments.map((a: any) => ({
    ...a,
    selfSubmitted: selfSubmitted.has(a.id),
    gradesReleased: a.cycle?.grades_released || false,
  }));

  return {
    assignments: enriched,
    recentFeedback: feedbackRes.data || [],
  };
}

async function getManagerData(userId: string) {
  const supabase = await createServerSupabaseClient();

  const [reportsRes, cyclesRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, slack_name, job_title, department")
      .eq("manager_id", userId),
    supabase
      .from("performance_cycles")
      .select("id, name, status, review_deadline")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const reports = reportsRes.data || [];
  const activeCycles = cyclesRes.data || [];

  // Fetch assignments for direct reports in active cycles
  let teamAssignments: any[] = [];
  if (reports.length > 0 && activeCycles.length > 0) {
    const reportIds = reports.map((r: any) => r.id);
    const cycleIds = activeCycles.map((c: any) => c.id);
    const { data: assignments } = await supabase
      .from("review_assignments")
      .select("id, employee_id, manager_id, status, cycle_id")
      .eq("assignment_type", "standard")
      .in("employee_id", reportIds)
      .in("cycle_id", cycleIds);
    teamAssignments = assignments || [];
  }

  // Build per-report status
  const reportMap = new Map(reports.map((r: any) => [r.id, r]));
  const teamStatus = teamAssignments.map((a: any) => {
    const report = reportMap.get(a.employee_id);
    const selfDone = a.status === "in_progress" || a.status === "completed";
    const mgrDone = a.status === "completed";
    return { ...a, report, selfDone, mgrDone };
  });

  const pendingMgrReviews = teamStatus.filter((t) => !t.mgrDone && t.selfDone);
  const waitingOnSelf = teamStatus.filter((t) => !t.selfDone);

  return {
    teamSize: reports.length,
    teamStatus,
    pendingMgrReviews,
    waitingOnSelf,
    activeCycles,
  };
}

async function getOrgData(workspaceId: string | undefined) {
  const supabase = await createServerSupabaseClient();

  const [reviewsRes, feedbackRes, usersRes, activeRes] = await Promise.all([
    supabase.from("review_assignments").select("*", { count: "exact", head: true }),
    supabase.from("continuous_feedback").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("performance_cycles").select("*", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const [usersSetup, compRes, cyclesRes, managersRes] = workspaceId
    ? await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("competencies").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("performance_cycles").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).not("manager_id", "is", null),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }];

  const activeCycles = await (async () => {
    let q = supabase
      .from("performance_cycles")
      .select("id, name, status, start_date, end_date")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data } = await q;
    return data || [];
  })();

  return {
    stats: {
      totalReviews: reviewsRes.count || 0,
      activeCycles: activeRes.count || 0,
      totalFeedback: feedbackRes.count || 0,
      totalUsers: usersRes.count || 0,
    },
    setup: {
      users: usersSetup.count || 0,
      competencies: compRes.count || 0,
      cycles: cyclesRes.count || 0,
      hasManagers: (managersRes.count || 0) > 0,
    },
    activeCycles,
  };
}

async function getChartData(workspaceId: string | undefined): Promise<DashboardChartData> {
  const supabase = await createServerSupabaseClient();

  const [assignmentsRes, goalsRes, responsesRes, usersRes, cyclesRes] = await Promise.all([
    supabase.from("review_assignments").select("id, status, cycle_id"),
    supabase.from("goals").select("id, tracking_status, status"),
    supabase
      .from("review_responses")
      .select(`id, rating, created_at, assignment:review_assignments!review_responses_assignment_id_fkey(employee_id)`)
      .not("rating", "is", null),
    supabase.from("users").select("id, department"),
    supabase.from("performance_cycles").select("id, name, status, created_at").order("created_at", { ascending: false }),
  ]);

  const assignments = assignmentsRes.data || [];
  const goals = goalsRes.data || [];
  const responses = responsesRes.data || [];
  const users = usersRes.data || [];
  const cycles = cyclesRes.data || [];

  const activeCycle = cycles.find((c) => c.status === "active");
  const completedCycles = cycles.filter((c) => c.status === "completed");
  const previousCycle = completedCycles[0] || null;
  const currentCycleAssignments = activeCycle ? assignments.filter((a) => a.cycle_id === activeCycle.id) : assignments;
  const totalCurrent = currentCycleAssignments.length;
  const completedCurrent = currentCycleAssignments.filter((a) => a.status === "completed").length;
  const completionRate = totalCurrent > 0 ? Math.round((completedCurrent / totalCurrent) * 100) : 0;

  let completionDelta: number | null = null;
  let previousCycleName: string | null = null;
  if (previousCycle) {
    previousCycleName = previousCycle.name;
    const prevAssignments = assignments.filter((a) => a.cycle_id === previousCycle.id);
    const prevTotal = prevAssignments.length;
    const prevCompleted = prevAssignments.filter((a) => a.status === "completed").length;
    const prevRate = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;
    completionDelta = completionRate - prevRate;
  }

  const activeGoals = goals.filter((g) => g.status === "active" || g.status === "draft");
  const trackingCounts: Record<string, number> = { on_track: 0, at_risk: 0, delayed: 0, achieved: 0 };
  activeGoals.forEach((g: any) => {
    const ts = g.tracking_status || "on_track";
    if (ts in trackingCounts) trackingCounts[ts]++;
  });
  const goalDistribution = Object.entries(trackingCounts).map(([key, value]) => ({
    name: STATUS_COLORS[key as keyof typeof STATUS_COLORS]?.label || key,
    value,
    color: STATUS_COLORS[key as keyof typeof STATUS_COLORS]?.fill || "#a1a1aa",
  }));

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const monthlyMap: Record<string, number> = {};
  responses.forEach((r: any) => {
    if (r.created_at && new Date(r.created_at) >= sixMonthsAgo) {
      const key = new Date(r.created_at).toLocaleString("default", { month: "short" });
      monthlyMap[key] = (monthlyMap[key] || 0) + 1;
    }
  });
  const reviewTrend: { name: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString("default", { month: "short" });
    reviewTrend.push({ name: key, value: monthlyMap[key] || 0 });
  }

  const userDeptMap = new Map(users.map((u) => [u.id, u.department]));
  const deptRatings: Record<string, number[]> = {};
  responses.forEach((r: any) => {
    const empId = r.assignment?.employee_id;
    if (empId && r.rating) {
      const dept = userDeptMap.get(empId) || "Unassigned";
      if (!deptRatings[dept]) deptRatings[dept] = [];
      deptRatings[dept].push(r.rating);
    }
  });
  const departmentPerformance = Object.entries(deptRatings)
    .map(([name, ratings]) => ({ name, value: ratings.reduce((a, b) => a + b, 0) / ratings.length }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return { completionRate, completionDelta, previousCycleName, goalDistribution, reviewTrend, departmentPerformance };
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const workspace = await getUserWorkspace();
  const role = workspace?.role || "user";
  const isAdminOrHR = isHROrAbove(role);
  const isManager = role === "manager";
  const firstName = workspace?.name?.split(" ")[0] || "there";
  const userId = workspace?.appUserId;

  // Fetch what each role needs
  const [personal, managerData, orgData, chartData] = await Promise.all([
    userId ? getPersonalData(userId) : null,
    isManager && userId ? getManagerData(userId) : null,
    isAdminOrHR ? getOrgData(workspace?.workspaceId) : null,
    isAdminOrHR ? getChartData(workspace?.workspaceId) : null,
  ]);

  // ── Employee dashboard ─────────────────────────────────────────────────────
  if (role === "user") {
    const assignments = personal?.assignments || [];
    const recentFeedback = personal?.recentFeedback || [];
    const pendingSelf = assignments.filter((a: any) => !a.selfSubmitted && a.status !== "completed");
    const inProgress = assignments.filter((a: any) => a.selfSubmitted && a.status !== "completed");
    const completed = assignments.filter((a: any) => a.status === "completed");

    return (
      <div className="space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Hey {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingSelf.length > 0
              ? `You have ${pendingSelf.length} self-review${pendingSelf.length !== 1 ? "s" : ""} waiting for your input.`
              : inProgress.length > 0
              ? "Your self-review is in — your manager is completing their side."
              : "You're all caught up. Check back when a new review cycle starts."}
          </p>
        </div>

        {/* Pending actions banner */}
        {pendingSelf.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Action required
            </h2>
            {pendingSelf.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-4 rounded-xl border border-amber-200/70 bg-amber-50/40 dark:border-amber-400/20 dark:bg-amber-400/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Self-review due — {a.cycle?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Complete your self-assessment to kick off the review process
                    </p>
                  </div>
                </div>
                <Button size="sm" className="shrink-0" asChild>
                  <Link href={`/dashboard/cycles/${a.cycle?.id}/review/${a.id}`}>
                    Start <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Active reviews */}
        {assignments.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              My reviews
            </h2>
            <div className="space-y-2">
              {assignments.map((a: any) => {
                let statusLabel: string;
                let statusClass: string;
                let StatusIcon: React.ComponentType<{ className?: string }>;

                if (a.status === "completed" && a.gradesReleased) {
                  statusLabel = "Results available";
                  statusClass = "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10";
                  StatusIcon = CheckCircle2;
                } else if (a.status === "completed") {
                  statusLabel = "Review complete";
                  statusClass = "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10";
                  StatusIcon = EyeOff;
                } else if (a.selfSubmitted) {
                  statusLabel = "Waiting on manager";
                  statusClass = "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10";
                  StatusIcon = Clock;
                } else {
                  statusLabel = "Self-review required";
                  statusClass = "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10";
                  StatusIcon = AlertCircle;
                }

                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{a.cycle?.name}</p>
                        <Badge className={`text-[10px] flex items-center gap-1 ${statusClass}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reviewed by: {a.manager?.slack_name || "Unassigned"}
                      </p>
                    </div>
                    {/* Show grade/rating when results released */}
                    {a.gradesReleased && a.status === "completed" && (
                      <div className="flex items-center gap-2 shrink-0">
                        {a.overall_rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-sm font-semibold text-foreground">{a.overall_rating}/5</span>
                          </div>
                        )}
                        {a.final_grade && (
                          <Badge variant="outline" className="text-xs">
                            <Medal className="h-3 w-3 mr-1" />
                            {a.final_grade}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pt-1">
              <Link
                href="/dashboard/my-reviews"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                View full review history <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* No reviews at all */}
        {assignments.length === 0 && pendingSelf.length === 0 && (
          <Card className="border-border/60">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <ClipboardCheck className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No active reviews</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                You'll be notified when your manager adds you to a performance cycle.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recent feedback */}
        {recentFeedback.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Recent feedback
              </h2>
              <Link
                href="/dashboard/feedback"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                See all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentFeedback.map((f: any) => (
                <div key={f.id} className="p-4 rounded-xl border border-border/60 bg-card">
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-medium text-primary">
                        {f.sender?.slack_name?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {f.sender?.slack_name || "Anonymous"}{" "}
                        <span className="text-muted-foreground font-normal">· {f.sender?.job_title || ""}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Manager dashboard ──────────────────────────────────────────────────────
  if (role === "manager" && managerData) {
    const { teamSize, pendingMgrReviews, waitingOnSelf, activeCycles, teamStatus } = managerData;
    const assignments = personal?.assignments || [];
    const pendingSelf = assignments.filter((a: any) => !a.selfSubmitted && a.status !== "completed");
    const totalTeamInCycle = teamStatus.length;
    const completedCount = teamStatus.filter((t) => t.mgrDone).length;
    const completionPct = totalTeamInCycle > 0 ? Math.round((completedCount / totalTeamInCycle) * 100) : 0;

    return (
      <div className="space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Hey {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingMgrReviews.length > 0
              ? `${pendingMgrReviews.length} team member${pendingMgrReviews.length !== 1 ? "s" : ""} ready for your review.`
              : teamSize === 0
              ? "No direct reports assigned yet."
              : "Your team is all caught up — great work!"}
          </p>
        </div>

        {/* Own pending self-review */}
        {pendingSelf.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your action required
            </h2>
            {pendingSelf.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-4 rounded-xl border border-amber-200/70 bg-amber-50/40 dark:border-amber-400/20 dark:bg-amber-400/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Your self-review is due — {a.cycle?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">You're also being reviewed this cycle</p>
                  </div>
                </div>
                <Button size="sm" className="shrink-0" asChild>
                  <Link href={`/dashboard/cycles/${a.cycle?.id}/review/${a.id}`}>
                    Start <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Team stats */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Team overview
            </h2>
            <div className="grid gap-2">
              {[
                { label: "Direct reports", value: teamSize, color: "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10", icon: Users },
                { label: "Ready to review", value: pendingMgrReviews.length, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10", icon: ClipboardCheck },
                { label: "Awaiting self-review", value: waitingOnSelf.length, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10", icon: Clock },
              ].map((m) => (
                <Card key={m.label} className="border-border/60">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-xl font-semibold text-foreground">{m.value}</p>
                      </div>
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${m.color}`}>
                        <m.icon className="h-4 w-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Completion progress */}
              {totalTeamInCycle > 0 && (
                <Card className="border-border/60">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Cycle completion</p>
                      <span className="text-xs font-semibold text-foreground">{completionPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {completedCount} of {totalTeamInCycle} reviews complete
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Team to review list */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {pendingMgrReviews.length > 0 ? "Ready for your review" : "Team review status"}
              </h2>
              <Link
                href="/dashboard/my-reviews?tab=reviewing"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                See all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {teamStatus.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-10 flex flex-col items-center text-center">
                  <Users className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-foreground">No active cycle for your team</p>
                  <p className="text-xs text-muted-foreground mt-1">Review assignments will appear here during an active cycle.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {/* Show pending-mgr-review first, then waiting-on-self */}
                {[...pendingMgrReviews, ...waitingOnSelf].slice(0, 6).map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {t.report?.slack_name?.[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {t.report?.slack_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.report?.job_title || "No title"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.mgrDone ? (
                        <Badge className="text-[10px] text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </Badge>
                      ) : t.selfDone ? (
                        <Button size="sm" variant="default" className="text-xs h-8" asChild>
                          <Link href={`/dashboard/reviews/${t.id}`}>
                            Review <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      ) : (
                        <Badge className="text-[10px] text-muted-foreground bg-muted flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Awaiting self
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active cycles */}
        {activeCycles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Active cycles
              </h2>
              <Link
                href="/dashboard/cycles"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                Manage <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeCycles.map((cycle: any) => (
                <Link
                  key={cycle.id}
                  href={`/dashboard/cycles/${cycle.id}`}
                  className="group flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all"
                >
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{cycle.name}</p>
                    {cycle.review_deadline && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Deadline {new Date(cycle.review_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── HR / Admin dashboard ───────────────────────────────────────────────────
  const isAdminUser = canManageUsers(role);
  const stats = orgData?.stats ?? { totalReviews: 0, activeCycles: 0, totalFeedback: 0, totalUsers: 0 };
  const setup = orgData?.setup ?? { users: 0, competencies: 0, cycles: 0, hasManagers: false };
  const activeCycles = orgData?.activeCycles ?? [];
  const setupComplete = setup.users >= 2 && setup.competencies > 0 && setup.cycles > 0;
  const showOnboarding = isAdminUser && !setupComplete;

  const steps = [
    { id: "sync", label: "Sync your team", description: "Import members from your Slack workspace", href: "/dashboard/team", icon: Slack, done: setup.users >= 2 },
    { id: "org", label: "Set up org structure", description: "Assign managers, departments, and job levels", href: "/dashboard/team", icon: GitBranch, done: setup.hasManagers },
    { id: "competencies", label: "Define competencies", description: "Create the skills and behaviors your org values", href: "/dashboard/competencies", icon: Target, done: setup.competencies > 0 },
    { id: "matrix", label: "Map competencies to levels", description: "Set expected proficiency per role in the matrix", href: "/dashboard/competencies/matrix", icon: Layers, done: setup.competencies > 0 && setup.hasManagers },
    { id: "cycle", label: "Launch your first review cycle", description: "Create a performance review cycle and notify your team", href: "/dashboard/cycles/new", icon: Rocket, done: setup.cycles > 0 },
  ];
  const completedSteps = steps.filter((s) => s.done).length;

  const metrics = [
    { label: "Active Cycles", value: stats.activeCycles, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
    { label: "Review Assignments", value: stats.totalReviews, icon: FileText, color: "text-primary bg-primary/[0.08]" },
    { label: "Feedback Given", value: stats.totalFeedback, icon: MessageSquare, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
    { label: "Team Members", value: stats.totalUsers, icon: Users, color: "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
  ];

  const quickLinks = [
    { href: "/dashboard/my-reviews", label: "My Reviews", icon: ClipboardCheck, description: "View your performance reviews and pending actions" },
    { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquare, description: "See feedback you've given and received" },
    { href: "/dashboard/cycles", label: "Cycles", icon: CalendarClock, description: "Manage performance review cycles" },
    { href: "/dashboard/competencies", label: "Competencies", icon: Target, description: "Define and track competency frameworks" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Hey {firstName}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {showOnboarding
            ? "Let's get your workspace set up. Follow the steps below to start running reviews."
            : "Here's what's happening in your workspace."}
        </p>
      </div>

      {/* Onboarding checklist */}
      {showOnboarding && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Setup Checklist</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{completedSteps} of {steps.length} steps complete</p>
              </div>
              <div className="flex items-center gap-1.5">
                {steps.map((s) => (
                  <div key={s.id} className={`h-1.5 w-6 rounded-full transition-colors ${s.done ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              {steps.map((step) => (
                <Link
                  key={step.id}
                  href={step.href}
                  className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${step.done ? "opacity-60" : "hover:bg-primary/[0.04] hover:shadow-sm"}`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{step.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                  </div>
                  {!step.done && <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Org-wide metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
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

      {!showOnboarding && chartData && <DashboardCharts data={chartData} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Quick access</h2>
          <div className="grid gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-4 p-3.5 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
                  <link.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{link.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Active cycles</h2>
          <Card className="border-border/60">
            <CardContent className="pt-5">
              {activeCycles.length === 0 ? (
                <div className="text-center py-6">
                  <CalendarClock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No active cycles</p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link href="/dashboard/cycles/new">Create cycle</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCycles.map((cycle: any) => (
                    <Link
                      key={cycle.id}
                      href={`/dashboard/cycles/${cycle.id}`}
                      className="block p-3 rounded-lg border border-border/60 hover:border-border hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <p className="text-sm font-medium text-foreground truncate">{cycle.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-4">
                        {new Date(cycle.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" — "}
                        {new Date(cycle.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
