import { getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isAdminOrAbove } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const workspace = await getUserWorkspace();
  if (!workspace || !isAdminOrAbove(workspace.role)) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();

  const { data: wsData } = await supabase
    .from("workspaces")
    .select("id, team_name, team_id, logo_url, rating_scale, installed_at")
    .eq("id", workspace.workspaceId)
    .single();

  const { data: tenureBuckets } = await supabase
    .from("tenure_buckets")
    .select("*")
    .eq("workspace_id", workspace.workspaceId)
    .order("sort_order");

  return (
    <SettingsClient
      workspace={{
        id: wsData?.id || workspace.workspaceId,
        teamName: wsData?.team_name || workspace.workspaceName || "",
        teamId: wsData?.team_id || "",
        logoUrl: wsData?.logo_url || null,
        ratingScale: wsData?.rating_scale || { min: 1, max: 5, labels: { "1": "Needs improvement", "2": "Below expectations", "3": "Meets expectations", "4": "Exceeds expectations", "5": "Exceptional" } },
        installedAt: wsData?.installed_at || null,
      }}
      tenureBuckets={tenureBuckets || []}
    />
  );
}
