import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/roles";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, User2, Calendar, Layers } from "lucide-react";
import { ReviewDetailClient, type CompetencyRating } from "./review-detail-client";
import { getAssignmentStatus } from "@/lib/status";

export default async function ReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; cycleId?: string }>;
}) {
  const { id } = await params;
  const { from, cycleId } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const workspace = await getUserWorkspace();

  if (!workspace?.workspaceId || !workspace?.appUserId) notFound();

  // Fetch the review assignment with full relations
  const { data: assignment } = await supabase
    .from("review_assignments")
    .select(`
      id, status, overall_rating, created_at, updated_at,
      employee_id, manager_id, assignment_type, reviewer_id,
      employee:users!review_assignments_employee_id_fkey(
        id, slack_name, job_title, department, avatar_url,
        level_id,
        level:levels(id, name, grade, job_family:job_families(name))
      ),
      manager:users!review_assignments_manager_id_fkey(id, slack_name),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date)
    `)
    .eq("id", id)
    .eq("workspace_id", workspace.workspaceId)
    .single();

  // Determine reviewer role and edit permission based on the assignment relationship
  const currentUserId = workspace.appUserId;
  const isAssignmentManager = (assignment as any)?.manager_id === currentUserId;
  const isAssignmentEmployee = (assignment as any)?.employee_id === currentUserId;
  const isWorkspaceManager = isManagerOrAbove(workspace.role as any);
  const isUpwardReviewer =
    (assignment as any)?.assignment_type === "upward" &&
    (assignment as any)?.reviewer_id === currentUserId;

  // Can edit if: you are the upward reviewer, the assigned manager, or an HR/admin-level role
  const canEdit =
    isUpwardReviewer ||
    isAssignmentManager ||
    (isWorkspaceManager && !isAssignmentEmployee);

  // Role used when saving responses
  const reviewerRole: "self" | "manager" | "upward" =
    isUpwardReviewer
      ? "upward"
      : isAssignmentEmployee
      ? "self"
      : "manager";

  if (!assignment) notFound();

  const employee = assignment.employee as any;
  const levelId = employee?.level_id;

  // Fetch competencies expected for this employee's level
  const [levelCompsResult, existingResponsesResult] = await Promise.all([
    levelId
      ? supabase
          .from("level_competencies")
          .select(`
            id, expected_level, behavioral_indicators,
            competency:competencies(id, name, description, category, is_core)
          `)
          .eq("level_id", levelId)
          .eq("workspace_id", workspace.workspaceId)
          .order("expected_level", { ascending: false })
      : Promise.resolve({ data: [] }),

    supabase
      .from("review_responses")
      .select("id, competency_id, rating, comment, reviewer_id, reviewer_role")
      .eq("assignment_id", id),
  ]);

  const levelComps = levelCompsResult.data || [];
  const existingResponses = existingResponsesResult.data || [];

  // Build competency ratings array
  const competencyRatings: CompetencyRating[] = levelComps
    .filter((lc: any) => lc.competency)
    .map((lc: any) => {
      const comp = lc.competency;
      const existing = existingResponses.find(
        (r: any) => r.competency_id === comp.id
      );
      return {
        competencyId: comp.id,
        competencyName: comp.name,
        competencyDescription: comp.description,
        category: comp.category,
        expectedLevel: lc.expected_level,
        behavioralIndicators: Array.isArray(lc.behavioral_indicators) ? lc.behavioral_indicators : [],
        existingResponseId: existing?.id ?? null,
        currentRating: existing?.rating ?? null,
        currentComment: existing?.comment ?? null,
      };
    });

  const level = employee?.level as any;
  const cycle = assignment.cycle as any;
  const manager = assignment.manager as any;
  const statusCfg = getAssignmentStatus(assignment.status);

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href={
            from === "cycle" && cycleId
              ? `/dashboard/cycles/${cycleId}`
              : isAssignmentEmployee
              ? "/dashboard/my-reviews"
              : "/dashboard/reviews"
          }
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {from === "cycle" && cycleId
            ? "Back to cycle"
            : isAssignmentEmployee
            ? "Back to my reviews"
            : "Back to reviews"}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {employee?.slack_name || "Unknown employee"}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {level && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Layers className="h-3 w-3" />
                  {level.job_family?.name} · {level.name}
                  {level.grade && ` (${level.grade})`}
                </span>
              )}
              {employee?.department && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User2 className="h-3 w-3" />
                  {employee.department}
                </span>
              )}
              {cycle && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {cycle.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={`text-xs font-medium ${statusCfg.badge}`}>
              {statusCfg.label}
            </Badge>
            {assignment.overall_rating && (
              <Badge variant="outline" className="text-xs font-semibold">
                {assignment.overall_rating}/5
              </Badge>
            )}
          </div>
        </div>

        {/* Meta strip */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground border-t border-border/60 pt-3">
          <span>Reviewer: <span className="font-medium text-foreground">{manager?.slack_name || "—"}</span></span>
          {cycle?.start_date && (
            <span>
              Cycle: {format(new Date(cycle.start_date), "MMM d")}
              {cycle.end_date && ` → ${format(new Date(cycle.end_date), "MMM d, yyyy")}`}
            </span>
          )}
          {!levelId && (
            <span className="text-amber-600 font-medium">
              ⚠ No job level assigned — competencies cannot be loaded
            </span>
          )}
        </div>
      </div>

      {/* Competency ratings section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Competency Ratings</h2>
          {levelId && competencyRatings.length > 0 && (
            <Link
              href="/dashboard/competencies"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              View framework →
            </Link>
          )}
        </div>

        <ReviewDetailClient
          assignmentId={assignment.id}
          workspaceId={workspace.workspaceId}
          reviewerId={workspace.appUserId}
          reviewerRole={reviewerRole}
          competencyRatings={competencyRatings}
          existingOverallRating={assignment.overall_rating}
          canEdit={canEdit}
          status={assignment.status}
        />
      </div>
    </div>
  );
}
