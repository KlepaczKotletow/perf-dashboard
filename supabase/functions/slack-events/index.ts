import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://nami-ochre.vercel.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Slack HMAC-SHA256 signature verification (same pattern as slack-interactivity)
async function verifySlackSignature(req: Request, body: string): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET) {
    console.warn("SLACK_SIGNING_SECRET not set — skipping signature verification");
    return true; // only acceptable in local dev
  }
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";
  const slackSig = req.headers.get("x-slack-signature") || "";
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;
  const baseString = `v0:${timestamp}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(SLACK_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `v0=${hex}` === slackSig;
}

async function publishHomeTab(botToken: string, slackUserId: string, blocks: unknown[]) {
  const res = await fetch("https://slack.com/api/views.publish", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: slackUserId,
      view: { type: "home", blocks },
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("views.publish failed:", data.error);
  }
}

function divider() {
  return { type: "divider" };
}

function section(text: string) {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function header(text: string) {
  return { type: "header", text: { type: "plain_text", text, emoji: true } };
}

async function buildHomeBlocks(appUser: { id: string; role: string; workspace_id: string }) {
  const blocks: unknown[] = [];
  const { id: userId, role, workspace_id: workspaceId } = appUser;
  const isManagerOrAbove = role === "manager" || role === "admin" || role === "hr";

  // ── Pending reviews (manager reviews to write) ────────────────────
  const { data: pendingReviews } = await supabase
    .from("review_assignments")
    .select("id, cycle_id, employee:users!review_assignments_employee_id_fkey(slack_name), cycle:performance_cycles(name, review_deadline)")
    .eq("manager_id", userId)
    .eq("status", "pending");

  if (pendingReviews && pendingReviews.length > 0) {
    blocks.push(header("📋 Pending Reviews"));
    for (const r of pendingReviews.slice(0, 5)) {
      const emp = (r as any).employee;
      const cycle = (r as any).cycle;
      const deadline = cycle?.review_deadline
        ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "no deadline";
      blocks.push(section(`*${emp?.slack_name || "Unknown"}* — ${cycle?.name || "Review"}\n_Due: ${deadline}_ | <${DASHBOARD_URL}/dashboard/cycles/${r.cycle_id}|Complete review>`));
    }
    if (pendingReviews.length > 5) {
      blocks.push(section(`_...and ${pendingReviews.length - 5} more. <${DASHBOARD_URL}/dashboard/my-reviews|View all>_`));
    }
    blocks.push(divider());
  }

  // ── Pending self-assessments ──────────────────────────────────────
  const { data: selfPending } = await supabase
    .from("review_assignments")
    .select("id, cycle_id, cycle:performance_cycles(name, review_deadline)")
    .eq("employee_id", userId)
    .eq("status", "pending");

  if (selfPending && selfPending.length > 0) {
    blocks.push(header("✍️ Self-Assessments Due"));
    for (const r of selfPending.slice(0, 3)) {
      const cycle = (r as any).cycle;
      const deadline = cycle?.review_deadline
        ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "no deadline";
      blocks.push(section(`*${cycle?.name || "Review"}*\n_Due: ${deadline}_ | <${DASHBOARD_URL}/dashboard/my-reviews|Start>`));
    }
    blocks.push(divider());
  }

  // ── Recent feedback received (visibility-gated: non-anonymous only) ─
  const { data: feedback } = await supabase
    .from("continuous_feedback")
    .select("id, message, is_anonymous, created_at, from_user:users!continuous_feedback_from_user_id_fkey(slack_name)")
    .eq("to_user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_anonymous", false)
    .order("created_at", { ascending: false })
    .limit(3);

  if (feedback && feedback.length > 0) {
    blocks.push(header("💬 Recent Feedback"));
    for (const f of feedback) {
      const from = (f as any).from_user?.slack_name || "Someone";
      const preview = f.message.length > 120 ? f.message.slice(0, 120) + "…" : f.message;
      blocks.push(section(`*From ${from}:* ${preview}`));
    }
    blocks.push(divider());
  }

  // ── Manager: team's pending reviews ──────────────────────────────
  if (isManagerOrAbove) {
    const { data: myTeamPending } = await supabase
      .from("review_assignments")
      .select("id, employee:users!review_assignments_employee_id_fkey(slack_name)")
      .neq("status", "completed")
      .eq("manager_id", userId);

    if ((myTeamPending || []).length > 0) {
      blocks.push(header(`👥 Team Reviews Pending (${(myTeamPending || []).length})`));
      const names = [...new Set((myTeamPending || []).map((a: any) => a.employee?.slack_name).filter(Boolean))] as string[];
      blocks.push(section(names.slice(0, 5).map((n) => `• ${n}`).join("\n") + (names.length > 5 ? `\n_...and ${names.length - 5} more_` : "")));
      blocks.push(section(`<${DASHBOARD_URL}/dashboard/cycles|View all cycles>`));
      blocks.push(divider());
    }
  }

  // ── Own at-risk / delayed goals ───────────────────────────────────
  const { data: badGoals } = await supabase
    .from("goals")
    .select("id, title, tracking_status")
    .eq("employee_id", userId)
    .eq("status", "active")
    .in("tracking_status", ["at_risk", "delayed"]);

  if (badGoals && badGoals.length > 0) {
    blocks.push(header("🎯 Goals Needing Attention"));
    for (const g of badGoals.slice(0, 4)) {
      const icon = g.tracking_status === "delayed" ? "🔴" : "⚠️";
      blocks.push(section(`${icon} *${g.title}*`));
    }
    blocks.push(section(`<${DASHBOARD_URL}/dashboard/goals|View all goals>`));
    blocks.push(divider());
  }

  // ── Footer ────────────────────────────────────────────────────────
  if (blocks.length === 0) {
    blocks.push(header("👋 You're all caught up!"));
    blocks.push(section(`No pending reviews or urgent goals.\n<${DASHBOARD_URL}/dashboard|Open dashboard>`));
  } else {
    blocks.push(section(`<${DASHBOARD_URL}/dashboard|Open full dashboard>`));
  }

  return blocks;
}

Deno.serve(async (req) => {
  const body = await req.text();

  // Verify Slack signature
  const valid = await verifySlackSignature(req, body);
  if (!valid) return new Response("Invalid signature", { status: 403 });

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Slack URL verification challenge (one-time during app setup in Slack dashboard)
  if (event.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: event.challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (event.type !== "event_callback") {
    return new Response("OK", { status: 200 });
  }

  const innerEvent = event.event;

  if (innerEvent?.type === "app_home_opened") {
    const slackUserId = innerEvent.user;
    const teamId = event.team_id;

    // Look up workspace by Slack team_id
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, bot_token")
      .eq("team_id", teamId)
      .single();

    if (workspaceError && workspaceError.code !== "PGRST116") {
      console.error("Workspace lookup error:", workspaceError.message, { teamId });
    }

    if (!workspace?.bot_token) {
      console.error("Workspace not found for team_id:", teamId);
      return new Response("Workspace not found", { status: 404 });
    }

    // Look up the app user by slack_user_id + workspace_id
    const { data: appUser } = await supabase
      .from("users")
      .select("id, role, workspace_id")
      .eq("slack_user_id", slackUserId)
      .eq("workspace_id", workspace.id)
      .single();

    if (!appUser) {
      // User not yet in the system — show a simple welcome message
      await publishHomeTab(workspace.bot_token, slackUserId, [
        header("👋 Welcome to Perf"),
        section("You haven't been added to the workspace yet. Ask your admin to import the team from Slack."),
      ]);
      return new Response("OK", { status: 200 });
    }

    const blocks = await buildHomeBlocks(appUser);
    await publishHomeTab(workspace.bot_token, slackUserId, blocks);
  }

  return new Response("OK", { status: 200 });
});
