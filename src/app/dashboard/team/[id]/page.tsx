import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { ArrowLeft, Star, FileText, MessageSquare, Mail, Pencil } from "lucide-react";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
import { format } from "date-fns";
import { notFound } from "next/navigation";

async function getEmployeeDetails(id: string) {
  const supabase = await createServerSupabaseClient();

  // Get user info with org hierarchy
  const { data: user, error } = await supabase
    .from("users")
    .select(`
      *,
      manager:users!users_manager_id_fkey(id, slack_name),
      level:levels!users_level_id_fkey(name, grade, job_family:job_families(name))
    `)
    .eq("id", id)
    .single();

  if (error || !user) return null;

  // Get review assignments where this person is the employee
  const { data: reviewAssignments } = await supabase
    .from("review_assignments")
    .select(`
      id, status, overall_rating, final_grade, created_at, updated_at,
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date, grades_released),
      manager:users!review_assignments_manager_id_fkey(slack_name)
    `)
    .eq("employee_id", id)
    .order("created_at", { ascending: false });

  // Get review responses for this employee's assignments (to calculate skill averages)
  const assignmentIds = (reviewAssignments || []).map((a: any) => a.id);
  let reviewResponses: any[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("review_responses")
      .select(`
        id, rating, comment, reviewer_role,
        competency:competencies!review_responses_competency_id_fkey(name, category)
      `)
      .in("assignment_id", assignmentIds);
    reviewResponses = data || [];
  }

  // Get continuous feedback received
  const { data: continuousFeedback } = await supabase
    .from("continuous_feedback")
    .select(`
      id, message, feedback_type, is_anonymous, created_at,
      from_user:users!continuous_feedback_from_user_id_fkey(slack_name)
    `)
    .eq("to_user_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Get direct reports
  const { data: directReports } = await supabase
    .from("users")
    .select("id, slack_name, job_title")
    .eq("manager_id", id)
    .order("slack_name");

  // Calculate skill averages from review responses
  const ratingsBySkill: Record<string, { name: string; category: string | null; ratings: number[] }> = {};
  reviewResponses.forEach((r: any) => {
    if (r.rating && r.competency?.name) {
      const key = r.competency.name;
      if (!ratingsBySkill[key]) {
        ratingsBySkill[key] = { name: r.competency.name, category: r.competency.category, ratings: [] };
      }
      ratingsBySkill[key].ratings.push(r.rating);
    }
  });

  const skillAverages = Object.values(ratingsBySkill).map((s) => ({
    name: s.name,
    category: s.category,
    avg: (s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length).toFixed(1),
    count: s.ratings.length,
  }));

  const allRatings = reviewResponses.filter((r: any) => r.rating).map((r: any) => r.rating as number);
  const overallAvg = allRatings.length > 0
    ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
    : null;

  return {
    user,
    reviewAssignments: reviewAssignments || [],
    continuousFeedback: continuousFeedback || [],
    directReports: directReports || [],
    skillAverages,
    overallAvg,
  };
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getUserWorkspace();
  const data = await getEmployeeDetails(id);

  if (!data) {
    notFound();
  }

  const { user, reviewAssignments, continuousFeedback, directReports, skillAverages, overallAvg } = data;
  const canEdit = isHROrAbove(workspace?.role);
  const canSeeAllRatings = isManagerOrAbove(workspace?.role);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const statusConfig: Record<string, { label: string; badge: string }> = {
    pending: { label: "Pending", badge: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
    in_progress: { label: "In Progress", badge: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
    completed: { label: "Completed", badge: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
  };

  const feedbackTypeBadge: Record<string, string> = {
    praise: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    constructive: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    general: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-5">
        <Button variant="ghost" size="icon" className="shrink-0 mt-1" asChild>
          <Link href="/dashboard/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-16 w-16 shrink-0">
          <AvatarFallback className="text-xl bg-primary/[0.08] text-primary font-medium">
            {getInitials(user.slack_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">
              {user.slack_name || "Unknown"}
            </h1>
            {canEdit && (
              <Button variant="outline" size="sm" className="text-xs shrink-0" asChild>
                <Link href={`/dashboard/team/${id}/edit`}>
                  <Pencil className="h-3 w-3 mr-1.5" />
                  Edit
                </Link>
              </Button>
            )}
          </div>
          {user.job_title && (
            <p className="text-sm text-muted-foreground mt-0.5">{user.job_title}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {user.slack_email && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                {user.slack_email}
              </span>
            )}
            <Badge variant="outline" className="text-[10px]">{user.role || "user"}</Badge>
            {user.department && <Badge variant="secondary" className="text-[10px]">{user.department}</Badge>}
            {user.level && (
              <Badge variant="secondary" className="text-[10px]">
                {(user.level as any)?.job_family?.name ? `${(user.level as any).job_family.name} — ` : ""}
                {(user.level as any)?.name}
                {(user.level as any)?.grade ? ` (${(user.level as any).grade})` : ""}
              </Badge>
            )}
            {user.manager?.slack_name && (
              <span className="text-xs text-muted-foreground">
                Reports to{" "}
                <Link href={`/dashboard/team/${user.manager.id}`} className="text-primary hover:underline">
                  {user.manager.slack_name}
                </Link>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overall Rating</p>
                <p className="text-2xl font-semibold mt-1 text-foreground">{canSeeAllRatings && overallAvg ? `${overallAvg}/5` : "N/A"}</p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10">
                <Star className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reviews</p>
                <p className="text-2xl font-semibold mt-1 text-foreground">{reviewAssignments.length}</p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-primary bg-primary/[0.08]">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Feedback</p>
                <p className="text-2xl font-semibold mt-1 text-foreground">{continuousFeedback.length}</p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Competencies</p>
                <p className="text-2xl font-semibold mt-1 text-foreground">{skillAverages.length}</p>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10">
                <Star className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Direct Reports */}
      {directReports.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Direct Reports ({directReports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {directReports.map((report: any) => (
                <Link
                  key={report.id}
                  href={`/dashboard/team/${report.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border hover:shadow-sm transition-all text-sm"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-primary/[0.08] text-primary">
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
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Review History */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Performance Reviews
            </CardTitle>
            <CardDescription>From structured performance cycles</CardDescription>
          </CardHeader>
          <CardContent>
            {reviewAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No reviews assigned yet. Reviews appear when a cycle is launched.
              </p>
            ) : (
              <div className="space-y-2">
                {reviewAssignments.map((a: any) => {
                  const config = statusConfig[a.status] || statusConfig.pending;
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {a.cycle?.name || "Unknown Cycle"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Manager: {a.manager?.slack_name || "Unassigned"}
                          {a.cycle?.start_date && (
                            <> &middot; {format(new Date(a.cycle.start_date), "MMM yyyy")}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.overall_rating && (canSeeAllRatings || a.cycle?.grades_released) && (
                          <span className="text-sm font-semibold text-foreground">{a.overall_rating}/5</span>
                        )}
                        {a.final_grade && (canSeeAllRatings || a.cycle?.grades_released) && (
                          <Badge variant="outline" className="text-[10px] font-medium">{a.final_grade}</Badge>
                        )}
                        <Badge className={`text-[10px] font-medium ${config.badge}`}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Continuous Feedback */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Recent Feedback
            </CardTitle>
            <CardDescription>Anytime feedback from colleagues</CardDescription>
          </CardHeader>
          <CardContent>
            {continuousFeedback.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No feedback received yet. Feedback is sent via /feedback in Slack.
              </p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {continuousFeedback.map((f: any) => (
                  <div key={f.id} className="p-3 rounded-lg border border-border/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground">
                        {f.is_anonymous ? "Anonymous" : f.from_user?.slack_name || "Unknown"}
                      </span>
                      <Badge className={`text-[10px] ${feedbackTypeBadge[f.feedback_type] || feedbackTypeBadge.general}`}>
                        {f.feedback_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{f.message}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                      {format(new Date(f.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Competency Ratings — only visible to managers+ */}
      {canSeeAllRatings && skillAverages.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Competency Ratings
            </CardTitle>
            <CardDescription>Aggregated from all review responses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {skillAverages.map((skill) => (
                <div key={skill.name} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{skill.name}</p>
                    {skill.category && (
                      <p className="text-[11px] text-muted-foreground">{skill.category}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= Math.round(parseFloat(skill.avg))
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/20"
                        }`}
                      />
                    ))}
                    <span className="text-xs font-medium text-foreground ml-1">{skill.avg}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
