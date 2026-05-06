import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/roles";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, User2, Calendar, Layers, TriangleAlert, Lock } from "lucide-react";
import { ReviewDetailClient, type CompetencyRating } from "./review-detail-client";
import { getAssignmentStatus } from "@/lib/status";
import { PageHeader } from "@/components/page-header";

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
  // Note: review_assignments has no workspace_id column — filter via cycle's workspace_id
  const { data: assignment } = await supabase
    .from("review_assignments")
    .select(`
      id, status, overall_rating, created_at, updated_at,
      employee_id, manager_id, assignment_type, reviewer_id, cycle_id,
      employee:users!review_assignments_employee_id_fkey(
        id, slack_name, job_title, department, avatar_url,
        level_id,
        level:levels(id, name, grade, job_family:job_families(name))
      ),
      manager:users!review_assignments_manager_id_fkey(id, slack_name),
      cycle:performance_cycles!inner(id, name, status, start_date, end_date)
    `)
    .eq("id", id)
    .eq("cycle.workspace_id", workspace.workspaceId)
    .single();

  if (!assignment) notFound();

  // Determine reviewer role and edit permission based on the assignment relationship
  const currentUserId = workspace.appUserId;
  const isAssignmentManager = assignment.manager_id === currentUserId;
  const isAssignmentEmployee = assignment.employee_id === currentUserId;
  const isWorkspaceManager = isManagerOrAbove(workspace.role) || !!workspace.hasDirectReports;
  const isUpwardReviewer =
    assignment.assignment_type === "upward" &&
    assignment.reviewer_id === currentUserId;

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

  type LevelJoin = { id: string; name: string; grade: string | null; job_family?: { name: string } | { name: string }[] | null };
  type EmployeeRow = {
    id: string;
    slack_name: string | null;
    job_title: string | null;
    department: string | null;
    avatar_url: string | null;
    level_id: string | null;
    level: LevelJoin | LevelJoin[] | null;
  };
  type CycleJoin = { id: string; name: string; status: string; start_date: string | null; end_date: string | null };
  type ManagerJoin = { id: string; slack_name: string | null };
  type LevelCompRow = {
    id: string;
    expected_level: number;
    behavioral_indicators: string[] | null;
    competency: { id: string; name: string; description: string | null; category: string | null; is_core: boolean } | { id: string; name: string; description: string | null; category: string | null; is_core: boolean }[] | null;
  };
  type CycleQuestionRow = {
    id: string;
    question_type: string;
    competency_id: string | null;
    prompt: string | null;
    sort_order: number;
    required: boolean | null;
    competency: { id: string; name: string; description: string | null; category: string | null } | { id: string; name: string; description: string | null; category: string | null }[] | null;
  };
  type ResponseRow = {
    id: string;
    competency_id: string | null;
    rating: number | null;
    comment: string | null;
    reviewer_id: string;
    reviewer_role: string;
  };

  const employee = assignment.employee as unknown as EmployeeRow;
  const levelId = employee?.level_id;

  // Fetch competencies from level OR cycle questions, plus existing responses
  const [levelCompsResult, cycleQuestionsResult, existingResponsesResult] = await Promise.all([
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

    // Also fetch cycle questions as fallback when no level competencies
    supabase
      .from("cycle_questions")
      .select(`
        id, question_type, competency_id, prompt, sort_order, required,
        competency:competencies(id, name, description, category)
      `)
      .eq("cycle_id", assignment.cycle_id)
      .order("sort_order"),

    supabase
      .from("review_responses")
      .select("id, competency_id, rating, comment, reviewer_id, reviewer_role")
      .eq("assignment_id", id),
  ]);

  const levelComps = (levelCompsResult.data || []) as unknown as LevelCompRow[];
  const cycleQuestions = (cycleQuestionsResult.data || []) as unknown as CycleQuestionRow[];
  const existingResponses = (existingResponsesResult.data || []) as ResponseRow[];

  // Build competency ratings — prefer level competencies, fall back to cycle questions
  let competencyRatings: CompetencyRating[];

  if (levelComps.length > 0) {
    // Use level competencies (existing behavior)
    competencyRatings = levelComps
      .filter((lc) => lc.competency)
      .map((lc) => {
        const comp = Array.isArray(lc.competency) ? lc.competency[0] : lc.competency!;
        const existing = existingResponses.find(
          (r) => r.competency_id === comp.id
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
  } else {
    // Fallback: use cycle questions with competencies
    const compQuestions = cycleQuestions.filter(
      (q) => q.question_type === "competency" && q.competency
    );
    competencyRatings = compQuestions.map((q) => {
      const comp = Array.isArray(q.competency) ? q.competency[0] : q.competency;
      const existing = existingResponses.find(
        (r) => r.competency_id === (comp?.id ?? null)
      );
      return {
        competencyId: comp?.id || q.competency_id || "",
        competencyName: comp?.name || "Unknown",
        competencyDescription: comp?.description || q.prompt || null,
        category: comp?.category || null,
        expectedLevel: null,
        behavioralIndicators: [],
        existingResponseId: existing?.id ?? null,
        currentRating: existing?.rating ?? null,
        currentComment: existing?.comment ?? null,
      };
    });
  }

  const level = (Array.isArray(employee?.level) ? employee?.level[0] : employee?.level) as LevelJoin | undefined;
  const cycle = assignment.cycle as unknown as CycleJoin | null;
  const manager = assignment.manager as unknown as ManagerJoin | null;
  const statusCfg = getAssignmentStatus(assignment.status);

  return (
    <div className="space-y-6">
      <PageHeader
        hat="my-team"
        title={employee?.slack_name || "Unknown employee"}
        subtitle={cycle?.name}
      />
      {/* Back + header */}
      <div>
        <Link
          href={
            from === "cycle" && cycleId
              ? `/dashboard/cycles/${cycleId}`
              : isAssignmentEmployee
              ? "/dashboard/performance"
              : "/dashboard/reviews"
          }
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {from === "cycle" && cycleId
            ? "Back to cycle"
            : isAssignmentEmployee
            ? "Back to Performance"
            : "Back to reviews"}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {employee?.slack_name || "Unknown employee"}
            </h2>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {level && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Layers className="h-3 w-3" />
                  {(Array.isArray(level.job_family) ? level.job_family[0]?.name : level.job_family?.name)} · {level.name}
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
                {assignment.overall_rating}/{workspace.ratingScale?.max || 5}
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
          {!levelId && competencyRatings.length === 0 && (
            <span className="text-muted-foreground">
              No competencies configured for this cycle
            </span>
          )}
        </div>
      </div>

      {/* Overdue cycle warning */}
      {cycle?.status === "active" && cycle.end_date && new Date(cycle.end_date) < new Date() && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/10 px-4 py-3 flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            This cycle&apos;s deadline has passed. Your submission may still be accepted.
          </p>
        </div>
      )}

      {/* Closed cycle notice */}
      {cycle?.status === "closed" && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            This cycle has been closed. Reviews can no longer be submitted.
          </p>
        </div>
      )}

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
          maxRating={workspace.ratingScale?.max || 5}
        />
      </div>
    </div>
  );
}
