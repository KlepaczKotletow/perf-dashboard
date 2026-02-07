import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClipboardCheck, Target, Star, FileText, ArrowRight } from "lucide-react";
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

  // 3. Get my goals
  const { data: goals } = await supabase
    .from("goals")
    .select(`
      *,
      cycle:performance_cycles!goals_cycle_id_fkey(name)
    `)
    .eq("employee_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  // 4. Get my level and competency expectations
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

  // 5. Slack-based reviews where I am the subject
  const { data: adHocReviews } = await supabase
    .from("review_cycles")
    .select(`
      id, status, due_date, created_at,
      creator:users!review_cycles_created_by_fkey(slack_name)
    `)
    .eq("employee_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Stats
  const completedAssignments = (myAssignments || []).filter((a: any) => a.status === "completed").length;
  const activeAssignments = (myAssignments || []).filter((a: any) => a.status !== "completed").length;
  const activeGoals = (goals || []).filter((g: any) => g.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your performance reviews, pending actions, and goals
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Completed", value: completedAssignments, icon: ClipboardCheck, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
          { label: "Pending", value: activeAssignments, icon: FileText, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
          { label: "Active Goals", value: activeGoals, icon: Target, color: "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-yellow-500" />
              Reviews You Need to Complete
            </CardTitle>
            <CardDescription>These employees are waiting for your review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingReviews.map((review: any) => (
                <div key={review.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{review.employee?.slack_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">
                      {review.employee?.job_title || "No title"} · {review.cycle?.name || "Unknown cycle"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-[11px] font-medium ${(statusConfig[review.status] || statusConfig.pending).badge}`}>
                      {(statusConfig[review.status] || statusConfig.pending).label}
                    </Badge>
                    <Button size="sm" asChild>
                      <Link href={`/dashboard/cycles/${review.cycle?.id}/review/${review.id}`}>
                        Submit Review <ArrowRight className="h-3 w-3 ml-1" />
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Cycle Reviews</CardTitle>
          <CardDescription>Reviews from structured performance cycles</CardDescription>
        </CardHeader>
        <CardContent>
          {(!myAssignments || myAssignments.length === 0) ? (
            <p className="text-center py-6 text-muted-foreground">
              No performance cycle reviews yet.
            </p>
          ) : (
            <div className="space-y-3">
              {myAssignments.map((assignment: any) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{assignment.cycle?.name || "Unknown Cycle"}</p>
                    <p className="text-sm text-muted-foreground">
                      Manager: {assignment.manager?.slack_name || "Unassigned"}
                      {assignment.cycle?.start_date && (
                        <> · {format(new Date(assignment.cycle.start_date), "MMM yyyy")}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {assignment.overall_rating && (
                      <span className="text-sm font-bold">{assignment.overall_rating}/5</span>
                    )}
                    <Badge className={`text-[11px] font-medium ${(statusConfig[assignment.status] || statusConfig.pending).badge}`}>
                      {(statusConfig[assignment.status] || statusConfig.pending).label}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ad-hoc 360 Reviews */}
      {adHocReviews && adHocReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">360 Feedback Reviews</CardTitle>
            <CardDescription>Initiated via Slack</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {adHocReviews.map((review: any) => (
                <div key={review.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Review by {review.creator?.slack_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(review.created_at), "MMM d, yyyy")}
                      {review.due_date && <> · Due: {format(new Date(review.due_date), "MMM d, yyyy")}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[11px] font-medium ${(statusConfig[review.status] || statusConfig.pending).badge}`}>
                      {(statusConfig[review.status] || statusConfig.pending).label}
                    </Badge>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/reviews/${review.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* My Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              My Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!goals || goals.length === 0) ? (
              <p className="text-center py-4 text-muted-foreground">No goals set yet.</p>
            ) : (
              <div className="space-y-3">
                {goals.map((goal: any) => (
                  <div key={goal.id} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{goal.title}</p>
                      <Badge variant={goal.status === "completed" ? "default" : "outline"} className="text-xs">
                        {goal.status}
                      </Badge>
                    </div>
                    <div className="mt-2 w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${goal.progress || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{goal.progress || 0}% complete</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competency Expectations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5" />
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
              <p className="text-center py-4 text-muted-foreground">
                {myUser?.level_id
                  ? "No competencies defined for your level yet."
                  : "Ask your admin to assign you a job level."}
              </p>
            ) : (
              <div className="space-y-2">
                {competencyExpectations.map((lc: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <p className="text-sm font-medium">{lc.competency?.name}</p>
                      {lc.competency?.category && (
                        <p className="text-xs text-muted-foreground">{lc.competency.category}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-4 w-4 ${
                            s <= lc.expected_level
                              ? "fill-yellow-400 text-yellow-400"
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
