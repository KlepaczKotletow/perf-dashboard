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

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const today = new Date();
    const daysToCheck = [3, 7];

    let totalSent = 0;
    let totalSkipped = 0;

    for (const daysAhead of daysToCheck) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysAhead);
      const dateStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const nextDateStr = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // Find active cycles with deadline on this date
      const { data: cycles, error: cyclesError } = await supabase
        .from("performance_cycles")
        .select("id, name, review_deadline, workspace_id, workspaces(bot_token)")
        .eq("status", "active")
        .gte("review_deadline", `${dateStr}T00:00:00Z`)
        .lt("review_deadline", `${nextDateStr}T00:00:00Z`);

      if (cyclesError) { console.error("Failed to fetch cycles:", cyclesError.message); continue; }
      if (!cycles) continue;

      for (const cycle of cycles) {
        const botToken = (cycle as any).workspaces?.bot_token;
        if (!botToken) continue;

        const deadline = new Date(cycle.review_deadline).toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric",
        });

        // Find incomplete review assignments
        const { data: assignments, error: assignmentsError } = await supabase
          .from("review_assignments")
          .select(`
            id,
            manager_id,
            employee:users!review_assignments_employee_id_fkey(slack_name),
            manager:users!review_assignments_manager_id_fkey(id, slack_user_id)
          `)
          .eq("cycle_id", cycle.id)
          .neq("status", "completed");

        if (assignmentsError) { console.error("Failed to fetch assignments:", assignmentsError.message); continue; }
        if (!assignments) continue;

        for (const a of assignments) {
          const mgr = (a as any).manager;
          const emp = (a as any).employee;
          if (!mgr?.slack_user_id) continue;

          const eventType = "cycle_deadline_reminder";
          const referenceId = `${cycle.id}_${a.id}_d${daysAhead}`;

          // Atomically claim the send slot — insert first to prevent race conditions
          // between concurrent function invocations
          const { error: logError } = await supabase
            .from("notification_log")
            .insert({
              workspace_id: cycle.workspace_id,
              user_id: mgr.id,
              event_type: eventType,
              reference_id: referenceId,
            });

          if (logError) {
            // Unique constraint violation (23505) means already sent — skip silently
            if ((logError as any).code === "23505") {
              totalSkipped++;
              continue;
            }
            console.error("Failed to claim notification slot:", logError.message);
            continue;
          }

          // Slot claimed — now send the DM
          const text = `⏰ *Reminder: ${daysAhead} days left — ${cycle.name}*\nYou still have a review to complete for *${emp?.slack_name || "a team member"}*.\nDeadline: ${deadline}\n→ ${DASHBOARD_URL}/dashboard/cycles/${cycle.id}`;
          const ok = await sendSlackDM(botToken, mgr.slack_user_id, text);

          if (ok) {
            totalSent++;
          } else {
            // Send failed — remove the log entry so this reminder is retried next run
            await supabase
              .from("notification_log")
              .delete()
              .eq("workspace_id", cycle.workspace_id)
              .eq("user_id", mgr.id)
              .eq("event_type", eventType)
              .eq("reference_id", referenceId);
            totalSkipped++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent, skipped: totalSkipped }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-deadline-reminders error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
