import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClipboardCheck, Star, FileText, ArrowRight, MessageSquare } from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
  in_progress: { label: "In Progress", badge: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
  completed: { label: "Completed", badge: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
};

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
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date),
      manager:users!review_assignments_manager_id_fkey(slack_name)
    `)
    .eq("employee_id", userId)
    .order("created_at", { ascending: false });

  // 2. Get review assignments where I need to review someone else (pending reviews to give)
  const { data: pendingReviews } = await supabase
    .from("review_assignments")
    .select(`
      *,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status)
    `)
    .eq("manager_id", userId)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false });

  // 3. Get my level and competency expectations
  const { data: myUser } = await supabase
    .from("users")
    .select(`
      level_id,
      level:levels!users_level_id_fkey(name, grade, job_family:job_families(name))
    `)
    .eq("id", userId)
    .single();

  let competencyExpectations: any[] = [];
  if (myUser?.level_id) {
    const { data: levelComps } = await supabase
      .from("level_competencies")
      .select(`
        expected_level,
        competency:competencies!level_competencies_competency_id_fkey(name, category)
      `)
      .eq("level_id", myUser.level_id)
      .order("expected_level", { ascending: false });

    competencyExpectations = levelComps || [];
  }

  // 4. Get recent continuous feedback I received
  const { data: recentFeedback } = await supabase
    .from("continuous_feedback")
    .select(`
      id, message, feedback_type, is_anonymous, created_at,
      from_user:users!continuous_feedback_from_user_id_fkey(slack_name)
    `)
    .eq("to_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Stats
  const completedAssignments = (myAssignments || []).filter((a: any) => a.status === "completed").length;
  const activeAssignments = (myAssignments || []).filter((a: any) => a.status !== "completed").length;
  const pendingCount = (pendingReviews || []).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your performance reviews, pending actions, and competency expectations
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Completed", value: completedAssignments, icon: ClipboardCheck, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
          { label: "Pending", value: activeAssignments, icon: FileText, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
          { label: "To Review", value: pendingCount, icon: ArrowRight, color: "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
          { label: "Competencies", value: competencyExpectations.length, icon: Star, color: "text-primary bg-primary/[0.08]" },
        ].map((m) => (
          <Card key={m.label} className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
                  <p className="text-2xl font-semibold mt-1 text-foreground">{m.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${m.color}`}>
                  <m.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Reviews to Give (as manager) */}
      {pendingReviews && pendingReviews.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-500" />
              Reviews You Need to Complete
            </CardTitle>
            <CardDescription>These employees are waiting for your review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingReviews.map((review: any) => (
                <div key={review.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
                  <div>
                    <p className="text-sm font-medium text-foreground">{review.employee?.slack_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {review.employee?.job_title || "No title"} &middot; {review.cycle?.name || "Unknown cycle"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] font-medium ${(statusConfig[review.status] || statusConfig.pending).badge}`}>
                      {(statusConfig[review.status] || statusConfig.pending).label}
                    </Badge>
                    <Button size="sm" className="text-xs" asChild>
                      <Link href={`/dashboard/cycles/${review.cycle?.id}`}>
                        Review <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Performance Reviews (about me) */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance Cycle Reviews</CardTitle>
          <CardDescription>Reviews from structured performance cycles</CardDescription>
        </CardHeader>
        <CardContent>
          {(!myAssignments || myAssignments.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No reviews assigned yet. Your manager will assign reviews during a performance cycle.
            </p>
          ) : (
            <div className="space-y-2">
              {myAssignments.map((assignment: any) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
                  <div>
                    <p className="text-sm font-medium text-foreground">{assignment.cycle?.name || "Unknown Cycle"}</p>
                    <p className="text-xs text-muted-foreground">
                      Manager: {assignment.manager?.slack_name || "Unassigned"}
                      {assignment.cycle?.start_date && (
                        <> &middot; {format(new Date(assignment.cycle.start_date), "MMM yyyy")}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {assignment.overall_rating && (
                      <span className="text-sm font-semibold text-foreground">{assignment.overall_rating}/5</span>
                    )}
                    <Badge className={`text-[10px] font-medium ${(statusConfig[assignment.status] || statusConfig.pending).badge}`}>
                      {(statusConfig[assignment.status] || statusConfig.pending).label}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Feedback */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Recent Feedback
            </CardTitle>
            <CardDescription>Anytime feedback from colleagues</CardDescription>
          </CardHeader>
          <CardContent>
            {(!recentFeedback || recentFeedback.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No feedback received yet. Colleagues can send feedback via /feedback in Slack.
              </p>
            ) : (
              <div className="space-y-2">
                {recentFeedback.map((f: any) => (
                  <div key={f.id} className="p-3 rounded-lg border border-border/60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">
                        {f.is_anonymous ? "Anonymous" : f.from_user?.slack_name || "Unknown"}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{f.feedback_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{f.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competency Expectations */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              My Competency Expectations
            </CardTitle>
            <CardDescription>
              {myUser?.level ? (
                <>
                  Level: {(myUser.level as any)?.job_family?.name && `${(myUser.level as any).job_family.name} — `}
                  {(myUser.level as any)?.name}{(myUser.level as any)?.grade && ` (${(myUser.level as any).grade})`}
                </>
              ) : (
                "No level assigned yet"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {competencyExpectations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {myUser?.level_id
                  ? "No competencies defined for your level yet."
                  : "Ask your admin to assign you a job level."}
              </p>
            ) : (
              <div className="space-y-2">
                {competencyExpectations.map((lc: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-border/60">
                    <div>
                      <p className="text-sm font-medium text-foreground">{lc.competency?.name}</p>
                      {lc.competency?.category && (
                        <p className="text-[11px] text-muted-foreground">{lc.competency.category}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= lc.expected_level
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/20"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
