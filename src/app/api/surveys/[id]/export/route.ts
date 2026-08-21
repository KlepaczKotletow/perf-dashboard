import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { csvStreamResponse } from "@/lib/csv";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: surveyId } = await params;
  const workspace = await getUserWorkspace();
  if (!workspace || !isHROrAbove(workspace.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const wsId = workspace.workspaceId;

  // Survey config is small — buffer once.
  const { data: survey } = await supabase
    .from("surveys")
    .select("id, name, type, config")
    .eq("id", surveyId)
    .eq("workspace_id", wsId)
    .single();

  if (!survey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Participants + user names: bounded by workspace size, safe to buffer.
  const { data: participants } = await supabase
    .from("survey_participants")
    .select("id, user_id, subject_user_id, role, status")
    .eq("survey_id", surveyId)
    .eq("workspace_id", wsId);

  const userIds = new Set<string>();
  for (const p of participants || []) {
    if (p.user_id) userIds.add(p.user_id);
    if (p.subject_user_id) userIds.add(p.subject_user_id);
  }
  const { data: users } = userIds.size === 0
    ? { data: [] as Array<{ id: string; slack_name: string | null }> }
    : await supabase
        .from("users")
        .select("id, slack_name")
        .in("id", [...userIds])
        .eq("workspace_id", wsId);

  const nameMap: Record<string, string> = {};
  for (const u of users || []) {
    nameMap[u.id] = u.slack_name || "Unknown";
  }

  type ParticipantLite = { id: string; user_id: string | null; subject_user_id: string | null; role: string | null; status: string | null };
  const partMap: Record<string, ParticipantLite> = {};
  for (const p of (participants || []) as ParticipantLite[]) {
    partMap[p.id] = p;
  }

  const config = (survey.config || {}) as { questions?: Array<{ id: string; label: string; type: string }> };
  const questions = config.questions ?? [];

  let header: string[];
  if (survey.type === "enps") {
    header = ["Respondent", "Score", "Follow-up Response", "Submitted At"];
  } else if (survey.type === "pulse") {
    header = ["Respondent", ...questions.map((q) => q.label), "Submitted At"];
  } else if (survey.type === "360") {
    header = ["Subject", "Rater", "Rater Role", ...questions.map((q) => q.label), "Submitted At"];
  } else {
    header = ["Submitted At"];
  }

  type ResponseRow = {
    id: string;
    participant_id: string;
    subject_user_id: string | null;
    answers: Record<string, unknown> | null;
    submitted_at: string | null;
  };

  const filename = `${survey.name.replace(/[^a-zA-Z0-9]/g, "_")}_export.csv`;

  return csvStreamResponse<ResponseRow>({
    filename,
    header,
    pageSize: 500,
    fetchPage: async (offset, limit) => {
      const { data } = await supabase
        .from("survey_responses")
        .select("id, participant_id, subject_user_id, answers, submitted_at")
        .eq("survey_id", surveyId)
        .eq("workspace_id", wsId)
        .order("submitted_at", { ascending: true, nullsFirst: false })
        .range(offset, offset + limit - 1);
      return (data ?? []) as ResponseRow[];
    },
    toRow: (r) => {
      const part = partMap[r.participant_id];
      const submitted = r.submitted_at ? new Date(r.submitted_at).toISOString() : "";
      if (survey.type === "enps") {
        const respondent = part ? nameMap[part.user_id ?? ""] || "Unknown" : "Unknown";
        return [respondent, r.answers?.score ?? "", r.answers?.follow_up ?? "", submitted];
      }
      if (survey.type === "pulse") {
        const respondent = part ? nameMap[part.user_id ?? ""] || "Unknown" : "Unknown";
        const answers = questions.map((q) => r.answers?.[q.id] ?? "");
        return [respondent, ...answers, submitted];
      }
      if (survey.type === "360") {
        const rater = part ? nameMap[part.user_id ?? ""] || "Unknown" : "Unknown";
        const subject = r.subject_user_id ? nameMap[r.subject_user_id] || "Unknown" : "Unknown";
        const role = part?.role ?? "unknown";
        const answers = questions.map((q) => r.answers?.[q.id] ?? "");
        return [subject, rater, role, ...answers, submitted];
      }
      return [submitted];
    },
  });
}
