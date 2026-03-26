import { getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isAdminOrAbove } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const workspace = await getUserWorkspace();
  if (!workspace || !isAdminOrAbove(workspace.role)) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();

  // Fetch full workspace data
  const { data: wsData } = await supabase
    .from("workspaces")
    .select("id, team_name, team_id, use_departments, use_career_framework, onboarding_completed, rating_scale, installed_at, updated_at")
    .eq("id", workspace.workspaceId)
    .single();

  // Count users, cycles, competencies
  const [usersRes, cyclesRes, compsRes] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.workspaceId),
    supabase.from("performance_cycles").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.workspaceId),
    supabase.from("competencies").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.workspaceId),
  ]);

  return (
    <SettingsClient
      workspace={{
        id: wsData?.id || workspace.workspaceId,
        teamName: wsData?.team_name || workspace.workspaceName || "",
        teamId: wsData?.team_id || "",
        useDepartments: wsData?.use_departments ?? false,
        useCareerFramework: wsData?.use_career_framework ?? false,
        ratingScale: wsData?.rating_scale || { min: 1, max: 5, labels: { "1": "Needs improvement", "2": "Below expectations", "3": "Meets expectations", "4": "Exceeds expectations", "5": "Exceptional" } },
        installedAt: wsData?.installed_at || null,
      }}
      stats={{
        users: usersRes.count || 0,
        cycles: cyclesRes.count || 0,
        competencies: compsRes.count || 0,
      }}
    />
  );
}
