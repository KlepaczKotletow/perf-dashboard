import { SupabaseClient } from "@supabase/supabase-js";

export interface ManagerResponse {
  competency: string | null;
  rating: number | null;
  comment: string | null;
}
export interface CommentEntry {
  comment: string;
  created_at: string;
}
export interface KudosEntry {
  sender_name: string | null; // null when anonymous
  message: string;
  created_at: string;
  anonymous: boolean;
}
export interface PriorGrade {
  cycle_name: string;
  final_grade: string | null;
  cycle_end: string;
}

export interface EmployeeEvidence {
  managerResponses: ManagerResponse[];
  peerComments: CommentEntry[];
  upwardComments: CommentEntry[];
  recentKudos: KudosEntry[];
  priorGrade: PriorGrade | null;
}

/**
 * Fetch all the evidence backing one assignment's grade. Used by the side
 * sheet that opens when a calibrator clicks a chip in the 9-box grid.
 *
 * `cycleId` is needed because peer/upward responses are filtered by
 * (employeeId, cycleId) — the employee may have many open cycles.
 */
export async function getEmployeeEvidence(
  supabase: SupabaseClient,
  workspaceId: string,
  cycleId: string,
  assignmentId: string,
  employeeId: string,
): Promise<EmployeeEvidence> {
  const [managerR, peerR, upwardR, kudosR, priorR] = await Promise.all([
    // Manager responses on THIS assignment (subject's manager review).
    supabase
      .from("review_responses")
      .select("rating, comment, competency:competencies(name)")
      .eq("assignment_id", assignmentId)
      .eq("reviewer_role", "manager"),

    // Peer responses about this employee in this cycle.
    supabase
      .from("review_responses")
      .select(`
        comment, created_at,
        assignment:review_assignments!inner(employee_id, cycle_id)
      `)
      .eq("reviewer_role", "peer")
      .eq("assignment.employee_id", employeeId)
      .eq("assignment.cycle_id", cycleId)
      .not("comment", "is", null),

    // Upward responses about this employee in this cycle.
    supabase
      .from("review_responses")
      .select(`
        comment, created_at,
        assignment:review_assignments!inner(employee_id, cycle_id)
      `)
      .eq("reviewer_role", "upward")
      .eq("assignment.employee_id", employeeId)
      .eq("assignment.cycle_id", cycleId)
      .not("comment", "is", null),

    // Recent kudos. continuous_feedback uses from_user_id / to_user_id.
    supabase
      .from("continuous_feedback")
      .select(`
        message, created_at, is_anonymous,
        sender:users!continuous_feedback_from_user_id_fkey(slack_name)
      `)
      .eq("to_user_id", employeeId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(10),

    // Most recent prior cycle's grade.
    supabase
      .from("review_assignments")
      .select(`
        final_grade,
        cycle:performance_cycles!inner(name, end_date, status)
      `)
      .eq("employee_id", employeeId)
      .neq("cycle_id", cycleId)
      .eq("cycle.status", "completed")
      .order("cycle(end_date)", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    managerResponses: (managerR.data ?? []).map((r: any) => ({
      competency: Array.isArray(r.competency) ? r.competency[0]?.name ?? null : r.competency?.name ?? null,
      rating: r.rating,
      comment: r.comment,
    })),
    peerComments: (peerR.data ?? []).map((r: any) => ({
      comment: r.comment,
      created_at: r.created_at,
    })),
    upwardComments: (upwardR.data ?? []).map((r: any) => ({
      comment: r.comment,
      created_at: r.created_at,
    })),
    recentKudos: (kudosR.data ?? []).map((k: any) => ({
      sender_name: k.is_anonymous
        ? null
        : (Array.isArray(k.sender) ? k.sender[0]?.slack_name : k.sender?.slack_name) ?? null,
      message: k.message,
      created_at: k.created_at,
      anonymous: !!k.is_anonymous,
    })),
    priorGrade: priorR.data
      ? {
          cycle_name: Array.isArray((priorR.data as any).cycle)
            ? (priorR.data as any).cycle[0]?.name ?? "Unknown"
            : (priorR.data as any).cycle?.name ?? "Unknown",
          final_grade: (priorR.data as any).final_grade ?? null,
          cycle_end: Array.isArray((priorR.data as any).cycle)
            ? (priorR.data as any).cycle[0]?.end_date ?? ""
            : (priorR.data as any).cycle?.end_date ?? "",
        }
      : null,
  };
}
