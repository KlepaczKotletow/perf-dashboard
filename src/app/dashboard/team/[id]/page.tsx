import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { ArrowLeft, Star, FileText, MessageSquare, Mail, Pencil } from "lucide-react";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove } from "@/lib/roles";
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

  // Get reviews where they are the employee
  const { data: reviewsAsEmployee } = await supabase
    .from("review_cycles")
    .select(`
      id,
      status,
      start_date,
      due_date,
      created_at,
      creator:users!review_cycles_created_by_fkey(slack_name)
    `)
    .eq("employee_id", id)
    .order("created_at", { ascending: false });

  // Get feedback they received via their review cycles
  const reviewIds = reviewsAsEmployee?.map(r => r.id) || [];
  let feedbackReceived: any[] = [];
  if (reviewIds.length > 0) {
    const { data } = await supabase
      .from("feedback")
      .select(`
        id,
        question_id,
        question_text,
        response,
        rating,
        created_at,
        participant:participants!feedback_participant_id_fkey(
          reviewer:users!participants_reviewer_id_fkey(slack_name)
        )
      `)
      .in("review_cycle_id", reviewIds)
      .order("created_at", { ascending: false })
      .limit(20);
    feedbackReceived = data || [];
  }

  // Get direct reports
  const { data: directReports } = await supabase
    .from("users")
    .select("id, slack_name, job_title")
    .eq("manager_id", id)
    .order("slack_name");

  // Get continuous feedback received
  const { data: continuousFeedbackReceived } = await supabase
    .from("continuous_feedback")
    .select(`
      id,
      message,
      feedback_type,
      is_anonymous,
      created_at,
      from_user:users!continuous_feedback_from_user_id_fkey(slack_name)
    `)
    .eq("to_user_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Calculate average ratings per skill from feedback
  const ratingsBySkill: Record<string, { name: string; ratings: number[] }> = {};
  feedbackReceived.forEach((f: any) => {
    if (f.rating && f.question_text) {
      if (!ratingsBySkill[f.question_id]) {
        ratingsBySkill[f.question_id] = { name: f.question_text, ratings: [] };
      }
      ratingsBySkill[f.question_id].ratings.push(f.rating);
    }
  });

  const skillAverages = Object.values(ratingsBySkill).map(s => ({
    name: s.name,
    avg: (s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length).toFixed(1),
    count: s.ratings.length,
  }));

  const allRatings = feedbackReceived.filter((f: any) => f.rating).map((f: any) => f.rating as number);
  const overallAvg = allRatings.length > 0
    ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
    : null;

  return {
    user,
    reviewsAsEmployee: reviewsAsEmployee || [],
    feedbackReceived,
    continuousFeedbackReceived: continuousFeedbackReceived || [],
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

  const { user, reviewsAsEmployee, feedbackReceived, continuousFeedbackReceived, directReports, skillAverages, overallAvg } = data;
  const canEdit = isHROrAbove(workspace?.role);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      completed: "secondary",
      pending: "outline",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-6">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-20 w-20">
          <AvatarFallback className="text-2xl">{getInitials(user.slack_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              {user.slack_name || "Unknown"}
            </h1>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/team/${id}/edit`}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit Profile
                </Link>
              </Button>
            )}
          </div>
          {user.job_title && (
            <p className="text-lg text-muted-foreground">{user.job_title}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-600 dark:text-slate-400">
            {user.slack_email && (
              <span className="flex items-center gap-1 text-sm">
                <Mail className="h-4 w-4" />
                {user.slack_email}
              </span>
            )}
            <Badge variant="outline">{user.role || "user"}</Badge>
            {user.department && <Badge variant="secondary">{user.department}</Badge>}
            {user.level && (
              <Badge variant="secondary">
                {user.level.name}{user.level.grade ? ` (${user.level.grade})` : ""}
              </Badge>
            )}
            {user.manager?.slack_name && (
              <span className="text-sm">
                Reports to{" "}
                <Link href={`/dashboard/team/${user.manager.id}`} className="text-primary hover:underline">
                  {user.manager.slack_name}
                </Link>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overallAvg ? `${overallAvg}/5` : "N/A"}
            </div>
          </CardContent>
        </Card>
        {skillAverages.slice(0, 3).map((skill) => (
          <Card key={skill.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium truncate">{skill.name}</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{skill.avg}/5</div>
              <p className="text-xs text-muted-foreground">{skill.count} ratings</p>
            </CardContent>
          </Card>
        ))}
        {skillAverages.length === 0 && (
          <>
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground text-sm">No skill data yet</CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground text-sm">No skill data yet</CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground text-sm">No skill data yet</CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Direct Reports */}
      {directReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Direct Reports ({directReports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {directReports.map((report: any) => (
                <Link
                  key={report.id}
                  href={`/dashboard/team/${report.id}`}
                  className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{getInitials(report.slack_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-sm font-medium">{report.slack_name}</span>
                    {report.job_title && (
                      <span className="block text-xs text-muted-foreground">{report.job_title}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Review History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Review History
            </CardTitle>
            <CardDescription>360 reviews for this employee</CardDescription>
          </CardHeader>
          <CardContent>
            {reviewsAsEmployee.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {reviewsAsEmployee.map((review: any) => (
                  <div key={review.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">
                        Created by {review.creator?.slack_name || "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(review.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(review.status)}
                      <Link href={`/dashboard/reviews/${review.id}`} className="text-blue-600 text-sm hover:underline">
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Recent Feedback
            </CardTitle>
            <CardDescription>Latest feedback received</CardDescription>
          </CardHeader>
          <CardContent>
            {feedbackReceived.length === 0 && continuousFeedbackReceived.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No feedback yet</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {feedbackReceived.slice(0, 5).map((f: any) => (
                  <div key={f.id} className="border-b border-slate-200 dark:border-slate-800 pb-3 last:border-0">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium">{f.participant?.reviewer?.slack_name || "Anonymous"}</p>
                      <p className="text-xs text-slate-500">
                        {f.created_at ? format(new Date(f.created_at), "MMM d, yyyy") : "-"}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{f.question_text}</p>
                    {f.rating ? (
                      <span className="inline-block mt-1 bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                        Rating: {f.rating}/5
                      </span>
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{f.response}</p>
                    )}
                  </div>
                ))}
                {continuousFeedbackReceived.slice(0, 5).map((f: any) => (
                  <div key={f.id} className="border-b border-slate-200 dark:border-slate-800 pb-3 last:border-0">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium">
                        {f.is_anonymous ? "Anonymous" : f.from_user?.slack_name || "Unknown"}
                      </p>
                      <Badge variant="outline" className="text-xs">{f.feedback_type}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{f.message}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {format(new Date(f.created_at), "MMM d, yyyy")}
                    </p>
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
