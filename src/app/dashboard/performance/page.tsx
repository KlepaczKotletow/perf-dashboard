import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import { ArrowRight, ChevronRight, Calendar, Clock, Star } from "lucide-react";
import { CollapsibleSection, SectionEmptyNote } from "./collapsible-section";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";

export default async function PerformancePage() {
  const workspace = await getUserWorkspace();
  if (!workspace?.appUserId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please sign in to view your performance.
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const userId = workspace.appUserId;
  const workspaceId = workspace.workspaceId;

  const role = workspace.role;

  const [
    { data: myAssignments },
    { data: managerReviews },
    { data: upwardReviews },
    { data: activeCycles },
  ] = await Promise.all([
    supabase
      .from("review_assignments")
      .select(`
        *,
        cycle:performance_cycles!inner(id, name, status, review_deadline),
        manager:users!review_assignments_manager_id_fkey(slack_name)
      `)
      .eq("employee_id", userId)
      .eq("assignment_type", "standard")
      .eq("cycle.workspace_id", workspaceId)
      .order("created_at", { ascending: false }),

    supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
        cycle:performance_cycles!inner(id, name, status)
      `)
      .eq("manager_id", userId)
      .eq("assignment_type", "standard")
      .neq("employee_id", userId)
      .eq("cycle.workspace_id", workspaceId)
      .order("created_at", { ascending: false }),

    supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
        cycle:performance_cycles!inner(id, name, status)
      `)
      .eq("reviewer_id", userId)
      .eq("assignment_type", "upward")
      .eq("cycle.workspace_id", workspaceId)
      .order("created_at", { ascending: false }),

    supabase
      .from("performance_cycles")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "in_review"])
      .order("created_at", { ascending: false }),
  ]);

  // Fetch review ratings for this user (received ratings from completed reviews)
  const allAssignmentIds = (myAssignments || []).map((a: any) => a.id);
  let reviewRatings: any[] = [];
  if (allAssignmentIds.length > 0) {
    const { data: ratings } = await supabase
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
      .in("assignment_id", allAssignmentIds)
      .order("created_at", { ascending: false })
      .limit(50);
    reviewRatings = ratings || [];
  }

  // For managers, also fetch ratings for their direct reports
  let reportRatings: any[] = [];
  if (isManagerOrAbove(role)) {
    const { data: reportAssignments } = await supabase
      .from("review_assignments")
      .select("id")
      .eq("manager_id", userId)
      .eq("workspace_id", workspaceId);
    const reportAssignmentIds = (reportAssignments || []).map((a: any) => a.id);
    if (reportAssignmentIds.length > 0) {
      const { data: rRatings } = await supabase
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
        .in("assignment_id", reportAssignmentIds)
        .order("created_at", { ascending: false })
        .limit(100);
      reportRatings = rRatings || [];
    }
  }

  const allRatings = isHROrAbove(role)
    ? [...reviewRatings, ...reportRatings]
    : isManagerOrAbove(role)
    ? [...reviewRatings, ...reportRatings]
    : reviewRatings;

  // Deduplicate by id
  const seenIds = new Set<string>();
  const dedupedRatings = allRatings.filter((r: any) => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  const ratingMax = workspace?.ratingScale?.max || 5;

  const myAssignmentIds = (myAssignments || []).map((a: any) => a.id);
  let mySubmissions: Record<string, Set<string>> = {};
  if (myAssignmentIds.length > 0) {
    const { data: myResponses } = await supabase
      .from("review_responses")
      .select("id, assignment_id, reviewer_role")
      .eq("reviewer_id", userId)
      .in("assignment_id", myAssignmentIds);

    (myResponses || []).forEach((r: any) => {
      if (!mySubmissions[r.assignment_id]) {
        mySubmissions[r.assignment_id] = new Set();
      }
      mySubmissions[r.assignment_id].add(r.reviewer_role);
    });
  }

  const enrichedAssignments = (myAssignments || []).map((a: any) => {
    const selfSubmitted = mySubmissions[a.id]?.has("self") || false;
    const cycleEnded = a.cycle?.status === "closed" || a.cycle?.status === "completed";
    return { ...a, selfSubmitted, cycleEnded };
  });

  const sortByCompletion = (a: any, b: any) => {
    const aComplete = a.status === "completed";
    const bComplete = b.status === "completed";
    if (aComplete === bComplete) return 0;
    return aComplete ? 1 : -1;
  };

  const sortedManagerReviews = [...(managerReviews || [])].sort(sortByCompletion);
  const sortedUpwardReviews = [...(upwardReviews || [])].sort(sortByCompletion);

  const pendingSelfReviews = enrichedAssignments.filter(
    (a: any) => !a.selfSubmitted && !a.cycleEnded && a.status !== "completed"
  );
  const completedSelfReviewAssignments = enrichedAssignments.filter(
    (a: any) => a.selfSubmitted || a.status === "completed"
  );

  const pendingManagerReviews = sortedManagerReviews.filter((r: any) => r.status !== "completed");
  const pendingUpwardReviews = sortedUpwardReviews.filter((r: any) => r.status !== "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Your review cycles, actions, and ratings</p>
      </div>

      {/* ── Active Cycles Overview ── */}
      {(activeCycles || []).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {(activeCycles || []).map((cycle: any) => {
            const deadline = cycle.review_deadline ? new Date(cycle.review_deadline) : null;
            const isOverdue = deadline && isPast(deadline);
            const isUpcoming = deadline && isFuture(deadline);
            const timeLeft = deadline ? formatDistanceToNow(deadline, { addSuffix: true }) : null;

            return (
              <Card key={cycle.id} className="border-border/60">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="text-sm font-semibold text-foreground truncate">{cycle.name}</h3>
                        <Badge className={`shrink-0 text-[10px] font-medium ${
                          cycle.status === "active"
                            ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10"
                            : "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10"
                        }`}>
                          {cycle.status === "active" ? "Active" : "In Review"}
                        </Badge>
                      </div>

                      {deadline && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className={`h-3 w-3 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`} />
                          <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                            Review deadline: {format(deadline, "MMM d, yyyy")}
                            {isOverdue && " (overdue)"}
                            {isUpcoming && ` — ${timeLeft}`}
                          </span>
                        </div>
                      )}

                      {cycle.self_review_deadline && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Self-review deadline: {format(new Date(cycle.self_review_deadline), "MMM d, yyyy")}
                          </span>
                        </div>
                      )}

                      {cycle.start_date && cycle.end_date && (
                        <p className="text-xs text-muted-foreground/60 mt-1.5">
                          Period: {format(new Date(cycle.start_date), "MMM d")} — {format(new Date(cycle.end_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>

                    <Button size="sm" variant="outline" className="text-xs h-8 shrink-0" asChild>
                      <Link href={`/dashboard/cycles/${cycle.id}`}>
                        View <ChevronRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-2">

        {/* ── Self-Review ── */}
        <CollapsibleSection
          title="Self-Review"
          pendingCount={pendingSelfReviews.length}
          allDone={completedSelfReviewAssignments.length > 0 && pendingSelfReviews.length === 0}
          defaultOpen={pendingSelfReviews.length > 0}
        >
          {pendingSelfReviews.length === 0 ? (
            <SectionEmptyNote message="No self-reviews due" />
          ) : (
            <Card className="border-border/60">
              <CardContent>
                <div className="divide-y divide-border">
                  {pendingSelfReviews.map((a: any) => (
                    <div key={`self-${a.id}`} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {a.cycle?.name || "Unknown Cycle"}
                        </span>
                        {a.cycle?.review_deadline && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Deadline: {format(new Date(a.cycle.review_deadline), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                      <Button size="sm" className="text-xs h-8 shrink-0" asChild>
                        <Link href={`/dashboard/cycles/${a.cycle?.id}/review/${a.id}`}>
                          Start Self-Review <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CollapsibleSection>

        {/* ── Reviews to Give ── */}
        <CollapsibleSection
          title="Reviews to Give"
          pendingCount={pendingManagerReviews.length}
          allDone={sortedManagerReviews.length > 0 && pendingManagerReviews.length === 0}
          defaultOpen={pendingManagerReviews.length > 0}
        >
          {sortedManagerReviews.length === 0 ? (
            <SectionEmptyNote message="No reviews to give" />
          ) : (
            <Card className="border-border/60">
              <CardContent>
                <div className="divide-y divide-border">
                  {sortedManagerReviews.map((review: any) => {
                    const isDone = review.status === "completed";
                    return (
                      <div
                        key={`mgr-${review.id}`}
                        className={`py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 ${isDone ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-medium text-primary">
                              {review.employee?.slack_name?.[0]?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground truncate">
                                {review.employee?.slack_name || "Unknown"}
                              </span>
                              <Badge className={`shrink-0 text-[10px] font-medium ${isDone ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" : "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10"}`}>
                                {isDone ? "Completed" : review.status === "in_progress" ? "In Progress" : "Pending"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {review.cycle?.name || "Unknown cycle"}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isDone ? "ghost" : "default"}
                          className="text-xs h-8 shrink-0"
                          asChild
                        >
                          <Link href={`/dashboard/reviews/${review.id}`}>
                            {isDone ? "View" : "Review Now"}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </CollapsibleSection>

        {/* ── Upward Feedback ── */}
        <CollapsibleSection
          title="Upward Feedback"
          pendingCount={pendingUpwardReviews.length}
          allDone={sortedUpwardReviews.length > 0 && pendingUpwardReviews.length === 0}
          defaultOpen={pendingUpwardReviews.length > 0}
        >
          {sortedUpwardReviews.length === 0 ? (
            <SectionEmptyNote message="No upward feedback assigned" />
          ) : (
            <Card className="border-border/60">
              <CardContent>
                <div className="divide-y divide-border">
                  {sortedUpwardReviews.map((review: any) => {
                    const isDone = review.status === "completed";
                    return (
                      <div
                        key={`upward-${review.id}`}
                        className={`py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 ${isDone ? "opacity-60" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">
                              {review.employee?.slack_name || "Unknown"}
                            </span>
                            <Badge className={`shrink-0 text-[10px] font-medium ${isDone ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" : "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10"}`}>
                              {isDone ? "Submitted" : review.status === "in_progress" ? "In Progress" : "Pending"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {review.cycle?.name || "Unknown cycle"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isDone ? "ghost" : "default"}
                          className="text-xs h-8 shrink-0"
                          asChild
                        >
                          <Link
                            href={
                              isDone
                                ? `/dashboard/reviews/${review.id}`
                                : `/dashboard/cycles/${review.cycle?.id}/review/${review.id}`
                            }
                          >
                            {isDone ? "View" : "Give Feedback"}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </CollapsibleSection>

      </div>

      {/* ── Review Ratings ── */}
      {dedupedRatings.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Review Ratings
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {dedupedRatings.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {dedupedRatings.map((item: any) => {
                const roleConf: Record<string, { label: string; className: string }> = {
                  self: { label: "Self", className: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10" },
                  manager: { label: "Manager", className: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
                  upward: { label: "Upward", className: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
                  peer: { label: "Peer", className: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
                };
                const rConf = roleConf[item.reviewer_role] || roleConf.peer;
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
                          <Badge className={`shrink-0 text-[10px] font-medium ${rConf.className}`}>
                            {rConf.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 mt-1">
                          {item.competency?.name && (
                            <span className="text-xs text-muted-foreground">
                              {item.competency.name}
                            </span>
                          )}
                          {item.rating && (
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: ratingMax }, (_, i) => i + 1).map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3.5 w-3.5 ${
                                    star <= item.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-muted-foreground/20"
                                  }`}
                                />
                              ))}
                              <span className="ml-1.5 text-xs font-medium text-muted-foreground">{item.rating}/{ratingMax}</span>
                            </div>
                          )}
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
    </div>
  );
}
