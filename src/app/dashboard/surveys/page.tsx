import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, ChevronRight, Lock, ClipboardList, Download } from "lucide-react";
import { format } from "date-fns";
import { isManagerOrAbove, isHROrAbove } from "@/lib/roles";

async function getSurveys(workspaceId: string) {
  const supabase = await createServerSupabaseClient();

  // Query surveys and participant counts separately to avoid nested-embed RLS issues
  const [{ data: surveys, error: surveyErr }, { data: counts, error: countErr }] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, type, name, status, closes_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("survey_participants")
      .select("survey_id, status")
      .eq("workspace_id", workspaceId),
  ]);

  if (surveyErr) console.error("Failed to fetch surveys:", surveyErr.message);
  if (countErr) console.error("Failed to fetch survey participants:", countErr.message);

  // Build a per-survey completion map
  const statsMap = new Map<string, { total: number; completed: number }>();
  for (const p of counts || []) {
    const entry = statsMap.get(p.survey_id) || { total: 0, completed: 0 };
    entry.total++;
    if (p.status === "completed") entry.completed++;
    statsMap.set(p.survey_id, entry);
  }

  return (surveys || []).map((s: any) => {
    const stats = statsMap.get(s.id) || { total: 0, completed: 0 };
    return { ...s, totalParticipants: stats.total, completedParticipants: stats.completed };
  });
}

const TYPE_LABELS: Record<string, string> = { "360": "360°", pulse: "Pulse", enps: "eNPS" };
const TYPE_COLORS: Record<string, string> = {
  "360": "bg-purple-100 text-purple-700 border-purple-200",
  pulse: "bg-blue-100 text-blue-700 border-blue-200",
  enps: "bg-green-100 text-green-700 border-green-200",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

export default async function SurveysPage() {
  const workspace = await getUserWorkspace();
  if (!isManagerOrAbove(workspace?.role) && !workspace?.hasDirectReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">Surveys are available to managers and admins.</p>
        <Button variant="outline" size="sm" asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  const surveys = await getSurveys(workspace!.workspaceId);
  const isAdminOrHR = isHROrAbove(workspace?.role);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Surveys</h1>
          <p className="text-sm text-muted-foreground mt-1">360 reviews, pulse checks, and eNPS — all via Slack</p>
        </div>
        {isAdminOrHR && (
          <Button size="sm" asChild>
            <Link href="/dashboard/surveys/new">
              <Plus className="h-3.5 w-3.5 mr-1.5" />New Survey
            </Link>
          </Button>
        )}
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card py-16 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No surveys yet</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Create your first survey to gather feedback from your team.
          </p>
          {isAdminOrHR && (
            <Button size="sm" className="mt-5 gap-1.5" asChild>
              <Link href="/dashboard/surveys/new">
                <Plus className="h-3.5 w-3.5" />
                Create Survey
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          <div className="grid grid-cols-[1fr_70px_70px_1fr_100px_70px_32px] gap-3 px-4 py-2.5 bg-muted/40">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Response rate</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Closes</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Export</span>
            <span />
          </div>
          {surveys.map((survey) => {
            const total = survey.totalParticipants;
            const completed = survey.completedParticipants;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <div
                key={survey.id}
                className="grid grid-cols-[1fr_70px_70px_1fr_100px_70px_32px] gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors items-center"
              >
                <Link href={`/dashboard/surveys/${survey.id}`} className="text-sm font-medium text-foreground truncate hover:underline">
                  {survey.name}
                </Link>
                <Badge variant="outline" className={`text-xs w-fit ${TYPE_COLORS[survey.type] || ""}`}>
                  {TYPE_LABELS[survey.type] || survey.type}
                </Badge>
                <Badge variant="outline" className={`text-xs w-fit capitalize ${STATUS_COLORS[survey.status] || ""}`}>
                  {survey.status}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${rate === 100 ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{completed}/{total} ({rate}%)</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {survey.closes_at ? format(new Date(survey.closes_at), "MMM d, yyyy") : "—"}
                </span>
                <div>
                  {completed > 0 && (
                    <a
                      href={`/api/surveys/${survey.id}/export`}
                      download
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                      title="Export CSV"
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  )}
                </div>
                <Link href={`/dashboard/surveys/${survey.id}`}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
