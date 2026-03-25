import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import { ArrowRight, ChevronRight, Calendar, Clock, Star, Check, TrendingUp } from "lucide-react";
import { CollapsibleSection, SectionEmptyNote } from "./collapsible-section";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
import { gradeColor, getQuarterLabel } from "@/lib/status";

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
        cycle:performance_cycles!inner(id, name, status, start_date, end_date, review_deadline, grades_released),
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
      .select("id, cycle:performance_cycles!inner(workspace_id)")
      .eq("manager_id", userId)
      .eq("cycle.workspace_id", workspaceId);
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

  // ── Build cycle-over-cycle timeline ──
  const cycleTimeline = (myAssignments || [])
    .map((a: any) => {
      const gradesVisible = a.cycle?.grades_released === true;
      const isCurrent = a.cycle?.status === "active" || a.cycle?.status === "in_review";
      return {
        id: a.id,
        cycleId: a.cycle?.id,
        cycleName: a.cycle?.name || "Unknown",
        startDate: a.cycle?.start_date,
        endDate: a.cycle?.end_date,
        quarterLabel: getQuarterLabel(a.cycle?.start_date),
        cycleStatus: a.cycle?.status,
        isCurrent,
        grade: gradesVisible ? a.final_grade : null,
        rating: gradesVisible ? a.overall_rating : null,
        gradesReleased: gradesVisible,
        selfSubmitted: mySubmissions[a.id]?.has("self") || false,
        assignmentStatus: a.status as string,
        calibratedAt: a.calibrated_at as string | null,
      };
    })
    .sort((a: any, b: any) => {
      if (!a.startDate || !b.startDate) return 0;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

  const currentCycleEntry = cycleTimeline.find((c) => c.isCurrent);

  // Fetch actual cycle_phases for the current active cycle to get real deadlines and statuses
  let progressSteps: { label: string; done: boolean; active?: boolean; deadline: string | null }[] = [];
  if (currentCycleEntry?.cycleId) {
    const { data: phases } = await supabase
      .from("cycle_phases")
      .select("phase_type, name, status, end_date, sort_order")
      .eq("cycle_id", currentCycleEntry.cycleId)
      .order("sort_order");

    if (phases && phases.length > 0) {
      // Map real phases to progress steps — use actual DB status and deadlines
      const phaseMap: Record<string, { label: string }> = {
        goal_setting: { label: "Goal Setting" },
        self_assessment: { label: "Self-Review" },
        peer_review: { label: "Peer Review" },
        manager_review: { label: "Manager Review" },
        calibration: { label: "Calibration" },
        communication: { label: "Results" },
      };

      progressSteps = phases.map((p: any) => ({
        label: phaseMap[p.phase_type]?.label || p.name || p.phase_type,
        done: p.status === "completed",
        active: p.status === "active",
        deadline: p.end_date,
      }));
    } else {
      // Fallback if no phases configured — use assignment-level data
      progressSteps = [
        {
          label: "Self-Review",
          done: currentCycleEntry.selfSubmitted,
          deadline: null,
        },
        {
          label: "Manager Review",
          done: currentCycleEntry.assignmentStatus === "completed",
          deadline: currentCycleEntry.endDate,
        },
        {
          label: "Calibration",
          done: currentCycleEntry.calibratedAt != null,
          deadline: null,
        },
        {
          label: "Grade",
          done: currentCycleEntry.gradesReleased,
          deadline: null,
        },
      ];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Your review cycles, actions, and ratings</p>
      </div>

      {/* ── My Performance ── */}
      {cycleTimeline.length > 0 && (
        <div className="space-y-3">
          {/* Cycle chips — compact horizontal row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1">
            {cycleTimeline.map((entry) => (
              <Link
                key={entry.id}
                href={entry.cycleId ? `/dashboard/cycles/${entry.cycleId}` : "#"}
                className={`shrink-0 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent ${
                  entry.isCurrent
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/60 bg-card"
                }`}
              >
                <span className="font-mono font-medium text-foreground">{entry.quarterLabel}</span>
                {entry.grade ? (
                  <span className={`font-semibold ${gradeColor(entry.grade)}`}>{entry.grade}</span>
                ) : entry.isCurrent ? (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-muted-foreground">{entry.cycleStatus === "in_review" ? "In Review" : "Active"}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
                {entry.rating && (
                  <span className="text-muted-foreground tabular-nums">{Number(entry.rating).toFixed(1)}</span>
                )}
              </Link>
            ))}
          </div>

          {/* Current cycle progress — compact inline stepper with deadlines */}
          {currentCycleEntry && progressSteps.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-foreground">{currentCycleEntry.cycleName}</span>
                  {currentCycleEntry.endDate && (
                    <span className="text-[10px] text-muted-foreground">
                      Ends {format(new Date(currentCycleEntry.endDate), "MMM d")}
                    </span>
                  )}
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-0">
                  {progressSteps.map((step, idx) => {
                    const isActive = step.active || (!step.done && (idx === 0 || progressSteps[idx - 1].done));
                    const deadlineDate = step.deadline ? new Date(step.deadline) : null;
                    const isOverdue = deadlineDate && isPast(deadlineDate) && !step.done;

                    return (
                      <div key={step.label} className="flex items-center flex-1 min-w-0">
                        {/* Step */}
                        <div className="flex flex-col items-center gap-0.5 min-w-0">
                          <div
                            className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                              step.done
                                ? "bg-emerald-500 text-white dark:bg-emerald-500"
                                : isActive
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {step.done ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <span className={`text-[10px] leading-tight text-center truncate max-w-[72px] ${
                            isActive ? "font-medium text-foreground" : step.done ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {step.label}
                          </span>
                          {deadlineDate && (
                            <span className={`text-[9px] leading-none ${
                              isOverdue ? "text-red-500 font-medium" : "text-muted-foreground/60"
                            }`}>
                              {isOverdue ? "Overdue" : format(deadlineDate, "MMM d")}
                            </span>
                          )}
                        </div>

                        {/* Connector */}
                        {idx < progressSteps.length - 1 && (
                          <div className={`flex-1 h-px mx-1 mt-[-14px] ${
                            step.done ? "bg-emerald-400 dark:bg-emerald-600" : "bg-border"
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Active Cycles Overview removed — cycle chips above serve this purpose */}

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
