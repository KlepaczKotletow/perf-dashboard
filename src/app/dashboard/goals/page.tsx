import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import GoalsClient from "./goals-client";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";

async function getGoals(
  workspaceId: string | undefined,
  role: string | undefined,
  currentUserId: string | null
) {
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

  // HR / Admin — unrestricted
  if (isHROrAbove(role)) {
    const { data } = await query;
    return data || [];
  }

  if (!currentUserId) {
    // Unauthenticated — only public company-level goals
    const { data } = await query.eq("scope", "company");
    return data || [];
  }

  if (isManagerOrAbove(role)) {
    // Manager — company goals + team goals + individual goals for self and direct reports
    const { data: reports } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", currentUserId);

    const allIds = [currentUserId, ...((reports || []).map((r: any) => r.id))];
    const idsStr = allIds.join(",");

    const { data } = await query.or(
      `scope.eq.company,scope.eq.team,employee_id.in.(${idsStr})`
    );
    return data || [];
  }

  // Employee — company goals + their own individual goals
  const { data } = await query.or(
    `scope.eq.company,employee_id.eq.${currentUserId}`
  );
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
  const role = workspace?.role;
  const currentUserId = workspace?.appUserId ?? null;

  const [goals, cycles] = await Promise.all([
    getGoals(workspace?.workspaceId, role, currentUserId),
    getCycles(workspace?.workspaceId),
  ]);

  return <GoalsClient goals={goals} cycles={cycles} role={role} />;
}
