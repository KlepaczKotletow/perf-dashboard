import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { ArrowLeft, Mail, Pencil } from "lucide-react";
import { gradeColor, getQuarterLabel } from "@/lib/status";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove, isManagerOrAbove, isAdmin } from "@/lib/roles";
import { DeactivateButton } from "./deactivate-button";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getAssignmentStatus, GOAL_TRACKING_STATUS } from "@/lib/status";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ── Data Fetching ────────────────────────────────────────────────────────────

async function getEmployeeDetails(id: string, workspaceId: string, showAllFeedback: boolean) {
  const supabase = await createServerSupabaseClient();

  const { data: user, error } = await supabase
    .from("users")
    .select(`*, level:levels!users_level_id_fkey(name, grade, job_family:job_families(name))`)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !user) return null;

  let manager: { id: string; slack_name: string } | null = null;
  if (user.manager_id) {
    const { data: managerData } = await supabase
      .from("users")
      .select("id, slack_name")
      .eq("id", user.manager_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    manager = managerData;
  }

  const [reviewRes, directReportsRes, goalsRes] = await Promise.all([
    supabase
      .from("review_assignments")
      .select(`
        id, status, overall_rating, final_grade, created_at, updated_at,
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date, grades_released, workspace_id),
        manager:users!review_assignments_manager_id_fkey(slack_name)
      `)
      .eq("employee_id", id)
      .eq("cycle.workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("users")
      .select("id, slack_name, job_title, avatar_url")
      .eq("manager_id", id)
      .eq("workspace_id", workspaceId)
      .order("slack_name"),
    supabase
      .from("goals")
      .select("id, title, description, status, progress, weight, metric_start, metric_current, metric_target, metric_unit, tracking_status, scope, due_date")
      .eq("employee_id", id)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  type CycleJoin = { id: string; name: string; status: string; start_date: string | null; end_date: string | null; grades_released?: boolean; workspace_id?: string | null };
  type ReviewAssignmentRow = {
    id: string;
    status: string;
    overall_rating: number | null;
    final_grade: string | null;
    created_at: string | null;
    updated_at: string | null;
    cycle?: CycleJoin | null;
    manager?: { slack_name: string | null } | null;
  };
  type ReviewResponseRow = {
    id: string;
    rating: number | null;
    comment: string | null;
    reviewer_role: string | null;
    competency: { name: string | null; category: string | null } | { name: string | null; category: string | null }[] | null;
  };

  const reviewAssignments = (reviewRes.data || []) as unknown as ReviewAssignmentRow[];

  const assignmentIds = reviewAssignments.map((a) => a.id);
  let reviewResponses: ReviewResponseRow[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("review_responses")
      .select(`id, rating, comment, reviewer_role, competency:competencies!review_responses_competency_id_fkey(name, category)`)
      .in("assignment_id", assignmentIds);
    reviewResponses = (data || []) as ReviewResponseRow[];
  }

  let feedbackQuery = supabase
    .from("continuous_feedback")
    .select(`id, message, feedback_type, is_anonymous, shared_with_employee, created_at, from_user:users!continuous_feedback_from_user_id_fkey(slack_name)`)
    .eq("to_user_id", id)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!showAllFeedback) {
    feedbackQuery = feedbackQuery.eq("shared_with_employee", true);
  }
  const { data: continuousFeedback } = await feedbackQuery;

  const ratingsBySkill: Record<string, { name: string; category: string | null; ratings: number[] }> = {};
  reviewResponses.forEach((r) => {
    const comp = Array.isArray(r.competency) ? r.competency[0] : r.competency;
    if (r.rating && comp?.name) {
      const key = comp.name;
      if (!ratingsBySkill[key]) {
        ratingsBySkill[key] = { name: comp.name, category: comp.category, ratings: [] };
      }
      ratingsBySkill[key].ratings.push(r.rating);
    }
  });
  const skillAverages = Object.values(ratingsBySkill)
    .map((s) => ({
      name: s.name,
      category: s.category,
      avg: (s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length).toFixed(1),
      count: s.ratings.length,
    }))
    .sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));

  const allRatings = reviewResponses.filter((r) => r.rating).map((r) => r.rating as number);
  const overallAvg = allRatings.length > 0
    ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
    : null;

  return {
    user,
    manager,
    reviewAssignments,
    continuousFeedback: continuousFeedback || [],
    directReports: directReportsRes.data || [],
    goals: goalsRes.data || [],
    skillAverages,
    overallAvg,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getUserWorkspace();

  const canSeeAllRatings = isManagerOrAbove(workspace?.role) || !!workspace?.hasDirectReports;
  const canEdit = isHROrAbove(workspace?.role);
  const ratingMax = workspace?.ratingScale?.max || 5;
  const isViewingOwnProfile = workspace?.appUserId === id;
  const showKudosSection = canSeeAllRatings || isViewingOwnProfile;

  if (!workspace?.workspaceId) notFound();
  const data = await getEmployeeDetails(id, workspace.workspaceId, canSeeAllRatings);
  if (!data) notFound();

  const { user, manager, reviewAssignments, continuousFeedback, directReports, goals, skillAverages, overallAvg } = data;

  type GoalRow = { id: string; title: string; description: string | null; status: string; progress: number | null; weight: number | null; metric_start: number | null; metric_current: number | null; metric_target: number | null; metric_unit: string | null; tracking_status: string | null; scope: string; due_date: string | null };
  const activeGoals = (goals as GoalRow[]).filter((g) => g.status !== "completed" && g.status !== "cancelled");
  const gradesReleasedForAny = reviewAssignments.some((a) => a.cycle?.grades_released);
  const showRating = canSeeAllRatings || (isViewingOwnProfile && gradesReleasedForAny);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── 1. Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5 -ml-2" asChild>
          <Link href="/dashboard/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <Avatar className="h-16 w-16 shrink-0">
          {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.slack_name || ""} />}
          <AvatarFallback className="text-xl bg-primary/[0.08] text-primary font-semibold">
            {getInitials(user.slack_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
                {user.slack_name || "Unknown"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[user.job_title, user.department].filter(Boolean).join(" · ") || "No title"}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {manager?.slack_name && (
                  <span>
                    Reports to{" "}
                    <Link href={`/dashboard/team/${manager.id}`} className="text-primary hover:underline font-medium">
                      {manager.slack_name}
                    </Link>
                  </span>
                )}
                {user.slack_email && (
                  <a href={`mailto:${user.slack_email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Mail className="h-3 w-3" />
                    {user.slack_email}
                  </a>
                )}
                {user.start_date && (
                  <span>Started {format(new Date(user.start_date), "MMM d, yyyy")}</span>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="text-xs" asChild>
                  <Link href={`/dashboard/team/${id}/edit`}>
                    <Pencil className="h-3 w-3 mr-1.5" />
                    Edit
                  </Link>
                </Button>
                {isAdmin(workspace?.role) && !isViewingOwnProfile && (
                  <DeactivateButton
                    userId={id}
                    workspaceId={workspace.workspaceId}
                    isDeactivated={user.employee_status === "deactivated"}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Stats row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-sm border-y border-border/40 py-3">
        {showRating && overallAvg && (
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-foreground">{overallAvg}</span>
            <span className="text-muted-foreground">/ {ratingMax} avg</span>
          </div>
        )}
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{reviewAssignments.length}</span> {reviewAssignments.length === 1 ? "review" : "reviews"}
        </span>
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{activeGoals.length}</span> active {activeGoals.length === 1 ? "goal" : "goals"}
        </span>
        {showKudosSection && continuousFeedback.length > 0 && (
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{continuousFeedback.length}</span> kudos
          </span>
        )}
        {directReports.length > 0 && (
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{directReports.length}</span> direct {directReports.length === 1 ? "report" : "reports"}
          </span>
        )}
      </div>

      {/* ── 3. Performance History ────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance History</h2>
        {reviewAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No reviews yet — reviews appear when a performance cycle is launched.</p>
        ) : (
          <div className="border border-border/40 rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Cycle</span>
              <span>Period</span>
              <span className="text-center">Rating</span>
              <span className="text-center">Grade</span>
              <span className="text-right">Status</span>
            </div>
            {/* Rows */}
            {reviewAssignments.map((a) => {
              const config = getAssignmentStatus(a.status);
              const canSeeThis = canSeeAllRatings || a.cycle?.grades_released;
              const dateRange = a.cycle?.start_date && a.cycle?.end_date
                ? `${format(new Date(a.cycle.start_date), "MMM yyyy")} – ${format(new Date(a.cycle.end_date), "MMM yyyy")}`
                : getQuarterLabel(a.cycle?.start_date);
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 border-t border-border/30 hover:bg-muted/20 transition-colors items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.cycle?.name || "Unknown Cycle"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">Manager: {a.manager?.slack_name || "—"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{dateRange}</span>
                  <span className="text-sm font-semibold text-foreground text-center">
                    {canSeeThis && a.overall_rating ? `${a.overall_rating}/${ratingMax}` : "—"}
                  </span>
                  <div className="text-center">
                    {canSeeThis && a.final_grade ? (
                      <span className={`text-sm font-semibold ${gradeColor(a.final_grade)}`}>{a.final_grade}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge className={`text-[10px] font-medium ${config.badge}`}>{config.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Two-column: Goals + Competencies ───────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Goals */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Goals</h2>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No goals assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {(goals as GoalRow[]).map((goal) => {
                const tracking = GOAL_TRACKING_STATUS[goal.tracking_status as keyof typeof GOAL_TRACKING_STATUS] || GOAL_TRACKING_STATUS.on_track;
                const progress = goal.progress || 0;
                const isCompleted = goal.status === "completed";
                return (
                  <div key={goal.id} className="px-3 py-2.5 rounded-lg border border-border/30 hover:border-border/60 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className={`text-sm font-medium truncate ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>{goal.title}</p>
                      <Badge className={`text-[9px] shrink-0 ${tracking.badge}`}>{tracking.label}</Badge>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            goal.tracking_status === "on_track" || goal.tracking_status === "achieved"
                              ? "bg-emerald-500"
                              : goal.tracking_status === "at_risk"
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium w-8 text-right">{progress}%</span>
                    </div>
                    {goal.due_date && (
                      <p className="text-[10px] text-muted-foreground mt-1">Due {format(new Date(goal.due_date), "MMM d")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Competencies (manager+ only) */}
        {canSeeAllRatings && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Competencies</h2>
            {skillAverages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No competency data yet — ratings appear after reviews are submitted.</p>
            ) : (
              <div className="space-y-2">
                {skillAverages.map((skill) => {
                  const pct = (parseFloat(skill.avg) / ratingMax) * 100;
                  return (
                    <div key={skill.name} className="px-3 py-2.5 rounded-lg border border-border/30">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{skill.name}</p>
                          {skill.category && <p className="text-[10px] text-muted-foreground">{skill.category}</p>}
                        </div>
                        <span className="text-sm font-semibold text-foreground shrink-0">{skill.avg}/{ratingMax}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── 5. Kudos ──────────────────────────────────────────────────────── */}
      {showKudosSection && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Kudos</h2>
          {continuousFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {canSeeAllRatings ? "No kudos received yet." : "No kudos have been shared with this employee yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {(continuousFeedback as Array<{ id: string; message: string; is_anonymous: boolean | null; created_at: string; from_user: { slack_name: string | null } | { slack_name: string | null }[] | null }>).map((f) => {
                const fromUser = Array.isArray(f.from_user) ? f.from_user[0] : f.from_user;
                return (
                <div key={f.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border/30 hover:border-border/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-foreground">
                        {f.is_anonymous ? "Anonymous" : fromUser?.slack_name || "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(f.created_at), "MMM d, yyyy")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.message}</p>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── 6. Direct Reports ─────────────────────────────────────────────── */}
      {directReports.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Direct Reports ({directReports.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {(directReports as Array<{ id: string; slack_name: string | null; job_title: string | null; avatar_url: string | null }>).map((report) => (
              <Link
                key={report.id}
                href={`/dashboard/team/${report.id}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 hover:border-border hover:shadow-sm transition-all text-sm"
              >
                <Avatar className="h-6 w-6">
                  {report.avatar_url && <AvatarImage src={report.avatar_url} alt={report.slack_name || ""} />}
                  <AvatarFallback className="text-[10px] bg-primary/[0.08] text-primary">
                    {getInitials(report.slack_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{report.slack_name}</span>
                {report.job_title && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">{report.job_title}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
