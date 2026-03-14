import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, ChevronRight, Lock, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { isManagerOrAbove } from "@/lib/roles";

async function getSurveys() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("surveys")
    .select("id, type, name, status, closes_at, created_at, survey_participants(count)")
    .order("created_at", { ascending: false });
  return data || [];
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
  if (!isManagerOrAbove(workspace?.role)) {
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

  const surveys = await getSurveys();
  const isAdminOrHR = workspace?.role === "admin" || workspace?.role === "hr";

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
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
          <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <h3 className="text-base font-medium text-foreground mb-1">No surveys yet</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm">
            Launch a 360, pulse survey, or eNPS — participants respond directly in Slack.
          </p>
          {isAdminOrHR && (
            <Button size="sm" asChild>
              <Link href="/dashboard/surveys/new"><Plus className="h-3.5 w-3.5 mr-1.5" />Launch your first survey</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_120px_120px_40px] gap-4 px-4 py-2.5 bg-muted/40">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responses</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Closes</span>
            <span />
          </div>
          {surveys.map((survey: any) => {
            const total = survey.survey_participants?.[0]?.count ?? 0;
            return (
              <Link
                key={survey.id}
                href={`/dashboard/surveys/${survey.id}`}
                className="grid grid-cols-[1fr_80px_80px_120px_120px_40px] gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors items-center"
              >
                <span className="text-sm font-medium text-foreground truncate">{survey.name}</span>
                <Badge variant="outline" className={`text-xs w-fit ${TYPE_COLORS[survey.type] || ""}`}>
                  {TYPE_LABELS[survey.type] || survey.type}
                </Badge>
                <Badge variant="outline" className={`text-xs w-fit capitalize ${STATUS_COLORS[survey.status] || ""}`}>
                  {survey.status}
                </Badge>
                <span className="text-sm text-muted-foreground">{total} responded</span>
                <span className="text-sm text-muted-foreground">
                  {survey.closes_at ? format(new Date(survey.closes_at), "MMM d, yyyy") : "—"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
