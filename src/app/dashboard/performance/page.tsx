import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import {
  Star,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  EyeOff,
  Medal,
  Users,
  ChevronRight,
} from "lucide-react";
import { PerformanceTabsClient } from "./performance-tabs-client";
import { CollapsibleSection, SectionEmptyNote } from "./collapsible-section";

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

  const [
    { data: myAssignments },
    { data: managerReviews },
    { data: upwardReviews },
  ] = await Promise.all([
    supabase
      .from("review_assignments")
      .select(`
        *,
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date, grades_released, review_deadline),
        manager:users!review_assignments_manager_id_fkey(slack_name)
      `)
      .eq("employee_id", userId)
      .eq("assignment_type", "standard")
      .order("created_at", { ascending: false }),

    supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
      `)
      .eq("manager_id", userId)
      .eq("assignment_type", "standard")
      .neq("employee_id", userId)
      .order("created_at", { ascending: false }),

    supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
      `)
      .eq("reviewer_id", userId)
      .eq("assignment_type", "upward")
      .order("created_at", { ascending: false }),
  ]);

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
    const gradesReleased = a.cycle?.grades_released || false;
    const cycleEnded = a.cycle?.status === "closed" || a.cycle?.status === "completed";

    let smartStatus: { label: string; description: string; variant: string; icon: string };

    if (cycleEnded && a.status !== "completed") {
      smartStatus = { label: "Cycle Ended", description: "This review cycle has ended without completion.", variant: "text-muted-foreground bg-muted", icon: "clock" };
    } else if (a.status === "pending" && !selfSubmitted) {
      smartStatus = { label: "Self-Review Required", description: "Complete your self-assessment to get started", variant: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10", icon: "alert" };
    } else if ((a.status === "in_progress" || a.status === "pending") && selfSubmitted) {
      smartStatus = a.manager_id
        ? { label: "Self-Review Submitted", description: "Waiting for your manager to complete their review", variant: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10", icon: "clock" }
        : { label: "Self-Review Submitted", description: "No manager assigned — an admin will complete your review", variant: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10", icon: "clock" };
    } else if (a.status === "completed" && !gradesReleased) {
      smartStatus = { label: "Review Complete", description: "Your review is complete. Results will be shared after calibration.", variant: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10", icon: "eyeoff" };
    } else if (a.status === "completed" && gradesReleased) {
      smartStatus = { label: "Results Available", description: "Your performance results have been released", variant: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10", icon: "check" };
    } else {
      smartStatus = { label: a.status === "in_progress" ? "In Progress" : a.status.charAt(0).toUpperCase() + a.status.slice(1), description: "", variant: "text-muted-foreground bg-muted", icon: "clock" };
    }

    return { ...a, selfSubmitted, gradesReleased, cycleEnded, smartStatus };
  });

  const sortByCompletion = (a: any, b: any) => {
    const aComplete = a.status === "completed";
    const bComplete = b.status === "completed";
    if (aComplete === bComplete) return 0;
    return aComplete ? 1 : -1;
  };

  const sortedMyAssignments = [...enrichedAssignments].sort(sortByCompletion);

  // Split results by cycle cadence
  const annualAssignments = sortedMyAssignments.filter((a: any) => a.cycle?.type === "annual");
  const quarterlyAssignments = sortedMyAssignments.filter((a: any) => a.cycle?.type === "quarterly");
  // Catch-all for assignments with no cycle type (or future types)
  const otherAssignments = sortedMyAssignments.filter(
    (a: any) => !["annual", "quarterly"].includes(a.cycle?.type)
  );

  const sortedManagerReviews = [...(managerReviews || [])].sort(sortByCompletion);
  const sortedUpwardReviews = [...(upwardReviews || [])].sort(sortByCompletion);

  const pendingSelfReviews = sortedMyAssignments.filter(
    (a: any) => !a.selfSubmitted && !a.cycleEnded && a.status !== "completed"
  );

  // Assignments where self-review was expected and completed (cycle not ended early)
  const completedSelfReviewAssignments = sortedMyAssignments.filter(
    (a: any) => a.selfSubmitted || a.status === "completed"
  );

  const pendingManagerReviews = sortedManagerReviews.filter((r: any) => r.status !== "completed");
  const pendingUpwardReviews = sortedUpwardReviews.filter((r: any) => r.status !== "completed");

  const rawTodoCount =
    pendingSelfReviews.length +
    pendingManagerReviews.length +
    pendingUpwardReviews.length;

  // Cap badge display at 99
  const todoCount = Math.min(rawTodoCount, 99);

  // ── Results Tab ──
  const resultsContent = (
    <div className="space-y-2">
      {sortedMyAssignments.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-muted-foreground/30" />}
          title="No results yet"
          description="Your review results will appear here once a cycle is completed."
        />
      ) : (
        <>
          {annualAssignments.length > 0 && (
            <CollapsibleSection title="Annual Reviews" defaultOpen={true}>
              <div className="space-y-1.5">
                {annualAssignments.map((a: any, i: number) => {
                  const prevCompleted = i > 0 && annualAssignments[i - 1].status === "completed";
                  const showDivider = a.status === "completed" && !prevCompleted && annualAssignments.some((x: any) => x.status !== "completed");
                  return (
                    <div key={a.id}>
                      {showDivider && <CompletedDivider />}
                      <ResultCard assignment={a} />
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {quarterlyAssignments.length > 0 && (
            <CollapsibleSection title="Quarterly Reviews" defaultOpen={true}>
              <div className="space-y-1.5">
                {quarterlyAssignments.map((a: any, i: number) => {
                  const prevCompleted = i > 0 && quarterlyAssignments[i - 1].status === "completed";
                  const showDivider = a.status === "completed" && !prevCompleted && quarterlyAssignments.some((x: any) => x.status !== "completed");
                  return (
                    <div key={a.id}>
                      {showDivider && <CompletedDivider />}
                      <ResultCard assignment={a} />
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {otherAssignments.length > 0 && (
            <CollapsibleSection title="Performance Reviews" defaultOpen={true}>
              <div className="space-y-1.5">
                {otherAssignments.map((a: any, i: number) => {
                  const prevCompleted = i > 0 && otherAssignments[i - 1].status === "completed";
                  const showDivider = a.status === "completed" && !prevCompleted && otherAssignments.some((x: any) => x.status !== "completed");
                  return (
                    <div key={a.id}>
                      {showDivider && <CompletedDivider />}
                      <ResultCard assignment={a} />
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );

  // ── To Do Tab ──
  const todoContent = (
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
          pendingSelfReviews.map((a: any) => (
            <Card key={`self-${a.id}`} className="border-amber-200/60 bg-amber-50/20 dark:border-amber-400/10 dark:bg-amber-400/[0.02] border-border/60">
              <CardContent className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{a.cycle?.name || "Unknown Cycle"}</span>
                      <Badge className="text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Self-Review
                      </Badge>
                    </div>
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
              </CardContent>
            </Card>
          ))
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
          sortedManagerReviews.map((review: any, i: number) => {
            const isDone = review.status === "completed";
            const prevDone = i > 0 && sortedManagerReviews[i - 1].status === "completed";
            const showDivider = isDone && !prevDone && sortedManagerReviews.some((x: any) => x.status !== "completed");
            return (
              <div key={`mgr-${review.id}`}>
                {showDivider && <CompletedDivider />}
                <Card className={`border-border/60 transition-all ${isDone ? "opacity-60" : ""}`}>
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-primary">
                            {review.employee?.slack_name?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">{review.employee?.slack_name || "Unknown"}</p>
                            <Badge className="text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              Manager Review
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 flex-wrap">
                            {review.employee?.job_title || "No title"} &middot; {review.cycle?.name || "Unknown cycle"}
                            {review.cycle?.status && review.cycle.status !== "active" && (
                              <Badge variant="outline" className="text-[9px] font-normal text-muted-foreground capitalize">
                                {review.cycle.status}
                              </Badge>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDone ? (
                          <Badge className="text-[10px] text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {review.status === "in_progress" ? "In Progress" : "Pending"}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={(isDone || review.cycle?.status === "closed" || review.cycle?.status === "completed") ? "ghost" : "default"}
                          className="text-xs h-8"
                          asChild
                        >
                          <Link href={`/dashboard/reviews/${review.id}`}>
                            {isDone ? "View" : (review.cycle?.status === "closed" || review.cycle?.status === "completed") ? "View" : "Review Now"}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })
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
          sortedUpwardReviews.map((review: any, i: number) => {
            const isDone = review.status === "completed";
            const prevDone = i > 0 && sortedUpwardReviews[i - 1].status === "completed";
            const showDivider = isDone && !prevDone && sortedUpwardReviews.some((x: any) => x.status !== "completed");
            return (
              <div key={`upward-${review.id}`}>
                {showDivider && <CompletedDivider />}
                <Card className={`border-border/60 transition-all ${isDone ? "opacity-60" : ""}`}>
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-400/10 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">
                              Feedback for {review.employee?.slack_name || "Unknown"}
                            </p>
                            <Badge className="text-[10px] font-medium bg-violet-100 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400">
                              Upward Feedback
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{review.cycle?.name || "Unknown cycle"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDone ? (
                          <>
                            <Badge className="text-[10px] text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                            </Badge>
                            <Button size="sm" variant="ghost" className="text-xs h-8" asChild>
                              <Link href={`/dashboard/reviews/${review.id}`}>View <ChevronRight className="h-3 w-3 ml-1" /></Link>
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge className="text-[10px] text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {review.status === "in_progress" ? "In Progress" : "Pending"}
                            </Badge>
                            <Button size="sm" className="text-xs h-8" asChild>
                              <Link href={`/dashboard/cycles/${review.cycle?.id}/review/${review.id}`}>
                                Give Feedback <ArrowRight className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })
        )}
      </CollapsibleSection>

    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your review results and pending actions
        </p>
      </div>

      <PerformanceTabsClient
        todoCount={todoCount}
        resultsContent={resultsContent}
        todoContent={todoContent}
      />
    </div>
  );
}

function StatusIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "alert":  return <AlertCircle className="h-3.5 w-3.5" />;
    case "clock":  return <Clock className="h-3.5 w-3.5" />;
    case "eyeoff": return <EyeOff className="h-3.5 w-3.5" />;
    case "check":  return <CheckCircle2 className="h-3.5 w-3.5" />;
    default:       return <Clock className="h-3.5 w-3.5" />;
  }
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
    </div>
  );
}

function CompletedDivider() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Completed</span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function ResultCard({ assignment: a }: { assignment: any }) {
  const isCompleted = a.status === "completed";
  return (
    <Card className={`border-border/60 transition-all ${isCompleted ? "opacity-60" : a.smartStatus.icon === "alert" ? "border-amber-200/60 bg-amber-50/20 dark:border-amber-400/10 dark:bg-amber-400/[0.02]" : ""}`}>
      <CardContent className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-medium text-foreground">{a.cycle?.name || "Unknown Cycle"}</h3>
              <Badge className={`text-[10px] font-medium flex items-center gap-1 ${a.smartStatus.variant}`}>
                <StatusIcon icon={a.smartStatus.icon} />
                {a.smartStatus.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {a.manager_id ? `Reviewed by: ${a.manager?.slack_name || "Unknown"}` : "No manager assigned"}
            </p>
            {a.smartStatus.description && (
              <p className="text-xs text-muted-foreground/70 mt-1">{a.smartStatus.description}</p>
            )}
            {a.cycle?.review_deadline && !isCompleted && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Deadline: {format(new Date(a.cycle.review_deadline), "MMM d, yyyy")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {a.gradesReleased && isCompleted && (
              <>
                {a.overall_rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-bold text-foreground">{a.overall_rating}/5</span>
                  </div>
                )}
                {a.final_grade && (
                  <Badge variant="outline" className="text-xs font-medium">
                    <Medal className="h-3 w-3 mr-1" />
                    {a.final_grade}
                  </Badge>
                )}
                <Button size="sm" variant="ghost" className="text-xs h-8" asChild>
                  <Link href={`/dashboard/reviews/${a.id}`}>View <ChevronRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
