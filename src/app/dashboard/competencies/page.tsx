import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Lock } from "lucide-react";
import { isManagerOrAbove, isHROrAbove } from "@/lib/roles";
import { CompetenciesClient } from "./competencies-client";

async function getData() {
  const supabase = await createServerSupabaseClient();

  const [{ data: competencies }, { data: levels }, { data: levelCompetencies }] =
    await Promise.all([
      supabase
        .from("competencies")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("levels")
        .select("*, job_family:job_families(name)")
        .order("sort_order"),
      supabase.from("level_competencies").select("*"),
    ]);

  return {
    competencies: competencies || [],
    levels: levels || [],
    levelCompetencies: levelCompetencies || [],
  };
}

export default async function CompetenciesPage() {
  const workspace = await getUserWorkspace();

  if (!isManagerOrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Competency management is only available to managers and administrators.
        </p>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const { competencies, levels, levelCompetencies } = await getData();
  const canEdit = isHROrAbove(workspace?.role);

  return (
    <CompetenciesClient
      competencies={competencies}
      levels={levels}
      levelCompetencies={levelCompetencies}
      canEdit={canEdit}
      workspaceId={workspace?.workspaceId || ""}
    />
  );
}
