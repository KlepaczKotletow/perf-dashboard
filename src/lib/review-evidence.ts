import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the reviewer already knows, assembled so they don't have to remember it.
 *
 * The review form asked a manager to judge seven competencies across six months
 * from memory, with nothing on screen but the questions. Everything below is
 * already in the database and was already being shown to calibrators — after
 * the review was written, which is exactly too late to be useful.
 *
 * This is deliberately NOT `getEmployeeEvidence()` from the calibration page.
 * That function is calibration-shaped: manager, peer and upward responses plus
 * kudos and a prior grade. It has no self-review and no goals, which are the
 * two most useful things when you are the one writing. It also runs behind an
 * HR gate. Rather than widen it and make both callers worse, this is the
 * review-shaped view of the same underlying rows.
 *
 * RLS note — verified against production policies, no changes required:
 *   goals.goals_select_matrix          allows a direct manager
 *   continuous_feedback                allows a direct manager, shared items only
 *   review_responses                   allows the subject's reporting line
 *   review_assignments                 allows the subject's reporting line
 * A reviewer who cannot see a given piece simply gets fewer rows; nothing here
 * throws, and nothing here is required for the form to work.
 */

export interface SelfAssessmentEntry {
  competencyName: string | null;
  rating: number | null;
  comment: string | null;
}

export interface EvidenceGoal {
  id: string;
  title: string;
  progress: number | null;
  trackingStatus: string | null;
  status: string;
}

export interface EvidenceKudos {
  id: string;
  message: string;
  createdAt: string;
  fromName: string | null;
}

export interface PriorCycleResult {
  cycleName: string | null;
  overallRating: number | null;
  finalGrade: string | null;
}

export interface ReviewEvidence {
  selfAssessment: SelfAssessmentEntry[];
  goals: EvidenceGoal[];
  kudos: EvidenceKudos[];
  prior: PriorCycleResult | null;
}

export const EMPTY_REVIEW_EVIDENCE: ReviewEvidence = {
  selfAssessment: [],
  goals: [],
  kudos: [],
  prior: null,
};

type CompetencyJoin = { name: string | null } | { name: string | null }[] | null;
type UserJoin = { slack_name: string | null } | { slack_name: string | null }[] | null;
type CycleJoin = { name: string | null } | { name: string | null }[] | null;

function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function getReviewEvidence(
  supabase: SupabaseClient,
  args: {
    assignmentId: string;
    employeeId: string;
    workspaceId: string;
    cycleId: string;
  }
): Promise<ReviewEvidence> {
  const { assignmentId, employeeId, workspaceId, cycleId } = args;

  const [selfR, goalsR, kudosR, priorR] = await Promise.all([
    // The subject's own self-assessment. It lives on the SAME assignment row
    // under reviewer_role='self', so this is a single cheap read — and it is
    // the single most useful thing a manager can have open while writing.
    supabase
      .from("review_responses")
      .select("rating, comment, competency:competencies(name)")
      .eq("assignment_id", assignmentId)
      .eq("reviewer_role", "self"),

    supabase
      .from("goals")
      .select("id, title, progress, tracking_status, status")
      .eq("employee_id", employeeId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),

    supabase
      .from("continuous_feedback")
      .select("id, message, created_at, is_anonymous, from_user:users!continuous_feedback_from_user_id_fkey(slack_name)")
      .eq("to_user_id", employeeId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(6),

    // The most recent finished cycle that isn't this one, so the reviewer can
    // see where this person landed last time before deciding where they land now.
    supabase
      .from("review_assignments")
      .select("overall_rating, final_grade, cycle:performance_cycles!inner(name, end_date, status)")
      .eq("employee_id", employeeId)
      .neq("cycle_id", cycleId)
      .not("overall_rating", "is", null)
      .order("cycle(end_date)", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const selfAssessment: SelfAssessmentEntry[] = (selfR.data ?? []).map((r) => ({
    competencyName: first(r.competency as CompetencyJoin)?.name ?? null,
    rating: (r.rating as number | null) ?? null,
    comment: (r.comment as string | null) ?? null,
  }));

  const goals: EvidenceGoal[] = (goalsR.data ?? []).map((g) => ({
    id: g.id as string,
    title: g.title as string,
    progress: (g.progress as number | null) ?? null,
    trackingStatus: (g.tracking_status as string | null) ?? null,
    status: g.status as string,
  }));

  const kudos: EvidenceKudos[] = (kudosR.data ?? []).map((k) => ({
    id: k.id as string,
    message: k.message as string,
    createdAt: k.created_at as string,
    fromName: k.is_anonymous ? null : (first(k.from_user as UserJoin)?.slack_name ?? null),
  }));

  const priorRow = priorR.data as
    | { overall_rating: number | null; final_grade: string | null; cycle: CycleJoin }
    | null;
  const prior: PriorCycleResult | null = priorRow
    ? {
        cycleName: first(priorRow.cycle)?.name ?? null,
        overallRating: priorRow.overall_rating,
        finalGrade: priorRow.final_grade,
      }
    : null;

  return { selfAssessment, goals, kudos, prior };
}
