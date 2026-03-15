// src/app/dashboard/admin/functions/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { isAdminOrAbove, isManagerOrAbove } from "@/lib/roles";
import { FunctionsClient } from "./functions-client";

export default async function FunctionsPage() {
  const supabase = await createServerSupabaseClient();
  const workspace = await getUserWorkspace();

  if (!workspace || !isManagerOrAbove(workspace.role)) {
    redirect("/dashboard");
  }

  const canEdit = isAdminOrAbove(workspace.role);

  const [
    { data: functions },
    { data: levels },
    { data: competencies },
    { data: levelCompetencies },
    { data: users },
  ] = await Promise.all([
    supabase.from("job_families").select("id, name, description").eq("workspace_id", workspace.workspaceId).order("name"),
    supabase.from("levels").select("id, name, grade, sort_order, job_family_id").eq("workspace_id", workspace.workspaceId).order("sort_order"),
    supabase.from("competencies").select("id, name, description, category, is_core, job_family_id, workspace_id").eq("workspace_id", workspace.workspaceId).order("name"),
    supabase.from("level_competencies").select("id, level_id, competency_id, expected_level, workspace_id").eq("workspace_id", workspace.workspaceId),
    supabase.from("users").select("id, level_id").eq("workspace_id", workspace.workspaceId),
  ]);

  return (
    <FunctionsClient
      functions={functions ?? []}
      levels={levels ?? []}
      competencies={competencies ?? []}
      levelCompetencies={levelCompetencies ?? []}
      users={users ?? []}
      canEdit={canEdit}
      workspaceId={workspace.workspaceId}
    />
  );
}
