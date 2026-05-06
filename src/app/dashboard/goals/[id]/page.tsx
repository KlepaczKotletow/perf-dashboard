import type React from "react";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { isManagerOrAbove } from "@/lib/roles";
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
    if (!goal) notFound();

    // Fetch child goals
    const { data: childGoals } = await supabase
      .from("goals")
      .select("id, title, status, progress, tracking_status, weight")
      .eq("parent_id", id)
      .eq("workspace_id", workspace.workspaceId);

    const canEdit = isManagerOrAbove(workspace?.role as string | undefined) || !!workspace?.hasDirectReports;

    // Fetch cycles, employees, and progress history
    const [{ data: cycles }, { data: employees }, { data: historyRaw }] = await Promise.all([
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
      supabase
        .from("goal_progress_events")
        .select(`
          id, created_at,
          old_progress, new_progress,
          old_metric_current, new_metric_current,
          old_status, new_status,
          old_tracking_status, new_tracking_status,
          actor:users!goal_progress_events_actor_user_id_fkey(id, slack_name)
        `)
        .eq("goal_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    type GoalDetailGoal = React.ComponentProps<typeof GoalDetailClient>["goal"];
    type GoalDetailHistory = NonNullable<React.ComponentProps<typeof GoalDetailClient>["history"]>;
    return (
      <GoalDetailClient
        goal={goal as unknown as GoalDetailGoal}
        childGoals={(childGoals || []) as unknown as React.ComponentProps<typeof GoalDetailClient>["childGoals"]}
        canEdit={canEdit}
        cycles={cycles || []}
        employees={(employees || []) as unknown as React.ComponentProps<typeof GoalDetailClient>["employees"]}
        workspaceId={workspace.workspaceId}
        history={(historyRaw || []) as unknown as GoalDetailHistory}
      />
    );
  } catch (err: unknown) {
    console.error("[goal-detail] UNCAUGHT ERROR:", (err instanceof Error ? err.message : ""), (err instanceof Error ? err.stack : ""));
    throw err;
  }
}
