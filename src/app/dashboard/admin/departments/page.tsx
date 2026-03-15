import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isAdminOrAbove } from "@/lib/roles";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const supabase = await createServerSupabaseClient();
  const workspace = await getUserWorkspace();

  if (!workspace || !isAdminOrAbove(workspace.role)) redirect("/dashboard");

  // Seed departments from users if the table is empty for this workspace
  const { data: existing } = await supabase
    .from("departments")
    .select("id")
    .eq("workspace_id", workspace.workspaceId)
    .limit(1);

  if (!existing || existing.length === 0) {
    const { data: users } = await supabase
      .from("users")
      .select("department")
      .eq("workspace_id", workspace.workspaceId)
      .not("department", "is", null);

    const uniqueDepts = [...new Set((users || []).map((u: any) => u.department).filter(Boolean))] as string[];

    if (uniqueDepts.length > 0) {
      await supabase.from("departments").insert(
        uniqueDepts.map((name) => ({ name, workspace_id: workspace.workspaceId }))
      );
    }
  }

  const [{ data: departments }, { data: users }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name")
      .eq("workspace_id", workspace.workspaceId)
      .order("name"),
    supabase
      .from("users")
      .select("id, department")
      .eq("workspace_id", workspace.workspaceId),
  ]);

  // Compute member count per department name
  const memberCounts: Record<string, number> = {};
  (users || []).forEach((u: any) => {
    if (u.department) memberCounts[u.department] = (memberCounts[u.department] || 0) + 1;
  });

  return (
    <DepartmentsClient
      departments={departments ?? []}
      memberCounts={memberCounts}
      workspaceId={workspace.workspaceId}
    />
  );
}
