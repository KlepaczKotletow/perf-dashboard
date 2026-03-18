import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://nami-ochre.vercel.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendSlackDM(botToken: string, slackUserId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: slackUserId, text }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

async function logNotification(
  workspaceId: string,
  userId: string,
  eventType: string,
  referenceId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("notification_log")
    .insert({ workspace_id: workspaceId, user_id: userId, event_type: eventType, reference_id: referenceId });
  if (!error) return true;
  // Unique constraint violation (code 23505) = already sent, skip silently
  if ((error as any).code === "23505") return false;
  // Any other error is unexpected — log it but still skip to avoid crashing the loop
  console.error("logNotification unexpected error:", error.message, { eventType, referenceId });
  return false;
}

async function rollbackNotification(
  workspaceId: string,
  userId: string,
  eventType: string,
  referenceId: string
): Promise<void> {
  const { error } = await supabase
    .from("notification_log")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("reference_id", referenceId);
  if (error) console.error("Failed to rollback notification log:", error.message, { eventType, referenceId });
}

async function handleCycleLaunch(cycleId: string) {
  // Fetch cycle + workspace bot token
  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("id, name, review_deadline, workspace_id, workspaces(bot_token)")
    .eq("id", cycleId)
    .single();

  if (!cycle) return { sent: 0, skipped: 0 };

  const botToken = (cycle as any).workspaces?.bot_token;
  if (!botToken) return { sent: 0, skipped: 0, error: "No bot token" };

  // Fetch all review assignments for this cycle (both standard and upward)
  const { data: assignments } = await supabase
    .from("review_assignments")
    .select(`
      id,
      employee_id,
      manager_id,
      reviewer_id,
      assignment_type,
      employee:users!review_assignments_employee_id_fkey(id, slack_user_id, slack_name),
      manager:users!review_assignments_manager_id_fkey(id, slack_user_id, slack_name),
      reviewer:users!review_assignments_reviewer_id_fkey(id, slack_user_id, slack_name)
    `)
    .eq("cycle_id", cycleId);

  if (!assignments) return { sent: 0, skipped: 0 };

  const workspaceId = cycle.workspace_id;
  const deadline = cycle.review_deadline
    ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "no deadline set";

  let sent = 0;
  let skipped = 0;

  for (const a of assignments) {
    const emp = (a as any).employee;
    const mgr = (a as any).manager;

    // Notify manager to complete review for employee
    if (mgr?.slack_user_id) {
      const canSend = await logNotification(workspaceId, mgr.id, "review_assigned", a.id);
      if (canSend) {
        const text = `📋 *Review cycle started: ${cycle.name}*\nYou have a review to complete for *${emp?.slack_name || "a team member"}*.\nDeadline: ${deadline}\n→ ${DASHBOARD_URL}/dashboard/cycles/${cycleId}`;
        const ok = await sendSlackDM(botToken, mgr.slack_user_id, text);
        if (ok) {
          sent++;
        } else {
          await rollbackNotification(workspaceId, mgr.id, "review_assigned", a.id);
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    // Notify upward reviewer (direct report giving feedback on their manager)
    if (a.assignment_type === "upward") {
      const reviewer = (a as any).reviewer;
      const emp = (a as any).employee; // the manager being reviewed
      if (reviewer?.slack_user_id) {
        const canSend = await logNotification(workspaceId, reviewer.id, "review_assigned", `upward_${a.id}`);
        if (canSend) {
          const text = `📋 *Review cycle started: ${cycle.name}*\nYou've been asked to give upward feedback on *${emp?.slack_name || "your manager"}*.\nDeadline: ${deadline}\n→ ${DASHBOARD_URL}/dashboard/performance`;
          const ok = await sendSlackDM(botToken, reviewer.slack_user_id, text);
          if (ok) {
            sent++;
          } else {
            await rollbackNotification(workspaceId, reviewer.id, "review_assigned", `upward_${a.id}`);
            skipped++;
          }
        } else {
          skipped++;
        }
      }
    }

    // Notify employee to complete self-assessment
    if (emp?.slack_user_id && a.assignment_type === "standard") {
      const canSend = await logNotification(workspaceId, emp.id, "review_assigned", `self_${a.id}`);
      if (canSend) {
        const text = `📋 *Review cycle started: ${cycle.name}*\nYour performance review has begun. Please complete your self-assessment.\nDeadline: ${deadline}\n→ ${DASHBOARD_URL}/dashboard/performance`;
        const ok = await sendSlackDM(botToken, emp.slack_user_id, text);
        if (ok) {
          sent++;
        } else {
          await rollbackNotification(workspaceId, emp.id, "review_assigned", `self_${a.id}`);
          skipped++;
        }
      } else {
        skipped++;
      }
    }
  }

  return { sent, skipped };
}

async function handleGoalStatusUpdate(goalId: string, newStatus: string, employeeId: string) {
  // Fetch goal + employee + manager
  const { data: goal } = await supabase
    .from("goals")
    .select("id, title, workspace_id")
    .eq("id", goalId)
    .single();

  if (!goal) return { sent: 0, skipped: 1 };

  const { data: employee } = await supabase
    .from("users")
    .select("id, slack_name, manager_id")
    .eq("id", employeeId)
    .single();

  if (!employee?.manager_id) return { sent: 0, skipped: 1 };

  const { data: manager } = await supabase
    .from("users")
    .select("id, slack_user_id")
    .eq("id", employee.manager_id)
    .single();

  if (!manager?.slack_user_id) return { sent: 0, skipped: 1 };

  // Get bot token
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("bot_token")
    .eq("id", goal.workspace_id)
    .single();

  if (!workspace?.bot_token) return { sent: 0, skipped: 1 };

  const statusLabels: Record<string, string> = {
    at_risk: "⚠️ At risk",
    delayed: "🔴 Delayed",
    on_track: "✅ Back on track",
    achieved: "🎉 Achieved",
  };

  const label = statusLabels[newStatus] || newStatus;
  const referenceId = `goal_${goalId}_${newStatus}`;

  const canSend = await logNotification(goal.workspace_id, manager.id, "goal_status_update", referenceId);
  if (!canSend) return { sent: 0, skipped: 1 };

  const text = `${label} — *${goal.title}*\n${employee.slack_name}'s goal status has changed.\n→ ${DASHBOARD_URL}/dashboard/goals`;
  const ok = await sendSlackDM(workspace.bot_token, manager.slack_user_id, text);
  if (!ok) {
    await rollbackNotification(goal.workspace_id, manager.id, "goal_status_update", referenceId);
    return { sent: 0, skipped: 1 };
  }
  return { sent: 1, skipped: 0 };
}

async function handleSelfSubmitted(assignmentId: string) {
  const { data: assignment } = await supabase
    .from("review_assignments")
    .select(`
      id, cycle_id,
      employee:users!review_assignments_employee_id_fkey(id, slack_name),
      manager:users!review_assignments_manager_id_fkey(id, slack_user_id, slack_name),
      cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name, workspace_id, workspaces(bot_token))
    `)
    .eq("id", assignmentId)
    .single();

  if (!assignment) return { sent: 0, skipped: 1 };

  const mgr = (assignment as any).manager;
  const emp = (assignment as any).employee;
  const cycle = (assignment as any).cycle;
  const botToken = cycle?.workspaces?.bot_token;
  const workspaceId = cycle?.workspace_id;

  if (!mgr?.slack_user_id || !botToken || !workspaceId) return { sent: 0, skipped: 1 };

  const canSend = await logNotification(workspaceId, mgr.id, "self_review_submitted", assignmentId);
  if (!canSend) return { sent: 0, skipped: 1 };

  const text = `✅ *${emp?.slack_name || "An employee"}* has completed their self-review for *${cycle?.name}*.\nYou can now complete your manager review.\n→ ${DASHBOARD_URL}/dashboard/reviews/${assignmentId}`;
  const ok = await sendSlackDM(botToken, mgr.slack_user_id, text);
  if (!ok) {
    await rollbackNotification(workspaceId, mgr.id, "self_review_submitted", assignmentId);
    return { sent: 0, skipped: 1 };
  }
  return { sent: 1, skipped: 0 };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    return new Response("Server misconfiguration: CRON_SECRET not set", { status: 500 });
  }
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, cycle_id, goal_id, new_status, employee_id, assignment_id } = body;

    let result;
    if (action === "launch" && cycle_id) {
      result = await handleCycleLaunch(cycle_id);
    } else if (action === "goal_status" && goal_id && new_status && employee_id) {
      result = await handleGoalStatusUpdate(goal_id, new_status, employee_id);
    } else if (action === "self_submitted" && assignment_id) {
      result = await handleSelfSubmitted(assignment_id);
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cycle-notifications error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
