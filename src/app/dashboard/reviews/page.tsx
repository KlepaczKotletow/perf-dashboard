import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { ReviewsContent } from "./reviews-content";
import { ReviewsExportButton } from "./reviews-export-button";
import { isHROrAbove } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";

type UserRef = { id: string; slack_name: string | null; job_title?: string | null; department?: string | null; avatar_url?: string | null };
type CycleRef = { id: string; name: string; status: string; start_date: string | null; end_date: string | null };
type ReviewAssignmentItem = {
  id: string;
  status: string;
  overall_rating: number | null;
  created_at: string | null;
  updated_at: string | null;
  assignment_type: string | null;
  employee?: UserRef | null;
  manager?: UserRef | null;
  reviewer?: UserRef | null;
  cycle?: CycleRef | null;
};

async function getReviewAssignments(workspaceId: string) {
  const supabase = await createServerSupabaseClient();

  // Get cycle IDs belonging to this workspace first
  const { data: cycles, error: cyclesErr } = await supabase
    .from("performance_cycles")
    .select("id")
    .eq("workspace_id", workspaceId);
  if (cyclesErr) console.error("Failed to fetch review cycles:", cyclesErr.message);
  const cycleIds = ((cycles || []) as { id: string }[]).map((c) => c.id);
  if (cycleIds.length === 0) return [];

  // Search and status filtering moved to the client (single filter bar
  // owns both URL-derivable and ad-hoc filters). The server returns the
  // full slice; the client tables filter and sort interactively.
  const { data, error: assignmentsErr } = await supabase
    .from("review_assignments")
    .select(`
      id, status, overall_rating, created_at, updated_at, assignment_type,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title, department, avatar_url),
      manager:users!review_assignments_manager_id_fkey(id, slack_name, avatar_url),
      reviewer:users!review_assignments_reviewer_id_fkey(id, slack_name, avatar_url),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date)
    `)
    .in("cycle_id", cycleIds)
    .order("created_at", { ascending: false })
    .limit(200);

  if (assignmentsErr) console.error("Failed to fetch review assignments:", assignmentsErr.message);
  return (data || []) as unknown as ReviewAssignmentItem[];
}

export default async function ReviewsPage() {
  const workspace = await getUserWorkspace();
  const assignments = await getReviewAssignments(workspace!.workspaceId);

  // Group by cycle, then by assignment_type within each cycle. The client
  // flattens this back into rows for the table — keeping the grouped shape
  // here avoids changing the existing component prop contract while we
  // make the redesign.
  const cycleMap = new Map<string, { cycle: CycleRef | null; standard: ReviewAssignmentItem[]; upward: ReviewAssignmentItem[] }>();
  for (const a of assignments) {
    const cycle = a.cycle ?? null;
    const cid = cycle?.id ?? "__none__";
    if (!cycleMap.has(cid)) {
      cycleMap.set(cid, { cycle, standard: [], upward: [] });
    }
    const group = cycleMap.get(cid)!;
    if (a.assignment_type === "upward") group.upward.push(a);
    else group.standard.push(a);
  }
  const cycles = Array.from(cycleMap.values());

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        hat="my-team"
        title="Team Reviews"
        subtitle="All performance review assignments"
        actions={isHROrAbove(workspace?.role) ? <ReviewsExportButton /> : undefined}
      />

      <ReviewsContent cycles={cycles} />
    </div>
  );
}
