import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserWorkspace } from "@/lib/supabase-server";
import { assertCanReview } from "@/lib/review-access";
import { getReviewEvidence, EMPTY_REVIEW_EVIDENCE } from "@/lib/review-evidence";
import { EvidenceRail } from "./evidence-rail";
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

  const currentUserId = workspace.appUserId;
  const isAssignmentEmployee = assignment.employee_id === currentUserId;

  // Everything `assertCanReview` needs that isn't already on the assignment.
  // Both are cheap, and both are required before we can honestly tell the
  // reviewer whether this form will accept a submission — the database's INSERT
  // policy enforces the phase lock regardless, so a form that ignores it just
  // fails at save time instead of saying so up front.
  const [{ data: activePhases }, { data: mySubmissions }] = await Promise.all([
    supabase
      .from("cycle_phases")
      .select("phase_type")
      .eq("cycle_id", assignment.cycle_id)
      .eq("status", "active"),
    supabase
      .from("review_responses")
      .select("reviewer_role")
      .eq("assignment_id", assignment.id)
      .eq("reviewer_id", currentUserId),
  ]);

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

  // The single authorization gate, shared with the (now redirecting) cycles
  // route and written to agree with the INSERT policy exactly.
  //
  // What this replaces: `canEdit = isUpwardReviewer || isAssignmentManager ||
  // (isWorkspaceManager && !isAssignmentEmployee)`. That last clause handed an
  // editable form to any HR user or anyone with direct reports, on anyone's
  // review — and the database then refused the write, because the INSERT policy
  // requires the writer to BE the party whose role they claim. The form looked
  // fine and failed on submit.
  const access = assertCanReview(
    {
      employeeId: assignment.employee_id,
      managerId: assignment.manager_id,
      reviewerId: assignment.reviewer_id,
      assignmentType: assignment.assignment_type,
      cycleStatus: (assignment.cycle as unknown as CycleJoin | null)?.status ?? null,
      activePhaseTypes: (activePhases ?? []).map((p) => p.phase_type as string),
      submittedRoles: (mySubmissions ?? []).map((r) => r.reviewer_role as string),
      competencyCount: competencyRatings.length,
    },
    currentUserId
  );
  // Everything the reviewer would otherwise have to remember. Fetched only for
  // someone who is actually a party to this review — a read-only viewer has no
  // business seeing the subject's self-assessment and kudos laid out for them.
  const rawEvidence =
    access.role !== null
      ? await getReviewEvidence(supabase, {
          assignmentId: assignment.id,
          employeeId: assignment.employee_id as string,
          workspaceId: workspace.workspaceId,
          cycleId: assignment.cycle_id as string,
        })
      : EMPTY_REVIEW_EVIDENCE;

  // Someone writing their own self-review doesn't need "What Kacper said"
  // quoting their own draft back at them. Goals, kudos and last cycle still
  // help — those are the things you forget about your own year.
  const evidence =
    access.role === "self" ? { ...rawEvidence, selfAssessment: [] } : rawEvidence;

  const canEdit = access.canEdit;
  // Someone who may not write still gets a role for display where they have
  // one; the save path is never reached without `canEdit`.
  const reviewerRole = access.role ?? "manager";

  const level = (Array.isArray(employee?.level) ? employee?.level[0] : employee?.level) as LevelJoin | undefined;
  const cycle = assignment.cycle as unknown as CycleJoin | null;
  const manager = assignment.manager as unknown as ManagerJoin | null;
  const statusCfg = getAssignmentStatus(assignment.status);

  const familyName = level
    ? (Array.isArray(level.job_family) ? level.job_family[0]?.name : level.job_family?.name)
    : null;
  const levelLabel = level
    ? `${familyName ? `${familyName} · ` : ""}${level.name}${level.grade ? ` (${level.grade})` : ""}`
    : null;
  const showDepartment = employee?.department && employee.department !== familyName;
  const backHref =
    from === "cycle" && cycleId
      ? `/dashboard/cycles/${cycleId}`
      : isAssignmentEmployee
      ? "/dashboard/performance"
      : "/dashboard/reviews";
  const backLabel =
    from === "cycle" && cycleId
      ? "Back to cycle"
      : isAssignmentEmployee
      ? "Back to Performance"
      : "Back to reviews";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back link sits above the page header so the header itself stays clean */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      <PageHeader
        hat="my-team"
        title={employee?.slack_name || "Unknown employee"}
        serifTitle
        subtitle={cycle?.name}
        actions={
          <div className="flex items-center gap-2">
            <Badge className={`text-xs font-medium ${statusCfg.badge}`}>
              {statusCfg.label}
            </Badge>
            {assignment.overall_rating && (
              <Badge variant="outline" className="text-xs font-semibold">
                {assignment.overall_rating}/{workspace.ratingScale?.max || 5}
              </Badge>
            )}
          </div>
        }
      />

      {/* One-row meta: function · reviewer · cycle dates. Sits just below the
          PageHeader so the cycle name in the subtitle isn't repeated below. */}
      <div className="-mt-2 flex items-center gap-x-4 gap-y-1 text-xs text-muted-foreground flex-wrap">
        {levelLabel && (
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {levelLabel}
          </span>
        )}
        {showDepartment && (
          <span className="flex items-center gap-1">
            <User2 className="h-3 w-3" />
            {employee?.department}
          </span>
        )}
        <span className="flex items-center gap-1">
          <User2 className="h-3 w-3" />
          Reviewer: <span className="font-medium text-foreground">{manager?.slack_name || "—"}</span>
        </span>
        {cycle?.start_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(cycle.start_date), "MMM d")}
            {cycle.end_date && ` → ${format(new Date(cycle.end_date), "MMM d, yyyy")}`}
          </span>
        )}
        {!levelId && competencyRatings.length === 0 && (
          <span>No competencies configured</span>
        )}
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

      {/* Why this review can't be written.
          One notice, driven by the typed reason from assertCanReview, instead
          of the form quietly rendering read-only and leaving the reviewer to
          work out why. The old "closed cycle" notice was the only one of these
          cases the page acknowledged; the rest — not your review, phase not
          open, already submitted, nothing configured — showed nothing at all. */}
      {!access.canEdit && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 flex items-start gap-2">
          <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{access.message}</p>
        </div>
      )}

      {/* Form and evidence, side by side.
          The rail is reference material, so it sits second in the DOM and
          stacks below the form on narrow screens — a reviewer on a phone
          shouldn't have to scroll past someone's goals to reach question one. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
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

        <EvidenceRail
          evidence={evidence}
          employeeName={employee?.slack_name || "This person"}
          ratingMax={workspace.ratingScale?.max || 5}
        />
      </div>
    </div>
  );
}
