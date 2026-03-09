import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import GoalsClient from "./goals-client";

async function getGoals(workspaceId: string | undefined) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("goals")
    .select(`
      id, parent_id, title, description, status, progress,
      weight, metric_start, metric_current, metric_target, metric_unit,
      tracking_status, scope, due_date,
      employee:users!goals_employee_id_fkey(id, slack_name, department),
      cycle:performance_cycles!goals_cycle_id_fkey(id, name)
    `)
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data } = await query;
  return data || [];
}

async function getCycles(workspaceId: string | undefined) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("performance_cycles")
    .select("id, name")
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data } = await query;
  return data || [];
}

export default async function GoalsPage() {
  const workspace = await getUserWorkspace();
  const [goals, cycles] = await Promise.all([
    getGoals(workspace?.workspaceId),
    getCycles(workspace?.workspaceId),
  ]);

  return <GoalsClient goals={goals} cycles={cycles} />;
}
