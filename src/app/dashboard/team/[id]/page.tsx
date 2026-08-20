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

/**
 * What kind of review a row actually is. The database only ever writes
 * 'standard' and 'upward' today — 'self' and 'peer' have never been generated —
 * but all four are labelled so the column stays honest when they are.
 */
const ASSIGNMENT_TYPE_LABEL: Record<string, string> = {
  standard: "Manager review",
  upward: "Upward feedback",
  self: "Self-review",
  peer: "Peer review",
};

function assignmentTypeLabel(type: string | null | undefined): string {
  return (type && ASSIGNMENT_TYPE_LABEL[type]) || "Review";
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
        id, status, overall_rating, final_grade, created_at, updated_at, assignment_type,
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
    // Without this, a manager review and an upward review of the same person in
    // the same cycle render as two identical rows, one of them labelled
    // "Manager: —". It reads as a duplicate; it never was one.
    assignment_type: string | null;
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

  // No pooled `overallAvg` any more. It averaged every rating from every
  // reviewer role across every cycle into a single figure — mixing a manager's
  // assessment with upward feedback about a different person's management — and
  // then presented it as "2.3 / 5 avg". The header now reports the last manager
  // rating and its direction of travel instead, which is the question the page
  // is actually opened to answer.

  return {
    user,
    manager,
    reviewAssignments,
    continuousFeedback: continuousFeedback || [],
    directReports: directReportsRes.data || [],
    goals: goalsRes.data || [],
    skillAverages,
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

  const { user, manager, reviewAssignments, continuousFeedback, directReports, goals, skillAverages } = data;

  type GoalRow = { id: string; title: string; description: string | null; status: string; progress: number | null; weight: number | null; metric_start: number | null; metric_current: number | null; metric_target: number | null; metric_unit: string | null; tracking_status: string | null; scope: string; due_date: string | null };
  const gradesReleasedForAny = reviewAssignments.some((a) => a.cycle?.grades_released);
  const showRating = canSeeAllRatings || (isViewingOwnProfile && gradesReleasedForAny);

  // ── Trajectory ──────────────────────────────────────────────────────────
  // The old header read "2.3 / 5 avg", pooling every reviewer's score across
  // every cycle into one number that answers no question anyone asks. What a
  // manager opens this page for is "how is this person doing, and what
  // changed" — so: the last manager rating, and the direction of travel.
  //
  // Upward feedback is excluded. It rates the manager, not the employee;
  // averaging it into their score was part of what made the old number
  // meaningless.
  const ratingHistory = reviewAssignments
    .filter((a) => a.overall_rating != null && a.assignment_type !== "upward")
    .sort((a, b) => {
      const at = a.cycle?.start_date ? new Date(a.cycle.start_date).getTime() : 0;
      const bt = b.cycle?.start_date ? new Date(b.cycle.start_date).getTime() : 0;
      return bt - at;
    });
  const latestRated = ratingHistory[0] ?? null;
  const previousRated = ratingHistory[1] ?? null;
  const ratingDelta =
    latestRated?.overall_rating != null && previousRated?.overall_rating != null
      ? Number(latestRated.overall_rating) - Number(previousRated.overall_rating)
      : null;

  const levelLabelParts = [
    (user.level as { job_family?: { name?: string | null } | null } | null)?.job_family?.name,
    (user.level as { name?: string | null } | null)?.name,
  ].filter(Boolean);
  const levelLabel = levelLabelParts.length > 0 ? levelLabelParts.join(" · ") : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

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
              {/* The one deliberate serif moment in the product. Fraunces is
                  already loaded and tokenised and was used on no product
                  surface at all; setting a person's name in it costs nothing
                  and is the difference between a page that looks generated and
                  one that looks made. */}
              <h1 className="font-serif text-[2rem] font-semibold tracking-tight text-foreground leading-[1.1]">
                {user.slack_name || "Unknown"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[user.job_title, user.department].filter(Boolean).join(" · ") || "No title"}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
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

      {/* ── 2. Trajectory ─────────────────────────────────────────────────
          One sentence, not five equal facts and not a row of stat tiles: what
          band this person is in, where their last rating landed, and which way
          it moved. Everything else that used to sit here (review count, goal
          count, kudos count) is a heading below — counting it twice was noise. */}
      <div className="border-y border-border/40 py-3 text-sm tabular-nums">
        <p className="text-foreground leading-relaxed">
          {levelLabel && <span className="font-semibold">{levelLabel}</span>}
          {showRating && latestRated?.overall_rating != null ? (
            <>
              {levelLabel && <span className="text-muted-foreground"> · </span>}
              <span className="font-semibold">{latestRated.overall_rating}/{ratingMax}</span>
              <span className="text-muted-foreground"> last cycle</span>
              {ratingDelta !== null && (
                <span
                  className={
                    ratingDelta > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : ratingDelta < 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                  }
                >
                  {ratingDelta > 0 ? ", up from " : ratingDelta < 0 ? ", down from " : ", unchanged from "}
                  {previousRated?.overall_rating}
                </span>
              )}
            </>
          ) : (
            <>
              {levelLabel && <span className="text-muted-foreground"> · </span>}
              <span className="text-muted-foreground">
                {reviewAssignments.length === 0 ? "No reviews yet" : "No rating released yet"}
              </span>
            </>
          )}
          {directReports.length > 0 && (
            <span className="text-muted-foreground">
              {" · "}
              {directReports.length} direct {directReports.length === 1 ? "report" : "reports"}
            </span>
          )}
        </p>
      </div>

      {/* ── 3. Performance History ────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance History</h2>
        {reviewAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No reviews yet — reviews appear when a performance cycle is launched.</p>
        ) : (
          <div className="border border-border/40 rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2.4fr_1.2fr_1fr_0.8fr_1fr_1fr] gap-3 px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Cycle</span>
              <span>Type</span>
              <span>Period</span>
              <span className="text-center">Rating</span>
              <span className="text-center">Grade</span>
              <span className="text-right">Status</span>
            </div>
            {/* Rows */}
            {reviewAssignments.map((a) => {
              const config = getAssignmentStatus(a.status);
              // `grades_released` alone is NOT enough: it says the grade is
              // out, not that *this viewer* may read it. Without the
              // own-profile check a plain member reading a colleague's URL saw
              // their rating and final grade for every released cycle. Mirrors
              // `showRating` above — the two must stay in step.
              const canSeeThis = canSeeAllRatings || (isViewingOwnProfile && !!a.cycle?.grades_released);
              const dateRange = a.cycle?.start_date && a.cycle?.end_date
                ? `${format(new Date(a.cycle.start_date), "MMM yyyy")} – ${format(new Date(a.cycle.end_date), "MMM yyyy")}`
                : getQuarterLabel(a.cycle?.start_date);
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[2.4fr_1.2fr_1fr_0.8fr_1fr_1fr] gap-3 px-4 py-3 border-t border-border/30 hover:bg-muted/20 transition-colors items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.cycle?.name || "Unknown Cycle"}</p>
                    {/* Upward feedback has no manager of record, and printing
                        "Manager: —" against it made a valid row look broken. */}
                    {a.manager?.slack_name && (
                      <p className="text-xs text-muted-foreground truncate">{a.manager.slack_name}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{assignmentTypeLabel(a.assignment_type)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{dateRange}</span>
                  <span className="text-sm font-semibold text-foreground text-center tabular-nums">
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
                    <Badge className={`text-xs font-medium ${config.badge}`}>{config.label}</Badge>
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
                      <Badge className={`text-xs shrink-0 ${tracking.badge}`}>{tracking.label}</Badge>
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
                      <span className="text-xs text-muted-foreground font-medium w-8 text-right">{progress}%</span>
                    </div>
                    {goal.due_date && (
                      <p className="text-xs text-muted-foreground mt-1">Due {format(new Date(goal.due_date), "MMM d")}</p>
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
              /* Grouped by category rather than listed flat.
                 Seven identical full-width bars in one column give every
                 competency the same visual weight and no shape — you have to
                 read all seven to learn anything. Revolut's scorecard collapses
                 the same information into a few named pillars, each carrying a
                 headline figure, and that is what this is: the group average
                 answers "how are they doing", the rows underneath answer "on
                 what". The category is a heading now instead of a 10px caption
                 repeated on every row. */
              <div className="space-y-4">
                {Object.entries(
                  skillAverages.reduce<Record<string, typeof skillAverages>>((groups, skill) => {
                    const key = skill.category || "General";
                    (groups[key] ||= []).push(skill);
                    return groups;
                  }, {})
                ).map(([category, skills]) => {
                  const groupAvg =
                    skills.reduce((sum, s) => sum + parseFloat(s.avg), 0) / skills.length;
                  return (
                    <div key={category}>
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {category}
                        </h3>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {groupAvg.toFixed(1)}
                          <span className="text-muted-foreground font-normal">/{ratingMax}</span>
                        </span>
                      </div>
                      <div className="rounded-lg border border-border/30 divide-y divide-border/30">
                        {skills.map((skill) => {
                          const pct = (parseFloat(skill.avg) / ratingMax) * 100;
                          return (
                            <div key={skill.name} className="px-3 py-2">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm truncate">{skill.name}</p>
                                <span className="text-sm font-medium text-foreground shrink-0 tabular-nums">
                                  {skill.avg}
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
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
                      <span className="text-xs text-muted-foreground">{format(new Date(f.created_at), "MMM d, yyyy")}</span>
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
                  <AvatarFallback className="text-xs bg-primary/[0.08] text-primary">
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
