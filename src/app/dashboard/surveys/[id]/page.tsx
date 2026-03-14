import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { isHROrAbove } from "@/lib/roles";
import { SurveyActions } from "./survey-actions";
import { SurveyResults } from "./survey-results";

async function getSurvey(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("surveys")
    .select(`
      id, type, name, status, config, closes_at, created_at,
      survey_participants(id, user_id, subject_user_id, role, status)
    `)
    .eq("id", id)
    .single();
  return data;
}

async function getSurveyResponses(surveyId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("survey_responses")
    .select("id, participant_id, subject_user_id, answers, submitted_at")
    .eq("survey_id", surveyId);
  return data || [];
}

const TYPE_COLORS: Record<string, string> = {
  "360": "bg-purple-100 text-purple-700 border-purple-200",
  pulse: "bg-blue-100 text-blue-700 border-blue-200",
  enps: "bg-green-100 text-green-700 border-green-200",
};
const TYPE_LABELS: Record<string, string> = { "360": "360°", pulse: "Pulse", enps: "eNPS" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [survey, workspace] = await Promise.all([getSurvey(id), getUserWorkspace()]);
  if (!survey) notFound();

  const responses = await getSurveyResponses(id);
  const participants = (survey.survey_participants || []) as any[];
  const respondents = participants.filter((p) => p.role !== "subject");
  const completed = respondents.filter((p) => p.status === "completed").length;
  const total = respondents.length;
  const responseRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const canManage = isHROrAbove(workspace?.role);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/surveys"><ArrowLeft className="h-4 w-4 mr-1" />Surveys</Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{survey.name}</h1>
              <Badge variant="outline" className={`text-xs ${TYPE_COLORS[survey.type] || ""}`}>
                {TYPE_LABELS[survey.type] || survey.type}
              </Badge>
              <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[survey.status] || ""}`}>
                {survey.status}
              </Badge>
            </div>
            {survey.closes_at && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Closes {format(new Date(survey.closes_at), "MMMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
        {canManage && survey.status === "active" && (
          <SurveyActions surveyId={id} />
        )}
      </div>

      {/* Response rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Response Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-3xl font-bold text-foreground">{responseRate}%</span>
            <span className="text-sm text-muted-foreground mb-1">{completed} of {total} responded</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${responseRate}%` }}
              role="progressbar"
              aria-valuenow={responseRate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${responseRate}% response rate`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <SurveyResults survey={survey} responses={responses} participants={participants} />
    </div>
  );
}
