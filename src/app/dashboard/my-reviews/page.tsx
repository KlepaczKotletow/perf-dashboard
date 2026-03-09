import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClipboardCheck, Star, FileText, ArrowRight, Clock, CheckCircle2, AlertCircle, Eye, EyeOff, Medal } from "lucide-react";

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

  // 1. Get review assignments where I am the employee (reviews about me)
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

  // 2. Get review assignments where I need to review someone else (as manager)
  const { data: managerReviews } = await supabase
    .from("review_assignments")
    .select(`
      *,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
    `)
    .eq("manager_id", userId)
    .eq("assignment_type", "standard")
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false });

  // 3. Get upward review assignments where I need to review my manager
  const { data: upwardReviews } = await supabase
    .from("review_assignments")
    .select(`
      *,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
    `)
    .eq("reviewer_id", userId)
    .eq("assignment_type", "upward")
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false });

  // 4. Check which of my assignments I've submitted self-reviews for
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

  // Build smart status for each of my assignments
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

    return {
      ...a,
      selfSubmitted,
      gradesReleased,
      smartStatus,
    };
  });

  // Separate action-required items
  const actionRequired = enrichedAssignments.filter(
    (a: any) => !a.selfSubmitted && a.status !== "completed"
  );
  const allManagerReviews = managerReviews || [];
  const allUpwardReviews = upwardReviews || [];
  const hasActions = actionRequired.length > 0 || allManagerReviews.length > 0 || allUpwardReviews.length > 0;

  const StatusIcon = ({ icon }: { icon: string }) => {
    switch (icon) {
      case "alert":
        return <AlertCircle className="h-4 w-4" />;
      case "clock":
        return <Clock className="h-4 w-4" />;
      case "eyeoff":
        return <EyeOff className="h-4 w-4" />;
      case "check":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your performance reviews and pending actions
        </p>
      </div>

      {/* Action Required Section */}
      {hasActions && (
        <Card className="border-amber-200/60 bg-amber-50/30 dark:border-amber-400/10 dark:bg-amber-400/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Action Required
            </CardTitle>
            <CardDescription>
              {actionRequired.length + allManagerReviews.length + allUpwardReviews.length} item{actionRequired.length + allManagerReviews.length + allUpwardReviews.length !== 1 ? "s" : ""} need your attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Self-reviews needed */}
              {actionRequired.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-medium text-foreground">Submit Self-Review</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                      {a.cycle?.name || "Unknown cycle"}
                    </p>
                  </div>
                  <Button size="sm" className="text-xs" asChild>
                    <Link href={`/dashboard/cycles/${a.cycle?.id}/review/${a.id}`}>
                      Start <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}

              {/* Manager reviews needed */}
              {allManagerReviews.map((review: any) => (
                <div key={review.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-sky-500" />
                      <p className="text-sm font-medium text-foreground">
                        Review {review.employee?.slack_name || "Unknown"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                      {review.employee?.job_title || "No title"} &middot; {review.cycle?.name || "Unknown cycle"}
                    </p>
                  </div>
                  <Button size="sm" className="text-xs" asChild>
                    <Link href={`/dashboard/reviews/${review.id}`}>
                      Review <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}

              {/* Upward reviews needed */}
              {allUpwardReviews.map((review: any) => (
                <div key={review.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-violet-500" />
                      <p className="text-sm font-medium text-foreground">
                        Upward Feedback for {review.employee?.slack_name || "Unknown"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                      {review.cycle?.name || "Unknown cycle"}
                    </p>
                  </div>
                  <Button size="sm" className="text-xs" asChild>
                    <Link href={`/dashboard/cycles/${review.cycle?.id}/review/${review.id}`}>
                      Review <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Performance Reviews (about me) */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">My Performance Reviews</CardTitle>
          <CardDescription>Reviews from structured performance cycles</CardDescription>
        </CardHeader>
        <CardContent>
          {enrichedAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No reviews assigned yet. Your manager will assign reviews during a performance cycle.
            </p>
          ) : (
            <div className="space-y-3">
              {enrichedAssignments.map((a: any) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-xl border transition-all ${
                    a.smartStatus.icon === "check"
                      ? "border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-400/10 dark:bg-emerald-400/[0.02]"
                      : "border-border/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-foreground">
                          {a.cycle?.name || "Unknown Cycle"}
                        </h3>
                        <Badge className={`text-[10px] font-medium ${a.smartStatus.variant}`}>
                          <StatusIcon icon={a.smartStatus.icon} />
                          <span className="ml-1">{a.smartStatus.label}</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Manager: {a.manager?.slack_name || "Unassigned"}
                      </p>
                      {a.smartStatus.description && (
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          {a.smartStatus.description}
                        </p>
                      )}
                    </div>

                    {/* Show rating + grade only when grades are released */}
                    {a.gradesReleased && a.status === "completed" && (
                      <div className="flex items-center gap-3 shrink-0">
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
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
