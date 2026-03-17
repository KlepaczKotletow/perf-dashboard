import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ClipboardCheck,
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

export default async function MyReviewsPage() {
  const workspace = await getUserWorkspace();
  if (!workspace?.appUserId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please sign in to view your reviews.
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const userId = workspace.appUserId;

  // Fetch all three assignment types in parallel
  const [
    { data: myAssignments },
    { data: managerReviews },
    { data: upwardReviews },
  ] = await Promise.all([
    // 1. Reviews about me
    supabase
      .from("review_assignments")
      .select(`
        *,
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date, grades_released),
        manager:users!review_assignments_manager_id_fkey(slack_name)
      `)
      .eq("employee_id", userId)
      .eq("assignment_type", "standard")
      .order("created_at", { ascending: false }),

    // 2. Reviews I need to give as manager (exclude self-reviews where I'm both employee and manager)
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

    // 3. Upward feedback I need to give
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

  // 4. Check which of my assignments have self-review submitted
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

  // Enrich my assignments with smart status
  const enrichedAssignments = (myAssignments || []).map((a: any) => {
    const selfSubmitted = mySubmissions[a.id]?.has("self") || false;
    const gradesReleased = a.cycle?.grades_released || false;

    let smartStatus: { label: string; description: string; variant: string; icon: string };

    if (a.status === "pending" && !selfSubmitted) {
      smartStatus = {
        label: "Self-Review Required",
        description: "Complete your self-assessment to get started",
        variant: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
        icon: "alert",
      };
    } else if ((a.status === "in_progress" || a.status === "pending") && selfSubmitted) {
      smartStatus = {
        label: "Self-Review Submitted",
        description: "Waiting for your manager to complete their review",
        variant: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
        icon: "clock",
      };
    } else if (a.status === "completed" && !gradesReleased) {
      smartStatus = {
        label: "Review Complete",
        description: "Your review is complete. Results will be shared after calibration.",
        variant: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10",
        icon: "eyeoff",
      };
    } else if (a.status === "completed" && gradesReleased) {
      smartStatus = {
        label: "Results Available",
        description: "Your performance results have been released",
        variant: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
        icon: "check",
      };
    } else {
      smartStatus = {
        label: a.status === "in_progress" ? "In Progress" : a.status.charAt(0).toUpperCase() + a.status.slice(1),
        description: "",
        variant: "text-muted-foreground bg-muted",
        icon: "clock",
      };
    }

    return { ...a, selfSubmitted, gradesReleased, smartStatus };
  });

  // Sort: pending/active first, completed last
  const sortByCompletion = (a: any, b: any) => {
    const aComplete = a.status === "completed";
    const bComplete = b.status === "completed";
    if (aComplete === bComplete) return 0;
    return aComplete ? 1 : -1;
  };

  const sortedMyAssignments = [...enrichedAssignments].sort(sortByCompletion);
  const sortedManagerReviews = [...(managerReviews || [])].sort(sortByCompletion);
  const sortedUpwardReviews = [...(upwardReviews || [])].sort(sortByCompletion);

  const StatusIcon = ({ icon }: { icon: string }) => {
    switch (icon) {
      case "alert":   return <AlertCircle className="h-3.5 w-3.5" />;
      case "clock":   return <Clock className="h-3.5 w-3.5" />;
      case "eyeoff":  return <EyeOff className="h-3.5 w-3.5" />;
      case "check":   return <CheckCircle2 className="h-3.5 w-3.5" />;
      default:        return <Clock className="h-3.5 w-3.5" />;
    }
  };

  const hasMyAssignments = sortedMyAssignments.length > 0;
  const hasManagerReviews = sortedManagerReviews.length > 0;
  const hasUpwardReviews = sortedUpwardReviews.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your performance reviews and pending actions
        </p>
      </div>

      {/* ── My Performance ── */}
      {hasMyAssignments && (
        <Section
          icon={<FileText className="h-4 w-4" />}
          title="My Performance"
          description="Your self-assessments and review results"
        >
          {sortedMyAssignments.map((a: any, i: number) => {
            const isCompleted = a.status === "completed";
            const prevCompleted = i > 0 && sortedMyAssignments[i - 1].status === "completed";
            const showDivider = isCompleted && !prevCompleted && sortedMyAssignments.some((x: any) => x.status !== "completed");

            return (
              <div key={a.id}>
                {showDivider && <CompletedDivider />}
                <Card
                  className={`border-border/60 transition-all ${
                    isCompleted
                      ? "opacity-60"
                      : a.smartStatus.icon === "alert"
                      ? "border-amber-200/60 bg-amber-50/20 dark:border-amber-400/10 dark:bg-amber-400/[0.02]"
                      : ""
                  }`}
                >
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-medium text-foreground">
                            {a.cycle?.name || "Unknown Cycle"}
                          </h3>
                          <Badge className={`text-[10px] font-medium flex items-center gap-1 ${a.smartStatus.variant}`}>
                            <StatusIcon icon={a.smartStatus.icon} />
                            {a.smartStatus.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Reviewed by: {a.manager?.slack_name || "Unassigned"}
                        </p>
                        {a.smartStatus.description && (
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {a.smartStatus.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Self-review action */}
                        {!a.selfSubmitted && !isCompleted && (
                          <Button size="sm" className="text-xs h-8" asChild>
                            <Link href={`/dashboard/cycles/${a.cycle?.id}/review/${a.id}`}>
                              Start Self-Review <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        )}

                        {/* Rating + grade when released */}
                        {a.gradesReleased && isCompleted && (
                          <>
                            {a.overall_rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                <span className="text-sm font-bold text-foreground">
                                  {a.overall_rating}/5
                                </span>
                              </div>
                            )}
                            {a.final_grade && (
                              <Badge variant="outline" className="text-xs font-medium">
                                <Medal className="h-3 w-3 mr-1" />
                                {a.final_grade}
                              </Badge>
                            )}
                            <Button size="sm" variant="ghost" className="text-xs h-8" asChild>
                              <Link href={`/dashboard/reviews/${a.id}`}>
                                View <ChevronRight className="h-3 w-3 ml-1" />
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
          })}
        </Section>
      )}

      {/* ── Reviews to Give ── */}
      {hasManagerReviews && (
        <Section
          icon={<ClipboardCheck className="h-4 w-4" />}
          title="Reviews to Give"
          description="Manager reviews you need to complete for your team"
        >
          {sortedManagerReviews.map((review: any, i: number) => {
            const isDone = review.status === "completed";
            const prevDone = i > 0 && sortedManagerReviews[i - 1].status === "completed";
            const showDivider = isDone && !prevDone && sortedManagerReviews.some((x: any) => x.status !== "completed");

            return (
              <div key={review.id}>
                {showDivider && <CompletedDivider />}
                <Card
                  className={`border-border/60 transition-all ${
                    isDone
                      ? "opacity-60"
                      : ""
                  }`}
                >
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-primary">
                            {review.employee?.slack_name?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {review.employee?.slack_name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {review.employee?.job_title || "No title"} &middot; {review.cycle?.name || "Unknown cycle"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isDone ? (
                          <Badge className="text-[10px] text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {review.status === "in_progress" ? "In Progress" : "Pending"}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={isDone ? "ghost" : "default"}
                          className="text-xs h-8"
                          asChild
                        >
                          <Link href={`/dashboard/reviews/${review.id}`}>
                            {isDone ? "View" : "Review Now"}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </Section>
      )}

      {/* ── Upward Feedback ── */}
      {hasUpwardReviews && (
        <Section
          icon={<Users className="h-4 w-4" />}
          title="Upward Feedback"
          description="Feedback you're giving on your manager's leadership"
        >
          {sortedUpwardReviews.map((review: any, i: number) => {
            const isDone = review.status === "completed";
            const prevDone = i > 0 && sortedUpwardReviews[i - 1].status === "completed";
            const showDivider = isDone && !prevDone && sortedUpwardReviews.some((x: any) => x.status !== "completed");

            return (
              <div key={review.id}>
                {showDivider && <CompletedDivider />}
                <Card
                  className={`border-border/60 transition-all ${isDone ? "opacity-60" : ""}`}
                >
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-400/10 flex items-center justify-center shrink-0">
                          <Star className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            Feedback for {review.employee?.slack_name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {review.cycle?.name || "Unknown cycle"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isDone ? (
                          <>
                            <Badge className="text-[10px] text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Submitted
                            </Badge>
                            <Button size="sm" variant="ghost" className="text-xs h-8" asChild>
                              <Link href={`/dashboard/reviews/${review.id}`}>
                                View <ChevronRight className="h-3 w-3 ml-1" />
                              </Link>
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
          })}
        </Section>
      )}

      {/* All empty state */}
      {!hasMyAssignments && !hasManagerReviews && !hasUpwardReviews && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-foreground">Nothing here yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            You&apos;ll see your reviews, team assessments, and feedback requests here once a cycle is launched.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-1.5">{children}</div>
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
