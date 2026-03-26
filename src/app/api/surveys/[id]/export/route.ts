import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const workspace = await getUserWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const wsId = workspace.workspaceId;

  // Fetch survey with config
  const { data: survey } = await supabase
    .from("surveys")
    .select("id, name, type, config")
    .eq("id", surveyId)
    .eq("workspace_id", wsId)
    .single();

  if (!survey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch participants with user names
  const { data: participants } = await supabase
    .from("survey_participants")
    .select("id, user_id, subject_user_id, role, status")
    .eq("survey_id", surveyId);

  // Fetch responses
  const { data: responses } = await supabase
    .from("survey_responses")
    .select("id, participant_id, subject_user_id, answers, submitted_at")
    .eq("survey_id", surveyId)
    .eq("workspace_id", wsId);

  // Fetch user names
  const userIds = new Set<string>();
  for (const p of participants || []) {
    if (p.user_id) userIds.add(p.user_id);
    if (p.subject_user_id) userIds.add(p.subject_user_id);
  }
  const { data: users } = await supabase
    .from("users")
    .select("id, slack_name")
    .in("id", [...userIds])
    .eq("workspace_id", wsId);

  const nameMap: Record<string, string> = {};
  for (const u of users || []) {
    nameMap[u.id] = u.slack_name || "Unknown";
  }

  // Build participant lookup
  const partMap: Record<string, any> = {};
  for (const p of participants || []) {
    partMap[p.id] = p;
  }

  const config = (survey.config || {}) as Record<string, any>;
  const questions: { id: string; label: string; type: string }[] = config.questions || [];

  let csv = "";

  if (survey.type === "enps") {
    // eNPS: respondent, score, follow_up, submitted_at
    csv = "Respondent,Score,Follow-up Response,Submitted At\n";
    for (const r of responses || []) {
      const part = partMap[r.participant_id];
      const respondent = part ? nameMap[part.user_id] || "Unknown" : "Unknown";
      const score = r.answers?.score ?? "";
      const followUp = (r.answers?.follow_up || "").replace(/"/g, '""');
      const submitted = r.submitted_at ? new Date(r.submitted_at).toISOString() : "";
      csv += `"${respondent}","${score}","${followUp}","${submitted}"\n`;
    }
  } else if (survey.type === "pulse") {
    // Pulse: respondent, q1, q2, ..., submitted_at
    const headers = ["Respondent", ...questions.map(q => q.label), "Submitted At"];
    csv = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
    for (const r of responses || []) {
      const part = partMap[r.participant_id];
      const respondent = part ? nameMap[part.user_id] || "Unknown" : "Unknown";
      const answers = questions.map(q => {
        const val = r.answers?.[q.id] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      const submitted = r.submitted_at ? new Date(r.submitted_at).toISOString() : "";
      csv += `"${respondent}",${answers.join(",")},"${submitted}"\n`;
    }
  } else if (survey.type === "360") {
    // 360: subject, rater, role, q1, q2, ..., submitted_at
    const headers = ["Subject", "Rater", "Rater Role", ...questions.map(q => q.label), "Submitted At"];
    csv = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
    for (const r of responses || []) {
      const part = partMap[r.participant_id];
      const rater = part ? nameMap[part.user_id] || "Unknown" : "Unknown";
      const subject = r.subject_user_id ? nameMap[r.subject_user_id] || "Unknown" : "Unknown";
      const role = part?.role || "unknown";
      const answers = questions.map(q => {
        const val = r.answers?.[q.id] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      const submitted = r.submitted_at ? new Date(r.submitted_at).toISOString() : "";
      csv += `"${subject}","${rater}","${role}",${answers.join(",")},"${submitted}"\n`;
    }
  }

  const filename = `${survey.name.replace(/[^a-zA-Z0-9]/g, "_")}_export.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
