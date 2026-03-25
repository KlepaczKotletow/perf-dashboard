// =============================================================================
//  Nami Bot — Edge Function
//  Actions: launch_cycle, launch_survey, run_reminders
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL =
  Deno.env.get("DASHBOARD_URL") || "https://nami-ochre.vercel.app";

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
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: slackUserId, text, blocks }),
    });
    const data = await res.json();
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

interface ManagerContext {
  selfAvg?: number;
  prevRating?: number;
  goalsCount?: number;
}

async function getManagerContext(
  employeeId: string,
  cycleId: string,
): Promise<ManagerContext> {
  const ctx: ManagerContext = {};

  try {
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

    // 2. Previous cycle rating
    const { data: prevAssignments } = await supabase
      .from("review_assignments")
      .select("overall_rating")
      .eq("employee_id", employeeId)
      .eq("status", "completed")
      .neq("cycle_id", cycleId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (prevAssignments?.[0]?.overall_rating) {
      ctx.prevRating = prevAssignments[0].overall_rating;
    }

    // 3. Active goals count
    const { data: goals } = await supabase
      .from("goals")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("status", "active");

    if (goals) {
      ctx.goalsCount = goals.length;
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

  for (const a of filteredAssignments) {
    const emp = (a as any).employee;
    const mgr = (a as any).manager;

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
          const context = await getManagerContext(a.employee_id, cycleId);
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
    .select("id, name, workspace_id, config, workspaces(bot_token)")
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

  // Fetch pending participants
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
    .eq("survey_id", surveyId)
    .eq("status", "pending");

  if (!participants) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;

  for (const p of participants) {
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
      const blocks = buildSurveyOpening(
        user.slack_name || "there",
        survey.name,
        questionCount,
        p.id,
        surveyId,
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
//  Deno.serve() — CRON_SECRET bearer auth, routes action to handlers
// =============================================================================

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    return new Response("Server misconfiguration: CRON_SECRET not set", {
      status: 500,
    });
  }
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, cycle_id, survey_id, mode } = body;

    let result;
    if (action === "launch_cycle" && cycle_id) {
      result = await handleCycleLaunch(cycle_id, mode === "missed" ? "missed" : "all");
    } else if (action === "launch_survey" && survey_id) {
      result = await handleSurveyLaunch(survey_id);
    } else if (action === "run_reminders") {
      result = await handleReminders();
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("nami-bot error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
