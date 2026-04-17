import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import GoalsClient, { type TabId } from "./goals-client";
import { isHROrAbove } from "@/lib/roles";
import type { GoalRow } from "@/lib/goals-utils";

const GOAL_SELECT = `
  id, title, description, scope, status, progress, weight,
  metric_start, metric_current, metric_target, metric_unit,
  tracking_status, due_date, created_at, parent_id, goal_direction,
  employee_id, suggested_by_user_id,
  employee:users!goals_employee_id_fkey(id, slack_name, department),
  suggested_by:users!goals_suggested_by_user_id_fkey(id, slack_name),
  cycle:performance_cycles!goals_cycle_id_fkey(id, name)
`;

const VALID_TABS = ["me", "team", "company"] as const;

async function getMeGoals(workspaceId: string, appUserId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("employee_id", appUserId)
    .eq("scope", "individual")
    .order("created_at", { ascending: false });
  if (error) console.error("Failed to fetch 'me' goals:", error.message);
  return (data || []) as unknown as GoalRow[];
}

async function getTeamGoals(workspaceId: string, appUserId: string) {
  const supabase = await createServerSupabaseClient();

  // PostgREST .or() with subqueries is fragile — run two queries and merge.
  // Query 1: any team-scope goal in this workspace.
  // Query 2: individual goals owned by a direct report of the caller.
  const { data: reports, error: reportsErr } = await supabase
    .from("users")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("manager_id", appUserId);
  if (reportsErr) console.error("Failed to fetch reports for team goals:", reportsErr.message);

  const reportIds = (reports || []).map((r: { id: string }) => r.id);

  const teamScopePromise = supabase
    .from("goals")
    .select(GOAL_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("scope", "team")
    .order("created_at", { ascending: false });

  const reportIndividualsPromise =
    reportIds.length > 0
      ? supabase
          .from("goals")
          .select(GOAL_SELECT)
          .eq("workspace_id", workspaceId)
          .eq("scope", "individual")
          .in("employee_id", reportIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown as GoalRow[], error: null as { message: string } | null });

  const [teamScopeRes, reportIndividualsRes] = await Promise.all([
    teamScopePromise,
    reportIndividualsPromise,
  ]);

  if (teamScopeRes.error) console.error("Failed to fetch team-scope goals:", teamScopeRes.error.message);
  if (reportIndividualsRes.error)
    console.error("Failed to fetch reports' individual goals:", reportIndividualsRes.error.message);

  // Merge — IDs are unique across both queries (a row has exactly one scope).
  const merged = [
    ...((teamScopeRes.data as unknown as GoalRow[]) || []),
    ...((reportIndividualsRes.data as unknown as GoalRow[]) || []),
  ];
  // Re-sort the merged list by created_at DESC
  merged.sort((a, b) => {
    const aT = (a as GoalRow & { created_at?: string }).created_at || "";
    const bT = (b as GoalRow & { created_at?: string }).created_at || "";
    return bT.localeCompare(aT);
  });
  return merged;
}

async function getCompanyGoals(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("scope", "company")
    .order("created_at", { ascending: false });
  if (error) console.error("Failed to fetch company goals:", error.message);
  return (data || []) as unknown as GoalRow[];
}

async function getCycles(workspaceId: string | undefined) {
  if (!workspaceId) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("performance_cycles")
    .select("id, name")
    .order("created_at", { ascending: false })
    .eq("workspace_id", workspaceId);
  if (error) console.error("Failed to fetch cycles for goals:", error.message);
  return data || [];
}

async function getEmployees(workspaceId: string | undefined) {
  if (!workspaceId) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, slack_name")
    .order("slack_name")
    .eq("workspace_id", workspaceId);
  if (error) console.error("Failed to fetch employees for goals:", error.message);
  return data || [];
}

async function getDirectReports(workspaceId: string | undefined, appUserId: string | null) {
  if (!workspaceId || !appUserId) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, slack_name")
    .eq("workspace_id", workspaceId)
    .eq("manager_id", appUserId)
    .order("slack_name");
  if (error) console.error("Failed to fetch direct reports for goals:", error.message);
  return data || [];
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const rawTab = params.tab;
  const tab: TabId = (VALID_TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as TabId)
    : "me";

  const workspace = await getUserWorkspace();
  const role = workspace?.role;
  const appUserId = workspace?.appUserId ?? null;
  const workspaceId = workspace?.workspaceId;

  // Determine which tabs this caller sees
  const visibleTabs: TabId[] = ["me"];
  if (workspace?.hasDirectReports) visibleTabs.push("team");
  visibleTabs.push("company");

  // Fetch goals for all visible tabs in parallel — switching is instant.
  const fetches: Partial<Record<TabId, Promise<GoalRow[]>>> = {};
  if (workspaceId && appUserId) {
    if (visibleTabs.includes("me")) fetches.me = getMeGoals(workspaceId, appUserId);
    if (visibleTabs.includes("team")) fetches.team = getTeamGoals(workspaceId, appUserId);
    if (visibleTabs.includes("company")) fetches.company = getCompanyGoals(workspaceId);
  }

  const [meGoals, teamGoals, companyGoals, cycles, employees, directReports] = await Promise.all([
    fetches.me ?? Promise.resolve([] as GoalRow[]),
    fetches.team ?? Promise.resolve([] as GoalRow[]),
    fetches.company ?? Promise.resolve([] as GoalRow[]),
    getCycles(workspaceId),
    getEmployees(workspaceId),
    getDirectReports(workspaceId, appUserId),
  ]);

  const goalsByTab: Record<TabId, GoalRow[]> = {
    me: meGoals,
    team: teamGoals,
    company: companyGoals,
  };

  return (
    <GoalsClient
      initialTab={tab}
      visibleTabs={visibleTabs}
      goalsByTab={goalsByTab}
      cycles={cycles}
      employees={employees}
      directReports={directReports ?? []}
      currentUserId={appUserId ?? ""}
      currentUserName={workspace?.name ?? ""}
      canCreateCompany={isHROrAbove(role)}
      role={role}
      workspaceId={workspaceId ?? ""}
    />
  );
}
