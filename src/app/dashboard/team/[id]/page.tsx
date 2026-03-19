import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import {
  ArrowLeft, Mail, Pencil, Star, FileText,
  MessageSquare, Target, Users,
} from "lucide-react";
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

function gradeColor(grade: string | null | undefined): string {
  if (!grade) return "text-foreground";
  const g = grade.toLowerCase();
  if (g.includes("exceed") || g.includes("outstanding") || g.includes("exceptional"))
    return "text-emerald-600 dark:text-emerald-400";
  if (g.includes("performing") || g.includes("meeting") || g.includes("meets"))
    return "text-primary";
  if (g.includes("developing") || g.includes("below") || g.includes("needs"))
    return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}

function getQuarterLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  const q = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${q} '${String(date.getFullYear()).slice(2)}`;
}

function RatingRing({ rating, size = 80, strokeWidth = 8 }: {
  rating: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = rating !== null ? circumference - (rating / 5) * circumference : circumference;
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

async function getEmployeeDetails(id: string, showAllFeedback: boolean) {
  const supabase = await createServerSupabaseClient();

  const { data: user, error } = await supabase
    .from("users")
    .select(`*, level:levels!users_level_id_fkey(name, grade, job_family:job_families(name))`)
    .eq("id", id)
    .maybeSingle();

  if (error || !user) return null;

  // Fetch manager separately (avoids PostgREST 400 on self-referential + nested join)
  let manager: { id: string; slack_name: string } | null = null;
  if (user.manager_id) {
    const { data: managerData } = await supabase
      .from("users")
      .select("id, slack_name")
      .eq("id", user.manager_id)
      .maybeSingle();
    manager = managerData;
  }

  const [reviewRes, directReportsRes, goalsRes] = await Promise.all([
    supabase
      .from("review_assignments")
      .select(`
        id, status, overall_rating, final_grade, created_at, updated_at,
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date, grades_released),
        manager:users!review_assignments_manager_id_fkey(slack_name)
      `)
      .eq("employee_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("users")
      .select("id, slack_name, job_title")
      .eq("manager_id", id)
      .order("slack_name"),
    supabase
      .from("goals")
      .select("id, title, description, status, progress, weight, metric_start, metric_current, metric_target, metric_unit, tracking_status, scope, due_date")
      .eq("employee_id", id)
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
  const isViewingOwnProfile = workspace?.appUserId === id;
  const showFeedbackSection = canSeeAllRatings || isViewingOwnProfile;

  const data = await getEmployeeDetails(id, canSeeAllRatings);
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

      {/* ── 2. KPI Strip ───────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Overall Rating
                </p>
                <p className="text-2xl font-semibold mt-1 text-foreground">
                  {showRating && overallAvg ? `${overallAvg}/5` : "—"}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10">
                <Star className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Reviews
                </p>
                <p className="text-2xl font-semibold mt-1 text-foreground">
                  {reviewAssignments.length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-primary bg-primary/[0.08]">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Feedback
                </p>
                <p className="text-2xl font-semibold mt-1 text-foreground">
                  {showFeedbackSection ? continuousFeedback.length : "—"}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Goals
                </p>
                <p className="text-2xl font-semibold mt-1 text-foreground">{goals.length}</p>
                {activeGoals.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {onTrackGoals.length}/{activeGoals.length} on track
                  </p>
                )}
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10">
                <Target className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. At-a-Glance Row ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Latest Review */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Latest Review
            </CardTitle>
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
                          {latestReview.overall_rating}/5
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
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Target className="h-3.5 w-3.5" />
              Active Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No active goals.</p>
            ) : (
              <div className="space-y-3">
                {activeGoals.slice(0, 3).map((goal: any) => {
                  const tracking =
                    GOAL_TRACKING_STATUS[goal.tracking_status] || GOAL_TRACKING_STATUS.on_track;
                  const barColor = goal.tracking_status === "on_track" || goal.tracking_status === "achieved"
                    ? "bg-emerald-500"
                    : goal.tracking_status === "at_risk"
                      ? "bg-amber-500"
                      : "bg-red-500";
                  return (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate pr-2">{goal.title}</p>
                        <Badge className={`text-[10px] shrink-0 ${tracking.badge}`}>
                          {tracking.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${Math.min(goal.progress || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {goal.progress || 0}%
                        </span>
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
            <CardTitle className="text-base flex items-center gap-2">
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
                    className="flex items-center justify-between p-3 rounded-lg border border-border/60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{skill.name}</p>
                      {skill.category && (
                        <p className="text-[11px] text-muted-foreground">{skill.category}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {[1, 2, 3, 4, 5].map((s) => (
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
            <CardTitle className="text-base flex items-center gap-2">
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
                  <div key={f.id} className="p-3 rounded-lg border border-border/60">
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
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Performance Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reviewAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No reviews yet — reviews appear when a performance cycle is launched.
            </p>
          ) : (
            <div className="space-y-2">
              {reviewAssignments.map((a: any) => {
                const config = getAssignmentStatus(a.status);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {a.cycle?.name || "Unknown Cycle"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.manager?.slack_name || "Unassigned"}
                        {a.cycle?.start_date && (
                          <> &middot; {format(new Date(a.cycle.start_date), "MMM yyyy")}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.overall_rating && (canSeeAllRatings || a.cycle?.grades_released) && (
                        <span className="text-sm font-semibold text-foreground">
                          {a.overall_rating}/5
                        </span>
                      )}
                      {a.final_grade && (canSeeAllRatings || a.cycle?.grades_released) && (
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {a.final_grade}
                        </Badge>
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
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No goals assigned yet.
            </p>
          ) : (
            <div className="space-y-2">
              {goals.map((goal: any) => {
                const tracking =
                  GOAL_TRACKING_STATUS[goal.tracking_status] || GOAL_TRACKING_STATUS.on_track;
                return (
                  <div key={goal.id} className="p-3 rounded-lg border border-border/60">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground truncate">{goal.title}</p>
                      <Badge className={`text-[10px] font-medium shrink-0 ml-2 ${tracking.badge}`}>
                        {tracking.label}
                      </Badge>
                    </div>
                    {goal.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            goal.tracking_status === "on_track" || goal.tracking_status === "achieved"
                              ? "bg-emerald-500"
                              : goal.tracking_status === "at_risk"
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(goal.progress || 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground shrink-0">
                        {goal.progress || 0}%
                      </span>
                      {goal.metric_target && goal.metric_unit && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {goal.metric_current ?? goal.metric_start ?? 0} / {goal.metric_target}{" "}
                          {goal.metric_unit}
                        </span>
                      )}
                      {goal.due_date && (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          Due {format(new Date(goal.due_date), "MMM d")}
                        </span>
                      )}
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
            <CardTitle className="text-base flex items-center gap-2">
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
