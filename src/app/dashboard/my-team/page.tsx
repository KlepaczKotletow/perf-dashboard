import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { reviewHref } from "@/lib/review-links";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Users, ArrowRight, Flag, AlertTriangle } from "lucide-react";
import { isManagerOrAbove } from "@/lib/roles";
import { getAssignmentStatus } from "@/lib/status";
import { PageHeader } from "@/components/page-header";
import { NoticeBanner, SECTION_LABEL, PersonAvatar } from "@/components/data-list";
import { TeamTable, type ReportRow } from "./team-table";

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

  type DirectReportRow = {
    id: string;
    slack_name: string | null;
    slack_email: string | null;
    slack_user_id: string | null;
    avatar_url: string | null;
    job_title: string | null;
    department: string | null;
    employee_status: string | null;
    is_department_head: boolean | null;
    level: {
      name: string | null;
      job_family?: { name: string } | { name: string }[] | null;
    } | null;
  };
  type AssignmentRow = {
    id: string;
    employee_id: string;
    status: string;
    overall_rating: number | null;
    assignment_type: string | null;
    reviewer_id: string | null;
    manager_id: string | null;
    cycle?: { id: string; name: string | null; status: string | null } | null;
    employee?: { id: string; slack_name: string | null; slack_user_id: string | null } | null;
    reviewer?: { id: string; slack_name: string | null } | null;
    manager?: { id: string; slack_name: string | null } | null;
  };

  const { data: directReports } = await supabase
    .from("users")
    .select(`
      id, slack_name, slack_email, slack_user_id, avatar_url, job_title, department,
      employee_status, is_department_head,
      level:levels!users_level_id_fkey(name, job_family:job_families(name))
    `)
    .eq("manager_id", userId)
    .eq("workspace_id", workspace.workspaceId)
    .order("slack_name");

  const reports = (directReports || []) as unknown as DirectReportRow[];
  const reportIds = reports.map((r) => r.id);

  let assignments: AssignmentRow[] = [];
  let goals: { employee_id: string; status: string; progress: number | null }[] = [];

  if (reportIds.length > 0) {
    const [assignmentsRes, goalsRes] = await Promise.all([
      supabase
        .from("review_assignments")
        .select(`
          id, employee_id, status, overall_rating, assignment_type, reviewer_id, manager_id,
          employee:users!review_assignments_employee_id_fkey(id, slack_name, slack_user_id),
          reviewer:users!review_assignments_reviewer_id_fkey(id, slack_name),
          manager:users!review_assignments_manager_id_fkey(id, slack_name),
          cycle:performance_cycles!review_assignments_cycle_id_fkey!inner(id, name, status, workspace_id)
        `)
        .in("employee_id", reportIds)
        .eq("cycle.workspace_id", workspace.workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("goals")
        .select("employee_id, status, progress")
        .in("employee_id", reportIds)
        .eq("workspace_id", workspace.workspaceId)
        .in("status", ["active", "draft"]),
    ]);
    assignments = (assignmentsRes.data || []) as unknown as AssignmentRow[];
    goals = (goalsRes.data || []) as unknown as { employee_id: string; status: string; progress: number | null }[];
  }

  // Rating scale ceiling, so a bare "1.8" is always shown against its maximum.
  const { data: wsRow } = await supabase
    .from("workspaces")
    .select("rating_scale, active_rating_scale_id, rating_scales!workspaces_active_rating_scale_id_fkey(max_value)")
    .eq("id", workspace.workspaceId)
    .maybeSingle();
  const scale = wsRow as { rating_scale?: { max?: number } | null; rating_scales?: { max_value: number } | { max_value: number }[] | null } | null;
  const activeScale = Array.isArray(scale?.rating_scales) ? scale?.rating_scales[0] : scale?.rating_scales;
  const ratingMax = activeScale?.max_value ?? scale?.rating_scale?.max ?? 5;

  const rows: ReportRow[] = reports.map((emp) => {
    const mine = assignments.filter((a) => a.employee_id === emp.id);
    // The "standard" row carries both the self and the manager review — it is
    // the one a manager owes. Upward rows on a report are reviews of *them* by
    // *their* reports and belong on that person's own page, not here.
    const current =
      mine.find((a) => a.assignment_type !== "upward" && a.cycle?.status === "active") ?? null;
    const rated = mine.find((a) => a.overall_rating != null);

    const empGoals = goals.filter((g) => g.employee_id === emp.id);
    const active = empGoals.filter((g) => g.status === "active");
    const avgProgress = active.length
      ? Math.round(active.reduce((s, g) => s + (g.progress || 0), 0) / active.length)
      : 0;

    const jf = Array.isArray(emp.level?.job_family) ? emp.level?.job_family[0] : emp.level?.job_family;
    const levelLabel = emp.level?.name
      ? `${jf?.name ? `${jf.name} · ` : ""}${emp.level.name}`
      : null;

    return {
      id: emp.id,
      name: emp.slack_name,
      email: emp.slack_email,
      avatarUrl: emp.avatar_url,
      jobTitle: emp.job_title,
      department: emp.department,
      employeeStatus: emp.employee_status,
      isDepartmentHead: !!emp.is_department_head,
      hasSlack: !!emp.slack_user_id,
      levelLabel,
      review: current
        ? {
            assignmentId: current.id,
            cycleId: current.cycle?.id ?? "",
            cycleName: current.cycle?.name ?? null,
            status: current.status,
            mine: current.manager_id === userId,
            waitingOn: current.manager?.slack_name ?? null,
          }
        : null,
      rating: rated?.overall_rating ?? null,
      ratingCycle: rated?.cycle?.name ?? null,
      ratingMax,
      activeGoals: active.length,
      avgProgress,
    };
  });

  // Everything the signed-in manager personally owes, across their reports.
  const myPending = rows
    .filter((r) => r.review && r.review.mine && r.review.status !== "completed")
    .map((r) => r.review!);

  const unreachable = rows.filter((r) => !r.hasSlack).length;
  const activeGoalTotal = rows.reduce((s, r) => s + r.activeGoals, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        hat="my-team"
        title="Team Overview"
        subtitle={`${rows.length} direct report${rows.length !== 1 ? "s" : ""}`}
      />

      {unreachable > 0 && (
        <NoticeBanner icon={<AlertTriangle className="h-4 w-4 shrink-0" />}>
          <strong>
            {unreachable} of your reports {unreachable === 1 ? "has" : "have"} no Slack account
          </strong>{" "}
          — Nami can’t reach {unreachable === 1 ? "them" : "them"}, so their reviews will stay
          pending until they join the workspace.
        </NoticeBanner>
      )}

      {/* Stat strip — three numbers a manager acts on, no derived filler. */}
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-sm">
        {[
          { label: "direct reports", value: rows.length, tone: "text-primary" },
          {
            label: myPending.length === 1 ? "review you owe" : "reviews you owe",
            value: myPending.length,
            tone: myPending.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          },
          {
            label: "active goals",
            value: activeGoalTotal,
            tone: activeGoalTotal > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
          },
        ].map((m, i) => (
          <span key={m.label} className="inline-flex items-baseline gap-1.5">
            {i > 0 && <span className="text-muted-foreground/30 mr-5" aria-hidden="true">·</span>}
            <span className={`text-xl font-semibold tabular-nums ${m.tone}`}>{m.value}</span>
            <span className="text-xs text-muted-foreground">{m.label}</span>
          </span>
        ))}
      </div>

      {/* Only what this manager can actually action. Reviews owned by someone
          else surface as "Waiting on …" in the table rather than as a row with
          a disabled button. */}
      {myPending.length > 0 && (
        <section className="space-y-2">
          <h2 className={SECTION_LABEL}>
            Reviews you owe
            <span className="ml-1.5 text-xs font-medium text-muted-foreground">· {myPending.length}</span>
          </h2>
          <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
            {myPending.map((rev) => {
              const person = rows.find((r) => r.review?.assignmentId === rev.assignmentId)!;
              const status = getAssignmentStatus(rev.status);
              return (
                <div key={rev.assignmentId} className="flex items-center gap-3 px-4 py-3">
                  <PersonAvatar name={person.name} avatarUrl={person.avatarUrl} className="h-8 w-8" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground block truncate">
                      {person.name || "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground block truncate">
                      Manager review · {rev.cycleName || "Current cycle"}
                    </span>
                  </div>
                  <Badge className={`text-[10px] font-medium shrink-0 ${status.badge}`}>{status.label}</Badge>
                  <Button size="sm" className="h-7 text-xs shrink-0" asChild>
                    <Link href={reviewHref(rev.assignmentId)}>
                      Review <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className={SECTION_LABEL}>Your team</h2>
        <TeamTable reports={rows} />
      </section>

      {/* Goals live on their own page, which can create and edit them. This is
          a pointer, not a second copy of that table. */}
      {activeGoalTotal > 0 && (
        <Link
          href="/dashboard/goals?tab=team"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground truncate">
              <span className="font-medium">{activeGoalTotal} active goal{activeGoalTotal !== 1 ? "s" : ""}</span>
              <span className="text-muted-foreground"> across your team</span>
            </span>
          </div>
          <span className="text-xs text-primary font-medium flex items-center gap-1 shrink-0 group-hover:gap-1.5 transition-all">
            Manage team goals <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      )}
    </div>
  );
}
