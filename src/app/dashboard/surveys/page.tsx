import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, ChevronRight, Lock, ClipboardList, Download, Repeat } from "lucide-react";
import { format } from "date-fns";
import { isManagerOrAbove, isHROrAbove } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";

async function getSurveys(workspaceId: string) {
  const supabase = await createServerSupabaseClient();

  // Query surveys and participant counts separately to avoid nested-embed RLS issues.
  // Pull config too so we can surface recurrence (weekly / biweekly / monthly).
  const [{ data: surveys, error: surveyErr }, { data: counts, error: countErr }] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, type, name, status, config, closes_at, created_at")
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
  "360": "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-400/10 dark:border-violet-400/20",
  pulse: "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-400/10 dark:border-sky-400/20",
  enps: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "text-zinc-600 bg-zinc-100 border-zinc-200 dark:text-zinc-400 dark:bg-zinc-400/10 dark:border-zinc-400/20",
  active: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20",
  closed: "text-zinc-600 bg-zinc-100 border-zinc-200 dark:text-zinc-400 dark:bg-zinc-400/10 dark:border-zinc-400/20",
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

  // Split out recurring from one-off for clearer mental model
  const recurringSurveys = surveys.filter((s: any) => s.config?.recurrence);
  const oneOffSurveys = surveys.filter((s: any) => !s.config?.recurrence);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        hat="manage"
        title="Surveys"
        subtitle="360 reviews, pulse checks, and eNPS — all via Slack"
        actions={
          isAdminOrHR ? (
            <Button size="sm" asChild>
              <Link href="/dashboard/surveys/new">
                <Plus className="h-3.5 w-3.5 mr-1.5" />New Survey
              </Link>
            </Button>
          ) : undefined
        }
      />

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
        <>
          {/* Recurring schedules — shown first when present */}
          {recurringSurveys.length > 0 && (
            <section className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Repeat className="h-3 w-3" />
                Recurring schedules · {recurringSurveys.length}
              </p>
              <SurveyList surveys={recurringSurveys} />
            </section>
          )}

          {/* One-off surveys */}
          {oneOffSurveys.length > 0 && (
            <section className="space-y-2">
              {recurringSurveys.length > 0 && (
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  One-off surveys · {oneOffSurveys.length}
                </p>
              )}
              <SurveyList surveys={oneOffSurveys} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Flat row list — no column header chrome.                             */
/* -------------------------------------------------------------------- */

function SurveyList({ surveys }: { surveys: any[] }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
      {surveys.map((survey) => {
        const total = survey.totalParticipants;
        const completed = survey.completedParticipants;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const recurrence: string | undefined = survey.config?.recurrence;
        return (
          // Row is a flex container, NOT a link — so the Export anchor can be a
          // sibling rather than a nested <a> (which was crashing hydration).
          <div
            key={survey.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
          >
            <Link
              href={`/dashboard/surveys/${survey.id}`}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              {/* Name + type + optional recurring tag stacked */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{survey.name}</span>
                  <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[survey.type] || ""}`}>
                    {TYPE_LABELS[survey.type] || survey.type}
                  </Badge>
                  {recurrence && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-400/10 rounded px-1.5 py-0.5">
                      <Repeat className="h-2.5 w-2.5" />
                      {recurrence}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {completed}/{total} responded · {rate}%
                  {survey.closes_at && !recurrence && (
                    <> · closes {format(new Date(survey.closes_at), "MMM d, yyyy")}</>
                  )}
                </p>
              </div>

              {/* Progress bar */}
              <div className="hidden sm:flex items-center gap-2 shrink-0 w-[140px]">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${rate === 100 ? "bg-emerald-500" : "bg-primary"}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{rate}%</span>
              </div>

              {/* Status chip */}
              <Badge variant="outline" className={`text-[10px] shrink-0 capitalize ${STATUS_COLORS[survey.status] || ""}`}>
                {survey.status}
              </Badge>
            </Link>

            {/* Export sits OUTSIDE the Link so we don't nest <a> inside <a> */}
            {completed > 0 && (
              <a
                href={`/api/surveys/${survey.id}/export`}
                download
                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors shrink-0"
                title="Export CSV"
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            )}

            <Link
              href={`/dashboard/surveys/${survey.id}`}
              className="shrink-0"
              aria-label="Open survey"
            >
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" aria-hidden="true" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
