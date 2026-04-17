import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Download, Repeat } from "lucide-react";
import { notFound } from "next/navigation";
import { format, addDays, nextDay, Day } from "date-fns";
import { isHROrAbove } from "@/lib/roles";
import { SurveyActions } from "./survey-actions";
import { SurveyResults } from "./survey-results";
import { ScheduleEditor } from "./schedule-editor";
import { PageHeader } from "@/components/page-header";

async function getSurvey(id: string, workspaceId: string) {
  const supabase = await createServerSupabaseClient();

  // Query survey and participants separately to avoid nested-embed RLS issues
  const [{ data: survey }, { data: participants }] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, type, name, status, config, closes_at, created_at, nami_send_at")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single(),
    supabase
      .from("survey_participants")
      .select("id, user_id, subject_user_id, role, status")
      .eq("survey_id", id)
      .eq("workspace_id", workspaceId),
  ]);

  if (!survey) return null;
  return { ...survey, survey_participants: participants || [] };
}

async function getSurveyResponses(surveyId: string, workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("survey_responses")
    .select("id, participant_id, subject_user_id, answers, submitted_at")
    .eq("survey_id", surveyId)
    .eq("workspace_id", workspaceId);
  return data || [];
}

const TYPE_LABELS: Record<string, string> = { "360": "360°", pulse: "Pulse", enps: "eNPS" };

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getUserWorkspace();
  const [survey, responses] = await Promise.all([getSurvey(id, workspace!.workspaceId), getSurveyResponses(id, workspace!.workspaceId)]);
  if (!survey) notFound();

  const participants = (survey.survey_participants || []) as any[];

  // Fetch subject display names for 360
  const subjectUserIds = [
    ...new Set(
      participants
        .filter(p => p.role === "subject")
        .map((p: any) => p.subject_user_id)
        .filter(Boolean)
    ),
  ];
  let subjectNames: Record<string, string> = {};
  if (subjectUserIds.length) {
    const supabase = await createServerSupabaseClient();
    const { data: subjectUsers } = await supabase
      .from("users")
      .select("id, slack_name")
      .in("id", subjectUserIds)
      .eq("workspace_id", workspace!.workspaceId);
    subjectNames = Object.fromEntries((subjectUsers || []).map((u: any) => [u.id, u.slack_name || u.id]));
  }

  const respondents = participants.filter((p) => p.role !== "subject");
  const completed = respondents.filter((p) => p.status === "completed").length;
  const total = respondents.length;
  const responseRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const canManage = isHROrAbove(workspace?.role);

  // Recurrence — compute next-send estimate if set
  const config = (survey as any).config || {};
  const recurrence: string | undefined = config.recurrence;
  const recurrenceDay: string | undefined = config.recurrence_day;
  const lastRecurrenceAt: string | undefined = config.last_recurrence_at;
  const nextSendDate = recurrence ? computeNextSend(recurrence, recurrenceDay, lastRecurrenceAt) : null;

  // Build a compact subtitle string (type · status · optional schedule info)
  const subtitleParts: string[] = [
    TYPE_LABELS[survey.type] || survey.type,
    capitalize(survey.status),
  ];
  if (recurrence) {
    subtitleParts.push(`${recurrence} recurring`);
  } else if (survey.closes_at) {
    subtitleParts.push(`closes ${format(new Date(survey.closes_at), "MMM d, yyyy")}`);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        hat="manage"
        title={survey.name}
        subtitle={subtitleParts.join(" · ")}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/surveys">
                <ArrowLeft className="h-4 w-4 mr-1" /> Surveys
              </Link>
            </Button>
            {responses.length > 0 && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/surveys/${id}/export`} download>
                  <Download className="h-4 w-4 mr-1.5" /> Export CSV
                </a>
              </Button>
            )}
            {canManage && survey.status !== "closed" && (
              <ScheduleEditor
                surveyId={id}
                workspaceId={workspace!.workspaceId}
                surveyType={survey.type}
                initialConfig={(survey as { config?: Record<string, unknown> }).config || {}}
                initialSendAt={(survey as { nami_send_at?: string | null }).nami_send_at ?? null}
              />
            )}
            {canManage && survey.status === "active" && (
              <SurveyActions surveyId={id} workspaceId={workspace!.workspaceId} />
            )}
          </>
        }
      />

      {/* Recurring schedule info (when applicable) */}
      {recurrence && (
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
          <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-400/10 flex items-center justify-center shrink-0">
            <Repeat className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Sends {recurrence} on {recurrenceDay ? capitalize(recurrenceDay) : "Monday"}s
            </p>
            <p className="text-[11px] text-muted-foreground">
              {nextSendDate
                ? <>Next send: <span className="text-foreground font-medium">{format(nextSendDate, "EEEE, MMM d")}</span></>
                : "Next send computed when the recurring cron next fires."}
            </p>
          </div>
        </div>
      )}

      {/* Compact response-rate strip — was a big Card with 3xl text */}
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Response rate</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">{responseRate}%
            <span className="text-xs font-normal text-muted-foreground ml-2">{completed} of {total}</span>
          </p>
        </div>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden ml-4">
          <div
            className={`h-full rounded-full transition-all ${responseRate === 100 ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${responseRate}%` }}
            role="progressbar"
            aria-valuenow={responseRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${responseRate}% response rate`}
          />
        </div>
      </div>

      {/* Results */}
      <SurveyResults survey={survey} responses={responses} participants={participants} subjectNames={subjectNames} />
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Compute the next fire time for a recurring survey, mirroring the     */
/*  edge-function logic in nami-bot#shouldRecurrenceFire.                */
/*  Returns null if we can't figure it out.                              */
/* -------------------------------------------------------------------- */

function computeNextSend(
  recurrence: string,
  dayOfWeek: string = "monday",
  lastRecurrenceAt?: string,
): Date | null {
  const daysMap: Record<string, Day> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };
  const target = daysMap[(dayOfWeek || "monday").toLowerCase()];
  if (target === undefined) return null;

  const now = new Date();
  const lastAt = lastRecurrenceAt ? new Date(lastRecurrenceAt) : null;

  // First send: the next occurrence of the target day (today if it's today).
  if (!lastAt) {
    return now.getDay() === target ? now : nextDay(now, target);
  }

  // Otherwise, minimum-days after last fire, then round forward to the target day.
  const minDays = recurrence === "weekly" ? 6 : recurrence === "biweekly" ? 13 : recurrence === "monthly" ? 27 : 6;
  const earliest = addDays(lastAt, minDays);
  return earliest.getDay() === target ? earliest : nextDay(earliest, target);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
