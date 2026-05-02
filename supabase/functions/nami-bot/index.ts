// =============================================================================
//  Nami Bot — Edge Function
//  Actions: launch_cycle, launch_survey, run_reminders, release_grades
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildSelfReviewOpening,
  buildManagerReviewOpening,
  buildUpwardFeedbackOpening,
  buildSurveyOpening,
  buildReminderMessage,
  buildDeadlineReminder,
  buildManagerDeadlineAlert,
} from "../_shared/nami-blocks.ts";
import {
  callSlackApi,
  buildAuthedDashboardUrl,
  SlackRateLimitError,
  sendSlackBlocksWithTs,
} from "../_shared/slack-api.ts";
import { getWorkspaceSlackTokens, type WorkspaceTokens } from "../_shared/workspace-tokens.ts";
import { getDeadlineForCycle } from "../_shared/deadline-resolver.ts";

// Throttle between bulk message sends to avoid hitting Slack rate limits
const BULK_SEND_DELAY_MS = 1000;
function throttle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, BULK_SEND_DELAY_MS));
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL_RAW = Deno.env.get("DASHBOARD_URL");
if (!DASHBOARD_URL_RAW) {
  throw new Error("DASHBOARD_URL secret is not configured for this Supabase project");
}
const DASHBOARD_URL: string = DASHBOARD_URL_RAW;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
//  Cron-secret cache: pulled once from vault.decrypted_secrets and memoised
//  for the lifetime of the isolate. The drain cron fires every 60s, so we
//  do NOT want a DB roundtrip per invocation. If the vault entry is missing
//  (older deployment, vault not yet seeded) we fall back to the env var so
//  rollouts don't break the cron.
// =============================================================================
let cachedVaultCronSecret: string | null | undefined = undefined;
async function getVaultCronSecret(): Promise<string | null> {
  if (cachedVaultCronSecret !== undefined) return cachedVaultCronSecret;
  try {
    const { data, error } = await supabase.rpc("get_cron_secret");
    if (error || !data) {
      cachedVaultCronSecret = null;
      return null;
    }
    cachedVaultCronSecret = String(data);
    return cachedVaultCronSecret;
  } catch {
    cachedVaultCronSecret = null;
    return null;
  }
}

// =============================================================================
//  Shared helpers
// =============================================================================

async function sendSlackBlocks(
  botToken: string,
  slackUserId: string,
  text: string,
  blocks: any[],
): Promise<boolean> {
  try {
    const data = await callSlackApi(botToken, "chat.postMessage", {
      channel: slackUserId, text, blocks,
    });
    if (!data.ok) {
      console.error("Slack API error:", data.error, { channel: slackUserId });
    }
    return data.ok === true;
  } catch (err) {
    console.error("sendSlackBlocks fetch error:", err);
    return false;
  }
}

async function logNotification(
  workspaceId: string,
  userId: string,
  eventType: string,
  referenceId: string,
  reminderCount = 0,
): Promise<boolean> {
  const { error } = await supabase.from("notification_log").insert({
    workspace_id: workspaceId,
    user_id: userId,
    event_type: eventType,
    reference_id: referenceId,
    reminder_count: reminderCount,
  });
  if (!error) return true;
  // Unique constraint violation (23505) = already sent, skip silently
  if ((error as any).code === "23505") return false;
  console.error("logNotification unexpected error:", error.message, {
    eventType,
    referenceId,
  });
  return false;
}

async function rollbackNotification(
  workspaceId: string,
  userId: string,
  eventType: string,
  referenceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("notification_log")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("reference_id", referenceId);
  if (error) {
    console.error("Failed to rollback notification log:", error.message, {
      eventType,
      referenceId,
    });
  }
}

// =============================================================================
//  Manager context
// =============================================================================

interface CompetencyExpectation {
  name: string;
  expectedLevel: number;
  prevRating?: number;
}

interface ManagerContext {
  selfAvg?: number;
  prevRating?: number;
  goalsCount?: number;
  goalsByStatus?: Record<string, number>;
  levelName?: string;
  competencyExpectations?: CompetencyExpectation[];
}

async function getManagerContext(
  employeeId: string,
  cycleId: string,
  workspaceId: string,
): Promise<ManagerContext> {
  const ctx: ManagerContext = {};

  try {
    // 0. Verify cycle belongs to this workspace
    const { data: cycle } = await supabase
      .from("performance_cycles")
      .select("id")
      .eq("id", cycleId)
      .eq("workspace_id", workspaceId)
      .single();
    if (!cycle) return ctx;

    // 1. Self-assessment average for this cycle
    const { data: assignments } = await supabase
      .from("review_assignments")
      .select("id")
      .eq("cycle_id", cycleId)
      .eq("employee_id", employeeId);

    if (assignments && assignments.length > 0) {
      const assignmentIds = assignments.map((a: any) => a.id);
      const { data: selfResponses } = await supabase
        .from("review_responses")
        .select("rating")
        .in("assignment_id", assignmentIds)
        .eq("reviewer_role", "self");

      if (selfResponses && selfResponses.length > 0) {
        const rated = selfResponses.filter((r: any) => r.rating != null);
        if (rated.length > 0) {
          ctx.selfAvg =
            rated.reduce((s: number, r: any) => s + r.rating, 0) / rated.length;
        }
      }
    }

    // 2. Previous cycle overall rating
    const { data: prevAssignments } = await supabase
      .from("review_assignments")
      .select("id, overall_rating")
      .eq("employee_id", employeeId)
      .eq("status", "completed")
      .neq("cycle_id", cycleId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (prevAssignments?.[0]?.overall_rating) {
      ctx.prevRating = prevAssignments[0].overall_rating;
    }

    // 3. Previous cycle per-competency manager ratings
    let prevCompRatings: Record<string, number> = {};
    if (prevAssignments?.[0]?.id) {
      const { data: prevResponses } = await supabase
        .from("review_responses")
        .select("competency_id, rating")
        .eq("assignment_id", prevAssignments[0].id)
        .eq("reviewer_role", "manager");

      if (prevResponses) {
        for (const r of prevResponses) {
          if (r.competency_id && r.rating != null) {
            prevCompRatings[r.competency_id] = r.rating;
          }
        }
      }
    }

    // 4. Employee level name + competency expectations
    const { data: empData } = await supabase
      .from("users")
      .select("level_id, job_title, levels(name, job_families(name))")
      .eq("id", employeeId)
      .eq("workspace_id", workspaceId)
      .single();

    if (empData?.level_id) {
      const level = (empData as any).levels;
      if (level) {
        const jfName = level.job_families?.name;
        ctx.levelName = jfName ? `${jfName} — ${level.name}` : level.name;
      }

      // Fetch competency expectations for this level
      const { data: levelComps } = await supabase
        .from("level_competencies")
        .select("competency_id, expected_level, competencies(name)")
        .eq("level_id", empData.level_id)
        .eq("workspace_id", workspaceId);

      if (levelComps && levelComps.length > 0) {
        ctx.competencyExpectations = levelComps.map((lc: any) => ({
          name: lc.competencies?.name || "Unknown",
          expectedLevel: lc.expected_level,
          prevRating: prevCompRatings[lc.competency_id],
        }));
      }
    }

    // 5. Goal status breakdown
    const { data: goals } = await supabase
      .from("goals")
      .select("id, tracking_status")
      .eq("employee_id", employeeId)
      .eq("status", "active");

    if (goals && goals.length > 0) {
      ctx.goalsCount = goals.length;
      ctx.goalsByStatus = {};
      for (const g of goals) {
        const ts = g.tracking_status || "no_status";
        ctx.goalsByStatus[ts] = (ctx.goalsByStatus[ts] || 0) + 1;
      }
    }
  } catch (err) {
    console.error("getManagerContext error:", err);
  }

  return ctx;
}

// =============================================================================
//  Handle cycle launch — fan-out only
//
//  Replaces the old in-process for-loop (one chat.postMessage per assignment,
//  3 branches each) with a single bulk insert into slack_send_queue. The
//  drainer picks them up at its own cadence, so a 200-person cycle launch
//  returns in <1s instead of timing out at the function's wall-clock cap.
//
//  Idempotency layers:
//   - dedupe_key on the queue collapses repeat enqueues from a double-clicked
//     Launch button into one job (partial unique index, see migration
//     20260421_04_send_queue_dedupe.sql).
//   - notification_log dedup inside sendCycleLaunchDm catches per-recipient
//     duplicates if the same logical job ever reaches the drainer twice.
// =============================================================================

interface CycleDmJobPayload {
  cycle_id: string;
  cycle_name: string;
  deadline_iso: string | null;
  workspace_id: string;
  assignment_id: string;
  role: "self" | "manager" | "upward";
  recipient_app_user_id: string;
  recipient_slack_user_id: string;
  recipient_name: string;
  subject_name?: string;
  // employee_id is needed by manager DMs to fetch the rich manager context
  // (self-avg, prev rating, goals, competency expectations). We lazy-fetch
  // inside the handler rather than serialising the full context into the
  // queue payload.
  subject_employee_id?: string;
}

function makeCycleDmJob(
  cycle: { id: string; name: string; review_deadline: string | null; workspace_id: string },
  assignment: { id: string; employee_id?: string },
  role: "self" | "manager" | "upward",
  recipient: { id: string; slack_user_id: string; slack_name?: string | null },
  subjectName?: string | null,
) {
  const refRole = role === "manager" ? "mgr" : role;
  const payload: CycleDmJobPayload = {
    cycle_id: cycle.id,
    cycle_name: cycle.name,
    deadline_iso: cycle.review_deadline,
    workspace_id: cycle.workspace_id,
    assignment_id: assignment.id,
    role,
    recipient_app_user_id: recipient.id,
    recipient_slack_user_id: recipient.slack_user_id,
    recipient_name: recipient.slack_name || "there",
    subject_name: subjectName ?? undefined,
    subject_employee_id: assignment.employee_id,
  };
  return {
    workspace_id: cycle.workspace_id,
    action: "send_cycle_dm",
    dedupe_key: `cycle_dm:${assignment.id}:${refRole}`,
    payload,
  };
}

// Extracted from the old in-process handler. Same query, same logic — only
// the surrounding control flow changed (now feeds the fan-out instead of
// the for-loop).
async function filterMissedAssignments(assignments: any[], workspaceId: string) {
  const refIdMap = new Map<string, any>();
  for (const a of assignments) {
    if (a.assignment_type === "standard") {
      refIdMap.set(`self_${a.id}`, a);
      refIdMap.set(`mgr_${a.id}`, a);
    } else if (a.assignment_type === "upward") {
      refIdMap.set(`upward_${a.id}`, a);
    }
  }
  const allRefIds = Array.from(refIdMap.keys());
  if (allRefIds.length === 0) return [] as any[];

  const { data: existingLogs } = await supabase
    .from("notification_log")
    .select("reference_id")
    .eq("workspace_id", workspaceId)
    .eq("event_type", "nami_initial")
    .in("reference_id", allRefIds);

  const sentRefIds = new Set((existingLogs || []).map((l: any) => l.reference_id));
  const missedAssignmentIds = new Set<string>();
  for (const a of assignments) {
    if (a.assignment_type === "standard") {
      if (!sentRefIds.has(`self_${a.id}`) || !sentRefIds.has(`mgr_${a.id}`)) {
        missedAssignmentIds.add(a.id);
      }
    } else if (a.assignment_type === "upward") {
      if (!sentRefIds.has(`upward_${a.id}`)) {
        missedAssignmentIds.add(a.id);
      }
    }
  }
  return assignments.filter((a: any) => missedAssignmentIds.has(a.id));
}

async function handleCycleLaunch(cycleId: string, mode: "all" | "missed" = "all") {
  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("id, name, review_deadline, workspace_id")
    .eq("id", cycleId)
    .single();
  if (!cycle) return { queued: 0, error: "Cycle not found" };

  const { data: assignments } = await supabase
    .from("review_assignments")
    .select(
      `
      id,
      employee_id,
      manager_id,
      reviewer_id,
      assignment_type,
      employee:users!review_assignments_employee_id_fkey(id, slack_user_id, slack_name),
      manager:users!review_assignments_manager_id_fkey(id, slack_user_id, slack_name),
      reviewer:users!review_assignments_reviewer_id_fkey(id, slack_user_id, slack_name)
    `,
    )
    .eq("cycle_id", cycleId);
  if (!assignments) return { queued: 0 };

  let filtered = assignments;
  if (mode === "missed") {
    filtered = await filterMissedAssignments(assignments, cycle.workspace_id);
  }

  const jobs: ReturnType<typeof makeCycleDmJob>[] = [];
  for (const a of filtered as any[]) {
    if (a.employee?.slack_user_id && a.assignment_type === "standard") {
      jobs.push(makeCycleDmJob(cycle, a, "self", a.employee));
    }
    if (a.manager?.slack_user_id && a.assignment_type === "standard") {
      jobs.push(makeCycleDmJob(cycle, a, "manager", a.manager, a.employee?.slack_name));
    }
    if (a.reviewer?.slack_user_id && a.assignment_type === "upward") {
      jobs.push(makeCycleDmJob(cycle, a, "upward", a.reviewer, a.employee?.slack_name));
    }
  }

  if (jobs.length === 0) {
    await supabase
      .from("performance_cycles")
      .update({ nami_confirmed: true })
      .eq("id", cycleId);
    return { queued: 0 };
  }

  const { error: insErr } = await supabase
    .from("slack_send_queue")
    .upsert(jobs, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true });
  if (insErr) {
    console.error("[handleCycleLaunch] queue insert failed:", insErr);
    return { queued: 0, error: insErr.message };
  }

  // Recount from DB instead of trusting the insert response. ignoreDuplicates
  // only RETURNS rows it actually inserted, so a re-launch that collides with
  // every existing pending job would report 0 queued — even though the
  // drainer is still chewing through the originals. Counting actual pending
  // rows for THIS launch (matched on the dedupe_keys we just tried to insert)
  // reports the truth in all cases: first launch, partial collision, full
  // collision.
  const dedupeKeys = jobs.map((j) => j.dedupe_key);
  const { count: pending } = await supabase
    .from("slack_send_queue")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", cycle.workspace_id)
    .in("dedupe_key", dedupeKeys)
    .is("completed_at", null);

  await supabase
    .from("performance_cycles")
    .update({ nami_confirmed: true })
    .eq("id", cycleId);
  return { queued: pending ?? jobs.length };
}

// =============================================================================
//  Handle survey launch — fan-out only
//
//  Same shape as handleCycleLaunch: collapse the in-process for-loop into a
//  bulk queue insert. Distinct dedupe_key prefix (`survey_dm:`) and distinct
//  notification_log event_type (`nami_survey_invite`) so survey + cycle DMs
//  for the same physical user can't collide.
// =============================================================================

interface SurveyDmJobPayload {
  survey_id: string;
  survey_name: string;
  workspace_id: string;
  // The Slack DM lands once per user, but a 360-style survey can give one user
  // multiple participant rows (e.g. respondent + reviewer slots). Carry every
  // participant_id the user holds in this survey so the deeplink targets the
  // first row and (optionally, downstream) the handler can mark them all
  // notified in one go.
  participant_id: string;
  participant_ids: string[];
  question_count: number;
  role: string;
  subject_name?: string;
  recipient_app_user_id: string;
  recipient_slack_user_id: string;
  recipient_name: string;
}

function makeSurveyDmJob(
  survey: { id: string; name: string; workspace_id: string },
  userParts: any[],
  recipient: { id: string; slack_user_id: string; slack_name?: string | null },
  questionCount: number,
  subjectName?: string | null,
) {
  const primary = userParts[0];
  const payload: SurveyDmJobPayload = {
    survey_id: survey.id,
    survey_name: survey.name,
    workspace_id: survey.workspace_id,
    participant_id: primary.id,
    participant_ids: userParts.map((p) => p.id),
    question_count: questionCount,
    role: primary.role,
    subject_name: subjectName ?? undefined,
    recipient_app_user_id: recipient.id,
    recipient_slack_user_id: recipient.slack_user_id,
    recipient_name: recipient.slack_name || "there",
  };
  return {
    workspace_id: survey.workspace_id,
    action: "send_survey_invite",
    // Key on (survey_id, user_id) — NOT participant_id. The launch picks one
    // participant per user but the choice is non-deterministic across
    // retries (different sort orders return userParts[0] differently). A
    // participant-keyed dedupe would let a re-launch enqueue a SECOND DM for
    // the same user under a different participant. Per-user keying is
    // stable.
    dedupe_key: `survey_dm:${survey.id}:${recipient.id}`,
    payload,
  };
}

async function handleSurveyLaunch(surveyId: string) {
  const { data: survey } = await supabase
    .from("surveys")
    .select("id, name, type, workspace_id, config")
    .eq("id", surveyId)
    .single();
  if (!survey) return { queued: 0, error: "Survey not found" };

  const config = (survey.config || {}) as Record<string, any>;
  const questions = (config.questions || []) as unknown[];
  const questionCount = questions.length;

  const { data: participants } = await supabase
    .from("survey_participants")
    .select(
      `
      id,
      user_id,
      role,
      subject_user_id,
      status,
      user:users!survey_participants_user_id_fkey(id, slack_user_id, slack_name),
      subject:users!survey_participants_subject_user_id_fkey(id, slack_name)
    `,
    )
    .eq("survey_id", surveyId)
    .eq("status", "pending");
  if (!participants) return { queued: 0 };

  // Drop subject tracking rows — they're not real recipients.
  const filteredParticipants = participants.filter((p: any) => p.role !== "subject");

  // Preserve the old "one consolidated DM per user for 360 surveys" semantics:
  // group by user_id and only enqueue the first participant row per user. The
  // per-participant notification_log dedup (downstream) treats these as
  // distinct logical sends, but a single Slack DM is sent for the user.
  const userParticipants = new Map<string, any[]>();
  for (const p of filteredParticipants as any[]) {
    const userId = p.user?.id;
    if (!userId) continue;
    const existing = userParticipants.get(userId) || [];
    existing.push(p);
    userParticipants.set(userId, existing);
  }

  const jobs: ReturnType<typeof makeSurveyDmJob>[] = [];
  for (const [, userParts] of userParticipants) {
    const primary = userParts[0];
    const user = primary.user;
    if (!user?.slack_user_id) continue;
    const subjectName = primary.subject?.slack_name || undefined;
    jobs.push(makeSurveyDmJob(survey, userParts, user, questionCount, subjectName));
  }

  if (jobs.length === 0) {
    await supabase.from("surveys").update({ nami_confirmed: true }).eq("id", surveyId);
    return { queued: 0 };
  }

  const { error: insErr } = await supabase
    .from("slack_send_queue")
    .upsert(jobs, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true });
  if (insErr) {
    console.error("[handleSurveyLaunch] queue insert failed:", insErr);
    return { queued: 0, error: insErr.message };
  }

  // See handleCycleLaunch above — count actual pending rows so the report is
  // accurate whether we just inserted, collided with a previous launch, or
  // some mix.
  const dedupeKeys = jobs.map((j) => j.dedupe_key);
  const { count: pending } = await supabase
    .from("slack_send_queue")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", survey.workspace_id)
    .in("dedupe_key", dedupeKeys)
    .is("completed_at", null);

  await supabase.from("surveys").update({ nami_confirmed: true }).eq("id", surveyId);
  return { queued: pending ?? jobs.length };
}

// =============================================================================
//  Recurring survey helpers
// =============================================================================

function shouldRecurrenceFire(
  now: Date, lastAt: Date | null, recurrence: string, dayOfWeek: string
): boolean {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  if (days[now.getDay()] !== (dayOfWeek || "monday").toLowerCase()) return false;
  if (!lastAt) return true;
  const daysSinceLast = (now.getTime() - lastAt.getTime()) / (1000 * 60 * 60 * 24);
  switch (recurrence) {
    case "weekly": return daysSinceLast >= 6;
    case "biweekly": return daysSinceLast >= 13;
    case "monthly": return daysSinceLast >= 27;
    default: return false;
  }
}

async function cloneAndLaunchRecurringSurvey(
  templateSurveyId: string, workspaceId: string, config: Record<string, any>, surveyType: string
): Promise<string | null> {
  const { data: template } = await supabase
    .from("surveys")
    .select("name, type, config, created_by")
    .eq("id", templateSurveyId)
    .single();
  if (!template) return null;

  const dateSuffix = new Date().toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  const { data: newSurvey } = await supabase
    .from("surveys")
    .insert({
      workspace_id: workspaceId,
      type: template.type,
      name: `${template.name} — ${dateSuffix}`,
      status: "active",
      config: { ...(template.config as any), parent_survey_id: templateSurveyId },
      created_by: template.created_by,
      nami_confirmed: true,
    })
    .select("id")
    .single();
  if (!newSurvey) return null;

  // Create participants based on targeting config
  const targeting = config.targeting || { mode: "all" };
  const { data: wsUsers } = await supabase
    .from("users")
    .select("id, department")
    .eq("workspace_id", workspaceId);

  let targetUsers = wsUsers || [];
  if (targeting.mode === "departments" && targeting.departments?.length) {
    targetUsers = targetUsers.filter((u: any) => targeting.departments.includes(u.department));
  } else if (targeting.mode === "people" && targeting.user_ids?.length) {
    const idSet = new Set(targeting.user_ids);
    targetUsers = targetUsers.filter((u: any) => idSet.has(u.id));
  }

  const participants = targetUsers.map((u: any) => ({
    survey_id: newSurvey.id,
    user_id: u.id,
    role: "respondent",
    workspace_id: workspaceId,
  }));

  if (participants.length) {
    await supabase.from("survey_participants").insert(participants);
  }

  return newSurvey.id;
}

// =============================================================================
//  Handle reminders (the reminder ladder)
// =============================================================================

async function handleReminders() {
  const now = new Date();
  let sent = 0;
  let skipped = 0;

  // -----------------------------------------------------------------------
  //  Part 0: Check for scheduled sends (nami_send_at)
  // -----------------------------------------------------------------------

  // Scheduled cycle launches
  const { data: scheduledCycles } = await supabase
    .from("performance_cycles")
    .select("id")
    .eq("status", "active")
    .eq("nami_confirmed", true)
    .not("nami_send_at", "is", null)
    .lte("nami_send_at", now.toISOString());

  for (const cycle of scheduledCycles || []) {
    // Check if initial messages were already sent for any assignment in this cycle
    const { data: assignments } = await supabase
      .from("review_assignments")
      .select("id")
      .eq("cycle_id", cycle.id)
      .limit(1);

    if (assignments?.length) {
      const { data: alreadySent } = await supabase
        .from("notification_log")
        .select("id")
        .eq("event_type", "nami_initial")
        .eq("reference_id", `self_${assignments[0].id}`)
        .limit(1);

      if (!alreadySent?.length) {
        // Not yet sent — enqueue now. handleCycleLaunch returns
        // { queued } after the Phase 5/6 fan-out refactor; the real DM
        // sends happen on the drain pass.
        const result = await handleCycleLaunch(cycle.id);
        sent += result.queued ?? 0;
      }
    }
  }

  // Scheduled survey launches
  const { data: scheduledSurveys } = await supabase
    .from("surveys")
    .select("id")
    .eq("status", "active")
    .eq("nami_confirmed", true)
    .not("nami_send_at", "is", null)
    .lte("nami_send_at", now.toISOString());

  for (const survey of scheduledSurveys || []) {
    const { data: participants } = await supabase
      .from("survey_participants")
      .select("id")
      .eq("survey_id", survey.id)
      .limit(1);

    if (participants?.length) {
      const { data: alreadySent } = await supabase
        .from("notification_log")
        .select("id")
        .eq("event_type", "nami_initial")
        .eq("reference_id", `survey_${participants[0].id}`)
        .limit(1);

      if (!alreadySent?.length) {
        const result = await handleSurveyLaunch(survey.id);
        sent += result.queued ?? 0;
      }
    }
  }

  // -----------------------------------------------------------------------
  //  Part 0b: Recurring survey launches
  // -----------------------------------------------------------------------
  const { data: recurringSurveys } = await supabase
    .from("surveys")
    .select("id, config, workspace_id, type")
    .eq("status", "active")
    .eq("nami_confirmed", true);

  for (const survey of recurringSurveys || []) {
    const config = (survey.config || {}) as Record<string, any>;
    if (!config.recurrence) continue;

    const lastAt = config.last_recurrence_at ? new Date(config.last_recurrence_at) : null;
    if (!shouldRecurrenceFire(now, lastAt, config.recurrence, config.recurrence_day)) continue;

    // Clone the survey and create fresh participants
    const newSurveyId = await cloneAndLaunchRecurringSurvey(survey.id, survey.workspace_id, config, survey.type);
    if (newSurveyId) {
      const result = await handleSurveyLaunch(newSurveyId);
      // Only stamp last_recurrence_at AFTER the launch succeeds. If the
      // queue insert errored we leave the timestamp alone so the next cron
      // tick retries — otherwise a transient failure would silently skip
      // this recurrence until the next interval (week/2weeks/month).
      if (!result.error) {
        await supabase.from("surveys").update({
          config: { ...config, last_recurrence_at: now.toISOString() },
        }).eq("id", survey.id);
        sent += result.queued ?? 0;
      } else {
        console.warn(
          `[handleReminders] recurring survey ${survey.id} launch failed; leaving last_recurrence_at unchanged for retry next tick:`,
          result.error,
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  //  Part 1: Review assignment reminders
  // -----------------------------------------------------------------------
  const { data: cycles } = await supabase
    .from("performance_cycles")
    .select("id, name, workspace_id")
    .eq("status", "active")
    .eq("nami_confirmed", true);

  if (cycles) {
    for (const cycle of cycles) {
      const cycleTokens = await getWorkspaceSlackTokens(cycle.workspace_id);
      const botToken = cycleTokens?.botToken;
      if (!botToken) continue;

      const workspaceId = cycle.workspace_id;
      // Phase-aware deadline: if workspaces.phase_deadline_reminders_enabled
      // is on and there's an active phase, target that phase's end_date;
      // otherwise fall back to cycle.review_deadline / cycle.end_date. The
      // 7d/3d/1d/overdue thresholds and the manager deadline alert below
      // both consume the resulting daysLeft.
      // Wrap the resolver in try/catch so one bad cycle (network blip,
      // unexpected DB error) doesn't abort processing of all later cycles
      // in this cron run.
      let deadlineDate: Date | null = null;
      try {
        deadlineDate = await getDeadlineForCycle(supabase, cycle.id, workspaceId);
      } catch (err) {
        console.error(`[nami] getDeadlineForCycle failed for cycle ${cycle.id}:`, err);
        continue; // skip this cycle, keep processing the rest
      }
      const daysLeft = deadlineDate
        ? Math.ceil(
            (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 999;

      // Skip very stale cycles (>30 days past deadline) but allow overdue processing
      if (daysLeft < -30) continue;

      // Get incomplete assignments
      const { data: assignments } = await supabase
        .from("review_assignments")
        .select(
          `
          id,
          employee_id,
          manager_id,
          reviewer_id,
          assignment_type,
          status,
          employee:users!review_assignments_employee_id_fkey(id, slack_user_id, slack_name, manager_id),
          manager:users!review_assignments_manager_id_fkey(id, slack_user_id, slack_name),
          reviewer:users!review_assignments_reviewer_id_fkey(id, slack_user_id, slack_name)
        `,
        )
        .eq("cycle_id", cycle.id)
        .neq("status", "completed");

      if (!assignments) continue;

      for (const a of assignments) {
        // Determine target user and ref prefix based on assignment type
        let targetUser: any = null;
        let refPrefix = "";
        let actionId = "nami_start_review";

        if (a.assignment_type === "upward") {
          targetUser = (a as any).reviewer;
          refPrefix = `upward_${a.id}`;
        } else {
          // Standard assignment — check both self-review (employee) and manager review
          // We handle them as separate reminder targets
          const emp = (a as any).employee;
          const mgr = (a as any).manager;

          // Employee self-review reminder
          if (emp?.slack_user_id) {
            const selfResult = await processAssignmentReminder({
              botToken,
              workspaceId,
              targetUser: emp,
              refPrefix: `self_${a.id}`,
              itemName: `self-review for ${cycle.name}`,
              daysLeft,
              actionId: "nami_start_review",
              actionValue: `self_${a.id}`,
            });
            sent += selfResult.sent;
            skipped += selfResult.skipped;
          }

          // Manager review reminder
          if (mgr?.slack_user_id) {
            const mgrResult = await processAssignmentReminder({
              botToken,
              workspaceId,
              targetUser: mgr,
              refPrefix: `mgr_${a.id}`,
              itemName: `manager review of ${(a as any).employee?.slack_name || "team member"} for ${cycle.name}`,
              daysLeft,
              actionId: "nami_start_review",
              actionValue: `mgr_${a.id}`,
            });
            sent += mgrResult.sent;
            skipped += mgrResult.skipped;
          }

          continue; // skip the common handler below — already handled both
        }

        // Common handler for upward assignments
        if (targetUser?.slack_user_id) {
          const result = await processAssignmentReminder({
            botToken,
            workspaceId,
            targetUser,
            refPrefix,
            itemName: `upward feedback on ${(a as any).employee?.slack_name || "your manager"} for ${cycle.name}`,
            daysLeft,
            actionId,
            actionValue: refPrefix,
          });
          sent += result.sent;
          skipped += result.skipped;
        }
      }

      // -----------------------------------------------------------------
      //  Consolidated manager deadline alerts (1d warning + overdue)
      // -----------------------------------------------------------------
      if (assignments && (daysLeft <= 1 || daysLeft < 0)) {
        const isOverdue = daysLeft < 0;
        const alertType = isOverdue ? "overdue" : "warning";
        const eventType = isOverdue ? "nami_mgr_overdue" : "nami_mgr_warning";

        // Group incomplete assignments by their employee's manager_id
        const mgrReports = new Map<
          string,
          { name: string; itemName: string; status: string }[]
        >();

        for (const a of assignments) {
          const emp = (a as any).employee;
          const managerId = emp?.manager_id;
          if (!managerId) continue;

          // Check if this assignment's self-review is actually incomplete
          const { data: responses } = await supabase
            .from("review_responses")
            .select("id")
            .eq("assignment_id", a.id)
            .eq("reviewer_role", "self")
            .limit(1);

          const selfDone = (responses && responses.length > 0);

          // For standard assignments, report if self-review not done
          if (a.assignment_type === "standard" && !selfDone) {
            if (!mgrReports.has(managerId)) {
              mgrReports.set(managerId, []);
            }
            mgrReports.get(managerId)!.push({
              name: emp.slack_name || "Team member",
              itemName: `self-review for ${cycle.name}`,
              status: a.status || "pending",
            });
          }
        }

        // Send one consolidated DM per manager
        for (const [managerId, reports] of mgrReports) {
          const mgrAlertRef = `mgr_alert_${cycle.id}_${alertType}`;

          const canSend = await logNotification(
            workspaceId,
            managerId,
            eventType,
            mgrAlertRef,
          );
          if (!canSend) continue; // already sent for this cycle + type

          // Fetch manager's Slack info
          const { data: mgrUser } = await supabase
            .from("users")
            .select("id, slack_user_id, slack_name")
            .eq("id", managerId)
            .single();

          if (!mgrUser?.slack_user_id) {
            await rollbackNotification(workspaceId, managerId, eventType, mgrAlertRef);
            continue;
          }

          const blocks = buildManagerDeadlineAlert(
            mgrUser.slack_name || "there",
            reports,
            isOverdue,
          );
          const fallbackText = isOverdue
            ? `${reports.length} team member(s) have overdue reviews for ${cycle.name}`
            : `${reports.length} team member(s) haven't completed reviews — deadline is tomorrow`;

          const ok = await sendSlackBlocks(
            botToken,
            mgrUser.slack_user_id,
            fallbackText,
            blocks,
          );
          if (ok) {
            sent++;
          } else {
            await rollbackNotification(workspaceId, managerId, eventType, mgrAlertRef);
            skipped++;
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  //  Part 2: Survey reminders
  // -----------------------------------------------------------------------
  const { data: surveys } = await supabase
    .from("surveys")
    .select("id, name, closes_at, workspace_id")
    .eq("status", "active")
    .eq("nami_confirmed", true);

  if (surveys) {
    for (const survey of surveys) {
      const surveyTokens = await getWorkspaceSlackTokens(survey.workspace_id);
      const botToken = surveyTokens?.botToken;
      if (!botToken) continue;

      const workspaceId = survey.workspace_id;
      const closesAt = survey.closes_at ? new Date(survey.closes_at) : null;
      const daysLeft = closesAt
        ? Math.ceil(
            (closesAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 999;

      if (daysLeft < 0) continue;

      const { data: participants } = await supabase
        .from("survey_participants")
        .select(
          `
          id,
          user_id,
          status,
          user:users!survey_participants_user_id_fkey(id, slack_user_id, slack_name)
        `,
        )
        .eq("survey_id", survey.id)
        .eq("status", "pending");

      if (!participants) continue;

      for (const p of participants) {
        const user = (p as any).user;
        if (!user?.slack_user_id) continue;

        const refPrefix = `survey_${p.id}`;
        const result = await processSurveyReminder({
          botToken,
          workspaceId,
          targetUser: user,
          refPrefix,
          itemName: `${survey.name} survey`,
          daysLeft,
          now,
          surveyId: survey.id,
          participantId: p.id,
        });
        sent += result.sent;
        skipped += result.skipped;
      }
    }
  }

  return { sent, skipped };
}

// =============================================================================
//  Reminder processing helpers
// =============================================================================

interface AssignmentReminderParams {
  botToken: string;
  workspaceId: string;
  targetUser: any; // { id, slack_user_id, slack_name, manager_id? }
  refPrefix: string;
  itemName: string;
  daysLeft: number;
  actionId: string;
  actionValue: string;
}

async function processAssignmentReminder(
  params: AssignmentReminderParams,
): Promise<{ sent: number; skipped: number }> {
  const {
    botToken,
    workspaceId,
    targetUser,
    refPrefix,
    itemName,
    daysLeft,
    actionId,
    actionValue,
  } = params;

  let sent = 0;
  let skipped = 0;

  // Deadline-anchored events: each fires at most once via notification_log
  // dedup. Three pre-deadline tiers — survey-research sweet spot is 2-3
  // reminders before diminishing returns. The post-deadline ("overdue") tier
  // was dropped: by the time it would fire, the phase has typically
  // auto-advanced and the reminder is noise (negative-spillover research,
  // PMC PMC11046690). Manager escalation at deadline boundary is the
  // evidence-supported path for late submissions and lives separately
  // (manager_deadline_alert).
  const deadlineEvents = [
    { eventType: "nami_reminder_7d", threshold: 7 },
    { eventType: "nami_reminder_3d", threshold: 3 },
    { eventType: "nami_reminder_1d", threshold: 1 },
  ];

  for (const { eventType, threshold } of deadlineEvents) {
    // Reminders fire when daysLeft <= threshold (i.e., approaching deadline).
    const shouldFire = daysLeft <= threshold;

    if (!shouldFire) continue;

    const canSend = await logNotification(
      workspaceId,
      targetUser.id,
      eventType,
      refPrefix,
    );
    if (!canSend) {
      // Already sent this event for this assignment — dedup working
      continue;
    }

    const blocks = buildDeadlineReminder(
      targetUser.slack_name || "there",
      itemName,
      daysLeft,
      actionValue,
      actionId,
    );
    const fallbackText = `Reminder: ${itemName} — ${daysLeft <= 1 ? "due tomorrow" : `due in ${daysLeft} days`}`;

    const ok = await sendSlackBlocks(
      botToken,
      targetUser.slack_user_id,
      fallbackText,
      blocks,
    );
    if (ok) {
      sent++;
    } else {
      await rollbackNotification(
        workspaceId,
        targetUser.id,
        eventType,
        refPrefix,
      );
      skipped++;
    }
  }

  return { sent, skipped };
}

interface SurveyReminderParams {
  botToken: string;
  workspaceId: string;
  targetUser: any;
  refPrefix: string;
  itemName: string;
  daysLeft: number;
  now: Date;
  surveyId: string;
  participantId: string;
}

async function processSurveyReminder(
  params: SurveyReminderParams,
): Promise<{ sent: number; skipped: number }> {
  const {
    botToken,
    workspaceId,
    targetUser,
    refPrefix,
    itemName,
    daysLeft,
    now,
    surveyId,
    participantId,
  } = params;

  let sent = 0;
  let skipped = 0;

  // Count existing reminders
  const { data: existingLogs } = await supabase
    .from("notification_log")
    .select("id, event_type, sent_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUser.id)
    .like("reference_id", refPrefix)
    .like("event_type", "nami_%")
    .order("sent_at", { ascending: false });

  const reminderEntries = (existingLogs || []).filter(
    (l: any) =>
      l.event_type.startsWith("nami_reminder_") ||
      l.event_type === "nami_initial",
  );
  const reminderCount = reminderEntries.filter((l: any) =>
    l.event_type.startsWith("nami_reminder_"),
  ).length;
  const lastSentAt = reminderEntries[0]?.sent_at
    ? new Date(reminderEntries[0].sent_at)
    : null;
  const daysSinceLast = lastSentAt
    ? (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  // Regular reminder: < 3 reminders AND 3+ days since last
  if (reminderCount < 3 && daysSinceLast >= 3) {
    const nextNum = reminderCount + 1;
    const eventType = `nami_reminder_${nextNum}`;
    const actionValue = JSON.stringify({ participantId, surveyId });
    const canSend = await logNotification(
      workspaceId,
      targetUser.id,
      eventType,
      refPrefix,
    );
    if (canSend) {
      const blocks = buildReminderMessage(
        targetUser.slack_name || "there",
        itemName,
        nextNum,
        daysLeft,
        actionValue,
        "nami_start_survey",
      );
      const ok = await sendSlackBlocks(
        botToken,
        targetUser.slack_user_id,
        `Reminder ${nextNum}: ${itemName}`,
        blocks,
      );
      if (ok) {
        sent++;
      } else {
        await rollbackNotification(
          workspaceId,
          targetUser.id,
          eventType,
          refPrefix,
        );
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  return { sent, skipped };
}

// =============================================================================
//  Auth helpers
// =============================================================================

/**
 * Validate a Supabase JWT and return the caller's workspace_id.
 * Uses auth.getUser() for cryptographic verification, then looks up the
 * workspace via the user's email (email is provider-set, not user-editable).
 */
// =============================================================================
//  Handle release grades — fan-out only
//
//  Same shape as the cycle/survey launches. Distinct dedupe_key prefix
//  (`grade_dm:`) and distinct notification_log event_type
//  (`nami_grade_release`) keep these isolated from cycle launch DMs that
//  share the same assignment_id.
//
//  The cycle's stamped rating scale max_value is captured at enqueue time
//  and stored in the payload so the drainer doesn't need to re-resolve it.
// =============================================================================

interface GradeReleaseDmJobPayload {
  cycle_id: string;
  cycle_name: string;
  workspace_id: string;
  assignment_id: string;
  rating_max: number;
  overall_rating: number | null;
  final_grade: string | null;
  recipient_app_user_id: string;
  recipient_slack_user_id: string;
}

function makeGradeReleaseDmJob(
  cycle: { id: string; name: string; workspace_id: string },
  ratingMax: number,
  assignment: { id: string; overall_rating: number | null; final_grade: string | null },
  recipient: { id: string; slack_user_id: string },
) {
  const payload: GradeReleaseDmJobPayload = {
    cycle_id: cycle.id,
    cycle_name: cycle.name,
    workspace_id: cycle.workspace_id,
    assignment_id: assignment.id,
    rating_max: ratingMax,
    overall_rating: assignment.overall_rating,
    final_grade: assignment.final_grade,
    recipient_app_user_id: recipient.id,
    recipient_slack_user_id: recipient.slack_user_id,
  };
  return {
    workspace_id: cycle.workspace_id,
    action: "send_grade_release",
    dedupe_key: `grade_dm:${assignment.id}`,
    payload,
  };
}

async function handleReleaseGrades(cycleId: string) {
  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select(
      "id, name, workspace_id, rating_scale_id, rating_scale:rating_scales!performance_cycles_rating_scale_id_fkey(max_value)",
    )
    .eq("id", cycleId)
    .single();
  if (!cycle) return { queued: 0, error: "Cycle not found" };

  // Fall back to 5 only if the cycle has no stamped scale (pre-backfill data).
  const ratingMax: number = (cycle as any).rating_scale?.max_value ?? 5;

  const { data: assignments } = await supabase
    .from("review_assignments")
    .select(
      `
      id,
      overall_rating,
      final_grade,
      employee:users!review_assignments_employee_id_fkey(id, slack_user_id, slack_name)
    `,
    )
    .eq("cycle_id", cycleId)
    .eq("assignment_type", "standard");
  if (!assignments) return { queued: 0 };

  const jobs: ReturnType<typeof makeGradeReleaseDmJob>[] = [];
  for (const a of assignments as any[]) {
    const emp = a.employee;
    if (!emp?.slack_user_id) continue;
    jobs.push(
      makeGradeReleaseDmJob(
        cycle,
        ratingMax,
        { id: a.id, overall_rating: a.overall_rating, final_grade: a.final_grade },
        emp,
      ),
    );
  }

  if (jobs.length === 0) return { queued: 0 };

  const { error: insErr } = await supabase
    .from("slack_send_queue")
    .upsert(jobs, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true });
  if (insErr) {
    console.error("[handleReleaseGrades] queue insert failed:", insErr);
    return { queued: 0, error: insErr.message };
  }

  // See handleCycleLaunch above — count actual pending rows so the report is
  // accurate whether we just inserted, collided with a previous launch, or
  // some mix.
  const dedupeKeys = jobs.map((j) => j.dedupe_key);
  const { count: pending } = await supabase
    .from("slack_send_queue")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", cycle.workspace_id)
    .in("dedupe_key", dedupeKeys)
    .is("completed_at", null);
  return { queued: pending ?? jobs.length };
}

async function resolveCallerWorkspace(
  token: string,
): Promise<{ workspaceId: string } | null> {
  const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);
  if (error || !user?.email) return null;

  const { data: dbUser } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("slack_email", user.email)
    .single();

  return dbUser ? { workspaceId: dbUser.workspace_id } : null;
}

/**
 * Verify that a resource (cycle or survey) belongs to the caller's workspace.
 */
async function verifyResourceOwnership(
  table: "performance_cycles" | "surveys",
  resourceId: string,
  callerWorkspaceId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(table)
    .select("workspace_id")
    .eq("id", resourceId)
    .single();

  return data?.workspace_id === callerWorkspaceId;
}

// =============================================================================
//  Slack send queue drain — processes feedback + new-reviewer DMs
// =============================================================================

interface QueueJob {
  id: string;
  workspace_id: string;
  action: string;
  payload: Record<string, unknown>;
  attempts: number;
}

// Drain handlers can optionally return a Slack message_ts on success — the
// drainer records it via complete_slack_send_job_with_ts so we can audit
// "Slack accepted but we crashed before ack'ing" failures.
type DrainResult = { ok: boolean; ts?: string; error?: string };

// =============================================================================
//  Bulk launch DM handlers — drained from slack_send_queue. Each handler
//  uses logNotification + sendSlackBlocksWithTs and only rolls back the
//  notification_log row when Slack explicitly rejects (knownRejected=true).
//  Indeterminate failures (network reset, 5xx) leave the row in place so
//  the retry will hit the canSend=false branch and no-op rather than risk
//  a duplicate DM.
// =============================================================================

async function sendCycleLaunchDm(
  job: QueueJob,
  tokenFor: (wsId: string) => Promise<WorkspaceTokens | null>,
): Promise<DrainResult> {
  const p = job.payload as unknown as CycleDmJobPayload;
  const refRole = p.role === "manager" ? "mgr" : p.role;
  const refId = `${refRole}_${p.assignment_id}`;
  const eventType = "nami_initial";

  const canSend = await logNotification(
    p.workspace_id,
    p.recipient_app_user_id,
    eventType,
    refId,
  );
  if (!canSend) return { ok: true }; // already delivered, no-op

  const tokens = await tokenFor(p.workspace_id);
  const botToken = tokens?.botToken;
  if (!botToken) {
    // Workspace has no Slack token (uninstalled or token revoked). Terminal —
    // mark complete and don't retry. We deliberately do NOT roll back the
    // notification_log row: if the workspace re-installs later, the row
    // prevents an accidental re-delivery of a now-stale launch DM.
    // TODO (Task 13): set workspaces.requires_reinstall = true here so the
    // dashboard surfaces the issue.
    console.warn(
      `[send_cycle_dm] workspace ${p.workspace_id} has no bot token — marking job complete without delivery`,
    );
    return { ok: true };
  }

  const deadline = p.deadline_iso
    ? new Date(p.deadline_iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "no deadline set";

  let blocks: unknown[];
  let text: string;
  if (p.role === "self") {
    blocks = buildSelfReviewOpening(p.recipient_name, p.cycle_name, deadline, p.assignment_id);
    text = `Your self-review for ${p.cycle_name} is ready`;
  } else if (p.role === "manager") {
    // manager_context is the only field heavy enough to lazy-fetch (5+
    // queries; not worth serialising into payload). Falls back to an empty
    // context if subject_employee_id is missing — the block builder
    // handles that gracefully.
    const ctx = p.subject_employee_id
      ? await getManagerContext(p.subject_employee_id, p.cycle_id, p.workspace_id)
      : {};
    blocks = buildManagerReviewOpening(
      p.recipient_name,
      p.subject_name ?? "a team member",
      p.cycle_name,
      deadline,
      p.assignment_id,
      ctx,
    );
    text = `Time to review ${p.subject_name ?? "a team member"} for ${p.cycle_name}`;
  } else {
    blocks = buildUpwardFeedbackOpening(
      p.recipient_name,
      p.subject_name ?? "your manager",
      p.cycle_name,
      deadline,
      p.assignment_id,
    );
    text = `Upward feedback requested for ${p.subject_name ?? "your manager"}`;
  }

  const sendResult = await sendSlackBlocksWithTs(
    botToken,
    p.recipient_slack_user_id,
    text,
    blocks,
  );
  if (sendResult.ok) {
    return { ok: true, ts: sendResult.ts };
  }
  if (sendResult.knownRejected) {
    await rollbackNotification(p.workspace_id, p.recipient_app_user_id, eventType, refId);
  }
  return { ok: false, error: sendResult.error };
}

async function sendSurveyInviteDm(
  job: QueueJob,
  tokenFor: (wsId: string) => Promise<WorkspaceTokens | null>,
): Promise<DrainResult> {
  const p = job.payload as unknown as SurveyDmJobPayload;
  // Key the notification_log row on (survey_id, user_id) — matches the
  // queue dedupe_key so both layers protect against the same double-DM
  // scenario described on makeSurveyDmJob. Was: `survey_${participant_id}`,
  // which let a re-launch with a different participant ordering re-deliver.
  const refId = `survey_${p.survey_id}_user_${p.recipient_app_user_id}`;
  const eventType = "nami_survey_invite";

  const canSend = await logNotification(
    p.workspace_id,
    p.recipient_app_user_id,
    eventType,
    refId,
  );
  if (!canSend) return { ok: true };

  const tokens = await tokenFor(p.workspace_id);
  const botToken = tokens?.botToken;
  if (!botToken) {
    // See sendCycleLaunchDm — terminal, no rollback, TODO surfaces in
    // dashboard via Task 13's requires_reinstall flag.
    console.warn(
      `[send_survey_invite] workspace ${p.workspace_id} has no bot token — marking job complete without delivery`,
    );
    return { ok: true };
  }

  const blocks = buildSurveyOpening(
    p.recipient_name,
    p.survey_name,
    p.question_count,
    p.participant_id,
    p.survey_id,
    p.role,
    p.subject_name,
  );
  const text = `You're invited to take the ${p.survey_name} survey`;

  const sendResult = await sendSlackBlocksWithTs(
    botToken,
    p.recipient_slack_user_id,
    text,
    blocks,
  );
  if (sendResult.ok) return { ok: true, ts: sendResult.ts };
  if (sendResult.knownRejected) {
    await rollbackNotification(p.workspace_id, p.recipient_app_user_id, eventType, refId);
  }
  return { ok: false, error: sendResult.error };
}

async function sendGradeReleaseDm(
  job: QueueJob,
  tokenFor: (wsId: string) => Promise<WorkspaceTokens | null>,
): Promise<DrainResult> {
  const p = job.payload as unknown as GradeReleaseDmJobPayload;
  const refId = `grade_${p.assignment_id}`;
  const eventType = "nami_grade_release";

  const canSend = await logNotification(
    p.workspace_id,
    p.recipient_app_user_id,
    eventType,
    refId,
  );
  if (!canSend) return { ok: true };

  const tokens = await tokenFor(p.workspace_id);
  const botToken = tokens?.botToken;
  if (!botToken) {
    // See sendCycleLaunchDm — terminal, no rollback, TODO surfaces in
    // dashboard via Task 13's requires_reinstall flag.
    console.warn(
      `[send_grade_release] workspace ${p.workspace_id} has no bot token — marking job complete without delivery`,
    );
    return { ok: true };
  }

  const ratingStr = p.overall_rating
    ? `${Math.round(p.overall_rating * 10) / 10}/${p.rating_max}`
    : null;
  const gradeStr = p.final_grade || null;
  const resultParts: string[] = [];
  if (ratingStr) resultParts.push(`:star: *${ratingStr}*`);
  if (gradeStr) resultParts.push(`:medal: *${gradeStr}*`);
  const resultLine = resultParts.length > 0 ? resultParts.join("  ·  ") : "_No rating available_";

  const resultsUrl = await buildAuthedDashboardUrl(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    DASHBOARD_URL,
    p.recipient_app_user_id,
    "/dashboard/performance",
  );

  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:tada: *Your ${p.cycle_name} results are in!*\n\n${resultLine}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "View your full results including competency breakdown and feedback on the dashboard.",
        },
      ],
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View my results :chart_with_upwards_trend:", emoji: true },
          style: "primary",
          url: resultsUrl,
          action_id: "open_results",
        },
      ],
    },
  ];

  const text = `Your ${p.cycle_name} review results are ready`;
  const sendResult = await sendSlackBlocksWithTs(
    botToken,
    p.recipient_slack_user_id,
    text,
    blocks,
  );
  if (sendResult.ok) return { ok: true, ts: sendResult.ts };
  if (sendResult.knownRejected) {
    await rollbackNotification(p.workspace_id, p.recipient_app_user_id, eventType, refId);
  }
  return { ok: false, error: sendResult.error };
}

async function sendFeedbackDm(
  job: QueueJob,
  tokenFor: (wsId: string) => Promise<WorkspaceTokens | null>,
): Promise<DrainResult> {
  // Audit (Section 6.5): no notification_log involvement here, so there's
  // nothing to roll back on a knownRejected error. Routing through the
  // sendSlackBlocksWithTs path is still useful: we capture the Slack ts
  // for audit when the send succeeds.
  const feedbackId = job.payload.feedback_id as string | undefined;
  if (!feedbackId) return { ok: false, error: "missing feedback_id" };

  const { data: fb } = await supabase
    .from("continuous_feedback")
    .select(
      `
      id, workspace_id, message, feedback_type, is_anonymous, shared_with_employee,
      from_user:users!continuous_feedback_from_user_id_fkey(slack_name),
      to_user:users!continuous_feedback_to_user_id_fkey(slack_user_id, slack_name)
      `,
    )
    .eq("id", feedbackId)
    .single();
  if (!fb) return { ok: false, error: "feedback not found" };

  // Only DM when the sender actually shared it with the recipient.
  if (!fb.shared_with_employee) return { ok: true };

  const recipient = (fb as { to_user?: { slack_user_id?: string; slack_name?: string } | null }).to_user;
  if (!recipient?.slack_user_id) return { ok: true };

  const tokens = await tokenFor(job.workspace_id);
  const botToken = tokens?.botToken;
  if (!botToken) return { ok: false, error: "no bot token" };

  const sender = fb.is_anonymous
    ? "someone in your workspace"
    : (fb as { from_user?: { slack_name?: string } | null }).from_user?.slack_name ?? "a teammate";
  const typeLabel =
    fb.feedback_type === "praise" ? ":clap: praise"
    : fb.feedback_type === "constructive" ? ":speech_balloon: constructive feedback"
    : fb.feedback_type === "improvement" ? ":chart_with_upwards_trend: improvement suggestion"
    : ":speech_balloon: feedback";

  // Route through callSlackApi so 429s bubble up as SlackRateLimitError and
  // the drain loop can requeue without burning an attempt.
  const open = await callSlackApi(botToken, "conversations.open", { users: recipient.slack_user_id });
  const channel = open?.channel?.id;
  if (!channel) return { ok: false, error: `conversations.open: ${open?.error ?? "unknown"}` };

  const text = `${typeLabel} from ${sender}:\n> ${String(fb.message).replace(/\n/g, "\n> ")}`;
  const sendResult = await sendSlackBlocksWithTs(botToken, channel, text);
  if (sendResult.ok) return { ok: true, ts: sendResult.ts };
  return { ok: false, error: `postMessage: ${sendResult.error ?? "unknown"}` };
}

async function sendNewReviewerDm(
  job: QueueJob,
  tokenFor: (wsId: string) => Promise<WorkspaceTokens | null>,
): Promise<DrainResult> {
  const assignmentId = job.payload.assignment_id as string | undefined;
  if (!assignmentId) return { ok: false, error: "missing assignment_id" };

  const { data: a } = await supabase
    .from("review_assignments")
    .select(
      `
      id, assignment_type, status, reviewer_id, cycle_id,
      cycle:performance_cycles!review_assignments_cycle_id_fkey(name, status),
      reviewer:users!review_assignments_reviewer_id_fkey(slack_user_id, slack_name),
      employee:users!review_assignments_employee_id_fkey(slack_name)
      `,
    )
    .eq("id", assignmentId)
    .single();
  if (!a) return { ok: false, error: "assignment not found" };

  const cycle = (a as { cycle?: { name?: string; status?: string } | null }).cycle;
  if (cycle?.status !== "active") return { ok: true }; // cycle paused — skip, keep completed
  const reviewer = (a as { reviewer?: { slack_user_id?: string; slack_name?: string } | null }).reviewer;
  if (!reviewer?.slack_user_id) return { ok: true };
  const employee = (a as { employee?: { slack_name?: string } | null }).employee;

  const tokens = await tokenFor(job.workspace_id);
  const botToken = tokens?.botToken;
  if (!botToken) return { ok: false, error: "no bot token" };

  const open = await callSlackApi(botToken, "conversations.open", { users: reviewer.slack_user_id });
  const channel = open?.channel?.id;
  if (!channel) return { ok: false, error: `conversations.open: ${open?.error ?? "unknown"}` };

  const kind = a.assignment_type === "upward" ? "upward review" : "peer review";
  const text = [
    `:wave: You've been added as a reviewer on an active cycle.`,
    `:clipboard: *${cycle?.name ?? "cycle"}* — ${kind} for *${employee?.slack_name ?? "a teammate"}*.`,
    `Open the dashboard when you're ready to fill it in.`,
  ].join("\n");

  const sendResult = await sendSlackBlocksWithTs(botToken, channel, text);
  if (sendResult.ok) return { ok: true, ts: sendResult.ts };
  return { ok: false, error: `postMessage: ${sendResult.error ?? "unknown"}` };
}

async function refreshHomeTab(
  job: QueueJob,
  tokenFor: (wsId: string) => Promise<WorkspaceTokens | null>,
): Promise<DrainResult> {
  const appUserId = job.payload.app_user_id as string | undefined;
  if (!appUserId) return { ok: false, error: "missing app_user_id" };
  const { data: u } = await supabase
    .from("users")
    .select("slack_user_id")
    .eq("id", appUserId)
    .single();
  const slackUserId = (u as { slack_user_id?: string } | null)?.slack_user_id;
  if (!slackUserId) return { ok: true }; // nothing to refresh — user has no Slack link

  const tokens = await tokenFor(job.workspace_id);
  const botToken = tokens?.botToken;
  if (!botToken) return { ok: false, error: "no bot token" };

  // Trigger a no-op views.publish. The slack-events handler listens for
  // app_home_opened and rebuilds the view content; here we just poke Slack
  // to fetch the latest via the event-based refresh mechanism. For now
  // publish a minimal holding view; slack-events's own handler provides
  // the rich one. If the user hasn't opened the home tab yet, Slack will
  // reject with channel_not_found — treat that as success (idempotent).
  const resp = await callSlackApi(botToken, "views.publish", {
    user_id: slackUserId,
    view: {
      type: "home",
      blocks: [{ type: "section", text: { type: "mrkdwn", text: ":arrows_counterclockwise: Refreshing..." } }],
    },
  });
  if (!resp?.ok) {
    if (resp?.error === "channel_not_found" || resp?.error === "not_allowed_token_type") {
      return { ok: true };
    }
    return { ok: false, error: `views.publish: ${resp?.error ?? "unknown"}` };
  }
  return { ok: true };
}

async function handleDrainSendQueue() {
  const { data: jobsRaw, error: claimErr } = await supabase.rpc("claim_slack_send_jobs", { p_limit: 25 });
  if (claimErr) {
    return { processed: 0, error: claimErr.message };
  }
  const jobs = (jobsRaw ?? []) as QueueJob[];

  // Per-drain token cache: collapses N jobs from one workspace into one
  // Vault decrypt round-trip. Cache lifetime = single drain invocation.
  const tokenCache = new Map<string, WorkspaceTokens | null>();
  async function tokenFor(workspaceId: string): Promise<WorkspaceTokens | null> {
    if (tokenCache.has(workspaceId)) return tokenCache.get(workspaceId) ?? null;
    const t = await getWorkspaceSlackTokens(workspaceId);
    tokenCache.set(workspaceId, t);
    return t;
  }

  let succeeded = 0;
  let failed = 0;
  let requeued = 0;
  for (const job of jobs) {
    try {
      let result: DrainResult;
      if (job.action === "notify_feedback") {
        result = await sendFeedbackDm(job, tokenFor);
      } else if (job.action === "notify_new_reviewer") {
        result = await sendNewReviewerDm(job, tokenFor);
      } else if (job.action === "refresh_home_tab") {
        result = await refreshHomeTab(job, tokenFor);
      } else if (job.action === "send_cycle_dm") {
        result = await sendCycleLaunchDm(job, tokenFor);
      } else if (job.action === "send_survey_invite") {
        result = await sendSurveyInviteDm(job, tokenFor);
      } else if (job.action === "send_grade_release") {
        result = await sendGradeReleaseDm(job, tokenFor);
      } else {
        result = { ok: false, error: `unknown action ${job.action}` };
      }
      // Prefer the with-ts RPC when Slack returned a message_ts. Stores the
      // ts in slack_send_queue.slack_message_ts for audit/cleanup; the
      // notification_log dedup is what protects against double-sends, so
      // the queue ts is informational only.
      if (result.ok && result.ts) {
        await supabase.rpc("complete_slack_send_job_with_ts", {
          p_id: job.id,
          p_slack_message_ts: result.ts,
        });
      } else {
        await supabase.rpc("complete_slack_send_job", {
          p_id: job.id,
          p_success: result.ok,
          p_error: result.ok ? null : result.error ?? null,
        });
      }
      if (result.ok) succeeded++;
      else failed++;
    } catch (e) {
      // Slack rate limits: honour Retry-After at the queue layer instead of
      // burning attempts. Reset locked_at + next_attempt_at and leave the
      // attempt counter untouched so the job has its full retry budget for
      // actual failures.
      if (e instanceof SlackRateLimitError) {
        const nextAttemptAt = new Date(Date.now() + e.retryAfterSeconds * 1000).toISOString();
        await supabase
          .from("slack_send_queue")
          .update({
            locked_at: null,
            next_attempt_at: nextAttemptAt,
            last_error: `rate-limited; retry after ${e.retryAfterSeconds}s`,
          })
          .eq("id", job.id);
        requeued++;
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.rpc("complete_slack_send_job", {
        p_id: job.id,
        p_success: false,
        p_error: msg,
      });
      failed++;
    }
  }
  return { processed: jobs.length, succeeded, failed, requeued };
}

// =============================================================================
//  Deno.serve() — CRON_SECRET or validated JWT auth, routes action to handlers
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // -------------------------------------------------------------------------
  //  Authentication: accept CRON_SECRET, the Supabase service role key
  //  (used by pg_cron → pg_net calls), or a validated Supabase JWT.
  // -------------------------------------------------------------------------
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") || "";
  // Vault-stored cron_secret is sent by pg_cron in a custom x-cron-secret
  // header. We can't put it in Authorization because the Supabase API
  // gateway requires Authorization to be a valid JWT (so the cron still
  // sends Bearer <anon_key> there to clear the gateway). Fetched lazily
  // and memoised so we don't add a DB roundtrip to every cron tick.
  const cronSecretHeader = req.headers.get("x-cron-secret") || "";
  const vaultCronSecret = await getVaultCronSecret();
  const hasCronAuth =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) ||
    (vaultCronSecret && cronSecretHeader === vaultCronSecret);

  // For JWT auth: extract the token and cryptographically verify it
  let callerWorkspaceId: string | null = null;
  let hasJwtAuth = false;

  if (!hasCronAuth && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const resolved = await resolveCallerWorkspace(token);
    if (resolved) {
      callerWorkspaceId = resolved.workspaceId;
      hasJwtAuth = true;
    }
  }

  // Parse body before the auth gate. Phase 3 / Task 10: every action now
  // requires cron or JWT auth — drain_send_queue was previously on a
  // no-auth carve-out because the cron sent only the public anon-key
  // (which our auth.getUser-based JWT path can't validate). The cron now
  // uses the vault-stored cron_secret instead, so the carve-out is gone.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { action, cycle_id, survey_id, mode } = body as {
    action?: string;
    cycle_id?: string;
    survey_id?: string;
    mode?: string;
  };

  const ACTIONS_WITHOUT_AUTH = new Set<string>([]); // empty — every action requires auth
  if (!hasCronAuth && !hasJwtAuth && !ACTIONS_WITHOUT_AUTH.has(String(action))) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  try {

    // -----------------------------------------------------------------------
    //  run_reminders: CRON_SECRET only (iterates all workspaces)
    // -----------------------------------------------------------------------
    if (action === "run_reminders") {
      if (!hasCronAuth) {
        return new Response(
          JSON.stringify({ error: "run_reminders requires CRON_SECRET auth" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const result = await handleReminders();
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -----------------------------------------------------------------------
    //  launch_cycle / launch_survey: verify workspace ownership
    // -----------------------------------------------------------------------
    if (action === "launch_cycle" && cycle_id) {
      // JWT callers must own the cycle; CRON_SECRET bypasses (trusted)
      if (hasJwtAuth) {
        const owns = await verifyResourceOwnership(
          "performance_cycles",
          cycle_id,
          callerWorkspaceId!,
        );
        if (!owns) {
          return new Response(
            JSON.stringify({ error: "Forbidden: cycle belongs to another workspace" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      const result = await handleCycleLaunch(cycle_id, mode === "missed" ? "missed" : "all");
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "launch_survey" && survey_id) {
      if (hasJwtAuth) {
        const owns = await verifyResourceOwnership(
          "surveys",
          survey_id,
          callerWorkspaceId!,
        );
        if (!owns) {
          return new Response(
            JSON.stringify({ error: "Forbidden: survey belongs to another workspace" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      const result = await handleSurveyLaunch(survey_id);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "release_grades" && cycle_id) {
      if (hasJwtAuth) {
        const owns = await verifyResourceOwnership(
          "performance_cycles",
          cycle_id,
          callerWorkspaceId!,
        );
        if (!owns) {
          return new Response(
            JSON.stringify({ error: "Forbidden: cycle belongs to another workspace" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      const result = await handleReleaseGrades(cycle_id);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -----------------------------------------------------------------------
    //  drain_send_queue: cron-only. Claims up to 25 queued jobs
    //  (feedback DMs, post-launch reviewer notifications), processes each,
    //  marks success/failure with exponential backoff.
    //
    //  Phase 3 / Task 10: this endpoint now requires hasCronAuth — the
    //  pg_cron job sends Bearer <vault.cron_secret> instead of the public
    //  anon-key it used previously. The data-layer guarantees still hold
    //  (SECURITY DEFINER triggers on the queue, 25-job cap, 5-attempt cap,
    //  FOR UPDATE SKIP LOCKED on claim) but defense-in-depth: the auth
    //  check now keeps random anon-key holders out of the drain loop.
    // -----------------------------------------------------------------------
    if (action === "drain_send_queue") {
      const result = await handleDrainSendQueue();
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("nami-bot error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
