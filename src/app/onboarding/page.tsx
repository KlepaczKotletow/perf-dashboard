import { getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const workspace = await getUserWorkspace();
  if (!workspace) redirect("/");
  if (workspace.onboardingCompleted) redirect("/dashboard");

  return (
    <OnboardingClient
      workspaceId={workspace.workspaceId}
      workspaceName={workspace.workspaceName ?? ""}
    />
  );
}
