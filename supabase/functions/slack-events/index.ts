import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCompetencyPrompt,
  buildCommentPrompt,
  buildTextQuestionPrompt,
  buildReviewSummary,
  buildSurveyQuestionPrompt,
} from "../_shared/nami-blocks.ts";
import { callSlackApi, sendSlackMessage as sendSlackMessageWithRetry } from "../_shared/slack-api.ts";
import { getWorkspaceSlackTokens } from "../_shared/workspace-tokens.ts";
import { asUuid } from "../_shared/postgrest-safe.ts";

const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL");
if (!DASHBOARD_URL) {
  throw new Error("DASHBOARD_URL secret is not configured for this Supabase project");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Slack HMAC-SHA256 signature verification (same pattern as slack-interactivity)
async function verifySlackSignature(req: Request, body: string): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET) {
    console.error("SLACK_SIGNING_SECRET not set — rejecting request for security");
    return false;
  }
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";
  const slackSig = req.headers.get("x-slack-signature") || "";
  const parsedTs = parseInt(timestamp);
  const nowSec = Date.now() / 1000;
  // Reject if missing, in the future (more than 5s clock skew), or older than 5 min.
  if (isNaN(parsedTs) || parsedTs > nowSec + 5 || nowSec - parsedTs > 300) {
    console.warn(`[slack-sig] timestamp out of range: ts=${parsedTs} now=${nowSec}`);
    return false;
  }
  const baseString = `v0:${timestamp}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(SLACK_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // Timing-safe comparison to prevent timing attacks
  const computed = encoder.encode(`v0=${hex}`);
  const received = encoder.encode(slackSig);
  if (computed.byteLength !== received.byteLength) return false;
  return crypto.subtle.timingSafeEqual(computed, received);
}

async function publishHomeTab(botToken: string, slackUserId: string, blocks: unknown[]) {
  const data = await callSlackApi(botToken, "views.publish", {
    user_id: slackUserId,
    view: { type: "home", blocks },
  });
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

// Time-bucket helpers for the App Home pending-tasks sections. Items due in
// the next 24h get a red 🔥 marker; items due in the next 7 days get a 📅;
// everything else (or no deadline) renders unmarked. Lattice and 15Five
// surface comparable "what's due now" stripes; the marker is purely visual
// — calibrators / managers still see the full list.
const URGENT_HOURS = 24;
const SOON_HOURS = 24 * 7;
function bucketByDeadline(deadlineIso: string | null | undefined, now: Date = new Date()): "today" | "week" | "later" | "none" {
  if (!deadlineIso) return "none";
  const d = new Date(deadlineIso);
  if (Number.isNaN(d.getTime())) return "none";
  const diffH = (d.getTime() - now.getTime()) / 36e5;
  if (diffH < 0) return "today";       // overdue collapses into Today
  if (diffH <= URGENT_HOURS) return "today";
  if (diffH <= SOON_HOURS) return "week";
  return "later";
}
function bucketEmoji(b: "today" | "week" | "later" | "none"): string {
  return b === "today" ? "🔥" : b === "week" ? "📅" : "";
}
function bucketCounts<T extends { cycle?: { review_deadline?: string | null } | null }>(items: T[]): { today: number; week: number } {
  const now = new Date();
  let today = 0;
  let week = 0;
  for (const r of items) {
    const b = bucketByDeadline((r as any).cycle?.review_deadline ?? null, now);
    if (b === "today") today++;
    else if (b === "week") week++;
  }
  return { today, week };
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
    const { today, week } = bucketCounts(pendingReviews as any[]);
    if (today > 0 || week > 0) {
      const parts: string[] = [];
      if (today > 0) parts.push(`🔥 *${today} due today*`);
      if (week > 0) parts.push(`📅 ${week} this week`);
      blocks.push(section(parts.join("  ·  ")));
    }
    // Render most-urgent first so the calibrator's eye catches them.
    const sorted = [...pendingReviews].sort((a: any, b: any) => {
      const da = a.cycle?.review_deadline ? new Date(a.cycle.review_deadline).getTime() : Infinity;
      const db = b.cycle?.review_deadline ? new Date(b.cycle.review_deadline).getTime() : Infinity;
      return da - db;
    });
    for (const r of sorted.slice(0, 5)) {
      const emp = (r as any).employee;
      const cycle = (r as any).cycle;
      const bucket = bucketByDeadline(cycle?.review_deadline);
      const emoji = bucketEmoji(bucket);
      const deadline = cycle?.review_deadline
        ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "no deadline";
      const prefix = emoji ? `${emoji} ` : "";
      blocks.push(section(`${prefix}*${emp?.slack_name || "Unknown"}* — ${cycle?.name || "Review"}\n_Due: ${deadline}_ | <${DASHBOARD_URL}/dashboard/cycles/${(r as any).cycle_id}|Complete review>`));
    }
    if (pendingReviews.length > 5) {
      blocks.push(section(`_...and ${pendingReviews.length - 5} more. <${DASHBOARD_URL}/dashboard/performance|View all>_`));
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
    const { today, week } = bucketCounts(selfPending as any[]);
    if (today > 0 || week > 0) {
      const parts: string[] = [];
      if (today > 0) parts.push(`🔥 *${today} due today*`);
      if (week > 0) parts.push(`📅 ${week} this week`);
      blocks.push(section(parts.join("  ·  ")));
    }
    const sorted = [...selfPending].sort((a: any, b: any) => {
      const da = a.cycle?.review_deadline ? new Date(a.cycle.review_deadline).getTime() : Infinity;
      const db = b.cycle?.review_deadline ? new Date(b.cycle.review_deadline).getTime() : Infinity;
      return da - db;
    });
    for (const r of sorted.slice(0, 3)) {
      const cycle = (r as any).cycle;
      const bucket = bucketByDeadline(cycle?.review_deadline);
      const emoji = bucketEmoji(bucket);
      const deadline = cycle?.review_deadline
        ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "no deadline";
      const prefix = emoji ? `${emoji} ` : "";
      blocks.push(section(`${prefix}*${cycle?.name || "Review"}*\n_Due: ${deadline}_ | <${DASHBOARD_URL}/dashboard/performance|Start>`));
    }
    blocks.push(divider());
  }

  // ── Recent feedback received ─────────────────────────────────────
  // Include anonymous feedback but redact the sender name, consistent
  // with how the web dashboard handles it.
  const { data: feedback } = await supabase
    .from("continuous_feedback")
    .select("id, message, is_anonymous, created_at, from_user:users!continuous_feedback_from_user_id_fkey(slack_name)")
    .eq("to_user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (feedback && feedback.length > 0) {
    blocks.push(header("💬 Recent Feedback"));
    for (const f of feedback) {
      const from = f.is_anonymous ? "Anonymous" : ((f as any).from_user?.slack_name || "Someone");
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

  // ── Notification settings (Sprint 3) ─────────────────────────────
  // Mode + snooze control. Lets users opt in to digest mode or pause
  // reminders without an admin getting involved.
  const { data: prefsRow } = await supabase
    .from("users")
    .select("notification_prefs")
    .eq("id", userId)
    .maybeSingle();
  const prefs = (prefsRow?.notification_prefs ?? {}) as Record<string, unknown>;
  const mode = (prefs.mode === "digest" || prefs.mode === "critical_only" ? prefs.mode : "realtime") as
    | "realtime"
    | "digest"
    | "critical_only";
  const digestHour =
    typeof prefs.digest_hour === "number" && prefs.digest_hour >= 0 && prefs.digest_hour <= 23
      ? prefs.digest_hour
      : 9;
  const digestTz =
    typeof prefs.digest_timezone === "string" && prefs.digest_timezone.length > 0
      ? prefs.digest_timezone
      : "UTC";
  const snoozedUntilIso = typeof prefs.snoozed_until === "string" ? prefs.snoozed_until : null;
  const snoozedUntilDate = snoozedUntilIso ? new Date(snoozedUntilIso) : null;
  const isSnoozed =
    !!snoozedUntilDate && !Number.isNaN(snoozedUntilDate.getTime()) && snoozedUntilDate > new Date();

  blocks.push(divider());
  blocks.push(header("⚙️ Notification settings"));

  const modeLabel =
    mode === "digest"
      ? `Daily digest at ${String(digestHour).padStart(2, "0")}:00 ${digestTz}`
      : mode === "critical_only"
        ? "Critical only"
        : "Realtime (each event)";
  blocks.push(section(`*Current mode:* ${modeLabel}`));

  if (isSnoozed) {
    blocks.push(
      section(
        `_Snoozed until ${snoozedUntilDate!.toLocaleString("en-GB", {
          dateStyle: "short",
          timeStyle: "short",
        })}_`,
      ),
    );
  }

  const modeOptions = [
    { text: { type: "plain_text", text: "Realtime (each event)" }, value: "realtime" },
    { text: { type: "plain_text", text: "Daily digest" }, value: "digest" },
    { text: { type: "plain_text", text: "Critical only" }, value: "critical_only" },
  ];
  const initialModeOption = modeOptions.find((o) => o.value === mode) ?? modeOptions[0];

  const settingsActions: any[] = [
    {
      type: "static_select",
      action_id: "set_notification_mode",
      placeholder: { type: "plain_text", text: "Notification mode" },
      initial_option: initialModeOption,
      options: modeOptions,
    },
  ];
  if (isSnoozed) {
    settingsActions.push({
      type: "button",
      text: { type: "plain_text", text: "Wake me up", emoji: true },
      style: "primary",
      action_id: "clear_snooze",
    });
  }

  blocks.push({ type: "actions", elements: settingsActions });

  return blocks;
}

Deno.serve(async (req) => {
  const body = await req.text();

  // Verify Slack signature
  const valid = await verifySlackSignature(req, body);
  if (!valid) return new Response("Invalid signature", { status: 403 });

  // Slack retried because we were slow. With Task 2's event_id dedup, the
  // inbox catches event-callback retries; this is the catch-all for the
  // other endpoints (commands, interactivity) that don't have an event_id.
  // Either we already finished and Slack didn't get our 200 — doing it again
  // risks side-effects firing twice. Or we're still processing the original.
  // Either way, acknowledge fast so Slack stops retrying.
  const retryNum = req.headers.get("x-slack-retry-num");
  if (retryNum) {
    console.warn(
      `[slack-events] retry #${retryNum} (reason=${
        req.headers.get("x-slack-retry-reason") ?? "?"
      }), short-circuiting to 200`,
    );
    return new Response("OK", { status: 200 });
  }

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

  // Idempotency: every Events API delivery has a unique event_id.
  // INSERT into the inbox; if it conflicts, we've seen it before — return
  // 200 immediately so Slack stops retrying. If the insert succeeds we
  // own the event and run side effects exactly once.
  const eventId = event.event_id;
  if (eventId) {
    const dedupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/slack_processed_events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          event_id: eventId,
          team_id: event.team_id ?? "unknown",
          event_type: event.event?.type ?? event.type,
        }),
      },
    );
    if (dedupRes.status === 409) {
      console.log(`[slack-events] duplicate event_id ${eventId}, skipping`);
      return new Response("OK", { status: 200 });
    }
    if (!dedupRes.ok) {
      console.error(`[slack-events] dedup insert failed: ${dedupRes.status}`);
      // Fall through — better to risk a duplicate than drop the event.
    }
  }

  const innerEvent = event.event;

  if (innerEvent?.type === "app_home_opened") {
    const slackUserId = innerEvent.user;
    const teamId = event.team_id;

    // Look up workspace by Slack team_id
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("team_id", teamId)
      .single();

    if (workspaceError && workspaceError.code !== "PGRST116") {
      console.error("Workspace lookup error:", workspaceError.message, { teamId });
    }

    if (!workspace) {
      console.error("Workspace not found for team_id:", teamId);
      return new Response("Workspace not found", { status: 404 });
    }

    const tokens = await getWorkspaceSlackTokens(workspace.id);
    const botToken = tokens?.botToken;
    if (!botToken) {
      console.error("[slack-events] Workspace token unreadable for team_id:", teamId);
      return new Response("Workspace token unavailable", { status: 503 });
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
      await publishHomeTab(botToken, slackUserId, [
        header("👋 Welcome to Nami"),
        section("You haven't been added to the workspace yet. Ask your admin to import the team from Slack."),
      ]);
      return new Response("OK", { status: 200 });
    }

    const blocks = await buildHomeBlocks(appUser);
    await publishHomeTab(botToken, slackUserId, blocks);
  }

  // ================================================================
  //  Nami: Handle free-text DM replies for active conversations
  // ================================================================
  if (
    innerEvent?.type === "message" &&
    innerEvent.channel_type === "im" &&
    !innerEvent.bot_id &&
    !innerEvent.subtype
  ) {
    // Respond to Slack immediately — process in background
    const slackUserId = innerEvent.user;
    const text = (innerEvent.text || "").trim();
    const teamId = event.team_id;

    if (!text) {
      return new Response("OK", { status: 200 });
    }

    // Fire-and-forget: Slack needs a 200 within 3 seconds
    const processing = (async () => {
      try {
        // Look up active conversation for this user
        const { data: convRows, error: convErr } = await supabase
          .from("conversation_states")
          .select("*")
          .eq("slack_user_id", slackUserId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);

        if (convErr || !convRows || convRows.length === 0) return;
        const conv = convRows[0];

        // Look up workspace bot token via vault helper
        const { data: ws } = await supabase
          .from("workspaces")
          .select("id")
          .eq("team_id", teamId)
          .single();

        if (!ws) return;
        const tokens = await getWorkspaceSlackTokens(ws.id);
        if (!tokens?.botToken) return;
        const botToken = tokens.botToken;

        async function sendSlackMessage(channel: string, msgText: string, msgBlocks?: unknown[]) {
          await sendSlackMessageWithRetry(botToken, channel, msgText, msgBlocks);
        }

        // ── Review flow ──────────────────────────────────────────────
        if (conv.flow_type === "review") {

          // -- Phase: competencies (user typed free text — guide them to use buttons) --
          if (conv.phase === "competencies") {
            await sendSlackMessage(slackUserId,
              "💡 Please use the buttons above to rate competencies or add comments. Free-text replies aren't supported here to avoid mix-ups between reviews."
            );
            return;
          }

          // Legacy: keep the advance logic as dead code guard
          if (false as boolean) {
            const compIds: string[] = conv.competency_ids || [];
            const compNames: string[] = conv.competency_names || [];
            const currentIdx: number = conv.current_index || 0;
            const currentCompId = compIds[currentIdx];
            const ratings = conv.ratings || {};
            const evtRatingScale = conv.rating_scale || undefined;

            if (currentCompId && ratings[currentCompId]) {
              ratings[currentCompId].comment = text;
            }

            const nextIndex = currentIdx + 1;

            if (nextIndex < compIds.length) {
              await supabase
                .from("conversation_states")
                .update({
                  ratings,
                  current_index: nextIndex,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", conv.id);

              const compDescs: string[] = conv.competency_descriptions || [];
              const evtSdByComp = conv.score_descriptors_by_comp || {};
              const compIds: string[] = conv.competency_ids || [];
              const evtCompSd = evtSdByComp[compIds[nextIndex]] || undefined;
              const blocks = buildCompetencyPrompt(
                compNames[nextIndex], compDescs[nextIndex] || "", nextIndex, compNames.length,
                conv.id, conv.assignment_id, evtRatingScale, evtCompSd,
              );
              await sendSlackMessage(
                slackUserId,
                `Rate ${compNames[nextIndex]} (${nextIndex + 1}/${compNames.length})`,
                blocks,
              );
            } else {
              // No more competencies — check for text questions
              const textQuestionIds: string[] = conv.text_question_ids || [];
              const textQuestionPrompts: string[] = conv.text_question_prompts || [];

              if (textQuestionIds.length > 0) {
                // Transition to text_questions phase
                await supabase
                  .from("conversation_states")
                  .update({
                    ratings,
                    phase: "text_questions",
                    current_index: 0,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", conv.id);

                const blocks = buildTextQuestionPrompt(
                  textQuestionPrompts[0], 0, textQuestionPrompts.length, conv.id,
                );
                await sendSlackMessage(
                  slackUserId,
                  `Question 1/${textQuestionPrompts.length}`,
                  blocks,
                );
              } else {
                // No text questions — go to summary
                await supabase
                  .from("conversation_states")
                  .update({
                    ratings,
                    phase: "summary",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", conv.id);

                const ratingValues = compIds.map((id: string) => ratings[id]?.rating || 0);
                const textResponses = conv.text_responses || {};
                const tqIds: string[] = conv.text_question_ids || [];
                const tqPrompts: string[] = conv.text_question_prompts || [];
                const tqResponses = tqIds.map((id: string) => textResponses[id] || "");

                const blocks = buildReviewSummary(
                  conv.employee_name, compNames, ratingValues,
                  tqPrompts, tqResponses, conv.id, evtRatingScale,
                );
                await sendSlackMessage(
                  slackUserId,
                  `Review summary for ${conv.employee_name}`,
                  blocks,
                );
              }
            }
            return;
          }

          // -- Phase: text_questions (user is answering a text question) --
          if (conv.phase === "text_questions") {
            const textQuestionIds: string[] = conv.text_question_ids || [];
            const textQuestionPrompts: string[] = conv.text_question_prompts || [];
            const textResponses = conv.text_responses || {};
            const currentIdx: number = conv.current_index || 0;
            const currentQId = textQuestionIds[currentIdx];

            // Save answer
            if (currentQId) {
              textResponses[currentQId] = text;
            }

            const nextIndex = currentIdx + 1;

            if (nextIndex < textQuestionIds.length) {
              // More questions
              await supabase
                .from("conversation_states")
                .update({
                  text_responses: textResponses,
                  current_index: nextIndex,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", conv.id);

              const blocks = buildTextQuestionPrompt(
                textQuestionPrompts[nextIndex], nextIndex, textQuestionPrompts.length, conv.id,
              );
              await sendSlackMessage(
                slackUserId,
                `Question ${nextIndex + 1}/${textQuestionPrompts.length}`,
                blocks,
              );
            } else {
              // Done — go to summary
              await supabase
                .from("conversation_states")
                .update({
                  text_responses: textResponses,
                  phase: "summary",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", conv.id);

              const compIds: string[] = conv.competency_ids || [];
              const compNames: string[] = conv.competency_names || [];
              const ratings = conv.ratings || {};
              const ratingValues = compIds.map((id: string) => ratings[id]?.rating || 0);
              const tqResponses = textQuestionIds.map((id: string) => textResponses[id] || "");
              const tqRatingScale = conv.rating_scale || undefined;

              const blocks = buildReviewSummary(
                conv.employee_name, compNames, ratingValues,
                textQuestionPrompts, tqResponses, conv.id, tqRatingScale,
              );
              await sendSlackMessage(
                slackUserId,
                `Review summary for ${conv.employee_name}`,
                blocks,
              );
            }
            return;
          }

          // Other review phases (summary, completed) — ignore text
          return;
        }

        // ── Survey flow ──────────────────────────────────────────────
        if (conv.flow_type === "survey") {
          if (conv.phase !== "survey_questions") return;

          const questions: any[] = conv.survey_questions_config || [];
          const questionIds: string[] = conv.survey_question_ids || [];
          const answers = conv.survey_answers || {};
          const currentIdx: number = conv.current_index || 0;
          const currentQ = questions[currentIdx];

          // Only handle text-type survey questions via free-text
          if (!currentQ || currentQ.type !== "text") return;

          // Save answer
          if (questionIds[currentIdx]) {
            answers[questionIds[currentIdx]] = text;
          }

          const nextIndex = currentIdx + 1;

          if (nextIndex < questions.length) {
            await supabase
              .from("conversation_states")
              .update({
                survey_answers: answers,
                current_index: nextIndex,
                updated_at: new Date().toISOString(),
              })
              .eq("id", conv.id);

            const nextQ = questions[nextIndex];
            const blocks = buildSurveyQuestionPrompt(
              { prompt: nextQ.label || nextQ.prompt, type: nextQ.type, options: nextQ.options },
              nextIndex, questions.length, conv.id, conv.survey_id,
            );
            await sendSlackMessage(
              slackUserId,
              `Question ${nextIndex + 1}/${questions.length}`,
              blocks,
            );
          } else {
            // Survey complete — save responses
            await supabase
              .from("conversation_states")
              .update({
                survey_answers: answers,
                status: "completed",
                phase: "completed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", conv.id);

            // Save to survey_responses table
            const participantId = conv.survey_participant_id;
            const { data: participant } = await supabase
              .from("survey_participants")
              .select("subject_user_id")
              .eq("id", participantId)
              .single();

            await supabase.from("survey_responses").insert({
              survey_id: conv.survey_id,
              participant_id: participantId,
              subject_user_id: participant?.subject_user_id || null,
              answers,
              workspace_id: ws.id,
            });

            await supabase
              .from("survey_participants")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
              })
              .eq("id", participantId);

            await sendSlackMessage(
              slackUserId,
              ":white_check_mark: Thank you! Your survey response has been submitted.",
            );
          }
          return;
        }
      } catch (err) {
        console.error("Error handling Nami DM text:", err);
      }
    })();

    // Don't await — return 200 immediately, Deno keeps the promise alive
    void processing;
  }

  // ================================================================
  //  REQUIRED: Handle app_uninstalled — clean up tokens and workspace data
  // ================================================================
  if (innerEvent?.type === "app_uninstalled") {
    const teamId = event.team_id;
    const cleanup = (async () => {
      try {
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("id")
          .eq("team_id", teamId)
          .single();

        if (workspace) {
          // Invalidate tokens — set to null so stale tokens can't be used.
          // Also flip requires_reinstall so the dashboard banner surfaces.
          await supabase
            .from("workspaces")
            .update({
              bot_token: null,
              refresh_token: null,
              token_expires_at: null,
              requires_reinstall: true,
              requires_reinstall_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", workspace.id);

          // Cancel any active conversation states for this workspace
          await supabase
            .from("conversation_states")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("status", "active")
            .in(
              "slack_user_id",
              supabase
                .from("users")
                .select("slack_user_id")
                .eq("workspace_id", workspace.id)
            );

          console.log("[slack-events] app_uninstalled: cleaned up workspace", teamId);
        }
      } catch (err) {
        console.error("[slack-events] Error handling app_uninstalled:", err);
      }
    })();
    void cleanup;
  }

  // ================================================================
  //  REQUIRED: Handle tokens_revoked — invalidate specific tokens
  // ================================================================
  if (innerEvent?.type === "tokens_revoked") {
    const teamId = event.team_id;
    const revokedTokens = innerEvent.tokens;
    const cleanup = (async () => {
      try {
        // If bot tokens were revoked, clear them from the workspace and
        // flip requires_reinstall so the dashboard banner surfaces.
        if (revokedTokens?.bot && revokedTokens.bot.length > 0) {
          await supabase
            .from("workspaces")
            .update({
              bot_token: null,
              refresh_token: null,
              token_expires_at: null,
              requires_reinstall: true,
              requires_reinstall_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("team_id", teamId);

          console.log("[slack-events] tokens_revoked: cleared bot tokens for", teamId);
        }

        // If user tokens were revoked, log a count (do NOT log token IDs).
        if (revokedTokens?.oauth && revokedTokens.oauth.length > 0) {
          console.log(`[slack-events] tokens_revoked: ${revokedTokens.oauth?.length ?? 0} oauth, ${revokedTokens.bot?.length ?? 0} bot for ${teamId}`);
        }
      } catch (err) {
        console.error("[slack-events] Error handling tokens_revoked:", err);
      }
    })();
    void cleanup;
  }

  // ================================================================
  //  SECURITY: Handle team_leave — deactivate user when removed from Slack
  // ================================================================
  if (innerEvent?.type === "team_leave") {
    const slackUserId = innerEvent.user?.id;
    const teamId = event.team_id;

    if (slackUserId && teamId) {
      const deactivation = (async () => {
        try {
          const { data: workspace } = await supabase
            .from("workspaces")
            .select("id")
            .eq("team_id", teamId)
            .single();

          if (!workspace) return;
          const wsTokens = await getWorkspaceSlackTokens(workspace.id);
          const wsBotToken = wsTokens?.botToken ?? null;

          // Look up the app user row so we can also close their open reviews.
          const { data: appUser } = await supabase
            .from("users")
            .select("id, slack_name, manager_id")
            .eq("slack_user_id", slackUserId)
            .eq("workspace_id", workspace.id)
            .single();

          // 1. Deactivate the user row (existing behaviour)
          const { error: userErr } = await supabase
            .from("users")
            .update({ employee_status: "deactivated", updated_at: new Date().toISOString() })
            .eq("slack_user_id", slackUserId)
            .eq("workspace_id", workspace.id);
          if (userErr) {
            console.error("[slack-events] Failed to deactivate user:", userErr.message);
          }

          if (!appUser) {
            console.log("[slack-events] team_leave: no app user for slack_user_id", slackUserId);
            return;
          }

          // 2. Close any open review_assignments where the departing user is
          //    the subject, the reviewer, or the manager. Matches Lattice /
          //    Leapsome behaviour: in-flight reviews don't silently carry on
          //    against someone who is no longer in the company.
          // Defense in depth: appUser.id is a server-generated UUID, but it
          // gets interpolated into a PostgREST `or=` filter — validate first.
          const safeAppUserId = asUuid(appUser.id);
          if (!safeAppUserId) {
            console.error("[slack-events] team_leave: invalid app user UUID rejected:", appUser.id);
            return;
          }
          const { data: affected } = await supabase
            .from("review_assignments")
            .select(
              `
              id, cycle_id, employee_id, reviewer_id, manager_id, assignment_type, status,
              cycle:performance_cycles!review_assignments_cycle_id_fkey(name),
              manager:users!review_assignments_manager_id_fkey(id, slack_user_id, slack_name)
              `,
            )
            .in("status", ["pending", "in_progress"])
            .or(
              `employee_id.eq.${safeAppUserId},reviewer_id.eq.${safeAppUserId},manager_id.eq.${safeAppUserId}`,
            );

          if (affected && affected.length > 0) {
            const ids = affected.map((a) => a.id);
            const { error: closeErr } = await supabase
              .from("review_assignments")
              .update({ status: "cancelled", updated_at: new Date().toISOString() })
              .in("id", ids);
            if (closeErr) {
              console.error("[slack-events] Failed to cancel assignments:", closeErr.message);
            } else {
              console.log(
                `[slack-events] Cancelled ${ids.length} review_assignments for ${slackUserId}`,
              );
            }

            // 3. DM affected managers so they know their team roster changed.
            // One DM per distinct manager summarising what was closed.
            const byManager = new Map<string, { slackId: string; name: string; items: string[] }>();
            for (const a of affected as Array<{
              id: string;
              assignment_type: string;
              cycle?: { name?: string } | null;
              manager?: { id?: string; slack_user_id?: string; slack_name?: string } | null;
            }>) {
              const mgr = a.manager;
              if (!mgr?.slack_user_id) continue;
              const key = mgr.slack_user_id;
              const entry = byManager.get(key) ?? { slackId: mgr.slack_user_id, name: mgr.slack_name ?? "", items: [] };
              entry.items.push(
                `• ${a.cycle?.name ?? "cycle"} — ${a.assignment_type} review`,
              );
              byManager.set(key, entry);
            }

            if (wsBotToken && byManager.size > 0) {
              for (const entry of byManager.values()) {
                try {
                  // Open / reuse the DM channel, then post.
                  const open = await fetch("https://slack.com/api/conversations.open", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${wsBotToken}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ users: entry.slackId }),
                  }).then((r) => r.json());
                  const channelId = open?.channel?.id;
                  if (!channelId) continue;

                  const text = [
                    `:wave: *${appUser.slack_name ?? "A team member"}* has left the Slack workspace.`,
                    "",
                    "I've cancelled the following reviews so nothing lingers:",
                    ...entry.items,
                    "",
                    "If you expected them back, your admin can re-invite them to Slack and I'll restore the rows.",
                  ].join("\n");

                  await fetch("https://slack.com/api/chat.postMessage", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${wsBotToken}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ channel: channelId, text }),
                  });
                } catch (dmErr) {
                  console.error("[slack-events] manager DM failed:", dmErr);
                }
              }
            }
          }

          console.log("[slack-events] Deactivated user + closed reviews:", slackUserId);
        } catch (err) {
          console.error("[slack-events] Error handling team_leave:", err);
        }
      })();
      void deactivation;
    }
  }

  return new Response("OK", { status: 200 });
});
