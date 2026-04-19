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
  buildManagerEscalation,
  buildFinalWarning,
  buildDeadlineReminder,
  buildOverdueNotice,
  buildManagerDeadlineAlert,
} from "../_shared/nami-blocks.ts";
import { callSlackApi, buildAuthedDashboardUrl, SlackRateLimitError } from "../_shared/slack-api.ts";

// Throttle between bulk message sends to avoid hitting Slack rate limits
const BULK_SEND_DELAY_MS = 1000;
function throttle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, BULK_SEND_DELAY_MS));
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL");
if (!DASHBOARD_URL) {
  throw new Error("DASHBOARD_URL secret is not configured for this Supabase project");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
//  Handle cycle launch
// =============================================================================

async function handleCycleLaunch(cycleId: string, mode: "all" | "missed" = "all") {
  // Fetch cycle + workspace bot token
  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("id, name, review_deadline, workspace_id, workspaces(bot_token)")
    .eq("id", cycleId)
    .single();

  if (!cycle) return { sent: 0, skipped: 0, error: "Cycle not found" };

  const botToken = (cycle as any).workspaces?.bot_token;
  if (!botToken) return { sent: 0, skipped: 0, error: "No bot token" };

  const workspaceId = cycle.workspace_id;
  const deadline = cycle.review_deadline
    ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "no deadline set";

  // Fetch all review assignments for this cycle
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

  if (!assignments) return { sent: 0, skipped: 0, failed: 0, failedUsers: [] as string[] };

  // --- "missed" mode: filter to only assignments without existing notification_log entries ---
  let filteredAssignments = assignments;
  if (mode === "missed") {
    // Build all possible ref IDs for each assignment
    const refIdMap = new Map<string, any>(); // refId -> assignment
    for (const a of assignments) {
      if (a.assignment_type === "standard") {
        refIdMap.set(`self_${a.id}`, a);
        refIdMap.set(`mgr_${a.id}`, a);
      } else if (a.assignment_type === "upward") {
        refIdMap.set(`upward_${a.id}`, a);
      }
    }

    const allRefIds = Array.from(refIdMap.keys());
    // Query notification_log for existing entries for this cycle's assignments
    const { data: existingLogs } = await supabase
      .from("notification_log")
      .select("reference_id")
      .eq("workspace_id", workspaceId)
      .eq("event_type", "nami_initial")
      .in("reference_id", allRefIds);

    const sentRefIds = new Set((existingLogs || []).map((l: any) => l.reference_id));

    // Keep only assignments that have at least one unsent notification
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
    filteredAssignments = assignments.filter((a: any) => missedAssignmentIds.has(a.id));
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const failedUsers: string[] = [];

  for (let _i = 0; _i < filteredAssignments.length; _i++) {
    const a = filteredAssignments[_i];
    const emp = (a as any).employee;
    const mgr = (a as any).manager;

    // Throttle between iterations to respect Slack rate limits
    if (_i > 0) await throttle();

    // --- Employee self-review ---
    if (emp?.slack_user_id && a.assignment_type === "standard") {
      try {
        const refId = `self_${a.id}`;
        const canSend = await logNotification(
          workspaceId,
          emp.id,
          "nami_initial",
          refId,
        );
        if (canSend) {
          const blocks = buildSelfReviewOpening(
            emp.slack_name || "there",
            cycle.name,
            deadline,
            a.id,
          );
          const ok = await sendSlackBlocks(
            botToken,
            emp.slack_user_id,
            `Your self-review for ${cycle.name} is ready`,
            blocks,
          );
          if (ok) {
            sent++;
          } else {
            await rollbackNotification(workspaceId, emp.id, "nami_initial", refId);
            failed++;
            failedUsers.push(emp.slack_name || emp.id);
          }
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Error sending self-review notification to ${emp.slack_name || emp.id}:`, err);
        failed++;
        failedUsers.push(emp.slack_name || emp.id);
      }
    }

    // --- Manager review ---
    if (mgr?.slack_user_id && a.assignment_type === "standard") {
      try {
        const refId = `mgr_${a.id}`;
        const canSend = await logNotification(
          workspaceId,
          mgr.id,
          "nami_initial",
          refId,
        );
        if (canSend) {
          const context = await getManagerContext(a.employee_id, cycleId, workspaceId);
          const blocks = buildManagerReviewOpening(
            mgr.slack_name || "there",
            emp?.slack_name || "a team member",
            cycle.name,
            deadline,
            a.id,
            context,
          );
          const ok = await sendSlackBlocks(
            botToken,
            mgr.slack_user_id,
            `Time to review ${emp?.slack_name || "a team member"} for ${cycle.name}`,
            blocks,
          );
          if (ok) {
            sent++;
          } else {
            await rollbackNotification(workspaceId, mgr.id, "nami_initial", refId);
            failed++;
            failedUsers.push(mgr.slack_name || mgr.id);
          }
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Error sending manager-review notification to ${mgr.slack_name || mgr.id}:`, err);
        failed++;
        failedUsers.push(mgr.slack_name || mgr.id);
      }
    }

    // --- Upward feedback ---
    if (a.assignment_type === "upward") {
      const reviewer = (a as any).reviewer;
      if (reviewer?.slack_user_id) {
        try {
          const refId = `upward_${a.id}`;
          const canSend = await logNotification(
            workspaceId,
            reviewer.id,
            "nami_initial",
            refId,
          );
          if (canSend) {
            const blocks = buildUpwardFeedbackOpening(
              reviewer.slack_name || "there",
              emp?.slack_name || "your manager",
              cycle.name,
              deadline,
              a.id,
            );
            const ok = await sendSlackBlocks(
              botToken,
              reviewer.slack_user_id,
              `Upward feedback requested for ${emp?.slack_name || "your manager"}`,
              blocks,
            );
            if (ok) {
              sent++;
            } else {
              await rollbackNotification(
                workspaceId,
                reviewer.id,
                "nami_initial",
                refId,
              );
              failed++;
              failedUsers.push(reviewer.slack_name || reviewer.id);
            }
          } else {
            skipped++;
          }
        } catch (err) {
          console.error(`Error sending upward-feedback notification to ${reviewer.slack_name || reviewer.id}:`, err);
          failed++;
          failedUsers.push(reviewer.slack_name || reviewer.id);
        }
      }
    }
  }

  // Mark cycle as nami_confirmed
  await supabase
    .from("performance_cycles")
    .update({ nami_confirmed: true })
    .eq("id", cycleId);

  return { sent, skipped, failed, failedUsers };
}

// =============================================================================
//  Handle survey launch
// =============================================================================

async function handleSurveyLaunch(surveyId: string) {
  const { data: survey } = await supabase
    .from("surveys")
    .select("id, name, type, workspace_id, config, workspaces(bot_token)")
    .eq("id", surveyId)
    .single();

  if (!survey) return { sent: 0, skipped: 0, error: "Survey not found" };

  const botToken = (survey as any).workspaces?.bot_token;
  if (!botToken) return { sent: 0, skipped: 0, error: "No bot token" };

  const workspaceId = survey.workspace_id;

  // Count questions from config
  const config = (survey.config || {}) as Record<string, any>;
  const questions = config.questions || [];
  const questionCount = questions.length;

  // Fetch pending participants with role and subject info
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

  if (!participants) return { sent: 0, skipped: 0 };

  // Filter out "subject" tracking entries — they don't need notifications
  const filteredParticipants = participants.filter((p: any) => p.role !== "subject");

  let sent = 0;
  let skipped = 0;

  // Group participants by user for 360 surveys so we can send a single consolidated DM
  const userParticipants = new Map<string, typeof filteredParticipants>();
  for (const p of filteredParticipants) {
    const userId = (p as any).user?.id;
    if (!userId) continue;
    const existing = userParticipants.get(userId) || [];
    existing.push(p);
    userParticipants.set(userId, existing);
  }

  for (const [, userParts] of userParticipants) {
    const p = userParts[0]; // Use first participant for notification tracking
    const user = (p as any).user;
    if (!user?.slack_user_id) {
      skipped++;
      continue;
    }

    const refId = `survey_${p.id}`;
    const canSend = await logNotification(
      workspaceId,
      user.id,
      "nami_initial",
      refId,
    );
    if (canSend) {
      const subjectName = (p as any).subject?.slack_name || undefined;
      const blocks = buildSurveyOpening(
        user.slack_name || "there",
        survey.name,
        questionCount,
        p.id,
        surveyId,
        (p as any).role,
        subjectName,
      );
      const ok = await sendSlackBlocks(
        botToken,
        user.slack_user_id,
        `You're invited to take the ${survey.name} survey`,
        blocks,
      );
      if (ok) {
        sent++;
      } else {
        await rollbackNotification(workspaceId, user.id, "nami_initial", refId);
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  // Mark survey as nami_confirmed
  await supabase
    .from("surveys")
    .update({ nami_confirmed: true })
    .eq("id", surveyId);

  return { sent, skipped };
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
        // Not yet sent — launch now
        const result = await handleCycleLaunch(cycle.id);
        sent += result.sent;
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
        sent += result.sent;
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
      // Update last_recurrence_at on the template survey
      await supabase.from("surveys").update({
        config: { ...config, last_recurrence_at: now.toISOString() },
      }).eq("id", survey.id);

      const result = await handleSurveyLaunch(newSurveyId);
      sent += result.sent;
    }
  }

  // -----------------------------------------------------------------------
  //  Part 1: Review assignment reminders
  // -----------------------------------------------------------------------
  const { data: cycles } = await supabase
    .from("performance_cycles")
    .select("id, name, review_deadline, workspace_id, workspaces(bot_token)")
    .eq("status", "active")
    .eq("nami_confirmed", true);

  if (cycles) {
    for (const cycle of cycles) {
      const botToken = (cycle as any).workspaces?.bot_token;
      if (!botToken) continue;

      const workspaceId = cycle.workspace_id;
      const deadlineDate = cycle.review_deadline
        ? new Date(cycle.review_deadline)
        : null;
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
    .select("id, name, closes_at, workspace_id, workspaces(bot_token)")
    .eq("status", "active")
    .eq("nami_confirmed", true);

  if (surveys) {
    for (const survey of surveys) {
      const botToken = (survey as any).workspaces?.bot_token;
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

  // Deadline-anchored events: each fires at most once via notification_log dedup
  const deadlineEvents = [
    { eventType: "nami_reminder_7d", threshold: 7 },
    { eventType: "nami_reminder_3d", threshold: 3 },
    { eventType: "nami_reminder_1d", threshold: 1 },
    { eventType: "nami_overdue",     threshold: -1 },
  ];

  for (const { eventType, threshold } of deadlineEvents) {
    // For overdue: fires when daysLeft < 0 (past deadline)
    // For reminders: fires when daysLeft <= threshold
    const shouldFire =
      eventType === "nami_overdue"
        ? daysLeft < 0
        : daysLeft <= threshold;

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

    let blocks: any[];
    let fallbackText: string;

    if (eventType === "nami_overdue") {
      blocks = buildOverdueNotice(
        targetUser.slack_name || "there",
        itemName,
        actionValue,
        actionId,
      );
      fallbackText = `Overdue: ${itemName}`;
    } else {
      blocks = buildDeadlineReminder(
        targetUser.slack_name || "there",
        itemName,
        daysLeft,
        actionValue,
        actionId,
      );
      fallbackText = `Reminder: ${itemName} — ${daysLeft <= 1 ? "due tomorrow" : `due in ${daysLeft} days`}`;
    }

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
//  Handle release grades — DM each employee their review results
// =============================================================================

async function handleReleaseGrades(cycleId: string) {
  // Fetch cycle + workspace bot token + stamped rating scale so the DM
  // reflects the scale that was active at this cycle's launch (Lattice /
  // Leapsome semantics: cycles freeze their scale at kickoff).
  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select(
      "id, name, workspace_id, rating_scale_id, workspaces(bot_token), rating_scale:rating_scales!performance_cycles_rating_scale_id_fkey(max_value)",
    )
    .eq("id", cycleId)
    .single();

  if (!cycle) return { sent: 0, skipped: 0, failed: 0, error: "Cycle not found" };

  const botToken = (cycle as any).workspaces?.bot_token;
  if (!botToken) return { sent: 0, skipped: 0, failed: 0, error: "No bot token" };

  const workspaceId = cycle.workspace_id;
  // Fall back to 5 only if the cycle has no stamped scale (pre-backfill data).
  const ratingMax: number = (cycle as any).rating_scale?.max_value ?? 5;

  // Fetch all standard review assignments with employee info
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

  if (!assignments) return { sent: 0, skipped: 0, failed: 0 };

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (let _i = 0; _i < assignments.length; _i++) {
    const a = assignments[_i];
    const emp = (a as any).employee;

    if (!emp?.slack_user_id) {
      skipped++;
      continue;
    }

    // Throttle between iterations to respect Slack rate limits
    if (_i > 0) await throttle();

    try {
      // Build a rich results message — this is the most important notification an employee receives
      const ratingStr = a.overall_rating
        ? `${(Math.round(a.overall_rating * 10) / 10)}/${ratingMax}`
        : null;
      const gradeStr = a.final_grade || null;

      // Summary line combining rating + grade
      const resultParts: string[] = [];
      if (ratingStr) resultParts.push(`:star: *${ratingStr}*`);
      if (gradeStr) resultParts.push(`:medal: *${gradeStr}*`);
      const resultLine = resultParts.length > 0
        ? resultParts.join("  ·  ")
        : "_No rating available_";

      const resultsUrl = await buildAuthedDashboardUrl(
        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_URL,
        emp.id, "/dashboard/performance",
      );

      const blocks: any[] = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:tada: *Your ${cycle.name} results are in!*\n\n${resultLine}`,
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

      const ok = await sendSlackBlocks(
        botToken,
        emp.slack_user_id,
        `Your ${cycle.name} review results are ready`,
        blocks,
      );

      if (ok) {
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(
        `Error sending grade release to ${emp.slack_name || emp.id}:`,
        err,
      );
      failed++;
    }
  }

  return { sent, skipped, failed };
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

async function sendFeedbackDm(job: QueueJob): Promise<{ ok: boolean; error?: string }> {
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

  const { data: ws } = await supabase
    .from("workspaces")
    .select("bot_token")
    .eq("id", job.workspace_id)
    .single();
  const botToken = (ws as { bot_token?: string } | null)?.bot_token;
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
  const post = await callSlackApi(botToken, "chat.postMessage", { channel, text });
  if (!post?.ok) return { ok: false, error: `postMessage: ${post?.error ?? "unknown"}` };
  return { ok: true };
}

async function sendNewReviewerDm(job: QueueJob): Promise<{ ok: boolean; error?: string }> {
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

  const { data: ws } = await supabase
    .from("workspaces")
    .select("bot_token")
    .eq("id", job.workspace_id)
    .single();
  const botToken = (ws as { bot_token?: string } | null)?.bot_token;
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

  const post = await callSlackApi(botToken, "chat.postMessage", { channel, text });
  if (!post?.ok) return { ok: false, error: `postMessage: ${post?.error ?? "unknown"}` };
  return { ok: true };
}

async function refreshHomeTab(job: QueueJob): Promise<{ ok: boolean; error?: string }> {
  const appUserId = job.payload.app_user_id as string | undefined;
  if (!appUserId) return { ok: false, error: "missing app_user_id" };
  const { data: u } = await supabase
    .from("users")
    .select("slack_user_id")
    .eq("id", appUserId)
    .single();
  const slackUserId = (u as { slack_user_id?: string } | null)?.slack_user_id;
  if (!slackUserId) return { ok: true }; // nothing to refresh — user has no Slack link

  const { data: ws } = await supabase
    .from("workspaces")
    .select("bot_token")
    .eq("id", job.workspace_id)
    .single();
  const botToken = (ws as { bot_token?: string } | null)?.bot_token;
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
  let succeeded = 0;
  let failed = 0;
  let requeued = 0;
  for (const job of jobs) {
    try {
      let result: { ok: boolean; error?: string };
      if (job.action === "notify_feedback") {
        result = await sendFeedbackDm(job);
      } else if (job.action === "notify_new_reviewer") {
        result = await sendNewReviewerDm(job);
      } else if (job.action === "refresh_home_tab") {
        result = await refreshHomeTab(job);
      } else {
        result = { ok: false, error: `unknown action ${job.action}` };
      }
      await supabase.rpc("complete_slack_send_job", {
        p_id: job.id,
        p_success: result.ok,
        p_error: result.ok ? null : result.error ?? null,
      });
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
  const hasCronAuth =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`);

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

  // Parse body before the auth gate so we can carve out specifically the
  // actions that authorize themselves at the data layer (e.g.
  // drain_send_queue, whose jobs were already authorized by SECURITY DEFINER
  // triggers on protected tables). Other actions still require cron or JWT.
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

  const ACTIONS_WITHOUT_AUTH = new Set(["drain_send_queue"]);
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
    //  drain_send_queue: no auth required. Claims up to 25 queued jobs
    //  (feedback DMs, post-launch reviewer notifications), processes each,
    //  marks success/failure with exponential backoff.
    //
    //  Auth-less is safe for this endpoint because:
    //    - the queue only accepts rows from SECURITY DEFINER triggers on
    //      authorized INSERTs (continuous_feedback, review_assignments)
    //    - work is strictly bounded: 25 jobs per call, 5-attempt cap per job
    //    - claim_slack_send_jobs uses FOR UPDATE SKIP LOCKED, so concurrent
    //      calls can't double-process the same row
    //    - no user-supplied input influences which jobs run; an attacker
    //      calling this only causes the existing queue to drain faster
    //
    //  Keeping it auth-less sidesteps the pg_cron vault-secret plumbing
    //  that the older send-deadline-reminders cron has been silently
    //  failing on (no app.settings.service_role_key at the session level).
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
