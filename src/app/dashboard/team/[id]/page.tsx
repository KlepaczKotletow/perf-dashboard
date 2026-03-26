import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import {
  ArrowLeft, Mail, Pencil, Star,
  MessageSquare, Users,
} from "lucide-react";
import { gradeColor, getQuarterLabel } from "@/lib/status";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getAssignmentStatus, GOAL_TRACKING_STATUS } from "@/lib/status";

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const feedbackTypeBadge: Record<string, string> = {
  praise: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  constructive: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  general: "bg-muted text-muted-foreground",
};

// ── Visual helpers ─────────────────────────────────────────────────────────

// gradeColor and getQuarterLabel imported from @/lib/status

function RatingRing({ rating, max = 5, size = 80, strokeWidth = 8 }: {
  rating: number | null;
  max?: number;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = rating !== null ? circumference - (rating / max) * circumference : circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={strokeWidth}
        className="stroke-muted"
      />
      {rating !== null && (
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-primary transition-all duration-500"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

function GoalRing({ progress, trackingStatus, size = 32, strokeWidth = 4 }: {
  progress: number;
  trackingStatus: string;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;
  const color =
    trackingStatus === "on_track" || trackingStatus === "achieved"
      ? "stroke-emerald-500"
      : trackingStatus === "at_risk"
        ? "stroke-amber-500"
        : trackingStatus === "behind" || trackingStatus === "delayed"
          ? "stroke-red-500"
          : "stroke-muted-foreground/40";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden="true">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={strokeWidth}
        className="stroke-muted"
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={color}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ── Data Fetching ──────────────────────────────────────────────────────────

async function getEmployeeDetails(id: string, workspaceId: string, showAllFeedback: boolean) {
  const supabase = await createServerSupabaseClient();

  const { data: user, error } = await supabase
    .from("users")
    .select(`*, level:levels!users_level_id_fkey(name, grade, job_family:job_families(name))`)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !user) return null;

  // Fetch manager separately (avoids PostgREST 400 on self-referential + nested join)
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
      .select("id, slack_name, job_title")
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

  const reviewAssignments = reviewRes.data || [];

  // Fetch review responses for competency averages
  const assignmentIds = reviewAssignments.map((a: any) => a.id);
  let reviewResponses: any[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("review_responses")
      .select(`id, rating, comment, reviewer_role, competency:competencies!review_responses_competency_id_fkey(name, category)`)
      .in("assignment_id", assignmentIds);
    reviewResponses = data || [];
  }

  // Feedback — managers see all; others see only shared items
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

  // Compute competency averages
  const ratingsBySkill: Record<string, { name: string; category: string | null; ratings: number[] }> = {};
  reviewResponses.forEach((r: any) => {
    if (r.rating && r.competency?.name) {
      const key = r.competency.name;
      if (!ratingsBySkill[key]) {
        ratingsBySkill[key] = { name: r.competency.name, category: r.competency.category, ratings: [] };
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

  const allRatings = reviewResponses.filter((r: any) => r.rating).map((r: any) => r.rating as number);
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

// ── Page ───────────────────────────────────────────────────────────────────

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getUserWorkspace();

  const canSeeAllRatings = isManagerOrAbove(workspace?.role);
  const canEdit = isHROrAbove(workspace?.role);
  const ratingMax = workspace?.ratingScale?.max || 5;
  const isViewingOwnProfile = workspace?.appUserId === id;
  const showFeedbackSection = canSeeAllRatings || isViewingOwnProfile;

  if (!workspace?.workspaceId) notFound();
  const data = await getEmployeeDetails(id, workspace.workspaceId, canSeeAllRatings);
  if (!data) notFound();

  const { user, manager, reviewAssignments, continuousFeedback, directReports, goals, skillAverages, overallAvg } = data;

  const level = user.level as any;
  const levelLabel = level
    ? [level.job_family?.name, level.name, level.grade ? `(${level.grade})` : ""].filter(Boolean).join(" — ")
    : null;

  const activeGoals = goals.filter((g: any) => g.status !== "completed" && g.status !== "cancelled");
  const onTrackGoals = activeGoals.filter((g: any) => g.tracking_status === "on_track" || g.tracking_status === "achieved");

  const gradesReleasedForAny = reviewAssignments.some((a: any) => a.cycle?.grades_released);
  const showRating = canSeeAllRatings || (isViewingOwnProfile && gradesReleasedForAny);

  const latestReview: any = reviewAssignments[0] ?? null;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── 1. Header ──────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-primary/[0.04] p-6">
        <div className="flex items-start gap-5">
          <Button variant="ghost" size="icon" className="shrink-0 mt-1" asChild>
            <Link href="/dashboard/team">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <Avatar className="h-24 w-24 shrink-0">
            <AvatarFallback className="text-3xl bg-primary/[0.08] text-primary font-medium">
              {getInitials(user.slack_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {user.slack_name || "Unknown"}
                </h1>
                {user.job_title && (
                  <p className="text-base text-muted-foreground mt-0.5">{user.job_title}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  {[user.department, levelLabel, user.role || "user"].filter(Boolean).join(" · ")}
                </p>
                {manager?.slack_name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Reports to{" "}
                    <Link
                      href={`/dashboard/team/${manager.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {manager.slack_name}
                    </Link>
                  </p>
                )}
                {user.slack_email && (
                  <a
                    href={`mailto:${user.slack_email}`}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1 w-fit"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {user.slack_email}
                  </a>
                )}
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" className="text-xs shrink-0" asChild>
                  <Link href={`/dashboard/team/${id}/edit`}>
                    <Pencil className="h-3 w-3 mr-1.5" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Performance Hero ────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex items-center gap-8">
            {/* Circular rating ring */}
            <div className="relative shrink-0 flex items-center justify-center" style={{ width: 80, height: 80 }}>
              <RatingRing rating={showRating && overallAvg ? parseFloat(overallAvg) : null} max={ratingMax} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-foreground leading-none">
                  {showRating && overallAvg ? overallAvg : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Overall</span>
              </div>
            </div>

            {/* Grade + inline stats */}
            <div className="flex-1 min-w-0">
              {latestReview?.final_grade &&
                (canSeeAllRatings || latestReview.cycle?.grades_released) && (
                  <p className={`text-2xl font-bold leading-tight ${gradeColor(latestReview.final_grade)}`}>
                    {latestReview.final_grade}
                  </p>
                )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2">
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{reviewAssignments.length}</span>{" "}
                  {reviewAssignments.length === 1 ? "review" : "reviews"}
                </span>
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {onTrackGoals.length}/{activeGoals.length > 0 ? activeGoals.length : goals.length}
                  </span>{" "}
                  goals on track
                </span>
                {showFeedbackSection && (
                  <span className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{continuousFeedback.length}</span>{" "}
                    feedback
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. At-a-Glance Row ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Latest Review */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Latest Review</CardTitle>
          </CardHeader>
          <CardContent>
            {!latestReview ? (
              <p className="text-sm text-muted-foreground py-2">
                No reviews yet — reviews appear when a performance cycle is launched.
              </p>
            ) : (() => {
              const config = getAssignmentStatus(latestReview.status);
              return (
                <div className="space-y-2">
                  <p className="text-base font-semibold text-foreground">
                    {latestReview.cycle?.name || "Unknown Cycle"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Manager: {latestReview.manager?.slack_name || "Unassigned"}
                    {latestReview.cycle?.start_date && (
                      <> &middot; {format(new Date(latestReview.cycle.start_date), "MMM yyyy")}</>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-[11px] font-medium ${config.badge}`}>
                      {config.label}
                    </Badge>
                    {latestReview.overall_rating &&
                      (canSeeAllRatings || latestReview.cycle?.grades_released) && (
                        <span className="text-sm font-semibold text-foreground">
                          {latestReview.overall_rating}/{ratingMax}
                        </span>
                      )}
                    {latestReview.final_grade &&
                      (canSeeAllRatings || latestReview.cycle?.grades_released) && (
                        <Badge variant="outline" className="text-[11px]">
                          {latestReview.final_grade}
                        </Badge>
                      )}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Active Goals snapshot */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active Goals</CardTitle>
          </CardHeader>
          <CardContent>
            {activeGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No active goals.</p>
            ) : (
              <div className="space-y-3">
                {activeGoals.slice(0, 3).map((goal: any) => {
                  const tracking =
                    GOAL_TRACKING_STATUS[goal.tracking_status] || GOAL_TRACKING_STATUS.on_track;
                  return (
                    <div key={goal.id} className="flex items-center gap-3">
                      <GoalRing progress={goal.progress || 0} trackingStatus={goal.tracking_status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{goal.title}</p>
                          <Badge className={`text-[10px] shrink-0 ${tracking.badge}`}>
                            {tracking.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{goal.progress || 0}%</p>
                      </div>
                    </div>
                  );
                })}
                {activeGoals.length > 3 && (
                  <a href="#goals" className="text-xs text-primary hover:underline">
                    View all {activeGoals.length} goals ↓
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Competency Highlights (manager/above only) ──────────────── */}
      {canSeeAllRatings && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Competencies
            </CardTitle>
          </CardHeader>
          <CardContent>
            {skillAverages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No competency data yet — ratings appear after reviews are submitted.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {skillAverages.map((skill) => (
                  <div
                    key={skill.name}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{skill.name}</p>
                      {skill.category && (
                        <p className="text-[11px] text-muted-foreground">{skill.category}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {Array.from({ length: ratingMax }, (_, i) => i + 1).map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= Math.round(parseFloat(skill.avg))
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/20"
                          }`}
                        />
                      ))}
                      <span className="text-xs font-medium ml-1">{skill.avg}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 5. Feedback Feed (permission-gated) ────────────────────────── */}
      {showFeedbackSection && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            {continuousFeedback.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {canSeeAllRatings
                  ? "No feedback received yet."
                  : "No feedback has been shared with this employee yet."}
              </p>
            ) : (
              <div className="space-y-3">
                {continuousFeedback.map((f: any) => (
                  <div key={f.id} className="px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground">
                        {f.is_anonymous ? "Anonymous" : f.from_user?.slack_name || "Unknown"}
                      </span>
                      <Badge
                        className={`text-[10px] ${feedbackTypeBadge[f.feedback_type] || feedbackTypeBadge.general}`}
                      >
                        {f.feedback_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{f.message}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                      {format(new Date(f.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 6. All Reviews ─────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Performance Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {reviewAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No reviews yet — reviews appear when a performance cycle is launched.
            </p>
          ) : (
            <div className="space-y-1">
              {reviewAssignments.map((a: any) => {
                const config = getAssignmentStatus(a.status);
                return (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      {/* Quarter chip */}
                      <div className="w-14 shrink-0">
                        <span className="inline-block rounded-md bg-muted px-2 py-1 text-xs font-mono font-medium text-foreground">
                          {getQuarterLabel(a.cycle?.start_date)}
                        </span>
                      </div>
                      {/* Cycle info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {a.cycle?.name || "Unknown Cycle"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.manager?.slack_name || "Unassigned"}
                        </p>
                      </div>
                      {/* Grade + status */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {a.final_grade && (canSeeAllRatings || a.cycle?.grades_released) && (
                          <span className={`text-sm font-semibold ${gradeColor(a.final_grade)}`}>
                            {a.final_grade}
                          </span>
                        )}
                        {!a.final_grade && a.overall_rating && (canSeeAllRatings || a.cycle?.grades_released) && (
                          <span className="text-sm font-semibold text-foreground">
                            {a.overall_rating}/{ratingMax}
                          </span>
                        )}
                        <Badge className={`text-[10px] font-medium ${config.badge}`}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 7. All Goals ───────────────────────────────────────────────── */}
      <Card id="goals" className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Goals</CardTitle>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No goals assigned yet.
            </p>
          ) : (
            <div className="space-y-1">
              {goals.map((goal: any) => {
                const tracking =
                  GOAL_TRACKING_STATUS[goal.tracking_status] || GOAL_TRACKING_STATUS.on_track;
                return (
                  <div key={goal.id} className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors">
                    <GoalRing progress={goal.progress || 0} trackingStatus={goal.tracking_status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-sm font-medium text-foreground truncate">{goal.title}</p>
                        <Badge className={`text-[10px] font-medium shrink-0 ml-2 ${tracking.badge}`}>
                          {tracking.label}
                        </Badge>
                      </div>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{goal.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">{goal.progress || 0}%</span>
                        {goal.metric_target && goal.metric_unit && (
                          <span className="text-xs text-muted-foreground">
                            {goal.metric_current ?? goal.metric_start ?? 0} / {goal.metric_target} {goal.metric_unit}
                          </span>
                        )}
                        {goal.due_date && (
                          <span className="text-[11px] text-muted-foreground">
                            Due {format(new Date(goal.due_date), "MMM d")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 8. Direct Reports (only if person manages others) ──────────── */}
      {directReports.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Direct Reports ({directReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {directReports.map((report: any) => (
                <Link
                  key={report.id}
                  href={`/dashboard/team/${report.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border hover:shadow-sm transition-all text-sm"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-primary/[0.08] text-primary">
                      {getInitials(report.slack_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">{report.slack_name}</span>
                  {report.job_title && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {report.job_title}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
