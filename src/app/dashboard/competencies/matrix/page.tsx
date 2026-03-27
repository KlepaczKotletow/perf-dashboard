import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { isManagerOrAbove, isHROrAbove } from "@/lib/roles";
import { EditableCell } from "./editable-cell";

async function getMatrixData(workspaceId: string) {
  const supabase = await createServerSupabaseClient();

  const [{ data: levels }, { data: competencies }, { data: levelCompetencies }] = await Promise.all([
    supabase.from("levels").select("*, job_family:job_families(name)").eq("workspace_id", workspaceId).order("sort_order"),
    supabase.from("competencies").select("*").eq("workspace_id", workspaceId).order("category").order("name"),
    supabase.from("level_competencies").select("*").eq("workspace_id", workspaceId),
  ]);

  return {
    levels: levels || [],
    competencies: competencies || [],
    levelCompetencies: levelCompetencies || [],
  };
}

const proficiencyColors: Record<number, string> = {
  1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  2: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  3: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  4: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  5: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const proficiencyLabels: Record<number, string> = {
  1: "Basic",
  2: "Developing",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

export default async function CompetencyMatrixPage() {
  const workspace = await getUserWorkspace();
  
  if (!isManagerOrAbove(workspace?.role) && !workspace?.hasDirectReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
        <p className="text-muted-foreground mb-6">Only managers and admins can view the competency matrix.</p>
        <Button asChild><Link href="/dashboard">Go to Dashboard</Link></Button>
      </div>
    );
  }

  const workspaceId = workspace?.workspaceId;
  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-muted-foreground">Workspace not found.</p>
      </div>
    );
  }

  const { levels, competencies, levelCompetencies } = await getMatrixData(workspaceId);
  const canEdit = isHROrAbove(workspace?.role);

  // Build a lookup: levelId-competencyId -> { expected_level, id, behavioral_indicators }
  const matrixLookup: Record<string, { expected_level: number; id: string; behavioral_indicators: string[] }> = {};
  levelCompetencies.forEach((lc: any) => {
    const raw = lc.behavioral_indicators;
    matrixLookup[`${lc.level_id}-${lc.competency_id}`] = {
      expected_level: lc.expected_level,
      id: lc.id,
      behavioral_indicators: Array.isArray(raw) ? raw : [],
    };
  });

  // Group competencies by category
  const categories = [...new Set(competencies.map((c: any) => c.category || "Uncategorized"))];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/functions"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Competency Matrix</h1>
          <p className="text-muted-foreground mt-1">Expected proficiency levels per job level</p>
        </div>
      </div>

      {levels.length === 0 || competencies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="mb-4">
              {levels.length === 0
                ? "No job levels defined yet. Create functions and levels first."
                : "No competencies defined yet. Create competencies first."}
            </p>
            <div className="flex gap-3 justify-center">
              {levels.length === 0 && (
                <Button asChild variant="outline">
                  <Link href="/dashboard/admin/functions">Manage Functions</Link>
                </Button>
              )}
              {competencies.length === 0 && (
                <Button asChild variant="outline">
                  <Link href="/dashboard/competencies">Manage Competencies</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {canEdit && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
              Click any cell to set or change the expected proficiency level. Changes are saved immediately.
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <span className="text-muted-foreground font-medium">Proficiency Scale:</span>
            {[1, 2, 3, 4, 5].map((level) => (
              <Badge key={level} className={proficiencyColors[level]}>
                {level} - {proficiencyLabels[level]}
              </Badge>
            ))}
            <Badge variant="outline" className="text-muted-foreground">Not set</Badge>
          </div>

          {categories.map((category) => {
            const catCompetencies = competencies.filter((c: any) => (c.category || "Uncategorized") === category);
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{category}</CardTitle>
                  <CardDescription>{catCompetencies.length} competencies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium min-w-[160px]">Competency</th>
                          {levels.map((level: any) => (
                            <th key={level.id} className="text-center py-2 px-2 font-medium min-w-[80px]">
                              <div className="text-xs">{(level.job_family as any)?.name}</div>
                              <div>{level.name}</div>
                              {level.grade && <div className="text-xs text-muted-foreground">{level.grade}</div>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {catCompetencies.map((comp: any) => (
                          <tr key={comp.id} className="border-b last:border-0">
                            <td className="py-2 pr-4">
                              <span className="font-medium">{comp.name}</span>
                              {comp.is_core && <Badge variant="outline" className="ml-2 text-xs">Core</Badge>}
                            </td>
                            {levels.map((level: any) => {
                              const entry = matrixLookup[`${level.id}-${comp.id}`];
                              return (
                                <td key={level.id} className="text-center py-2 px-2">
                                  <EditableCell
                                    levelId={level.id}
                                    competencyId={comp.id}
                                    workspaceId={workspaceId}
                                    initialValue={entry?.expected_level || null}
                                    existingId={entry?.id || null}
                                    initialBehaviors={entry?.behavioral_indicators || []}
                                    competencyName={comp.name}
                                    levelLabel={`${(level.job_family as any)?.name ?? ""} · ${level.name}`}
                                    canEdit={canEdit}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
