import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FeedbackFilter } from "./feedback-filter";
import { Suspense } from "react";
import { Star, MessageSquare, ArrowRight } from "lucide-react";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";

interface FeedbackFilters {
  source?: string;
  type?: string;
  search?: string;
}

/** null means "no restriction" (HR/admin). An array (possibly empty) means "only these IDs". */
interface FeedbackScope {
  assignmentIds: string[] | null; // restrict review_responses by assignment_id
  userIds: string[] | null;       // restrict continuous_feedback by to_user_id
}

const roleConfig: Record<string, { label: string; className: string }> = {
  self: { label: "Self", className: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10" },
  manager: { label: "Manager", className: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
  upward: { label: "Upward", className: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
  peer: { label: "Peer", className: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
};

const feedbackTypeConfig: Record<string, { label: string; className: string }> = {
  praise: { label: "Praise", className: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
  constructive: { label: "Constructive", className: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
  general: { label: "General", className: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10" },
};

async function getScope(
  role: string | undefined,
  currentUserId: string | null,
  workspaceId: string | undefined
): Promise<FeedbackScope> {
  // HR / Admin — unrestricted
  if (isHROrAbove(role)) {
    return { assignmentIds: null, userIds: null };
  }

  const supabase = await createServerSupabaseClient();

  if (!currentUserId || !workspaceId) {
    return { assignmentIds: [], userIds: [] };
  }

  // Manager — direct reports + self
  if (isManagerOrAbove(role)) {
    const { data: reports, error: reportsErr } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", currentUserId)
      .eq("workspace_id", workspaceId);
    if (reportsErr) console.error("Failed to fetch manager reports:", reportsErr.message);

    const allUserIds = [
      currentUserId,
      ...((reports || []).map((r: any) => r.id)),
    ];

    const { data: assignments, error: assignmentsErr } = await supabase
      .from("review_assignments")
      .select("id")
      .in("employee_id", allUserIds)
      .eq("workspace_id", workspaceId);
    if (assignmentsErr) console.error("Failed to fetch manager assignments:", assignmentsErr.message);

    return {
      assignmentIds: (assignments || []).map((a: any) => a.id),
      userIds: allUserIds,
    };
  }

  // Employee — themselves only (feedback received)
  const { data: myAssignments, error: myAssignmentsErr } = await supabase
    .from("review_assignments")
    .select("id")
    .eq("employee_id", currentUserId)
    .eq("workspace_id", workspaceId);
  if (myAssignmentsErr) console.error("Failed to fetch employee assignments:", myAssignmentsErr.message);

  return {
    assignmentIds: (myAssignments || []).map((a: any) => a.id),
    userIds: [currentUserId],
  };
}

async function getReviewFeedback(filters: FeedbackFilters, scope: FeedbackScope, workspaceId: string | undefined) {
  // If scope is an empty array we know there's nothing to return
  if (scope.assignmentIds !== null && scope.assignmentIds.length === 0) return [];

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("review_responses")
    .select(`
      id, reviewer_role, rating, comment, created_at,
      competency:competencies(name, category),
      reviewer:users!review_responses_reviewer_id_fkey(slack_name),
      assignment:review_assignments!review_responses_assignment_id_fkey(
        id,
        employee:users!review_assignments_employee_id_fkey(slack_name),
        cycle:performance_cycles!review_assignments_cycle_id_fkey(name)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  if (scope.assignmentIds !== null) {
    query = query.in("assignment_id", scope.assignmentIds);
  }

  const { data, error: reviewFeedbackErr } = await query;
  if (reviewFeedbackErr) console.error("Failed to fetch review feedback:", reviewFeedbackErr.message);
  let results = data || [];

  if (filters.search) {
    const s = filters.search.toLowerCase();
    results = results.filter((item: any) =>
      item.reviewer?.slack_name?.toLowerCase().includes(s) ||
      item.assignment?.employee?.slack_name?.toLowerCase().includes(s) ||
      item.competency?.name?.toLowerCase().includes(s) ||
      item.comment?.toLowerCase().includes(s) ||
      item.assignment?.cycle?.name?.toLowerCase().includes(s)
    );
  }

  return results;
}

async function getContinuousFeedback(
  filters: FeedbackFilters,
  scope: FeedbackScope,
  workspaceId: string | undefined,
  currentUserId: string | null,
  role: string | undefined,
) {
  // If scope is an empty array we know there's nothing to return
  if (scope.userIds !== null && scope.userIds.length === 0) return [];

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("continuous_feedback")
    .select("*, from_user:users!continuous_feedback_from_user_id_fkey(slack_name), to_user:users!continuous_feedback_to_user_id_fkey(slack_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  if (scope.userIds !== null) {
    if (isManagerOrAbove(role)) {
      // Managers: see all kudos for their reports (regardless of shared flag) + own sent
      query = query.or(`to_user_id.in.(${scope.userIds.join(",")}),from_user_id.in.(${scope.userIds.join(",")})`);
    } else if (currentUserId) {
      // Employees: see kudos they sent + kudos they received IF shared_with_employee=true
      query = query.or(
        `from_user_id.eq.${currentUserId},and(to_user_id.eq.${currentUserId},shared_with_employee.eq.true)`
      );
    }
  }
  // HR/Admin: scope.userIds === null, no filter applied — sees everything

  if (filters.type && filters.type !== "all") {
    query = query.eq("feedback_type", filters.type);
  }

  const { data, error: continuousFeedbackErr } = await query;
  if (continuousFeedbackErr) console.error("Failed to fetch continuous feedback:", continuousFeedbackErr.message);
  let results = data || [];

  if (filters.search) {
    const s = filters.search.toLowerCase();
    results = results.filter((item: any) =>
      item.from_user?.slack_name?.toLowerCase().includes(s) ||
      item.to_user?.slack_name?.toLowerCase().includes(s) ||
      item.message?.toLowerCase().includes(s)
    );
  }

  return results;
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/20"
          }`}
        />
      ))}
      <span className="ml-1.5 text-xs font-medium text-muted-foreground">{rating}/{max}</span>
    </div>
  );
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; type?: string; search?: string }>;
}) {
  const params = await searchParams;
  const workspace = await getUserWorkspace();
  const role = workspace?.role;
  const currentUserId = workspace?.appUserId ?? null;

  const scope = await getScope(role, currentUserId, workspace?.workspaceId);

  const pageDescription = isHROrAbove(role)
    ? "All review ratings and kudos across the organisation"
    : isManagerOrAbove(role)
    ? "Review ratings and kudos for you and your direct reports"
    : "Kudos you've sent and received";

  const showReview = !params.source || params.source === "all" || params.source === "review";
  const showContinuous = !params.source || params.source === "all" || params.source === "continuous";

  const workspaceId = workspace?.workspaceId;
  const ratingMax = workspace?.ratingScale?.max || 5;

  const [reviewFeedback, continuousFeedback] = await Promise.all([
    showReview ? getReviewFeedback(params, scope, workspaceId) : Promise.resolve([]),
    showContinuous ? getContinuousFeedback(params, scope, workspaceId, currentUserId, role) : Promise.resolve([]),
  ]);

  const hasNoFeedback = reviewFeedback.length === 0 && continuousFeedback.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Kudos</h1>
        <p className="text-sm text-muted-foreground mt-1">{pageDescription}</p>
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <FeedbackFilter />
      </Suspense>

      {hasNoFeedback && (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No kudos yet</p>
            <p className="text-sm text-muted-foreground">
              Kudos from performance reviews and Slack will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Review Responses (modern system) */}
      {showReview && reviewFeedback.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Review Ratings
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {reviewFeedback.length}{reviewFeedback.length === 100 ? " (showing first 100)" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {reviewFeedback.map((item: any) => {
                const role = roleConfig[item.reviewer_role] || roleConfig.peer;
                const reviewerName = item.reviewer?.slack_name || "Unknown";
                const employeeName = item.assignment?.employee?.slack_name || "Unknown";
                const cycleName = item.assignment?.cycle?.name;

                return (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {reviewerName}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">
                            {employeeName}
                          </span>
                          <Badge className={`shrink-0 text-[10px] font-medium ${role.className}`}>
                            {role.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 mt-1">
                          {item.competency?.name && (
                            <span className="text-xs text-muted-foreground">
                              {item.competency.name}
                            </span>
                          )}
                          {item.rating && <StarRating rating={item.rating} max={ratingMax} />}
                        </div>

                        {item.comment && (
                          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                            {item.comment}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {item.created_at
                            ? format(new Date(item.created_at), "MMM d, yyyy")
                            : "—"}
                        </p>
                        {cycleName && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {cycleName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {showReview && reviewFeedback.length === 0 && !hasNoFeedback && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Review Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-6">
              No review ratings yet. Ratings from performance reviews will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Continuous Feedback */}
      {showContinuous && continuousFeedback.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Kudos
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {continuousFeedback.length}{continuousFeedback.length === 50 ? " (showing first 50)" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {continuousFeedback.map((item: any) => {
                const typeConf = feedbackTypeConfig[item.feedback_type] || feedbackTypeConfig.general;

                return (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {item.is_anonymous ? "Anonymous" : item.from_user?.slack_name || "Unknown"}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">
                            {item.to_user?.slack_name || "Unknown"}
                          </span>
                          <Badge className={`shrink-0 text-[10px] font-medium ${typeConf.className}`}>
                            {typeConf.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {item.message}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {item.created_at
                          ? format(new Date(item.created_at), "MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {showContinuous && continuousFeedback.length === 0 && !hasNoFeedback && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Kudos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-6">
              No continuous feedback yet. Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/kudos</code> in Slack to send feedback to a teammate.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
