import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCompetencyPrompt,
  buildCommentPrompt,
  buildTextQuestionPrompt,
  buildReviewSummary,
  buildSurveyQuestionPrompt,
} from "../_shared/nami-blocks.ts";
import { callSlackApi, sendSlackMessage as sendSlackMessageWithRetry } from "../_shared/slack-api.ts";

const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://namihr.com";

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
  if (isNaN(parsedTs) || Math.abs(Date.now() / 1000 - parsedTs) > 300) return false;
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
    for (const r of selfPending.slice(0, 3)) {
      const cycle = (r as any).cycle;
      const deadline = cycle?.review_deadline
        ? new Date(cycle.review_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "no deadline";
      blocks.push(section(`*${cycle?.name || "Review"}*\n_Due: ${deadline}_ | <${DASHBOARD_URL}/dashboard/performance|Start>`));
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
        header("👋 Welcome to Nami"),
        section("You haven't been added to the workspace yet. Ask your admin to import the team from Slack."),
      ]);
      return new Response("OK", { status: 200 });
    }

    const blocks = await buildHomeBlocks(appUser);
    await publishHomeTab(workspace.bot_token, slackUserId, blocks);
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

        // Look up workspace bot_token
        const { data: ws } = await supabase
          .from("workspaces")
          .select("id, bot_token")
          .eq("team_id", teamId)
          .single();

        if (!ws?.bot_token) return;
        const botToken = ws.bot_token;

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
          // Invalidate tokens — set to null so stale tokens can't be used
          await supabase
            .from("workspaces")
            .update({
              bot_token: null,
              refresh_token: null,
              token_expires_at: null,
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
        // If bot tokens were revoked, clear them from the workspace
        if (revokedTokens?.bot && revokedTokens.bot.length > 0) {
          await supabase
            .from("workspaces")
            .update({
              bot_token: null,
              refresh_token: null,
              token_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("team_id", teamId);

          console.log("[slack-events] tokens_revoked: cleared bot tokens for", teamId);
        }

        // If user tokens were revoked, log it (we don't store user tokens long-term)
        if (revokedTokens?.oauth && revokedTokens.oauth.length > 0) {
          console.log("[slack-events] tokens_revoked: user tokens revoked for", teamId, revokedTokens.oauth);
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

          if (workspace) {
            const { error } = await supabase
              .from("users")
              .update({ employee_status: "deactivated", updated_at: new Date().toISOString() })
              .eq("slack_user_id", slackUserId)
              .eq("workspace_id", workspace.id);

            if (error) {
              console.error("[slack-events] Failed to deactivate user:", error.message);
            } else {
              console.log("[slack-events] Deactivated user:", slackUserId, "from workspace:", teamId);
            }
          }
        } catch (err) {
          console.error("[slack-events] Error handling team_leave:", err);
        }
      })();
      void deactivation;
    }
  }

  return new Response("OK", { status: 200 });
});
