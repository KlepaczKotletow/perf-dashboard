import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { notFound, redirect } from "next/navigation";
import { isHROrAbove } from "@/lib/roles";
import DescriptorsClient from "./descriptors-client";

export default async function ScoreDescriptorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getUserWorkspace();
  if (!workspace?.workspaceId) redirect("/?signin=required");
  if (!isHROrAbove(workspace.role)) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();

  const [{ data: competency }, { data: descriptors }, { data: workspaceRow }] =
    await Promise.all([
      supabase
        .from("competencies")
        .select("id, name, description, category")
        .eq("id", id)
        .eq("workspace_id", workspace.workspaceId)
        .single(),
      supabase
        .from("competency_score_descriptors")
        .select("id, score, description")
        .eq("competency_id", id)
        .eq("workspace_id", workspace.workspaceId)
        .order("score"),
      supabase
        .from("workspaces")
        .select("rating_scale")
        .eq("id", workspace.workspaceId)
        .single(),
    ]);

  if (!competency) notFound();

  // Rating scale shape: { min: number, max: number, labels?: Record<string,string> }
  // Fall back to 1-5 if unset. The Slack bot currently hardcodes 5 — Phase 3.2
  // will thread this through so the two agree.
  const scale = (workspaceRow?.rating_scale ?? {}) as {
    min?: number;
    max?: number;
    labels?: Record<string, string>;
  };
  const min = scale.min ?? 1;
  const max = scale.max ?? 5;

  return (
    <DescriptorsClient
      competency={competency}
      descriptors={descriptors ?? []}
      workspaceId={workspace.workspaceId}
      scale={{ min, max, labels: scale.labels ?? {} }}
    />
  );
}
