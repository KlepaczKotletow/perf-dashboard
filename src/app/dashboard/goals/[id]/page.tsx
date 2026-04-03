import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
import GoalDetailClient from "./goal-detail-client";

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const workspace = await getUserWorkspace();
    if (!workspace?.workspaceId) {
      console.error("[goal-detail] No workspace found");
      notFound();
    }

    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select(`
        id, parent_id, title, description, status, progress,
        weight, metric_start, metric_current, metric_target, metric_unit,
        tracking_status, scope, goal_direction, due_date, created_at, updated_at,
        employee:users!goals_employee_id_fkey(id, slack_name, department),
        cycle:performance_cycles!goals_cycle_id_fkey(id, name)
      `)
      .eq("id", id)
      .eq("workspace_id", workspace.workspaceId)
      .single();

    if (goalError) {
      console.error("[goal-detail] goal query failed:", goalError.code, goalError.message);
    }
    if (!goal) {
      console.error("[goal-detail] goal is null for id:", id);
      notFound();
    }

    console.log("[goal-detail] goal loaded:", goal.id, goal.title);

    // Fetch child goals
    const { data: childGoals } = await supabase
      .from("goals")
      .select("id, title, status, progress, tracking_status, weight")
      .eq("parent_id", id)
      .eq("workspace_id", workspace.workspaceId);

    const canEdit = isManagerOrAbove(workspace?.role as string | undefined) || !!workspace?.hasDirectReports;

    // Fetch cycles and employees for edit form
    const [{ data: cycles }, { data: employees }] = await Promise.all([
      supabase
        .from("performance_cycles")
        .select("id, name")
        .eq("workspace_id", workspace.workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("id, slack_name")
        .eq("workspace_id", workspace.workspaceId)
        .order("slack_name"),
    ]);

    console.log("[goal-detail] rendering GoalDetailClient");

    return (
      <GoalDetailClient
        goal={goal as any}
        childGoals={childGoals || []}
        canEdit={canEdit}
        cycles={cycles || []}
        employees={employees || []}
        workspaceId={workspace.workspaceId}
      />
    );
  } catch (err: any) {
    console.error("[goal-detail] UNCAUGHT ERROR:", err?.message, err?.stack);
    throw err;
  }
}
