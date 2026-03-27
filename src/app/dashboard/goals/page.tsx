import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import GoalsClient from "./goals-client";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";

async function getGoals(
  workspaceId: string | undefined,
  role: string | undefined,
  currentUserId: string | null,
  hasDirectReports?: boolean,
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
    const { data, error } = await query;
    if (error) console.error("Failed to fetch goals (HR):", error.message);
    return data || [];
  }

  if (!currentUserId) {
    // Unauthenticated — only public company-level goals
    const { data, error } = await query.eq("scope", "company");
    if (error) console.error("Failed to fetch goals (public):", error.message);
    return data || [];
  }

  if (isManagerOrAbove(role) || hasDirectReports) {
    // Manager — company goals + team goals + individual goals for self and direct reports
    const { data: reports, error: reportsErr } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", currentUserId)
      .eq("workspace_id", workspaceId);
    if (reportsErr) console.error("Failed to fetch manager reports for goals:", reportsErr.message);

    const allIds = [currentUserId, ...((reports || []).map((r: any) => r.id))];
    const idsStr = allIds.join(",");

    const { data, error } = await query.or(
      `scope.eq.company,scope.eq.team,employee_id.in.(${idsStr})`
    );
    if (error) console.error("Failed to fetch goals (manager):", error.message);
    return data || [];
  }

  // Employee — company goals + their own individual goals
  const { data, error } = await query.or(
    `scope.eq.company,employee_id.eq.${currentUserId}`
  );
  if (error) console.error("Failed to fetch goals (employee):", error.message);
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

  const { data, error } = await query;
  if (error) console.error("Failed to fetch cycles for goals:", error.message);
  return data || [];
}

export default async function GoalsPage() {
  const workspace = await getUserWorkspace();
  const role = workspace?.role;
  const currentUserId = workspace?.appUserId ?? null;

  const [goals, cycles] = await Promise.all([
    getGoals(workspace?.workspaceId, role, currentUserId, workspace?.hasDirectReports),
    getCycles(workspace?.workspaceId),
  ]);

  return <GoalsClient goals={goals} cycles={cycles} role={role} workspaceId={workspace?.workspaceId ?? ""} />;
}
