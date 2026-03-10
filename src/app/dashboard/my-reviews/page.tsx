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

export default async function MyReviewsPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const activeTab = searchParams.tab || "about-me";

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

  // 1. Reviews about me
  const { data: myAssignments } = await supabase
    .from("review_assignments")
    .select(`
      *,
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date, grades_released),
      manager:users!review_assignments_manager_id_fkey(slack_name)
    `)
    .eq("employee_id", userId)
    .eq("assignment_type", "standard")
    .order("created_at", { ascending: false });

  // 2. Reviews I need to give as manager (all statuses)
  const { data: managerReviews } = await supabase
    .from("review_assignments")
    .select(`
      *,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
    `)
    .eq("manager_id", userId)
    .eq("assignment_type", "standard")
    .order("created_at", { ascending: false });

  // 3. Upward feedback I need to give (all statuses)
  const { data: upwardReviews } = await supabase
    .from("review_assignments")
    .select(`
      *,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
    `)
    .eq("reviewer_id", userId)
    .eq("assignment_type", "upward")
    .order("created_at", { ascending: false });

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

  const allManagerReviews = managerReviews || [];
  const allUpwardReviews = upwardReviews || [];

  // Pending counts for tab badges
  const aboutMePendingCount = enrichedAssignments.filter(
    (a: any) => !a.selfSubmitted && a.status !== "completed"
  ).length;
  const reviewingPendingCount = allManagerReviews.filter(
    (r: any) => r.status !== "completed"
  ).length;
  const upwardPendingCount = allUpwardReviews.filter(
    (r: any) => r.status !== "completed"
  ).length;

  const StatusIcon = ({ icon }: { icon: string }) => {
    switch (icon) {
      case "alert":   return <AlertCircle className="h-3.5 w-3.5" />;
      case "clock":   return <Clock className="h-3.5 w-3.5" />;
      case "eyeoff":  return <EyeOff className="h-3.5 w-3.5" />;
      case "check":   return <CheckCircle2 className="h-3.5 w-3.5" />;
      default:        return <Clock className="h-3.5 w-3.5" />;
    }
  };

  const tabs = [
    { id: "about-me",  label: "About Me",        pendingCount: aboutMePendingCount,  totalCount: enrichedAssignments.length },
    { id: "reviewing", label: "I'm Reviewing",    pendingCount: reviewingPendingCount, totalCount: allManagerReviews.length },
    { id: "upward",    label: "Upward Feedback",  pendingCount: upwardPendingCount,   totalCount: allUpwardReviews.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your performance reviews and pending actions
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <Link
                key={t.id}
                href={`?tab=${t.id}`}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
                }`}
              >
                {t.label}
                {t.totalCount > 0 && (
                  <span
                    className={`inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full text-[10px] font-semibold ${
                      t.pendingCount > 0
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.pendingCount > 0 ? t.pendingCount : t.totalCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Tab: About Me ── */}
      {activeTab === "about-me" && (
        <div className="space-y-3">
          {enrichedAssignments.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-muted-foreground/40" />}
              title="No reviews yet"
              description="You'll appear here once your manager assigns you to a performance cycle."
            />
          ) : (
            enrichedAssignments.map((a: any) => (
              <Card key={a.id} className={`border-border/60 transition-all ${
                a.smartStatus.icon === "check"
                  ? "border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-400/10 dark:bg-emerald-400/[0.02]"
                  : a.smartStatus.icon === "alert"
                  ? "border-amber-200/60 bg-amber-50/20 dark:border-amber-400/10 dark:bg-amber-400/[0.02]"
                  : ""
              }`}>
                <CardContent className="p-4">
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
                      {!a.selfSubmitted && a.status !== "completed" && (
                        <Button size="sm" className="text-xs h-8" asChild>
                          <Link href={`/dashboard/cycles/${a.cycle?.id}/review/${a.id}`}>
                            Start Self-Review <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      )}

                      {/* Rating + grade when released */}
                      {a.gradesReleased && a.status === "completed" && (
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
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Tab: I'm Reviewing ── */}
      {activeTab === "reviewing" && (
        <div className="space-y-3">
          {allManagerReviews.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-8 w-8 text-muted-foreground/40" />}
              title="No reviews to give"
              description="You'll appear here when you're assigned to review someone in your team."
            />
          ) : (
            allManagerReviews.map((review: any) => {
              const isDone = review.status === "completed";
              return (
                <Card key={review.id} className={`border-border/60 ${
                  isDone
                    ? "border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-400/10 dark:bg-emerald-400/[0.02]"
                    : ""
                }`}>
                  <CardContent className="p-4">
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
              );
            })
          )}
        </div>
      )}

      {/* ── Tab: Upward Feedback ── */}
      {activeTab === "upward" && (
        <div className="space-y-3">
          {allUpwardReviews.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8 text-muted-foreground/40" />}
              title="No upward feedback requests"
              description="When your manager is included in a cycle with upward feedback enabled, you'll see it here."
            />
          ) : (
            allUpwardReviews.map((review: any) => {
              const isDone = review.status === "completed";
              return (
                <Card key={review.id} className={`border-border/60 ${
                  isDone
                    ? "border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-400/10 dark:bg-emerald-400/[0.02]"
                    : ""
                }`}>
                  <CardContent className="p-4">
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
                          <Badge className="text-[10px] text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Submitted
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {review.status === "in_progress" ? "In Progress" : "Pending"}
                          </Badge>
                        )}
                        {!isDone && (
                          <Button size="sm" className="text-xs h-8" asChild>
                            <Link href={`/dashboard/cycles/${review.cycle?.id}/review/${review.id}`}>
                              Give Feedback <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
    </div>
  );
}
