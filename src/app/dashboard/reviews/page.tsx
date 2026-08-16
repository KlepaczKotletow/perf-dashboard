import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { ReviewsContent } from "./reviews-content";
import { ReviewsExportButton } from "./reviews-export-button";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { reportingSubtree, scopeAssignmentsToViewer } from "@/lib/reporting-tree";

type UserRef = {
  id: string;
  slack_name: string | null;
  job_title?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  slack_user_id?: string | null;
};
type CycleRef = { id: string; name: string; status: string; start_date: string | null; end_date: string | null };
type ReviewAssignmentItem = {
  id: string;
  status: string;
  overall_rating: number | null;
  created_at: string | null;
  updated_at: string | null;
  assignment_type: string | null;
  employee_id?: string | null;
  manager_id?: string | null;
  reviewer_id?: string | null;
  employee?: UserRef | null;
  manager?: UserRef | null;
  reviewer?: UserRef | null;
  cycle?: CycleRef | null;
};

export default async function ReviewsPage() {
  const workspace = await getUserWorkspace();

  // Mirrors the nav gate (`requiresManager`) and /dashboard/my-team. Previously
  // absent: the link was hidden for employees but the page rendered for anyone
  // who navigated to the URL directly.
  if (!workspace?.appUserId || (!isManagerOrAbove(workspace?.role) && !workspace?.hasDirectReports)) {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const canSeeWholeOrg = isHROrAbove(workspace.role);

  const { data: cycleRows } = await supabase
    .from("performance_cycles")
    .select("id")
    .eq("workspace_id", workspace.workspaceId);
  const cycleIds = ((cycleRows || []) as { id: string }[]).map((c) => c.id);

  let assignments: ReviewAssignmentItem[] = [];
  if (cycleIds.length > 0) {
    const { data, error } = await supabase
      .from("review_assignments")
      .select(`
        id, status, overall_rating, created_at, updated_at, assignment_type,
        employee_id, manager_id, reviewer_id,
        employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title, department, avatar_url, slack_user_id),
        manager:users!review_assignments_manager_id_fkey(id, slack_name, avatar_url, slack_user_id),
        reviewer:users!review_assignments_reviewer_id_fkey(id, slack_name, avatar_url, slack_user_id),
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, status, start_date, end_date)
      `)
      .in("cycle_id", cycleIds)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) console.error("Failed to fetch review assignments:", error.message);
    assignments = (data || []) as unknown as ReviewAssignmentItem[];

    if (!canSeeWholeOrg) {
      const { data: orgRows } = await supabase
        .from("users")
        .select("id, manager_id")
        .eq("workspace_id", workspace.workspaceId);
      const subtree = reportingSubtree(
        (orgRows || []) as { id: string; manager_id: string | null }[],
        workspace.appUserId
      );
      assignments = scopeAssignmentsToViewer(assignments, subtree, workspace.appUserId);
    }
  }

  const cycleMap = new Map<string, { cycle: CycleRef | null; items: ReviewAssignmentItem[] }>();
  for (const a of assignments) {
    const cycle = a.cycle ?? null;
    const cid = cycle?.id ?? "__none__";
    if (!cycleMap.has(cid)) cycleMap.set(cid, { cycle, items: [] });
    cycleMap.get(cid)!.items.push(a);
  }
  const cycles = Array.from(cycleMap.values());

  // Ratings render as "4.2 / 5" — a bare number is unreadable without its ceiling.
  const { data: wsRow } = await supabase
    .from("workspaces")
    .select("rating_scale, rating_scales!workspaces_active_rating_scale_id_fkey(max_value)")
    .eq("id", workspace.workspaceId)
    .maybeSingle();
  const scale = wsRow as {
    rating_scale?: { max?: number } | null;
    rating_scales?: { max_value: number } | { max_value: number }[] | null;
  } | null;
  const activeScale = Array.isArray(scale?.rating_scales) ? scale?.rating_scales[0] : scale?.rating_scales;
  const ratingMax = activeScale?.max_value ?? scale?.rating_scale?.max ?? 5;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        hat="my-team"
        title="Team Reviews"
        subtitle={
          canSeeWholeOrg
            ? "Every review assignment in your workspace"
            : "Review assignments across your reporting line"
        }
        actions={canSeeWholeOrg ? <ReviewsExportButton /> : undefined}
      />

      <ReviewsContent cycles={cycles} currentUserId={workspace.appUserId} ratingMax={ratingMax} />
    </div>
  );
}
