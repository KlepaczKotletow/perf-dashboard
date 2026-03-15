import { getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isAdminOrAbove } from "@/lib/roles";
import { GeneralClient } from "./general-client";

export default async function GeneralSettingsPage() {
  const workspace = await getUserWorkspace();
  if (!workspace || !isAdminOrAbove(workspace.role)) redirect("/dashboard");

  return (
    <GeneralClient
      workspaceId={workspace.workspaceId}
      useDepartments={workspace.useDepartments}
      useCareerFramework={workspace.useCareerFramework}
    />
  );
}
