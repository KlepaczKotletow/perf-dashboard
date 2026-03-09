import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { ArrowLeft, Mail, Pencil } from "lucide-react";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
import { notFound } from "next/navigation";
import { ProfileTabs } from "./profile-tabs";

async function getEmployeeDetails(id: string) {
  const supabase = await createServerSupabaseClient();

  // Get user info — fetch manager separately to avoid PostgREST 400:
  // combining a self-referential join (manager:users!...) with a deeply
  // nested join (level → job_families) in one query causes PostgREST to
  // reject the entire request with a 400 error.
  const { data: user, error } = await supabase
    .from("users")
    .select(`
      *,
      level:levels!users_level_id_fkey(name, grade, job_family:job_families(name))
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !user) return null;

  // Fetch manager separately (avoids the PostgREST 400 bug above)
  let manager: { id: string; slack_name: string } | null = null;
  if (user.manager_id) {
    const { data: managerData } = await supabase
      .from("users")
      .select("id, slack_name")
      .eq("id", user.manager_id)
      .maybeSingle();
    manager = managerData;
  }

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

  // Get goals for this employee
  const { data: goals } = await supabase
    .from("goals")
    .select("id, title, description, status, progress, weight, metric_start, metric_current, metric_target, metric_unit, tracking_status, scope, due_date")
    .eq("employee_id", id)
    .order("created_at", { ascending: false });

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
    manager,
    reviewAssignments: reviewAssignments || [],
    continuousFeedback: continuousFeedback || [],
    directReports: directReports || [],
    skillAverages,
    overallAvg,
    goals: goals || [],
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

  const { user, manager, reviewAssignments, continuousFeedback, directReports, skillAverages, overallAvg, goals } = data;
  const canEdit = isHROrAbove(workspace?.role);
  const canSeeAllRatings = isManagerOrAbove(workspace?.role);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
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
            {manager?.slack_name && (
              <span className="text-xs text-muted-foreground">
                Reports to{" "}
                <Link href={`/dashboard/team/${manager.id}`} className="text-primary hover:underline">
                  {manager.slack_name}
                </Link>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <ProfileTabs
        reviewAssignments={reviewAssignments}
        continuousFeedback={continuousFeedback}
        directReports={directReports}
        skillAverages={skillAverages}
        overallAvg={overallAvg}
        goals={goals}
        canSeeAllRatings={canSeeAllRatings}
      />
    </div>
  );
}
