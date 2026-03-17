import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
import GoalDetailClient from "./goal-detail-client";

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const workspace = await getUserWorkspace();

  const { data: goal } = await supabase
    .from("goals")
    .select(`
      id, parent_id, title, description, status, progress,
      weight, metric_start, metric_current, metric_target, metric_unit,
      tracking_status, scope, due_date, created_at, updated_at,
      employee:users!goals_employee_id_fkey(id, slack_name, department),
      cycle:performance_cycles!goals_cycle_id_fkey(id, name),
      parent:goals!goals_parent_id_fkey(id, title)
    `)
    .eq("id", id)
    .eq("workspace_id", workspace?.workspaceId ?? "")
    .single();

  if (!goal) notFound();

  // Fetch child goals
  const { data: children } = await supabase
    .from("goals")
    .select("id, title, status, progress, tracking_status, weight")
    .eq("parent_id", id)
    .eq("workspace_id", workspace?.workspaceId ?? "");

  const canEdit = isManagerOrAbove(workspace?.role as string | undefined);

  // Fetch cycles and employees for edit form
  const [{ data: cycles }, { data: employees }] = await Promise.all([
    supabase
      .from("performance_cycles")
      .select("id, name")
      .eq("workspace_id", workspace?.workspaceId ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("users")
      .select("id, slack_name")
      .eq("workspace_id", workspace?.workspaceId ?? "")
      .order("slack_name"),
  ]);

  return (
    <GoalDetailClient
      goal={goal as any}
      children={children || []}
      canEdit={canEdit}
      cycles={cycles || []}
      employees={employees || []}
    />
  );
}
