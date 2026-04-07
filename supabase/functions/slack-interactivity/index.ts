import { buildCompetencyPrompt, buildCommentPrompt, buildTextQuestionPrompt, buildReviewSummary, buildSurveyQuestionPrompt } from "../_shared/nami-blocks.ts";
import { callSlackApi } from "../_shared/slack-api.ts";

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") || "";
const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET") || "";
const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://namihr.com";

Deno.serve(async (req) => {
  try {
    const body = await req.text();

    // Slack signature verification — always required
    if (!SLACK_SIGNING_SECRET) {
      console.error("SLACK_SIGNING_SECRET not set — rejecting request for security");
      return new Response("Server misconfiguration", { status: 500 });
    }
    {
      const timestamp = req.headers.get("x-slack-request-timestamp") || "";
      const slackSig = req.headers.get("x-slack-signature") || "";
      const fiveMin = 5 * 60;
      const parsedTs = parseInt(timestamp);
      if (isNaN(parsedTs) || Math.abs(Date.now() / 1000 - parsedTs) > fiveMin) {
        return new Response("Request too old", { status: 403 });
      }
      const baseString = `v0:${timestamp}:${body}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(SLACK_SIGNING_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      // Timing-safe comparison to prevent timing attacks
      const computed = encoder.encode(`v0=${hex}`);
      const received = encoder.encode(slackSig);
      if (computed.byteLength !== received.byteLength || !crypto.subtle.timingSafeEqual(computed, received)) {
        return new Response("Invalid signature", { status: 403 });
      }
    }

    const p = new URLSearchParams(body);
    const payloadStr = p.get("payload");
    if (!payloadStr) return new Response("No payload", { status: 400 });
    const payload = JSON.parse(payloadStr);

    // ----------------------------------------------------------------
    // DB helpers
    // ----------------------------------------------------------------
    async function dbQuery(table: string, query: string) {
      return (await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      })).json();
    }
    async function dbInsert(table: string, data: any) {
      return (await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(data),
      })).json();
    }
    async function dbUpdate(table: string, query: string, data: any) {
      return fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    }
    async function dbDelete(table: string, query: string) {
      return fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }
    async function slackApi(token: string, method: string, data: any) {
      return callSlackApi(token, method, data);
    }

    // Token refresh
    async function getFreshBotToken(ws: any): Promise<string> {
      if (ws.token_expires_at) {
        const expiresAt = new Date(ws.token_expires_at).getTime();
        if (Date.now() < expiresAt - 5 * 60 * 1000) return ws.bot_token;
      }
      if (!ws.refresh_token) return ws.bot_token;
      const res = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: SLACK_CLIENT_ID, client_secret: SLACK_CLIENT_SECRET,
          grant_type: "refresh_token", refresh_token: ws.refresh_token,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await dbUpdate("workspaces", `id=eq.${ws.id}`, {
          bot_token: data.access_token, refresh_token: data.refresh_token,
          token_expires_at: new Date(Date.now() + (data.expires_in || 43200) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        });
        return data.access_token;
      }
      return ws.bot_token;
    }

    // User lookup
    async function getOrCreateUser(wsId: string, slackId: string, token: string) {
      let users = await dbQuery("users", `workspace_id=eq.${wsId}&slack_user_id=eq.${slackId}`);
      if (users[0]) return users[0];
      const info = await slackApi(token, "users.info", { user: slackId });
      if (!info.ok) return null;
      const created = await dbInsert("users", {
        workspace_id: wsId,
        slack_user_id: slackId,
        slack_name: info.user.real_name || info.user.name,
        slack_email: info.user.profile?.email,
      });
      return created[0];
    }

    const defaultRatingLabels: Record<number, string> = { 1: "Needs improvement", 2: "Below expectations", 3: "Meets expectations", 4: "Exceeds expectations", 5: "Exceptional" };
    function ratingOptions(scale?: { min: number; max: number; labels: Record<string | number, string> }) {
      const s = scale || { min: 1, max: 5, labels: defaultRatingLabels };
      return Array.from({ length: s.max - s.min + 1 }, (_, i) => s.min + i).map(n => ({
        text: { type: "plain_text" as const, text: `${n} - ${s.labels[n] || ""}` },
        value: String(n),
      }));
    }

    // ----------------------------------------------------------------
    // Resolve workspace
    // ----------------------------------------------------------------
    const teamId = payload.team?.id || payload.user?.team_id;
    const ws = (await dbQuery("workspaces", `team_id=eq.${teamId}&select=id,bot_token,refresh_token,token_expires_at,rating_scale`))[0];
    if (!ws) return json({ response_action: "clear" });

    const botToken = await getFreshBotToken(ws);
    const cbId = payload.view?.callback_id;
    console.log("[interactivity] type:", payload.type, "callback:", cbId);

    // ----------------------------------------------------------------
    // SECURITY: Workspace validation helpers for multi-tenant isolation.
    // Edge functions use service_role (bypasses RLS), so we MUST verify
    // that entities belong to the resolved workspace before operating.
    // ----------------------------------------------------------------
    async function validateAssignmentWorkspace(assignmentId: string): Promise<boolean> {
      const res = await dbQuery("review_assignments",
        `id=eq.${assignmentId}&select=cycle:performance_cycles!inner(workspace_id)`);
      return res?.[0]?.cycle?.workspace_id === ws.id;
    }

    async function validateConversationWorkspace(convId: string): Promise<boolean> {
      const res = await dbQuery("conversation_states",
        `id=eq.${convId}&workspace_id=eq.${ws.id}&select=id`);
      return res?.length > 0;
    }

    // ================================================================
    //  WS4: Update original Slack notification after review submit
    // ================================================================
    async function updateOriginalNotification(assignmentId: string) {
      try {
        const assignments = await dbQuery("review_assignments",
          `id=eq.${assignmentId}&select=slack_notification_ts,slack_notification_channel`);
        const a = assignments?.[0];
        if (!a?.slack_notification_ts || !a?.slack_notification_channel) return;

        // Find ALL assignments sharing this notification message
        const siblings = await dbQuery("review_assignments",
          `slack_notification_ts=eq.${a.slack_notification_ts}&slack_notification_channel=eq.${a.slack_notification_channel}&select=id,status,overall_rating,employee:users!review_assignments_employee_id_fkey(slack_name),cycle:performance_cycles(name)`);
        if (!siblings?.length) return;

        const cycleName = siblings[0]?.cycle?.name || "Review";
        const lines = siblings.map((s: any) => {
          const name = s.employee?.slack_name || "Employee";
          if (s.status === "completed") {
            const r = s.overall_rating ? (Math.round(s.overall_rating * 10) / 10).toString() : "N/A";
            return `✅ ${name} — ⭐ ${r}/${ws.rating_scale?.max || 5}`;
          }
          if (s.status === "in_progress") return `🔄 ${name} — in progress`;
          return `⬜ ${name} — pending`;
        });
        const completed = siblings.filter((s: any) => s.status === "completed").length;
        const total = siblings.length;

        const blocks: any[] = [
          { type: "section", text: { type: "mrkdwn", text: `:memo: *Reviews — ${cycleName}*` } },
          { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
          { type: "context", elements: [{ type: "mrkdwn", text: `${completed}/${total} completed` }] },
        ];

        if (completed < total) {
          const nextPending = siblings.find((s: any) => s.status !== "completed" && s.status !== "in_progress");
          if (nextPending) {
            blocks.push({
              type: "actions",
              elements: [{
                type: "button",
                text: { type: "plain_text", text: "Continue Reviews ✏️", emoji: true },
                style: "primary",
                action_id: "open_cycle_review",
                value: nextPending.id,
              }],
            });
          }
        }

        await slackApi(botToken, "chat.update", {
          channel: a.slack_notification_channel,
          ts: a.slack_notification_ts,
          blocks,
          text: `${completed}/${total} reviews completed for ${cycleName}`,
        });
      } catch (err) {
        console.error("[WS4] updateOriginalNotification error:", err);
      }
    }

    // ================================================================
    //  WS5: Check and notify on milestone completions
    // ================================================================
    async function checkAndNotifyCompletion(assignmentId: string, cycleId: string, wsId: string) {
      try {
        const assignments = await dbQuery("review_assignments",
          `id=eq.${assignmentId}&select=employee_id,employee:users!review_assignments_employee_id_fkey(slack_name)`);
        const empId = assignments?.[0]?.employee_id;
        const empName = assignments?.[0]?.employee?.slack_name || "Employee";
        if (!empId) return;

        // Check: all reviews for this employee in this cycle
        const empAssignments = await dbQuery("review_assignments",
          `cycle_id=eq.${cycleId}&employee_id=eq.${empId}&select=id,status,overall_rating`);
        const completedForEmp = empAssignments.filter((a: any) => a.status === "completed" && a.overall_rating);
        const nonCompletedForEmp = empAssignments.filter((a: any) => a.status !== "completed");

        // Notify only when ALL reviews for this employee are completed (not pending or in_progress)
        if (nonCompletedForEmp.length === 0 && completedForEmp.length > 0) {
          const avgOverall = completedForEmp.reduce((s: number, a: any) => s + a.overall_rating, 0) / completedForEmp.length;
          const admins = await dbQuery("users", `workspace_id=eq.${wsId}&role=in.(admin,hr)&select=slack_user_id`);

          for (const admin of (admins || [])) {
            if (!admin?.slack_user_id) continue;
            await slackApi(botToken, "chat.postMessage", {
              channel: admin.slack_user_id,
              text: `All reviews for ${empName} are complete`,
              blocks: [
                { type: "section", text: { type: "mrkdwn", text: `:tada: *All reviews for ${empName} are complete!*` } },
                { type: "context", elements: [{ type: "mrkdwn", text: `Overall: ⭐ *${(Math.round(avgOverall * 10) / 10).toString()}/${ws.rating_scale?.max || 5}* · ${completedForEmp.length} reviews` }] },
                { type: "actions", elements: [
                  { type: "button", text: { type: "plain_text", text: "View Results 🔗", emoji: true },
                    url: `${DASHBOARD_URL}/dashboard/cycles/${cycleId}`, action_id: "view_dashboard" },
                ]},
              ],
            });
          }
        }

        // Check: all reviews in the ENTIRE cycle (must all be "completed", not just "not pending")
        const allNonCompleted = await dbQuery("review_assignments",
          `cycle_id=eq.${cycleId}&status=neq.completed&select=id`);
        if (Array.isArray(allNonCompleted) && allNonCompleted.length === 0) {
          const allCompleted = await dbQuery("review_assignments",
            `cycle_id=eq.${cycleId}&status=eq.completed&select=id,overall_rating`);
          const cycleAvg = allCompleted.length > 0
            ? allCompleted.reduce((s: number, a: any) => s + (a.overall_rating || 0), 0) / allCompleted.length
            : 0;
          const cycles = await dbQuery("performance_cycles", `id=eq.${cycleId}&select=name`);
          const cycleName = cycles?.[0]?.name || "Review Cycle";

          const admins = await dbQuery("users", `workspace_id=eq.${wsId}&role=eq.admin&select=slack_user_id&limit=1`);
          const firstAdmin = admins?.[0];
          if (firstAdmin?.slack_user_id) {
            await slackApi(botToken, "chat.postMessage", {
              channel: firstAdmin.slack_user_id,
              text: `All reviews for "${cycleName}" are complete!`,
              blocks: [
                { type: "section", text: { type: "mrkdwn", text: `:checkered_flag: *All reviews for "${cycleName}" are complete!*` } },
                { type: "context", elements: [{ type: "mrkdwn", text: `${allCompleted.length} reviews · Average: ⭐ *${(Math.round(cycleAvg * 10) / 10).toString()}/${ws.rating_scale?.max || 5}*` }] },
                { type: "actions", elements: [
                  { type: "button", text: { type: "plain_text", text: "View Results", emoji: true }, style: "primary",
                    url: `${DASHBOARD_URL}/dashboard/cycles/${cycleId}`, action_id: "view_dashboard" },
                  { type: "button", text: { type: "plain_text", text: "Start Calibration", emoji: true },
                    url: `${DASHBOARD_URL}/dashboard/cycles/${cycleId}/calibration`, action_id: "view_calibration" },
                ]},
              ],
            });
          }
        }
      } catch (err) {
        console.error("[WS5] checkAndNotifyCompletion error:", err);
      }
    }

    // ================================================================
    //  WS3: Send manager context before review
    // ================================================================
    async function sendManagerContext(slackUserId: string, employeeId: string, cycleId: string) {
      try {
        const contextLines: string[] = [];

        // Get all assignments for this employee in this cycle
        const empAssignments = await dbQuery("review_assignments",
          `cycle_id=eq.${cycleId}&employee_id=eq.${employeeId}&select=id,status`);
        const empAssignmentIds = (empAssignments || []).map((a: any) => a.id);

        if (empAssignmentIds.length > 0) {
          // 1. Self-assessment summary
          const selfResp = await dbQuery("review_responses",
            `assignment_id=in.(${empAssignmentIds.join(",")})&reviewer_role=eq.self&select=rating`);
          if (selfResp?.length > 0 && !selfResp.error) {
            const selfRatings = selfResp.filter((r: any) => r.rating);
            if (selfRatings.length > 0) {
              const selfAvg = selfRatings.reduce((s: number, r: any) => s + r.rating, 0) / selfRatings.length;
              contextLines.push(`Self-Assessment: ⭐ *${(Math.round(selfAvg * 10) / 10).toString()}* avg (${selfRatings.length} ratings)`);
            }
          }

          // 2. Peer/upward feedback
          const peerResp = await dbQuery("review_responses",
            `assignment_id=in.(${empAssignmentIds.join(",")})&reviewer_role=in.(peer,upward)&select=rating`);
          if (peerResp?.length > 0 && !peerResp.error) {
            const peerRatings = peerResp.filter((r: any) => r.rating);
            if (peerRatings.length > 0) {
              const peerAvg = peerRatings.reduce((s: number, r: any) => s + r.rating, 0) / peerRatings.length;
              contextLines.push(`Peer Feedback: ⭐ *${(Math.round(peerAvg * 10) / 10).toString()}* avg (${peerRatings.length} ratings)`);
            }
          }
        }

        // 3. Goals with tracking status
        const goals = await dbQuery("goals",
          `employee_id=eq.${employeeId}&status=eq.active&select=id,progress,tracking_status`);
        if (goals?.length > 0 && !goals.error) {
          const avgProgress = Math.round(goals.reduce((s: number, g: any) => s + (g.progress || 0), 0) / goals.length);
          const statusParts: string[] = [];
          const byStatus: Record<string, number> = {};
          for (const g of goals) {
            const ts = g.tracking_status || "no_status";
            byStatus[ts] = (byStatus[ts] || 0) + 1;
          }
          if (byStatus.on_track) statusParts.push(`${byStatus.on_track} on track`);
          if (byStatus.achieved) statusParts.push(`${byStatus.achieved} achieved`);
          if (byStatus.at_risk) statusParts.push(`${byStatus.at_risk} at risk`);
          if (byStatus.delayed) statusParts.push(`${byStatus.delayed} delayed`);
          const statusSuffix = statusParts.length > 0 ? ` · ${statusParts.join(" · ")}` : "";
          contextLines.push(`Goals: ${goals.length} active (${avgProgress}% avg progress${statusSuffix})`);
        }

        // 4. Previous cycle rating
        const prevAssignments = await dbQuery("review_assignments",
          `employee_id=eq.${employeeId}&status=eq.completed&cycle_id=neq.${cycleId}&select=id,overall_rating,updated_at&order=updated_at.desc&limit=1`);
        if (prevAssignments?.[0]?.overall_rating) {
          contextLines.push(`Previous Rating: ⭐ *${(Math.round(prevAssignments[0].overall_rating * 10) / 10).toString()}/${ws.rating_scale?.max || 5}*`);
        }

        // 5. Competency expectations from level matrix
        const empLevelData = await dbQuery("users", `id=eq.${employeeId}&workspace_id=eq.${ws.id}&select=level_id,levels(name,job_families(name))`);
        const empLevel = empLevelData?.[0];
        if (empLevel?.level_id) {
          const level = (empLevel as any).levels;
          const levelName = level?.job_families?.name
            ? `${level.job_families.name} — ${level.name}`
            : level?.name;

          const levelComps = await dbQuery("level_competencies",
            `level_id=eq.${empLevel.level_id}&workspace_id=eq.${ws.id}&select=competency_id,expected_level,competencies(name)`);

          if (levelComps?.length > 0 && !levelComps.error && levelName) {
            // Get previous per-competency ratings
            let prevCompMap: Record<string, number> = {};
            if (prevAssignments?.[0]?.id) {
              const prevResp = await dbQuery("review_responses",
                `assignment_id=eq.${prevAssignments[0].id}&reviewer_role=eq.manager&select=competency_id,rating`);
              if (prevResp && !prevResp.error) {
                for (const r of prevResp) {
                  if (r.competency_id && r.rating != null) prevCompMap[r.competency_id] = r.rating;
                }
              }
            }

            contextLines.push(""); // blank line separator
            contextLines.push(`:clipboard: *${levelName} expectations:*`);
            const MAX_SHOWN = 5;
            const shown = levelComps.slice(0, MAX_SHOWN);
            for (const lc of shown) {
              const compName = lc.competencies?.name || "Unknown";
              const prev = prevCompMap[lc.competency_id];
              let line = `• ${compName} — target: *${lc.expected_level}/${ws.rating_scale?.max || 5}*`;
              if (prev != null) {
                const met = prev >= lc.expected_level ? " :white_check_mark:" : "";
                line += ` (prev: ${prev}/${ws.rating_scale?.max || 5})${met}`;
              } else {
                line += " _(no prior data)_";
              }
              contextLines.push(line);
            }
            if (levelComps.length > MAX_SHOWN) {
              contextLines.push(`_…and ${levelComps.length - MAX_SHOWN} more in the review form_`);
            }
          }
        }

        if (contextLines.length === 0) return; // No context available

        const empData = await dbQuery("users", `id=eq.${employeeId}&select=slack_name`);
        const empName = empData?.[0]?.slack_name || "Employee";

        await slackApi(botToken, "chat.postMessage", {
          channel: slackUserId,
          text: `Context for reviewing ${empName}`,
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: `:bar_chart: *Context for reviewing ${empName}*` } },
            { type: "section", text: { type: "mrkdwn", text: contextLines.join("\n") } },
            { type: "context", elements: [{ type: "mrkdwn", text: "This data is for your reference only." }] },
          ],
        });
      } catch (err) {
        console.error("[WS3] sendManagerContext error:", err);
      }
    }

    // ================================================================
    //  Helper: get competencies for an assignment
    // ================================================================
    async function getCompetenciesForAssignment(assignmentId: string, employeeId: string, wsId: string) {
      const emps = await dbQuery("users", `id=eq.${employeeId}&select=id,slack_name,level_id`);
      const emp = emps?.[0];
      const empName = emp?.slack_name || "Employee";

      const assignments = await dbQuery("review_assignments", `id=eq.${assignmentId}&select=cycle_id`);
      const cycleId = assignments?.[0]?.cycle_id;

      let competencies: any[] = [];

      if (cycleId) {
        const cqs = await dbQuery(
          "cycle_questions",
          `cycle_id=eq.${cycleId}&question_type=eq.competency&select=id,competency_id,prompt,sort_order,competencies(id,name,category,description)&order=sort_order`
        );
        if (cqs && cqs.length > 0 && !cqs.error) {
          competencies = cqs.map((q: any) => ({
            id: q.competencies.id,
            name: q.competencies.name,
            category: q.competencies.category,
            description: q.competencies.description || "",
          }));
        }
      }

      if (competencies.length === 0 && emp?.level_id) {
        const lc = await dbQuery(
          "level_competencies",
          `level_id=eq.${emp.level_id}&workspace_id=eq.${wsId}&select=competency_id,competencies(id,name,category,description)&order=competencies(category),competencies(name)`
        );
        if (lc && lc.length > 0 && !lc.error) {
          competencies = lc.map((row: any) => ({
            id: row.competencies.id,
            name: row.competencies.name,
            category: row.competencies.category,
            description: row.competencies.description || "",
          }));
        }
      }

      if (competencies.length === 0) {
        const all = await dbQuery("competencies", `workspace_id=eq.${wsId}&select=id,name,category,is_core&order=category,name`);
        if (all && all.length > 0 && !all.error) {
          const core = all.filter((c: any) => c.is_core);
          competencies = (core.length >= 3 ? core : all).map((c: any) => ({
            id: c.id, name: c.name, category: c.category,
          }));
        }
        // If still empty, workspace has no competencies — review will proceed with text questions only
      }

      // Fetch score descriptors for all competencies in this review
      let scoreDescriptorsByComp: Record<string, Record<string, string>> = {};
      if (competencies.length > 0) {
        const compIds = competencies.map((c: any) => c.id);
        const sds = await dbQuery(
          "competency_score_descriptors",
          `workspace_id=eq.${wsId}&competency_id=in.(${compIds.join(",")})&select=competency_id,score,description`
        );
        if (sds && sds.length > 0 && !sds.error) {
          for (const sd of sds) {
            if (!scoreDescriptorsByComp[sd.competency_id]) {
              scoreDescriptorsByComp[sd.competency_id] = {};
            }
            scoreDescriptorsByComp[sd.competency_id][String(sd.score)] = sd.description;
          }
        }
      }

      return { competencies, empName, cycleId, scoreDescriptorsByComp };
    }

    // ================================================================
    //  Helper: send first competency prompt for DM review
    // ================================================================
    async function sendCompetencyPrompt(
      slackUserId: string,
      empName: string,
      cycleName: string,
      compName: string,
      currentIndex: number,
      totalComps: number,
      assignmentId: string,
      isFirst: boolean
    ) {
      const estMin = Math.max(2, Math.round(totalComps * 1.5));
      const blocks: any[] = [];

      if (isFirst) {
        blocks.push(
          {
            type: "section",
            text: { type: "mrkdwn", text: `:memo: *Reviewing ${empName} — ${cycleName}*\n${totalComps} competencies · ~${estMin} min · type \`cancel\` anytime to pause` },
          },
          { type: "divider" }
        );
      }

      blocks.push(
        {
          type: "section",
          text: { type: "mrkdwn", text: `*(${currentIndex + 1}/${totalComps} competencies) · ${compName}*\n\nRate 1–5, with an optional comment:\n\`4 — Great at cross-team coordination\`` },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Open Full Form Instead", emoji: true },
              action_id: "open_cycle_review",
              value: assignmentId,
            },
          ],
        }
      );

      const result = await slackApi(botToken, "chat.postMessage", {
        channel: slackUserId,
        text: `Rate ${compName} for ${empName} (${currentIndex + 1}/${totalComps})`,
        blocks,
      });

      return result?.ts || null;
    }

    // ================================================================
    //  Shared helper: build review form for a review_assignment (modal)
    // ================================================================
    async function buildReviewForm(assignmentId: string, reviewRole: string, employeeId: string, wsId: string) {
      const emps = await dbQuery("users", `id=eq.${employeeId}&select=id,slack_name,level_id`);
      const emp = emps?.[0];
      const empName = emp?.slack_name || "Employee";

      const assignments = await dbQuery("review_assignments", `id=eq.${assignmentId}&select=cycle_id`);
      const cycleId = assignments?.[0]?.cycle_id;

      let competencies: any[] = [];
      let textQuestions: any[] = [];
      let levelLabel = "";
      let usedCycleQuestions = false;

      if (cycleId) {
        const cqs = await dbQuery(
          "cycle_questions",
          `cycle_id=eq.${cycleId}&select=id,question_type,competency_id,prompt,sort_order,required,competencies(id,name,category)&order=sort_order`
        );
        if (cqs && cqs.length > 0 && !cqs.error) {
          usedCycleQuestions = true;
          let expectedMap: Record<string, number> = {};
          if (emp?.level_id) {
            const lc = await dbQuery("level_competencies", `level_id=eq.${emp.level_id}&select=competency_id,expected_level`);
            if (lc && !lc.error) {
              for (const row of lc) expectedMap[row.competency_id] = row.expected_level;
            }
          }
          for (const q of cqs) {
            if (q.question_type === "competency" && q.competencies) {
              competencies.push({ id: q.competencies.id, name: q.competencies.name, category: q.competencies.category, expected: expectedMap[q.competencies.id] || null });
            } else if (q.question_type === "text") {
              textQuestions.push({ id: q.id, prompt: q.prompt || "Additional comments", required: q.required });
            }
          }
        }
      }

      if (!usedCycleQuestions) {
        if (emp?.level_id) {
          const lc = await dbQuery(
            "level_competencies",
            `level_id=eq.${emp.level_id}&workspace_id=eq.${wsId}&select=competency_id,expected_level,weight,competencies(id,name,category)&order=competencies(category),competencies(name)`
          );
          if (lc && lc.length > 0 && !lc.error) {
            competencies = lc.map((row: any) => ({ id: row.competencies.id, name: row.competencies.name, category: row.competencies.category, expected: row.expected_level }));
          }
        }
        if (competencies.length === 0) {
          const all = await dbQuery("competencies", `workspace_id=eq.${wsId}&select=id,name,category,is_core&order=category,name`);
          if (all && all.length > 0 && !all.error) {
            const core = all.filter((c: any) => c.is_core);
            competencies = (core.length >= 3 ? core : all).map((c: any) => ({ id: c.id, name: c.name, category: c.category, expected: null }));
          }
          // If still empty, workspace has no competencies — review will proceed with text questions only
        }
      }

      if (emp?.level_id) {
        const levels = await dbQuery("levels", `id=eq.${emp.level_id}&select=name,grade,job_families(name)`);
        if (levels[0]) {
          const l = levels[0];
          levelLabel = `${l.job_families?.name || ""} - ${l.name}${l.grade ? " (" + l.grade + ")" : ""}`;
        }
      }

      const wsRatingScaleForModal = ws.rating_scale || { min: 1, max: 5, labels: defaultRatingLabels };
      const opts = ratingOptions(wsRatingScaleForModal);
      const compBlocks = competencies.slice(0, 60).map((c: any) => {
        let label = c.name;
        if (c.category) label += ` (${c.category})`;
        if (c.expected) label += ` - expected: ${c.expected}/${wsRatingScaleForModal.max}`;
        if (label.length > 200) label = label.slice(0, 197) + "...";
        return {
          type: "input", block_id: `comp_${c.id}`,
          label: { type: "plain_text", text: label },
          element: { type: "static_select", action_id: "rating", placeholder: { type: "plain_text", text: "Select rating" }, options: opts },
        };
      });

      const textBlocks = textQuestions.slice(0, 15).map((tq: any) => {
        let promptLabel = tq.prompt;
        if (promptLabel.length > 200) promptLabel = promptLabel.slice(0, 197) + "...";
        return {
          type: "input", block_id: `text_${tq.id}`,
          label: { type: "plain_text", text: promptLabel },
          optional: !tq.required,
          element: { type: "plain_text_input", action_id: "text_answer", multiline: true, placeholder: { type: "plain_text", text: "Your response..." } },
        };
      });

      const roleLabel = reviewRole === "self" ? "Self-Assessment" : reviewRole === "upward" ? "Upward Feedback" : "Manager Review";
      const headerLines = [`*${roleLabel} for ${empName}*`];
      if (levelLabel) headerLines.push(`Level: ${levelLabel}`);
      if (competencies.length > 0) headerLines.push(`${competencies.length} competencies to rate.`);
      if (textQuestions.length > 0) headerLines.push(`${textQuestions.length} open-ended question${textQuestions.length > 1 ? "s" : ""}.`);

      const blocks: any[] = [
        { type: "section", text: { type: "mrkdwn", text: headerLines.join("\n") } },
        { type: "divider" },
        ...compBlocks,
      ];

      if (textBlocks.length > 0) {
        if (compBlocks.length > 0) blocks.push({ type: "divider" });
        blocks.push(...textBlocks);
      }

      if (textQuestions.length === 0) {
        blocks.push({ type: "divider" });
        blocks.push({
          type: "input", block_id: "comment_block",
          label: { type: "plain_text", text: "Overall Comments" },
          optional: true,
          element: { type: "plain_text_input", action_id: "comment", multiline: true, placeholder: { type: "plain_text", text: "Strengths, areas for growth, overall impression..." } },
        });
      }

      return {
        type: "modal",
        callback_id: "cycle_review_submit",
        title: { type: "plain_text", text: roleLabel.slice(0, 24) },
        submit: { type: "plain_text", text: "Submit Review" },
        close: { type: "plain_text", text: "Cancel" },
        private_metadata: JSON.stringify({
          workspaceId: wsId, assignmentId, reviewRole, employeeId,
          competencyIds: competencies.slice(0, 60).map((c: any) => c.id),
          textQuestionIds: textQuestions.slice(0, 15).map((tq: any) => tq.id),
        }),
        blocks,
      };
    }

    // ================================================================
    //  VIEW SUBMISSIONS
    // ================================================================
    if (payload.type === "view_submission") {
      const vals = payload.view.state.values;

      // -- NAMI COMMENT MODAL --
      if (cbId === "nami_comment_submit") {
        const meta = safeParse(payload.view.private_metadata);
        const { convId, compName } = meta;
        const comment = vals?.comment_block?.comment_input?.value || "";

        if (convId && comment) {
          const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=*`);
          const conv = convStates?.[0];
          if (conv) {
            const compIds = conv.competency_ids || [];
            const currentIdx = conv.current_index || 0;
            const currentCompId = compIds[currentIdx];
            const ratings = conv.ratings || {};

            if (currentCompId && ratings[currentCompId]) {
              ratings[currentCompId].comment = comment;
              await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
                ratings,
                updated_at: new Date().toISOString(),
              });
            }

            // Advance to next competency (same logic as skip)
            const compNames = conv.competency_names || [];
            const compDescs = conv.competency_descriptions || compIds.map(() => "");
            const convRatingScale = conv.rating_scale || undefined;
            const nextIndex = currentIdx + 1;

            if (nextIndex < compIds.length) {
              await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
                current_index: nextIndex,
                ratings,
                updated_at: new Date().toISOString(),
              });
              const sdByComp = conv.score_descriptors_by_comp || {};
              const compSd = sdByComp[compIds[nextIndex]] || undefined;
              const blocks = buildCompetencyPrompt(compNames[nextIndex], compDescs[nextIndex] || "", nextIndex, compNames.length, convId, conv.assignment_id, convRatingScale, compSd);
              await slackApi(botToken, "chat.postMessage", {
                channel: payload.user.id,
                text: `Rate ${compNames[nextIndex]} (${nextIndex + 1}/${compNames.length})`,
                blocks,
              });
            } else {
              // Check for text questions
              const textQuestionIds = conv.text_question_ids || [];
              const textQuestionPrompts = conv.text_question_prompts || [];
              if (textQuestionIds.length > 0) {
                await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
                  phase: "text_questions",
                  current_index: 0,
                  ratings,
                  updated_at: new Date().toISOString(),
                });
                const { buildTextQuestionPrompt } = await import("../_shared/nami-blocks.ts");
                const tqBlocks = buildTextQuestionPrompt(textQuestionPrompts[0], 0, textQuestionIds.length, convId, conv.assignment_id);
                await slackApi(botToken, "chat.postMessage", {
                  channel: payload.user.id,
                  text: textQuestionPrompts[0],
                  blocks: tqBlocks,
                });
              } else {
                // Show summary
                const { buildReviewSummary } = await import("../_shared/nami-blocks.ts");
                const namiScaleMax = convRatingScale?.max || 5;
                const summaryBlocks = buildReviewSummary(conv.employee_name, compIds, compNames, ratings, convId, conv.assignment_id, namiScaleMax);
                await slackApi(botToken, "chat.postMessage", {
                  channel: payload.user.id,
                  text: `Review summary for ${conv.employee_name}`,
                  blocks: summaryBlocks,
                });
              }
            }

            // Confirm comment saved
            await slackApi(botToken, "chat.postMessage", {
              channel: payload.user.id,
              text: `💬 Comment saved for *${compName}*: _"${comment.slice(0, 80)}${comment.length > 80 ? "..." : ""}"_`,
            });
          }
        }
        return json({ response_action: "clear" });
      }

      // -- CYCLE REVIEW SELECT --
      if (cbId === "cycle_review_select") {
        const meta = safeParse(payload.view.private_metadata);
        let selection: any;
        if (meta.autoSelect) {
          selection = safeParse(meta.autoSelect);
        } else {
          const raw = vals.assignment_block?.assignment?.selected_option?.value;
          selection = safeParse(raw);
        }
        if (!selection?.assignmentId) {
          return json({ response_action: "errors", errors: { assignment_block: "Please select a review." } });
        }
        const view = await buildReviewForm(selection.assignmentId, selection.reviewRole || "manager", selection.employeeId, meta.workspaceId || ws.id);
        return json({ response_action: "update", view });
      }

      // -- CYCLE REVIEW SUBMIT --
      if (cbId === "cycle_review_submit") {
        const meta = safeParse(payload.view.private_metadata);
        const { assignmentId, reviewRole, competencyIds, textQuestionIds, workspaceId } = meta;

        const reviewer = await getOrCreateUser(workspaceId || ws.id, payload.user.id, botToken);
        if (!reviewer) return json({ response_action: "clear" });

        // Check if already submitted (avoid duplicates)
        const alreadySubmitted = await dbQuery("review_responses", `assignment_id=eq.${assignmentId}&reviewer_id=eq.${reviewer.id}&reviewer_role=eq.${reviewRole || "manager"}&select=id&limit=1`);
        if (alreadySubmitted && alreadySubmitted.length > 0 && !alreadySubmitted.error) {
          return json({ response_action: "errors", errors: { comment_block: "This review has already been submitted." } });
        }

        const ratings: { competencyId: string; rating: number }[] = [];
        for (const cId of (competencyIds || [])) {
          const val = vals[`comp_${cId}`]?.rating?.selected_option?.value;
          if (val) ratings.push({ competencyId: cId, rating: parseInt(val) });
        }

        const textResponses: { questionId: string; answer: string }[] = [];
        for (const tqId of (textQuestionIds || [])) {
          const answer = vals[`text_${tqId}`]?.text_answer?.value || "";
          if (answer.trim()) textResponses.push({ questionId: tqId, answer: answer.trim() });
        }

        const overallComment = vals.comment_block?.comment?.value || "";

        for (const r of ratings) {
          await dbInsert("review_responses", {
            assignment_id: assignmentId, reviewer_id: reviewer.id,
            reviewer_role: reviewRole || "manager", competency_id: r.competencyId, rating: r.rating,
          });
        }

        if (textResponses.length > 0) {
          const tqIds = textResponses.map(t => t.questionId);
          const cycleQs = await dbQuery("cycle_questions", `id=in.(${tqIds.join(",")})&select=id,prompt`);
          const promptMap: Record<string, string> = {};
          if (cycleQs && !cycleQs.error) {
            for (const q of cycleQs) promptMap[q.id] = q.prompt || "";
          }
          for (const tr of textResponses) {
            await dbInsert("review_responses", {
              assignment_id: assignmentId, reviewer_id: reviewer.id,
              reviewer_role: reviewRole || "manager", comment: `[${promptMap[tr.questionId] || ""}] ${tr.answer}`,
            });
          }
        }

        if (overallComment) {
          await dbInsert("review_responses", {
            assignment_id: assignmentId, reviewer_id: reviewer.id,
            reviewer_role: reviewRole || "manager", comment: overallComment,
          });
        }

        // Update assignment status
        let avgRating = 0;
        if ((reviewRole === "manager" || reviewRole === "upward") && ratings.length > 0) {
          avgRating = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
          await dbUpdate("review_assignments", `id=eq.${assignmentId}`, {
            status: "completed", overall_rating: Math.round(avgRating * 100) / 100,
            updated_at: new Date().toISOString(),
          });
        } else if (reviewRole === "self") {
          if (ratings.length > 0) avgRating = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
          await dbUpdate("review_assignments", `id=eq.${assignmentId}`, {
            status: "in_progress", updated_at: new Date().toISOString(),
          });
        }

        // Look up employee name for confirmation
        const empData = await dbQuery("review_assignments", `id=eq.${assignmentId}&select=employee:users!review_assignments_employee_id_fkey(slack_name),cycle_id`);
        const empName = empData?.[0]?.employee?.slack_name || "your team member";
        const cId = empData?.[0]?.cycle_id;

        // Count remaining reviews
        let remainingText = "";
        if (cId) {
          const remaining = await dbQuery("review_assignments", `cycle_id=eq.${cId}&status=in.(pending,in_progress)&or=(manager_id.eq.${reviewer.id},reviewer_id.eq.${reviewer.id})&select=id`);
          const remCount = Array.isArray(remaining) ? remaining.length : 0;
          remainingText = remCount > 0 ? `You have *${remCount} more review${remCount > 1 ? "s" : ""}* in this cycle. Check the Nami app Home Tab to continue.` : ":tada: *All caught up!* No more reviews in this cycle.";
        }

        // Compact confirmation message with time-limited Edit button
        const avgStr = avgRating > 0 ? (Math.round(avgRating * 10) / 10).toString() : "N/A";
        const confirmLabel = reviewRole === "upward" ? "Upward feedback" : "Review";
        const editDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min window
        const editValue = JSON.stringify({ assignmentId, reviewRole, employeeId: meta.employeeId, deadline: editDeadline });
        await slackApi(botToken, "chat.postMessage", {
          channel: payload.user.id,
          text: `${confirmLabel} submitted — ${empName}`,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `:white_check_mark: *${confirmLabel} submitted — ${empName}*` },
            },
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: `Average: *${avgStr}/${ws.rating_scale?.max || 5}* · ${ratings.length} competencies rated` }],
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Edit Review", emoji: true },
                  action_id: "nami_edit_submitted_review",
                  value: editValue,
                },
              ],
            },
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: "_You can edit this review for 30 minutes._" }],
            },
            ...(remainingText ? [
              { type: "divider" },
              { type: "section", text: { type: "mrkdwn", text: remainingText } },
            ] : []),
          ],
        });

        // WS4: Update original notification message
        updateOriginalNotification(assignmentId).catch(console.error);

        // WS5: Check for completion milestones
        if (cId) {
          checkAndNotifyCompletion(assignmentId, cId, workspaceId || ws.id).catch(console.error);
        }

        return json({ response_action: "clear" });
      }

      // -- FEEDBACK MODAL --
      if (cbId === "feedback_modal") {
        const meta = safeParse(payload.view?.private_metadata || "{}");
        const usedConfig = meta?.usedConfig;

        let toId: string;
        let type = "general";
        let msg = "";
        let anon = false;
        let customFields: Record<string, any> = {};

        if (usedConfig) {
          // Dynamic extraction from DB config
          const configRows = await dbQuery("feedback_form_configs", `workspace_id=eq.${ws.id}&select=fields&limit=1`);
          const fields: any[] = configRows?.[0]?.fields || [];

          for (const field of fields) {
            const blockVals = vals[field.id];
            if (!blockVals) continue;
            const actionVals = blockVals[field.id];
            if (!actionVals) continue;

            if (field.type === "user_select") {
              toId = actionVals.selected_user;
            } else if (field.type === "checkbox" && field.label?.toLowerCase().includes("anon")) {
              anon = (actionVals.selected_options?.length ?? 0) > 0;
            } else if (field.type === "text") {
              const val = actionVals.value || "";
              customFields[field.id] = val;
              if (!msg) msg = val; // first text field is the main message
            } else if (field.type === "rating" || field.type === "single_select") {
              customFields[field.id] = actionVals.selected_option?.value;
            } else if (field.type === "multi_select") {
              customFields[field.id] = (actionVals.selected_options || []).map((o: any) => o.value);
            }
          }
          // toId! — must be set by user_select field
        } else {
          // Hardcoded fallback — original extraction
          toId = vals.recipient_block?.recipient?.selected_user;
          type = vals.feedback_type_block?.feedback_type?.selected_option?.value || "general";
          msg = vals.message_block?.message?.value || "";
          const selectedPrivacyOpts = (vals.anonymous_block?.anonymous?.selected_options || []).map((o: any) => o.value);
          anon = selectedPrivacyOpts.includes("send_anonymously");
          var sharedWithEmployee = selectedPrivacyOpts.includes("share_with_recipient");
        }

        const from = await getOrCreateUser(ws.id, payload.user.id, botToken);
        const to = toId! ? await getOrCreateUser(ws.id, toId!, botToken) : null;

        // Determine shared_with_employee: for dynamic config, default to true unless explicitly set
        const isShared = typeof sharedWithEmployee !== "undefined" ? sharedWithEmployee : true;

        if (from && to) {
          await dbInsert("continuous_feedback", {
            workspace_id: ws.id,
            from_user_id: anon ? null : from.id,
            to_user_id: to.id,
            message: msg || JSON.stringify(customFields),
            feedback_type: type,
            is_anonymous: anon,
            shared_with_employee: isShared,
            ...(Object.keys(customFields).length > 0 ? { custom_fields: customFields } : {}),
          });

          // Only notify the recipient if shared_with_employee is true
          if (isShared) {
            const sender = anon ? "Someone" : from.slack_name;
            const typeEmoji = type === "praise" ? ":star:" : type === "constructive" ? ":bulb:" : ":speech_balloon:";
            const displayMsg = msg || "Feedback received";

            await slackApi(botToken, "chat.postMessage", {
              channel: toId!,
              text: `New kudos from ${sender}`,
              blocks: [
                { type: "section", text: { type: "mrkdwn", text: `${typeEmoji} *New kudos from ${sender}*` } },
                { type: "divider" },
                { type: "section", text: { type: "mrkdwn", text: displayMsg } },
                { type: "context", elements: [{ type: "mrkdwn", text: `Received just now · via /kudos` }] },
              ],
            });
          }

          // Send confirmation to the sender
          const recipientName = to.slack_name || "your colleague";
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Kudos sent to ${recipientName}`,
            blocks: [
              { type: "section", text: { type: "mrkdwn", text: `:white_check_mark: *Thank you!* Your kudos to *${recipientName}* has been sent.` } },
              { type: "context", elements: [{ type: "mrkdwn", text: isShared ? ":bell: They'll receive a notification." : ":lock: Visible only to admins." }] },
            ],
          });
        }
        return json({ response_action: "clear" });
      }

      // -- SURVEY MODAL SUBMIT (360 / pulse) --
      if (cbId === "survey_modal_submit") {
        const meta = safeParse(payload.view?.private_metadata || "{}");
        const { participantId, surveyId } = meta || {};
        if (!participantId || !surveyId) return json({ response_action: "clear" });

        // Check if already completed (prevent duplicate submissions)
        const existingParticipant = await dbQuery("survey_participants", `id=eq.${participantId}&select=status`);
        if (existingParticipant?.[0]?.status === "completed") {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: You've already submitted this survey. Thank you!",
          });
          return json({ response_action: "clear" });
        }

        const vals = payload.view.state.values;
        const answers: Record<string, any> = {};

        for (const blockId of Object.keys(vals)) {
          const blockVals = vals[blockId];
          const actionId = Object.keys(blockVals)[0];
          const actionVal = blockVals[actionId];
          if (actionVal?.value) answers[blockId] = actionVal.value;
          else if (actionVal?.selected_option?.value) answers[blockId] = actionVal.selected_option.value;
          else if (actionVal?.selected_options) answers[blockId] = actionVal.selected_options.map((o: any) => o.value);
        }

        // Fetch participant to get subject_user_id
        const participants = await dbQuery("survey_participants", `id=eq.${participantId}&select=subject_user_id`);
        const participant = participants?.[0];

        await dbInsert("survey_responses", {
          survey_id: surveyId,
          participant_id: participantId,
          subject_user_id: participant?.subject_user_id || null,
          answers,
          workspace_id: ws.id,
        });
        await dbUpdate("survey_participants", `id=eq.${participantId}&workspace_id=eq.${ws.id}`, {
          status: "completed",
          completed_at: new Date().toISOString(),
        });

        // Send thank-you confirmation to the user
        const surveyForConfirm = await dbQuery("surveys", `id=eq.${surveyId}&select=name`);
        const surveyName = surveyForConfirm?.[0]?.name || "the survey";
        await slackApi(botToken, "chat.postMessage", {
          channel: payload.user.id,
          text: `Survey submitted — ${surveyName}`,
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: `:white_check_mark: *Thank you!* Your response to *${surveyName}* has been recorded.` } },
            { type: "context", elements: [{ type: "mrkdwn", text: ":lock: Your answers are confidential and will be aggregated with other responses." }] },
          ],
        });

        return json({ response_action: "clear" });
      }

      // -- SURVEY SELECT (from /survey command) --
      if (cbId === "survey_select") {
        const vals = payload.view.state.values;
        const selected = safeParse(vals?.survey_block?.survey_selection?.selected_option?.value);
        if (!selected?.participantId) return json({ response_action: "clear" });

        const { participantId, surveyId } = selected;

        // Check if already completed
        const existingSP = await dbQuery("survey_participants", `id=eq.${participantId}&select=status`);
        if (existingSP?.[0]?.status === "completed") {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: You've already completed this survey. Thank you!",
          });
          return json({ response_action: "clear" });
        }

        const surveys = await dbQuery("surveys", `id=eq.${surveyId}&select=id,type,name,config,workspace_id`);
        const survey = surveys?.[0];
        if (!survey || survey.workspace_id !== ws.id) return json({ response_action: "clear" });

        // Build and push survey modal (same logic as open_survey_modal block action)
        const questions: any[] = survey.config?.questions || [];
        const blocks = questions.map((q: any) => {
          if (q.type === "rating_7") {
            return {
              type: "input", block_id: q.id,
              label: { type: "plain_text", text: q.label },
              element: {
                type: "static_select", action_id: q.id,
                placeholder: { type: "plain_text", text: "Select rating" },
                options: [1,2,3,4,5,6,7].map(n => ({ text: { type: "plain_text", text: String(n) }, value: String(n) })),
              },
            };
          } else if (q.type === "text") {
            return {
              type: "input", block_id: q.id, optional: !q.required,
              label: { type: "plain_text", text: q.label },
              element: { type: "plain_text_input", action_id: q.id, multiline: true },
            };
          } else if (q.type === "single_select") {
            return {
              type: "input", block_id: q.id,
              label: { type: "plain_text", text: q.label },
              element: {
                type: "static_select", action_id: q.id,
                placeholder: { type: "plain_text", text: "Select an option" },
                options: (q.options || []).map((o: string) => ({ text: { type: "plain_text", text: o }, value: o })),
              },
            };
          }
          return null;
        }).filter(Boolean);

        const surveyView = {
          type: "modal",
          callback_id: "survey_modal_submit",
          title: { type: "plain_text", text: survey.name.slice(0, 24) },
          submit: { type: "plain_text", text: "Submit" },
          close: { type: "plain_text", text: "Cancel" },
          private_metadata: JSON.stringify({ participantId, surveyId, workspaceId: ws.id }),
          blocks: blocks.length > 0 ? blocks : [
            { type: "section", text: { type: "mrkdwn", text: "_No questions configured._" } }
          ],
        };

        return json({ response_action: "push", view: surveyView });
      }
    }

    // ================================================================
    //  BLOCK ACTIONS
    // ================================================================
    if (payload.type === "block_actions") {
      const action = payload.actions?.[0];

      // -- Open cycle review modal --
      if (action?.action_id === "open_cycle_review") {
        const assignmentId = action.value;
        if (!await validateAssignmentWorkspace(assignmentId)) return json({});
        const assignments = await dbQuery("review_assignments", `id=eq.${assignmentId}&select=id,employee_id,manager_id,status,assignment_type,reviewer_id,cycle_id`);
        const assignment = assignments?.[0];
        if (!assignment) return json({});

        const user = await getOrCreateUser(ws.id, payload.user.id, botToken);
        if (!user) return json({});

        let reviewRole = "manager";
        if (user.id === assignment.employee_id) reviewRole = "self";
        if (assignment.assignment_type === "upward" && user.id === assignment.reviewer_id) reviewRole = "upward";
        if (assignment.assignment_type === "peer" && user.id === assignment.reviewer_id) reviewRole = "peer";

        // Authorization check — reject if role doesn't match
        if (reviewRole === "manager" && user.id !== assignment.manager_id) {
          await slackApi(botToken, "chat.postEphemeral", {
            channel: payload.channel?.id || payload.user.id,
            user: payload.user.id,
            text: ":no_entry: You are not authorized to review this employee.",
          });
          return json({});
        }

        // Check if already submitted (via web or Slack)
        const existing = await dbQuery("review_responses", `assignment_id=eq.${assignmentId}&reviewer_id=eq.${user.id}&reviewer_role=eq.${reviewRole}&select=id&limit=1`);
        if (existing && existing.length > 0 && !existing.error) {
          await slackApi(botToken, "chat.postEphemeral", {
            channel: payload.channel?.id || payload.user.id,
            user: payload.user.id,
            text: "✅ This review has already been submitted. You can view or edit it on the dashboard.",
          });
          return json({});
        }

        // WS3: Send manager context before opening the form
        if (reviewRole === "manager" && assignment.cycle_id) {
          await sendManagerContext(payload.user.id, assignment.employee_id, assignment.cycle_id);
        }

        const view = await buildReviewForm(assignmentId, reviewRole, assignment.employee_id, ws.id);
        await slackApi(botToken, "views.open", { trigger_id: payload.trigger_id, view });
      }

      // -- Remind me later --
      if (action?.action_id === "remind_me_later") {
        const meta = safeParse(action.value);
        const slackUserId = payload.user.id;

        const postAt = Math.floor(Date.now() / 1000) + 3 * 60 * 60;

        await slackApi(botToken, "chat.scheduleMessage", {
          channel: slackUserId,
          post_at: postAt,
          text: "Reminder: You have a pending review",
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: ":bell: *Reminder: You have a pending review*" },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Start Review ✏️", emoji: true },
                  style: "primary",
                  action_id: "open_cycle_review",
                  value: meta.assignmentId || "",
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "Review in DM 💬", emoji: true },
                  action_id: "start_dm_review",
                  value: JSON.stringify(meta),
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "Remind Me Later", emoji: true },
                  action_id: "remind_me_later",
                  value: action.value,
                },
              ],
            },
          ],
        });

        await slackApi(botToken, "chat.postMessage", {
          channel: slackUserId,
          text: ":clock3: I'll remind you in 3 hours.",
        });
      }

      // -- Start DM review (conversational flow) --
      if (action?.action_id === "start_dm_review") {
        const meta = safeParse(action.value);
        const assignmentId = meta.assignmentId;
        if (!assignmentId) return json({});
        if (!await validateAssignmentWorkspace(assignmentId)) return json({});

        const slackUserId = payload.user.id;
        const user = await getOrCreateUser(ws.id, slackUserId, botToken);
        if (!user) return json({});

        const assignments = await dbQuery("review_assignments", `id=eq.${assignmentId}&select=id,employee_id,manager_id,status,cycle_id,assignment_type,reviewer_id,performance_cycles(name)`);
        const assignment = assignments?.[0];
        if (!assignment) return json({});

        let reviewRole = "manager";
        if (user.id === assignment.employee_id) reviewRole = "self";
        if (assignment.assignment_type === "upward" && user.id === assignment.reviewer_id) reviewRole = "upward";
        if (assignment.assignment_type === "peer" && user.id === assignment.reviewer_id) reviewRole = "peer";

        // Authorization check
        if (reviewRole === "manager" && user.id !== assignment.manager_id) {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":no_entry: You are not authorized to review this employee.",
          });
          return json({});
        }

        // Check if already submitted (via web or modal)
        const existingResp = await dbQuery("review_responses", `assignment_id=eq.${assignmentId}&reviewer_id=eq.${user.id}&reviewer_role=eq.${reviewRole}&select=id&limit=1`);
        if (existingResp && existingResp.length > 0 && !existingResp.error) {
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: ":white_check_mark: This review has already been submitted. You can view or edit it on the dashboard.",
          });
          return json({});
        }

        // WS3: Send manager context before starting DM review
        if (reviewRole === "manager" && assignment.cycle_id) {
          await sendManagerContext(slackUserId, assignment.employee_id, assignment.cycle_id);
        }

        const { competencies, empName, scoreDescriptorsByComp } = await getCompetenciesForAssignment(assignmentId, assignment.employee_id, ws.id);
        const cycleName = assignment.performance_cycles?.name || "Review";

        if (competencies.length === 0) {
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: "No competencies found for this review. Please use the full form instead.",
          });
          return json({});
        }

        const compIds = competencies.map((c: any) => c.id);
        const compNames = competencies.map((c: any) => c.name);
        const compDescs = competencies.map((c: any) => c.description || "");

        await dbUpdate("conversation_states", `slack_user_id=eq.${slackUserId}&assignment_id=eq.${assignmentId}&status=eq.active`, { status: "expired" });

        const convState = await dbInsert("conversation_states", {
          workspace_id: ws.id,
          user_id: user.id,
          slack_user_id: slackUserId,
          assignment_id: assignmentId,
          review_role: reviewRole,
          employee_name: empName,
          cycle_name: cycleName,
          competency_ids: compIds,
          competency_names: compNames,
          competency_descriptions: compDescs,
          score_descriptors_by_comp: scoreDescriptorsByComp,
          current_index: 0,
          ratings: {},
          status: "active",
          phase: "competencies",
          text_question_ids: [],
          text_question_prompts: [],
          text_responses: {},
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

        if (!convState?.[0]) {
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: "Something went wrong starting the DM review. Please use the full form.",
          });
          return json({});
        }

        const msgTs = await sendCompetencyPrompt(
          slackUserId, empName, cycleName,
          compNames[0], 0, compNames.length,
          assignmentId, true
        );

        if (msgTs) {
          await dbUpdate("conversation_states", `id=eq.${convState[0].id}`, { last_message_ts: msgTs });
        }
      }

      // -- WS2: DM review submit (from summary buttons) --
      if (action?.action_id === "dm_review_submit") {
        const meta = safeParse(action.value);
        const convId = meta.convId;
        if (!convId) return json({});

        // Fetch the conversation state
        const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=*`);
        const conv = convStates?.[0];
        if (!conv) return json({});

        // Check if already submitted (via web or another Slack flow)
        const alreadyDone = await dbQuery("review_responses", `assignment_id=eq.${conv.assignment_id}&reviewer_id=eq.${conv.user_id}&reviewer_role=eq.${conv.review_role || "manager"}&select=id&limit=1`);
        if (alreadyDone && alreadyDone.length > 0 && !alreadyDone.error) {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: This review has already been submitted. You can view or edit it on the dashboard.",
          });
          await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, { status: "expired" });
          return json({});
        }

        // Mark as completed
        await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
          status: "completed",
          phase: "completed",
          updated_at: new Date().toISOString(),
        });

        // Save review responses (competency ratings)
        const ratings = conv.ratings || {};
        const compIds = conv.competency_ids || [];
        const compNames = conv.competency_names || [];
        const reviewRole = conv.review_role || "manager";
        let totalRating = 0;
        let ratedCount = 0;

        for (const [compId, data] of Object.entries(ratings)) {
          const { rating, comment } = data as any;
          if (!rating) continue;
          totalRating += rating;
          ratedCount++;
          await dbInsert("review_responses", {
            assignment_id: conv.assignment_id,
            reviewer_id: conv.user_id,
            reviewer_role: reviewRole,
            competency_id: compId,
            rating: rating,
            ...(comment ? { comment } : {}),
          });
        }

        // Save text responses
        const textResponses = conv.text_responses || {};
        const textQuestionIds = conv.text_question_ids || [];
        const textQuestionPrompts = conv.text_question_prompts || [];
        for (let i = 0; i < textQuestionIds.length; i++) {
          const answer = textResponses[textQuestionIds[i]];
          if (answer) {
            await dbInsert("review_responses", {
              assignment_id: conv.assignment_id,
              reviewer_id: conv.user_id,
              reviewer_role: reviewRole,
              comment: `[${textQuestionPrompts[i] || ""}] ${answer}`,
            });
          }
        }

        // Update assignment status
        const avgRating = ratedCount > 0 ? Math.round((totalRating / ratedCount) * 100) / 100 : 0;
        if ((reviewRole === "manager" || reviewRole === "upward") && ratedCount > 0) {
          await dbUpdate("review_assignments", `id=eq.${conv.assignment_id}`, {
            status: "completed",
            overall_rating: avgRating,
            updated_at: new Date().toISOString(),
          });
        } else if (reviewRole === "self") {
          await dbUpdate("review_assignments", `id=eq.${conv.assignment_id}`, {
            status: "in_progress",
            updated_at: new Date().toISOString(),
          });
        }

        // Send confirmation
        const avgStr = ratedCount > 0 ? (Math.round((totalRating / ratedCount) * 10) / 10).toString() : "N/A";
        const convScaleMax = conv.rating_scale?.max || 5;
        const summaryLines = compIds.map((id: string, i: number) => {
          const r = ratings[id];
          if (r?.rating) {
            return `• ${compNames[i]} — *${r.rating}*/${convScaleMax}${r.comment ? `  _${r.comment.slice(0, 50)}${r.comment.length > 50 ? "..." : ""}_` : ""}`;
          }
          return `• ${compNames[i]} — skipped`;
        }).join("\n");

        await slackApi(botToken, "chat.postMessage", {
          channel: payload.user.id,
          text: `Review submitted — ${conv.employee_name}`,
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: `:white_check_mark: *Review submitted — ${conv.employee_name}*` } },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: summaryLines } },
            { type: "context", elements: [{ type: "mrkdwn", text: `Average: *${avgStr}/${convScaleMax}* · ${ratedCount} of ${compIds.length} rated` }] },
            { type: "actions", elements: [
              { type: "button", text: { type: "plain_text", text: "View on Dashboard 🔗", emoji: true },
                url: `${DASHBOARD_URL}/dashboard`, action_id: "open_dashboard" },
            ]},
          ],
        });

        // WS4 + WS5: Update notification & check completions
        updateOriginalNotification(conv.assignment_id).catch(console.error);
        const aData = await dbQuery("review_assignments", `id=eq.${conv.assignment_id}&select=cycle_id`);
        if (aData?.[0]?.cycle_id) {
          checkAndNotifyCompletion(conv.assignment_id, aData[0].cycle_id, conv.workspace_id).catch(console.error);
        }
      }

      // -- WS2: DM review edit (go back to re-rate) --
      if (action?.action_id === "dm_review_edit") {
        const meta = safeParse(action.value);
        const convId = meta.convId;
        if (!convId) return json({});

        await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
          phase: "competencies",
          current_index: 0,
          updated_at: new Date().toISOString(),
        });

        const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=competency_names,competency_ids,employee_name,cycle_name,assignment_id`);
        const conv = convStates?.[0];
        if (conv) {
          const compNames = conv.competency_names || [];
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: "Edit mode: rate competencies again",
            blocks: [
              { type: "section", text: { type: "mrkdwn", text: `:pencil2: *Editing review for ${conv.employee_name}*\nStarting from the first competency. Rate 1–5 or type \`skip\` to keep current rating.` } },
              { type: "divider" },
              { type: "section", text: { type: "mrkdwn", text: `*(1/${compNames.length} competencies) · ${compNames[0]}*\n\nRate 1–5, with an optional comment:` } },
            ],
          });
        }
      }

      // -- WS2: DM review cancel --
      if (action?.action_id === "dm_review_cancel") {
        const meta = safeParse(action.value);
        const convId = meta.convId;
        if (!convId) return json({});

        await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
          status: "expired",
          updated_at: new Date().toISOString(),
        });

        await slackApi(botToken, "chat.postMessage", {
          channel: payload.user.id,
          text: "Review cancelled. You can start again anytime from the Nami app Home Tab.",
        });
      }

      // -- Open survey modal (360 / pulse) --
      if (action?.action_id === "open_survey_modal") {
        const { participantId, surveyId } = safeParse(action.value) || {};
        if (!participantId || !surveyId) return json({});

        // Check if already completed
        const existingP = await dbQuery("survey_participants", `id=eq.${participantId}&select=status`);
        if (existingP?.[0]?.status === "completed") {
          await slackApi(botToken, "chat.postEphemeral", {
            channel: payload.channel?.id || payload.user.id,
            user: payload.user.id,
            text: ":white_check_mark: You've already completed this survey. Thank you!",
          });
          return json({});
        }

        const surveys = await dbQuery("surveys", `id=eq.${surveyId}&select=id,type,name,config,workspace_id`);
        const survey = surveys?.[0];
        if (!survey || survey.workspace_id !== ws.id) return json({});

        const questions: any[] = survey.config?.questions || [];
        const blocks = questions.map((q: any) => {
          if (q.type === "rating_7") {
            return {
              type: "input",
              block_id: q.id,
              label: { type: "plain_text", text: q.label },
              element: {
                type: "static_select",
                action_id: q.id,
                placeholder: { type: "plain_text", text: "Select rating" },
                options: [1, 2, 3, 4, 5, 6, 7].map(n => ({
                  text: { type: "plain_text", text: String(n) },
                  value: String(n),
                })),
              },
            };
          } else if (q.type === "text") {
            return {
              type: "input",
              block_id: q.id,
              optional: !q.required,
              label: { type: "plain_text", text: q.label },
              element: { type: "plain_text_input", action_id: q.id, multiline: true },
            };
          } else if (q.type === "single_select") {
            return {
              type: "input",
              block_id: q.id,
              label: { type: "plain_text", text: q.label },
              element: {
                type: "static_select",
                action_id: q.id,
                placeholder: { type: "plain_text", text: "Select an option" },
                options: (q.options || []).map((o: string) => ({ text: { type: "plain_text", text: o }, value: o })),
              },
            };
          }
          return null;
        }).filter(Boolean);

        const view = {
          type: "modal",
          callback_id: "survey_modal_submit",
          title: { type: "plain_text", text: survey.name.slice(0, 24) },
          submit: { type: "plain_text", text: "Submit" },
          close: { type: "plain_text", text: "Cancel" },
          private_metadata: JSON.stringify({ participantId, surveyId, workspaceId: ws.id }),
          blocks: blocks.length > 0 ? blocks : [
            { type: "section", text: { type: "mrkdwn", text: "_This survey has no questions configured._" } }
          ],
        };

        await slackApi(botToken, "views.open", { trigger_id: payload.trigger_id, view });
        return json({});
      }

      // -- eNPS inline submit --
      if (action?.action_id === "enps_submit") {
        const { participantId, surveyId } = safeParse(action.value) || {};
        if (!participantId) return json({});

        // Check if already completed
        const existingEnps = await dbQuery("survey_participants", `id=eq.${participantId}&select=status`);
        if (existingEnps?.[0]?.status === "completed") {
          await slackApi(botToken, "chat.update", {
            channel: payload.channel?.id || payload.user.id,
            ts: payload.message?.ts,
            text: "✅ You've already submitted your response. Thank you!",
            blocks: [
              { type: "section", text: { type: "mrkdwn", text: ":white_check_mark: *You've already submitted your response.* Thank you!" } },
            ],
          });
          return json({});
        }

        // Extract score and follow-up from message state
        const state = payload.state?.values || {};
        const scoreBlock = Object.keys(state).find(k => k.startsWith("enps_score_"));
        const followupBlock = Object.keys(state).find(k => k.startsWith("enps_followup_"));
        const score = scoreBlock ? state[scoreBlock]?.enps_score?.selected_option?.value : null;
        const followup = followupBlock ? state[followupBlock]?.enps_followup?.value : null;

        if (score !== null && score !== undefined) {
          await dbInsert("survey_responses", {
            survey_id: surveyId,
            participant_id: participantId,
            answers: { score, follow_up: followup || "" },
            workspace_id: ws.id,
          });
          await dbUpdate("survey_participants", `id=eq.${participantId}&workspace_id=eq.${ws.id}`, {
            status: "completed",
            completed_at: new Date().toISOString(),
          });

          // Update the DM to show submitted state
          await slackApi(botToken, "chat.update", {
            channel: payload.channel?.id || payload.user.id,
            ts: payload.message?.ts,
            text: "✅ Your eNPS response has been submitted. Thank you!",
            blocks: [
              { type: "section", text: { type: "mrkdwn", text: "✅ *Thank you!* Your response has been recorded." } },
            ],
          });
        }
        return json({});
      }

      // ================================================================
      //  NAMI: Start review — opens a modal form (no inline buttons)
      // ================================================================
      if (action?.action_id === "nami_start_review") {
        const raw = action.value || "";
        // Value format: "self_<assignmentId>" | "mgr_<assignmentId>" | "upward_<assignmentId>"
        const underscoreIdx = raw.indexOf("_");
        const rolePrefix = raw.slice(0, underscoreIdx);
        const assignmentId = raw.slice(underscoreIdx + 1);
        if (!assignmentId) return json({});
        if (!await validateAssignmentWorkspace(assignmentId)) return json({});

        const slackUserId = payload.user.id;
        const user = await getOrCreateUser(ws.id, slackUserId, botToken);
        if (!user) return json({});

        const assignments = await dbQuery("review_assignments", `id=eq.${assignmentId}&select=id,employee_id,manager_id,status,cycle_id,assignment_type,reviewer_id,performance_cycles(name)`);
        const assignment = assignments?.[0];
        if (!assignment) return json({});

        let reviewRole = "manager";
        if (rolePrefix === "self" || user.id === assignment.employee_id) reviewRole = "self";
        if (rolePrefix === "upward" || (assignment.assignment_type === "upward" && user.id === assignment.reviewer_id)) reviewRole = "upward";
        if (assignment.assignment_type === "peer" && user.id === assignment.reviewer_id) reviewRole = "peer";

        // Authorization check
        if (reviewRole === "manager" && user.id !== assignment.manager_id) {
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: ":no_entry: You are not authorized to review this employee.",
          });
          return json({});
        }

        // Check if already submitted (via web or Slack)
        const existingResp = await dbQuery("review_responses", `assignment_id=eq.${assignmentId}&reviewer_id=eq.${user.id}&reviewer_role=eq.${reviewRole}&select=id&limit=1`);
        if (existingResp && existingResp.length > 0 && !existingResp.error) {
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: "✅ This review has already been submitted. You can view or edit it on the dashboard.",
          });
          return json({});
        }

        // WS3: Send manager context before opening form
        if (reviewRole === "manager" && assignment.cycle_id) {
          await sendManagerContext(slackUserId, assignment.employee_id, assignment.cycle_id);
        }

        // Open review as a Slack modal (prevents duplicate clicks, cleaner UX)
        const view = await buildReviewForm(assignmentId, reviewRole, assignment.employee_id, ws.id);
        await slackApi(botToken, "views.open", {
          trigger_id: payload.trigger_id,
          view,
        });
        return json({});
      }

      // ================================================================
      //  NAMI: Edit submitted review (within 30-minute window)
      // ================================================================
      if (action?.action_id === "nami_edit_submitted_review") {
        const editMeta = safeParse(action.value);
        const { assignmentId, reviewRole, employeeId, deadline } = editMeta;

        if (!assignmentId || !deadline) return json({});

        // Enforce 30-minute edit window
        if (new Date(deadline) < new Date()) {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: "The 30-minute edit window has closed. You can still edit this review on the dashboard.",
          });
          return json({});
        }

        if (!await validateAssignmentWorkspace(assignmentId)) return json({});

        const user = await getOrCreateUser(ws.id, payload.user.id, botToken);
        if (!user) return json({});

        // Delete existing responses so the modal submission can re-insert cleanly
        await dbDelete("review_responses", `assignment_id=eq.${assignmentId}&reviewer_id=eq.${user.id}&reviewer_role=eq.${reviewRole || "manager"}`);

        // Reset assignment status back to pending so the submit handler can update it
        await dbUpdate("review_assignments", `id=eq.${assignmentId}`, {
          status: "pending", overall_rating: null, updated_at: new Date().toISOString(),
        });

        // Re-open the review modal
        const view = await buildReviewForm(assignmentId, reviewRole || "manager", employeeId, ws.id);
        await slackApi(botToken, "views.open", {
          trigger_id: payload.trigger_id,
          view,
        });
        return json({});
      }

      // ================================================================
      //  NAMI: Remind me later (schedules a Slack message in 24h)
      // ================================================================
      if (action?.action_id === "nami_remind_later") {
        const slackUserId = payload.user.id;
        const value = action.value || "";

        // Schedule a reminder for 24 hours from now
        const postAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

        // Determine if this is a review or survey reminder
        const isReview = value.startsWith("self_") || value.startsWith("mgr_") || value.startsWith("upward_");

        if (isReview) {
          await slackApi(botToken, "chat.scheduleMessage", {
            channel: slackUserId,
            post_at: postAt,
            text: "Hey! Just a reminder — you still have a review to complete.",
            blocks: [
              { type: "section", text: { type: "mrkdwn", text: ":bell: *Reminder: You have a pending review*\nReady to get it done?" } },
              { type: "actions", elements: [
                { type: "button", text: { type: "plain_text", text: "Start now :rocket:", emoji: true }, style: "primary",
                  action_id: "nami_start_review", value: value },
                { type: "button", text: { type: "plain_text", text: "Remind me later", emoji: true },
                  action_id: "nami_remind_later", value: value },
              ]},
            ],
          });
        } else {
          // Survey reminder
          await slackApi(botToken, "chat.scheduleMessage", {
            channel: slackUserId,
            post_at: postAt,
            text: "Hey! Just a reminder — you still have a survey to complete.",
            blocks: [
              { type: "section", text: { type: "mrkdwn", text: ":bell: *Reminder: You have a pending survey*\nReady to take it?" } },
              { type: "actions", elements: [
                { type: "button", text: { type: "plain_text", text: "Start now :memo:", emoji: true }, style: "primary",
                  action_id: "nami_start_survey", value: value },
                { type: "button", text: { type: "plain_text", text: "Remind me later", emoji: true },
                  action_id: "nami_remind_later", value: value },
              ]},
            ],
          });
        }

        // Send immediate acknowledgment
        await slackApi(botToken, "chat.postMessage", {
          channel: slackUserId,
          text: ":clock3: No problem! I'll remind you in 24 hours.",
        });

        return json({});
      }

      // ================================================================
      //  NAMI: Rate competency (1-5)
      // ================================================================
      if (action?.action_id?.startsWith("nami_rate_")) {
        const ratingNum = parseInt(action.action_id.replace("nami_rate_", ""));
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) return json({});

        const meta = safeParse(action.value);
        const { convId, assignmentId, compName } = meta;
        if (!convId) return json({});

        const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=*`);
        const conv = convStates?.[0];
        if (!conv) return json({});

        // Update ratings
        const ratings = conv.ratings || {};
        const currentIdx = conv.current_index || 0;
        const compIds = conv.competency_ids || [];
        const currentCompId = compIds[currentIdx];
        if (currentCompId) {
          ratings[currentCompId] = { rating: ratingNum };
        }

        await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
          ratings,
          updated_at: new Date().toISOString(),
        });

        // Send comment prompt
        const compNames = conv.competency_names || [];
        const currentCompName = compNames[currentIdx] || compName || "this competency";
        const blocks = buildCommentPrompt(currentCompName, convId);
        await slackApi(botToken, "chat.postMessage", {
          channel: payload.user.id,
          text: `Any comments on ${currentCompName}?`,
          blocks,
        });
        return json({});
      }

      // ================================================================
      //  NAMI: Skip comment
      // ================================================================
      // ================================================================
      //  NAMI: Open comment modal (replaces free-text comment input)
      // ================================================================
      if (action?.action_id === "nami_open_comment_modal") {
        const meta = safeParse(action.value);
        const { convId, compName } = meta;
        if (!convId) return json({});

        await slackApi(botToken, "views.open", {
          trigger_id: payload.trigger_id,
          view: {
            type: "modal",
            callback_id: "nami_comment_submit",
            private_metadata: JSON.stringify({ convId, compName }),
            title: { type: "plain_text", text: "Add Comment" },
            submit: { type: "plain_text", text: "Save" },
            close: { type: "plain_text", text: "Cancel" },
            blocks: [
              {
                type: "section",
                text: { type: "mrkdwn", text: `Comment on *${compName}*:` },
              },
              {
                type: "input",
                block_id: "comment_block",
                label: { type: "plain_text", text: "Your thoughts" },
                element: {
                  type: "plain_text_input",
                  action_id: "comment_input",
                  multiline: true,
                  placeholder: { type: "plain_text", text: "Share specific examples or observations..." },
                },
              },
            ],
          },
        });
        return json({});
      }

      if (action?.action_id === "nami_skip_comment") {
        const meta = safeParse(action.value);
        const { convId } = meta;
        if (!convId) return json({});

        const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=*`);
        const conv = convStates?.[0];
        if (!conv) return json({});

        const compIds = conv.competency_ids || [];
        const compNames = conv.competency_names || [];
        const compDescs = conv.competency_descriptions || compIds.map(() => "");
        const convRatingScale = conv.rating_scale || undefined;
        const nextIndex = (conv.current_index || 0) + 1;

        if (nextIndex < compIds.length) {
          // More competencies to rate
          await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
            current_index: nextIndex,
            updated_at: new Date().toISOString(),
          });

          const sdByComp2 = conv.score_descriptors_by_comp || {};
          const compSd2 = sdByComp2[compIds[nextIndex]] || undefined;
          const blocks = buildCompetencyPrompt(compNames[nextIndex], compDescs[nextIndex] || "", nextIndex, compNames.length, convId, conv.assignment_id, convRatingScale, compSd2);
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Rate ${compNames[nextIndex]} (${nextIndex + 1}/${compNames.length})`,
            blocks,
          });
        } else {
          // No more competencies — check for text questions
          let textQuestionIds = conv.text_question_ids || [];
          let textQuestionPrompts = conv.text_question_prompts || [];

          // If text questions not yet loaded, fetch them
          if (textQuestionIds.length === 0 && conv.assignment_id) {
            const aData = await dbQuery("review_assignments", `id=eq.${conv.assignment_id}&select=cycle_id`);
            const cycleId = aData?.[0]?.cycle_id;
            if (cycleId) {
              const tqs = await dbQuery("cycle_questions", `cycle_id=eq.${cycleId}&question_type=eq.text&select=id,prompt&order=sort_order`);
              if (tqs && tqs.length > 0 && !tqs.error) {
                textQuestionIds = tqs.map((q: any) => q.id);
                textQuestionPrompts = tqs.map((q: any) => q.prompt || "Additional comments");
              }
            }
          }

          if (textQuestionIds.length > 0) {
            // Transition to text_questions phase
            await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
              phase: "text_questions",
              current_index: 0,
              text_question_ids: textQuestionIds,
              text_question_prompts: textQuestionPrompts,
              updated_at: new Date().toISOString(),
            });

            const blocks = buildTextQuestionPrompt(textQuestionPrompts[0], 0, textQuestionPrompts.length, convId);
            await slackApi(botToken, "chat.postMessage", {
              channel: payload.user.id,
              text: `Question 1/${textQuestionPrompts.length}`,
              blocks,
            });
          } else {
            // No text questions — go to summary
            await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
              phase: "summary",
              updated_at: new Date().toISOString(),
            });

            const ratings = conv.ratings || {};
            const ratingValues = compIds.map((id: string) => ratings[id]?.rating || 0);
            const textResponses = conv.text_responses || {};
            const tqPrompts = conv.text_question_prompts || [];
            const tqIds = conv.text_question_ids || [];
            const tqResponses = tqIds.map((id: string) => textResponses[id] || "");

            const blocks = buildReviewSummary(conv.employee_name, compNames, ratingValues, tqPrompts, tqResponses, convId, convRatingScale);
            await slackApi(botToken, "chat.postMessage", {
              channel: payload.user.id,
              text: `Review summary for ${conv.employee_name}`,
              blocks,
            });
          }
        }
        return json({});
      }

      // ================================================================
      //  NAMI: Submit review (from summary)
      // ================================================================
      if (action?.action_id === "nami_submit_review") {
        const convId = action.value;
        if (!convId) return json({});

        const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=*`);
        const conv = convStates?.[0];
        if (!conv) return json({});

        // Check if already submitted (e.g. via web while Slack flow was in progress)
        const alreadyDone = await dbQuery("review_responses", `assignment_id=eq.${conv.assignment_id}&reviewer_id=eq.${conv.user_id}&reviewer_role=eq.${conv.review_role}&select=id&limit=1`);
        if (alreadyDone && alreadyDone.length > 0 && !alreadyDone.error) {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: "⚠️ This review was already submitted (possibly via the dashboard). Your Slack responses were not saved to avoid duplicates.",
          });
          await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, { status: "expired" });
          return json({});
        }

        // Mark as completed
        await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
          status: "completed",
          phase: "completed",
          updated_at: new Date().toISOString(),
        });

        // Save competency ratings to review_responses
        const ratings = conv.ratings || {};
        const compIds = conv.competency_ids || [];
        const compNames = conv.competency_names || [];
        const reviewRole = conv.review_role || "manager";
        let totalRating = 0;
        let ratedCount = 0;

        for (const [compId, data] of Object.entries(ratings)) {
          const { rating, comment } = data as any;
          if (!rating) continue;
          totalRating += rating;
          ratedCount++;
          await dbInsert("review_responses", {
            assignment_id: conv.assignment_id,
            reviewer_id: conv.user_id,
            reviewer_role: reviewRole,
            competency_id: compId,
            rating: rating,
            ...(comment ? { comment } : {}),
          });
        }

        // Save text responses
        const textResponses = conv.text_responses || {};
        const textQuestionIds = conv.text_question_ids || [];
        const textQuestionPrompts = conv.text_question_prompts || [];
        for (let i = 0; i < textQuestionIds.length; i++) {
          const answer = textResponses[textQuestionIds[i]];
          if (answer) {
            await dbInsert("review_responses", {
              assignment_id: conv.assignment_id,
              reviewer_id: conv.user_id,
              reviewer_role: reviewRole,
              comment: `[${textQuestionPrompts[i] || ""}] ${answer}`,
            });
          }
        }

        // Update assignment status
        const avgRating = ratedCount > 0 ? Math.round((totalRating / ratedCount) * 100) / 100 : 0;
        if ((reviewRole === "manager" || reviewRole === "upward") && ratedCount > 0) {
          await dbUpdate("review_assignments", `id=eq.${conv.assignment_id}`, {
            status: "completed",
            overall_rating: avgRating,
            updated_at: new Date().toISOString(),
          });
        } else if (reviewRole === "self") {
          await dbUpdate("review_assignments", `id=eq.${conv.assignment_id}`, {
            status: "in_progress",
            updated_at: new Date().toISOString(),
          });

          // Notify the manager that this employee's self-review is done
          (async () => {
            try {
              const assignments = await dbQuery("review_assignments", `id=eq.${conv.assignment_id}&select=manager_id,cycle_id,cycle:performance_cycles!review_assignments_cycle_id_fkey(name)`);
              const a = assignments?.[0];
              if (a?.manager_id) {
                const managers = await dbQuery("users", `id=eq.${a.manager_id}&select=slack_user_id,slack_name`);
                const mgr = managers?.[0];
                if (mgr?.slack_user_id) {
                  const cycleName = a.cycle?.name || "the current cycle";
                  await slackApi(botToken, "chat.postMessage", {
                    channel: mgr.slack_user_id,
                    text: `${conv.employee_name} has completed their self-review`,
                    blocks: [
                      {
                        type: "section",
                        text: {
                          type: "mrkdwn",
                          text: `:white_check_mark: *${conv.employee_name}* has completed their self-review for *${cycleName}*.\n\nYou can now start your manager review.`,
                        },
                      },
                      { type: "divider" },
                      {
                        type: "actions",
                        elements: [
                          {
                            type: "button",
                            text: { type: "plain_text", text: "Start review :pencil:", emoji: true },
                            style: "primary",
                            action_id: "nami_start_review",
                            value: `mgr_${conv.assignment_id}`,
                          },
                        ],
                      },
                    ],
                  });
                }
              }
            } catch (e) {
              console.error("Failed to notify manager of self-review completion:", e);
            }
          })();
        }

        // Send confirmation
        const avgStr = ratedCount > 0 ? (Math.round((totalRating / ratedCount) * 10) / 10).toString() : "N/A";
        const namiScaleMax = conv.rating_scale?.max || 5;
        const summaryLines = compIds.map((id: string, i: number) => {
          const r = ratings[id];
          if (r?.rating) {
            return `\u2022 ${compNames[i]} \u2014 *${r.rating}*/${namiScaleMax}${r.comment ? `  _${r.comment.slice(0, 50)}${r.comment.length > 50 ? "..." : ""}_` : ""}`;
          }
          return `\u2022 ${compNames[i]} \u2014 skipped`;
        }).join("\n");

        await slackApi(botToken, "chat.postMessage", {
          channel: payload.user.id,
          text: `Review submitted \u2014 ${conv.employee_name}`,
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: `:white_check_mark: *Review submitted \u2014 ${conv.employee_name}*` } },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: summaryLines } },
            { type: "context", elements: [{ type: "mrkdwn", text: `Average: *${avgStr}/${namiScaleMax}* \u00b7 ${ratedCount} of ${compIds.length} rated` }] },
            { type: "actions", elements: [
              { type: "button", text: { type: "plain_text", text: "View on Dashboard \ud83d\udd17", emoji: true },
                url: `${DASHBOARD_URL}/dashboard`, action_id: "open_dashboard" },
            ]},
          ],
        });

        // WS4 + WS5: Update notification & check completions
        updateOriginalNotification(conv.assignment_id).catch(console.error);
        const aData = await dbQuery("review_assignments", `id=eq.${conv.assignment_id}&select=cycle_id`);
        if (aData?.[0]?.cycle_id) {
          checkAndNotifyCompletion(conv.assignment_id, aData[0].cycle_id, conv.workspace_id).catch(console.error);
        }
        return json({});
      }

      // ================================================================
      //  NAMI: Edit review (go back to first competency)
      // ================================================================
      if (action?.action_id === "nami_edit_review") {
        const convId = action.value;
        if (!convId) return json({});

        const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=*`);
        const conv = convStates?.[0];
        if (!conv) return json({});

        await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
          phase: "competencies",
          current_index: 0,
          updated_at: new Date().toISOString(),
        });

        const compNames = conv.competency_names || [];
        const compIds = conv.competency_ids || [];
        const compDescsEdit = conv.competency_descriptions || [];
        const editRatingScale = conv.rating_scale || undefined;
        const editSdByComp = conv.score_descriptors_by_comp || {};
        if (compNames.length > 0) {
          const blocks = buildCompetencyPrompt(compNames[0], compDescsEdit[0] || "", 0, compNames.length, convId, conv.assignment_id, editRatingScale, editSdByComp[compIds[0]] || undefined);
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Editing review \u2014 rate ${compNames[0]} again`,
            blocks: [
              { type: "section", text: { type: "mrkdwn", text: `:pencil2: *Editing review for ${conv.employee_name}*\nStarting from the first competency.` } },
              { type: "divider" },
              ...blocks,
            ],
          });
        }
        return json({});
      }

      // ================================================================
      //  NAMI: Cancel review
      // ================================================================
      if (action?.action_id === "nami_cancel_review") {
        const convId = action.value;
        if (!convId) return json({});

        await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
          status: "expired",
          updated_at: new Date().toISOString(),
        });

        await slackApi(botToken, "chat.postMessage", {
          channel: payload.user.id,
          text: "Review cancelled. You can start again anytime from the Nami app Home Tab.",
        });
        return json({});
      }

      // ================================================================
      //  NAMI: Start survey (conversational flow)
      // ================================================================
      if (action?.action_id === "nami_start_survey") {
        const meta = safeParse(action.value);
        const { participantId, surveyId } = meta;
        if (!participantId || !surveyId) return json({});

        const slackUserId = payload.user.id;

        // Check if already completed
        const existingP = await dbQuery("survey_participants", `id=eq.${participantId}&select=status`);
        if (existingP?.[0]?.status === "completed") {
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: ":white_check_mark: You've already completed this survey. Thank you!",
          });
          return json({});
        }

        const user = await getOrCreateUser(ws.id, slackUserId, botToken);
        if (!user) return json({});

        const surveys = await dbQuery("surveys", `id=eq.${surveyId}&select=id,name,config,workspace_id`);
        const survey = surveys?.[0];
        if (!survey || survey.workspace_id !== ws.id) return json({});

        const questions: any[] = survey.config?.questions || [];
        if (questions.length === 0) {
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: "This survey has no questions configured.",
          });
          return json({});
        }

        const questionIds = questions.map((q: any) => q.id);

        // Expire existing active survey conversation_states
        await dbUpdate("conversation_states", `slack_user_id=eq.${slackUserId}&status=eq.active&flow_type=eq.survey`, { status: "expired" });

        const convState = await dbInsert("conversation_states", {
          workspace_id: ws.id,
          user_id: user.id,
          slack_user_id: slackUserId,
          status: "active",
          flow_type: "survey",
          phase: "survey_questions",
          survey_id: surveyId,
          survey_participant_id: participantId,
          survey_question_ids: questionIds,
          survey_answers: {},
          current_index: 0,
          // Store full questions config for sending prompts
          survey_questions_config: questions,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

        if (!convState?.[0]) {
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: "Something went wrong starting the survey. Please try again.",
          });
          return json({});
        }

        // Send first question
        const firstQ = questions[0];
        const blocks = buildSurveyQuestionPrompt(
          { prompt: firstQ.label || firstQ.prompt, type: firstQ.type, options: firstQ.options },
          0, questions.length, convState[0].id, surveyId,
        );
        await slackApi(botToken, "chat.postMessage", {
          channel: slackUserId,
          text: `Question 1/${questions.length}`,
          blocks,
        });
        return json({});
      }

      // ================================================================
      //  NAMI: Survey rating answer (1-7)
      // ================================================================
      if (action?.action_id?.startsWith("nami_survey_rate_")) {
        const meta = safeParse(action.value);
        const { convId, surveyId, questionIndex, rating } = meta;
        if (!convId) return json({});

        const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=*`);
        const conv = convStates?.[0];
        if (!conv || conv.status === "completed") {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: This survey has already been submitted. Thank you!",
          });
          return json({});
        }

        const questions: any[] = conv.survey_questions_config || [];
        const questionIds = conv.survey_question_ids || [];
        const answers = conv.survey_answers || {};
        const currentIdx = questionIndex ?? conv.current_index ?? 0;

        // Save answer
        if (questionIds[currentIdx]) {
          answers[questionIds[currentIdx]] = rating;
        }

        const nextIndex = currentIdx + 1;
        if (nextIndex < questions.length) {
          await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
            survey_answers: answers,
            current_index: nextIndex,
            updated_at: new Date().toISOString(),
          });

          const nextQ = questions[nextIndex];
          const blocks = buildSurveyQuestionPrompt(
            { prompt: nextQ.label || nextQ.prompt, type: nextQ.type, options: nextQ.options },
            nextIndex, questions.length, convId, surveyId,
          );
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Question ${nextIndex + 1}/${questions.length}`,
            blocks,
          });
        } else {
          // Survey complete — save responses
          await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
            survey_answers: answers,
            status: "completed",
            phase: "completed",
            updated_at: new Date().toISOString(),
          });

          const participantId = conv.survey_participant_id;
          const participants = await dbQuery("survey_participants", `id=eq.${participantId}&select=subject_user_id`);
          const participant = participants?.[0];

          await dbInsert("survey_responses", {
            survey_id: conv.survey_id,
            participant_id: participantId,
            subject_user_id: participant?.subject_user_id || null,
            answers,
            workspace_id: ws.id,
          });
          await dbUpdate("survey_participants", `id=eq.${participantId}&workspace_id=eq.${ws.id}`, {
            status: "completed",
            completed_at: new Date().toISOString(),
          });

          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: Thank you! Your survey response has been submitted.",
          });
        }
        return json({});
      }

      // ================================================================
      //  NAMI: Survey select answer (0-4)
      // ================================================================
      if (action?.action_id?.startsWith("nami_survey_select_")) {
        const meta = safeParse(action.value);
        const { convId, surveyId, questionIndex, selected } = meta;
        if (!convId) return json({});

        const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=*`);
        const conv = convStates?.[0];
        if (!conv || conv.status === "completed") {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: This survey has already been submitted. Thank you!",
          });
          return json({});
        }

        const questions: any[] = conv.survey_questions_config || [];
        const questionIds = conv.survey_question_ids || [];
        const answers = conv.survey_answers || {};
        const currentIdx = questionIndex ?? conv.current_index ?? 0;

        // Save answer
        if (questionIds[currentIdx]) {
          answers[questionIds[currentIdx]] = selected;
        }

        const nextIndex = currentIdx + 1;
        if (nextIndex < questions.length) {
          await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
            survey_answers: answers,
            current_index: nextIndex,
            updated_at: new Date().toISOString(),
          });

          const nextQ = questions[nextIndex];
          const blocks = buildSurveyQuestionPrompt(
            { prompt: nextQ.label || nextQ.prompt, type: nextQ.type, options: nextQ.options },
            nextIndex, questions.length, convId, surveyId,
          );
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Question ${nextIndex + 1}/${questions.length}`,
            blocks,
          });
        } else {
          // Survey complete — save responses
          await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
            survey_answers: answers,
            status: "completed",
            phase: "completed",
            updated_at: new Date().toISOString(),
          });

          const participantId = conv.survey_participant_id;
          const participants = await dbQuery("survey_participants", `id=eq.${participantId}&select=subject_user_id`);
          const participant = participants?.[0];

          await dbInsert("survey_responses", {
            survey_id: conv.survey_id,
            participant_id: participantId,
            subject_user_id: participant?.subject_user_id || null,
            answers,
            workspace_id: ws.id,
          });
          await dbUpdate("survey_participants", `id=eq.${participantId}&workspace_id=eq.${ws.id}`, {
            status: "completed",
            completed_at: new Date().toISOString(),
          });

          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: Thank you! Your survey response has been submitted.",
          });
        }
        return json({});
      }

      // ================================================================
      //  NAMI: Skip survey question
      // ================================================================
      if (action?.action_id === "nami_survey_skip") {
        const meta = safeParse(action.value);
        const { convId, surveyId, questionIndex } = meta;
        if (!convId) return json({});

        const convStates = await dbQuery("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}&select=*`);
        const conv = convStates?.[0];
        if (!conv || conv.status === "completed") {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: This survey has already been submitted. Thank you!",
          });
          return json({});
        }

        const questions: any[] = conv.survey_questions_config || [];
        const currentIdx = questionIndex ?? conv.current_index ?? 0;
        const nextIndex = currentIdx + 1;

        if (nextIndex < questions.length) {
          await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
            current_index: nextIndex,
            updated_at: new Date().toISOString(),
          });

          const nextQ = questions[nextIndex];
          const blocks = buildSurveyQuestionPrompt(
            { prompt: nextQ.label || nextQ.prompt, type: nextQ.type, options: nextQ.options },
            nextIndex, questions.length, convId, surveyId,
          );
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Question ${nextIndex + 1}/${questions.length}`,
            blocks,
          });
        } else {
          // Survey complete — save responses (with skipped questions omitted)
          const answers = conv.survey_answers || {};
          await dbUpdate("conversation_states", `id=eq.${convId}&workspace_id=eq.${ws.id}`, {
            status: "completed",
            phase: "completed",
            updated_at: new Date().toISOString(),
          });

          const participantId = conv.survey_participant_id;
          const participants = await dbQuery("survey_participants", `id=eq.${participantId}&select=subject_user_id`);
          const participant = participants?.[0];

          await dbInsert("survey_responses", {
            survey_id: conv.survey_id,
            participant_id: participantId,
            subject_user_id: participant?.subject_user_id || null,
            answers,
            workspace_id: ws.id,
          });
          await dbUpdate("survey_participants", `id=eq.${participantId}&workspace_id=eq.${ws.id}`, {
            status: "completed",
            completed_at: new Date().toISOString(),
          });

          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: Thank you! Your survey response has been submitted.",
          });
        }
        return json({});
      }

      // -- Ignore view_dashboard and view_calibration link clicks --
      if (action?.action_id === "view_dashboard" || action?.action_id === "view_calibration" || action?.action_id === "open_dashboard") {
        // These are URL buttons, no action needed
      }
    }

    return json({});
  } catch (err: any) {
    console.error("[interactivity] unhandled error:", err?.message || err);
    return json({});
  }
});

function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
function safeParse(s: string) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}