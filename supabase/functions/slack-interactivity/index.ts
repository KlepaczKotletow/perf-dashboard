import { buildCompetencyPrompt, buildCommentPrompt, buildTextQuestionPrompt, buildReviewSummary, buildSurveyQuestionPrompt } from "../_shared/nami-blocks.ts";
import { callSlackApi, buildAuthedDashboardUrl } from "../_shared/slack-api.ts";
import { getWorkspaceSlackTokens, setWorkspaceSlackTokens } from "../_shared/workspace-tokens.ts";
import { asUuid, asSlackTeamId, asSlackUserId } from "../_shared/postgrest-safe.ts";

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") || "";
const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET") || "";
const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL");
if (!DASHBOARD_URL) {
  throw new Error("DASHBOARD_URL secret is not configured for this Supabase project");
}

Deno.serve(async (req) => {
  // Captured before any throw could happen so the outer catch can surface
  // a user-visible "something went wrong" instead of silent silence.
  let responseUrlForRecovery: string | undefined;
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
      const parsedTs = parseInt(timestamp);
      const nowSec = Date.now() / 1000;
      // Reject if missing, in the future (more than 5s clock skew), or older than 5 min.
      if (isNaN(parsedTs) || parsedTs > nowSec + 5 || nowSec - parsedTs > 300) {
        console.warn(`[slack-sig] timestamp out of range: ts=${parsedTs} now=${nowSec}`);
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

    // Slack retried because we were slow. With Task 2's event_id dedup, the
    // inbox catches event-callback retries; this is the catch-all for the
    // other endpoints (commands, interactivity) that don't have an event_id.
    // Either we already finished and Slack didn't get our 200 — doing it again
    // risks side-effects firing twice. Or we're still processing the original.
    // Either way, acknowledge fast so Slack stops retrying.
    const retryNum = req.headers.get("x-slack-retry-num");
    if (retryNum) {
      console.warn(
        `[slack-interactivity] retry #${retryNum} (reason=${
          req.headers.get("x-slack-retry-reason") ?? "?"
        }), short-circuiting to 200`,
      );
      return new Response("OK", { status: 200 });
    }

    const p = new URLSearchParams(body);
    const payloadStr = p.get("payload");
    if (!payloadStr) return new Response("No payload", { status: 400 });
    const payload = JSON.parse(payloadStr);

    // Stash response_url early so the outer catch can apologise to the user
    // if anything below throws. block_actions and view_submission payloads
    // both carry response_url for the channel the user interacted in.
    if (typeof payload?.response_url === "string") {
      responseUrlForRecovery = payload.response_url;
    }

    // ----------------------------------------------------------------
    // DB helpers
    // ----------------------------------------------------------------
    async function dbQuery(table: string, query: string): Promise<any> {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[dbQuery] ${table} ${res.status}: ${body}`);
        throw new Error(`dbQuery ${table} failed: ${res.status}`);
      }
      return res.json();
    }
    async function dbInsert(table: string, data: any) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[dbInsert] ${table} ${res.status}: ${body}`);
        throw new Error(`dbInsert ${table} failed: ${res.status}`);
      }
      return res.json();
    }
    async function dbUpdate(table: string, query: string, data: any) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[dbUpdate] ${table} ${res.status}: ${body}`);
        throw new Error(`dbUpdate ${table} failed: ${res.status}`);
      }
      return res;
    }
    async function dbDelete(table: string, query: string) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[dbDelete] ${table} ${res.status}: ${body}`);
        throw new Error(`dbDelete ${table} failed: ${res.status}`);
      }
      return res;
    }
    async function slackApi(token: string, method: string, data: any) {
      const res = await callSlackApi(token, method, data);
      // Surface ALL non-ok responses to function logs. Silent failures here
      // were the cause of "I clicked the button and nothing happened" reports.
      // Callers can still inspect res.ok themselves to decide on user-facing
      // recovery (e.g. fallback DM with a dashboard link).
      if (res && res.ok === false) {
        console.warn(`[slackApi] ${method} returned not-ok: ${res.error}${res.response_metadata?.messages ? " — " + JSON.stringify(res.response_metadata.messages) : ""}`);
      }
      return res;
    }

    // Token refresh
    async function getFreshBotToken(workspaceId: string): Promise<string | null> {
      const tokens = await getWorkspaceSlackTokens(workspaceId);
      if (!tokens) return null;

      const expiresAt = tokens.tokenExpiresAt
        ? new Date(tokens.tokenExpiresAt).getTime()
        : null;
      const needsRefresh = expiresAt === null || expiresAt - Date.now() < 5 * 60 * 1000;

      if (!tokens.refreshToken || !needsRefresh) return tokens.botToken;

      const res = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: SLACK_CLIENT_ID,
          client_secret: SLACK_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: tokens.refreshToken,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error("[getFreshBotToken] refresh failed:", data.error);
        if (data.error === "invalid_auth" || data.error === "token_revoked") {
          // Surface to the dashboard banner so an admin can reinstall.
          await fetch(`${SUPABASE_URL}/rest/v1/workspaces?id=eq.${workspaceId}`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              requires_reinstall: true,
              requires_reinstall_at: new Date().toISOString(),
            }),
          }).catch((e) => console.error("[getFreshBotToken] flag write failed:", e));
        }
        return tokens.botToken;  // serve stale rather than fail
      }

      await setWorkspaceSlackTokens(
        workspaceId,
        data.access_token,
        data.refresh_token ?? null,
        new Date(Date.now() + (data.expires_in || 43200) * 1000).toISOString(),
      );
      return data.access_token;
    }

    // User lookup
    async function getOrCreateUser(wsId: string, slackId: string, token: string) {
      // Defense in depth: validate both IDs before they get interpolated into
      // a PostgREST URL. Callers should already validate, but a missed call
      // site shouldn't be the difference between safe and unsafe.
      const safeWsId = asUuid(wsId);
      const safeSlackId = asSlackUserId(slackId);
      if (!safeWsId || !safeSlackId) {
        console.error("[getOrCreateUser] invalid id rejected:", { wsId, slackId });
        return null;
      }
      let users = await dbQuery("users", `workspace_id=eq.${safeWsId}&slack_user_id=eq.${safeSlackId}`);
      if (users[0]) return users[0];
      const info = await slackApi(token, "users.info", { user: safeSlackId });
      if (!info.ok) return null;
      const created = await dbInsert("users", {
        workspace_id: safeWsId,
        slack_user_id: safeSlackId,
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
    const rawTeamId = payload.team?.id || payload.user?.team_id;
    const teamId = asSlackTeamId(rawTeamId);
    if (!teamId) {
      console.warn(`[slack-interactivity] invalid team_id rejected:`, rawTeamId);
      return json({ response_action: "clear" });
    }
    const ws = (await dbQuery("workspaces", `team_id=eq.${teamId}&select=id,rating_scale`))[0];
    if (!ws) return json({ response_action: "clear" });

    // Defense in depth: ws.id is a server-generated UUID, but we interpolate it
    // into many PostgREST URLs throughout this handler — validate once here so
    // a corrupt DB row can't smuggle filter syntax into our queries.
    const wsId = asUuid(ws.id);
    if (!wsId) {
      console.error(`[slack-interactivity] invalid workspace UUID from DB:`, wsId);
      return json({ response_action: "clear" });
    }

    const botToken = await getFreshBotToken(wsId);
    if (!botToken) return json({ response_action: "clear" });
    const cbId = payload.view?.callback_id;
    console.log("[interactivity] type:", payload.type, "callback:", cbId);

    // ----------------------------------------------------------------
    // SECURITY: Workspace validation helpers for multi-tenant isolation.
    // Edge functions use service_role (bypasses RLS), so we MUST verify
    // that entities belong to the resolved workspace before operating.
    // ----------------------------------------------------------------
    async function validateAssignmentWorkspace(assignmentId: string): Promise<boolean> {
      const safeId = asUuid(assignmentId);
      if (!safeId) return false;
      const res = await dbQuery("review_assignments",
        `id=eq.${safeId}&select=cycle:performance_cycles!inner(workspace_id)`);
      return res?.[0]?.cycle?.workspace_id === wsId;
    }

    async function validateConversationWorkspace(convId: string): Promise<boolean> {
      const safeId = asUuid(convId);
      if (!safeId) return false;
      const res = await dbQuery("conversation_states",
        `id=eq.${safeId}&workspace_id=eq.${wsId}&select=id`);
      return res?.length > 0;
    }

    // ================================================================
    //  WS4: Update original Slack notification after review submit
    // ================================================================
    async function updateOriginalNotification(assignmentId: string) {
      try {
        // Defense in depth: assignmentId is validated at the callsite, but verify here too.
        const safeAssignmentId = asUuid(assignmentId);
        if (!safeAssignmentId) {
          console.error("[WS4] updateOriginalNotification: invalid assignmentId rejected:", assignmentId);
          return;
        }
        const assignments = await dbQuery("review_assignments",
          `id=eq.${safeAssignmentId}&select=slack_notification_ts,slack_notification_channel`);
        const a = assignments?.[0];
        if (!a?.slack_notification_ts || !a?.slack_notification_channel) return;

        // slack_notification_ts (Slack message timestamp like "1234567890.123") and
        // slack_notification_channel (Slack channel ID) are server-stored values
        // sourced from Slack — percent-encode to be safe in the URL filter.
        const safeNotifTs = encodeURIComponent(String(a.slack_notification_ts));
        const safeNotifChannel = encodeURIComponent(String(a.slack_notification_channel));
        // Find ALL assignments sharing this notification message
        const siblings = await dbQuery("review_assignments",
          `slack_notification_ts=eq.${safeNotifTs}&slack_notification_channel=eq.${safeNotifChannel}&select=id,status,overall_rating,employee:users!review_assignments_employee_id_fkey(slack_name),cycle:performance_cycles(name)`);
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
        // Defense in depth: validate all UUIDs before interpolation
        const safeAssignmentId = asUuid(assignmentId);
        const safeCycleId = asUuid(cycleId);
        const safeWsId = asUuid(wsId);
        if (!safeAssignmentId || !safeCycleId || !safeWsId) {
          console.error("[WS5] checkAndNotifyCompletion: invalid id rejected:",
            { assignmentId, cycleId, wsId });
          return;
        }
        const assignments = await dbQuery("review_assignments",
          `id=eq.${safeAssignmentId}&select=employee_id,employee:users!review_assignments_employee_id_fkey(slack_name)`);
        const empId = assignments?.[0]?.employee_id;
        const empName = assignments?.[0]?.employee?.slack_name || "Employee";
        if (!empId) return;
        // empId is also a server-generated UUID from the DB — validate before interpolating.
        const safeEmpId = asUuid(empId);
        if (!safeEmpId) {
          console.error("[WS5] checkAndNotifyCompletion: invalid empId from DB:", empId);
          return;
        }

        // Check: all reviews for this employee in this cycle
        const empAssignments = await dbQuery("review_assignments",
          `cycle_id=eq.${safeCycleId}&employee_id=eq.${safeEmpId}&select=id,status,overall_rating`);
        const completedForEmp = empAssignments.filter((a: any) => a.status === "completed" && a.overall_rating);
        const nonCompletedForEmp = empAssignments.filter((a: any) => a.status !== "completed");

        // Notify only when ALL reviews for this employee are completed (not pending or in_progress)
        if (nonCompletedForEmp.length === 0 && completedForEmp.length > 0) {
          // Atomically claim the per-employee alert slot. Only the first concurrent
          // caller sees a non-empty array back; later callers skip silently.
          // We flip one row per cycle+employee: whichever review_assignment fires
          // the PATCH first wins. The filter matches all assignments for this
          // (cycle, employee) pair so repeat calls find them all already stamped.
          const claimRes = await fetch(
            `${SUPABASE_URL}/rest/v1/review_assignments?cycle_id=eq.${safeCycleId}&employee_id=eq.${safeEmpId}&employee_completion_notified_at=is.null`,
            {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({ employee_completion_notified_at: new Date().toISOString() }),
            },
          );
          const claimed = claimRes.ok ? await claimRes.json() : [];
          if (!Array.isArray(claimed) || claimed.length === 0) {
            // Another caller already notified — skip both per-employee and cycle-wide
            // so we don't double-send. The cycle-wide branch below has its own
            // independent guard too.
          } else {
          const avgOverall = completedForEmp.reduce((s: number, a: any) => s + a.overall_rating, 0) / completedForEmp.length;
          const admins = await dbQuery("users", `workspace_id=eq.${safeWsId}&role=in.(admin,hr)&select=id,slack_user_id`);

          for (const admin of (admins || [])) {
            if (!admin?.slack_user_id) continue;
            const viewUrl = await buildAuthedDashboardUrl(
              SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_URL,
              admin.id, `/dashboard/cycles/${cycleId}`,
            );
            await slackApi(botToken, "chat.postMessage", {
              channel: admin.slack_user_id,
              text: `All reviews for ${empName} are complete`,
              blocks: [
                { type: "section", text: { type: "mrkdwn", text: `:tada: *All reviews for ${empName} are complete!*` } },
                { type: "context", elements: [{ type: "mrkdwn", text: `Overall: ⭐ *${(Math.round(avgOverall * 10) / 10).toString()}/${ws.rating_scale?.max || 5}* · ${completedForEmp.length} reviews` }] },
                { type: "actions", elements: [
                  { type: "button", text: { type: "plain_text", text: "View Results 🔗", emoji: true },
                    url: viewUrl, action_id: "view_dashboard" },
                ]},
              ],
            });
          }
          } // close "else" of atomic-claim branch
        }

        // Check: all reviews in the ENTIRE cycle (must all be "completed", not just "not pending")
        const allNonCompleted = await dbQuery("review_assignments",
          `cycle_id=eq.${safeCycleId}&status=neq.completed&select=id`);
        if (Array.isArray(allNonCompleted) && allNonCompleted.length === 0) {
          // Atomic claim on the cycle-wide alert slot.
          const cycleClaimRes = await fetch(
            `${SUPABASE_URL}/rest/v1/performance_cycles?id=eq.${safeCycleId}&completion_notified_at=is.null`,
            {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({ completion_notified_at: new Date().toISOString() }),
            },
          );
          const cycleClaimed = cycleClaimRes.ok ? await cycleClaimRes.json() : [];
          if (!Array.isArray(cycleClaimed) || cycleClaimed.length === 0) {
            return; // already sent by a concurrent caller
          }

          const allCompleted = await dbQuery("review_assignments",
            `cycle_id=eq.${safeCycleId}&status=eq.completed&select=id,overall_rating`);
          const cycleAvg = allCompleted.length > 0
            ? allCompleted.reduce((s: number, a: any) => s + (a.overall_rating || 0), 0) / allCompleted.length
            : 0;
          const cycles = await dbQuery("performance_cycles", `id=eq.${safeCycleId}&select=name`);
          const cycleName = cycles?.[0]?.name || "Review Cycle";

          const admins = await dbQuery("users", `workspace_id=eq.${safeWsId}&role=eq.admin&select=id,slack_user_id&limit=1`);
          const firstAdmin = admins?.[0];
          if (firstAdmin?.slack_user_id) {
            const [viewUrl, calUrl] = await Promise.all([
              buildAuthedDashboardUrl(
                SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_URL,
                firstAdmin.id, `/dashboard/cycles/${cycleId}`,
              ),
              buildAuthedDashboardUrl(
                SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_URL,
                firstAdmin.id, `/dashboard/cycles/${cycleId}/calibration`,
              ),
            ]);
            await slackApi(botToken, "chat.postMessage", {
              channel: firstAdmin.slack_user_id,
              text: `All reviews for "${cycleName}" are complete!`,
              blocks: [
                { type: "section", text: { type: "mrkdwn", text: `:checkered_flag: *All reviews for "${cycleName}" are complete!*` } },
                { type: "context", elements: [{ type: "mrkdwn", text: `${allCompleted.length} reviews · Average: ⭐ *${(Math.round(cycleAvg * 10) / 10).toString()}/${ws.rating_scale?.max || 5}*` }] },
                { type: "actions", elements: [
                  { type: "button", text: { type: "plain_text", text: "View Results", emoji: true }, style: "primary",
                    url: viewUrl, action_id: "view_dashboard" },
                  { type: "button", text: { type: "plain_text", text: "Start Calibration", emoji: true },
                    url: calUrl, action_id: "view_calibration" },
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
        // Defense in depth: validate UUIDs before they hit PostgREST URLs.
        const safeEmployeeId = asUuid(employeeId);
        const safeCycleId = asUuid(cycleId);
        if (!safeEmployeeId || !safeCycleId) {
          console.error("[WS3] sendManagerContext: invalid id rejected:",
            { employeeId, cycleId });
          return;
        }
        const contextLines: string[] = [];

        // Get all assignments for this employee in this cycle
        const empAssignments = await dbQuery("review_assignments",
          `cycle_id=eq.${safeCycleId}&employee_id=eq.${safeEmployeeId}&select=id,status`);
        // empAssignmentIds are server UUIDs from the DB. Validate each one
        // before they get joined into a PostgREST `in.()` filter.
        const empAssignmentIds = (empAssignments || [])
          .map((a: any) => asUuid(a.id))
          .filter((v: string | null): v is string => v !== null);

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
          `employee_id=eq.${safeEmployeeId}&status=eq.active&select=id,progress,tracking_status`);
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
          `employee_id=eq.${safeEmployeeId}&status=eq.completed&cycle_id=neq.${safeCycleId}&select=id,overall_rating,updated_at&order=updated_at.desc&limit=1`);
        if (prevAssignments?.[0]?.overall_rating) {
          contextLines.push(`Previous Rating: ⭐ *${(Math.round(prevAssignments[0].overall_rating * 10) / 10).toString()}/${ws.rating_scale?.max || 5}*`);
        }

        // 5. Competency expectations from level matrix
        const empLevelData = await dbQuery("users", `id=eq.${safeEmployeeId}&workspace_id=eq.${wsId}&select=level_id,levels(name,job_families(name))`);
        const empLevel = empLevelData?.[0];
        if (empLevel?.level_id) {
          const level = (empLevel as any).levels;
          const levelName = level?.job_families?.name
            ? `${level.job_families.name} — ${level.name}`
            : level?.name;

          // empLevel.level_id is a DB UUID — validate before interpolating.
          const safeLevelId = asUuid(empLevel.level_id);
          if (!safeLevelId) {
            console.warn("[WS3] sendManagerContext: invalid level_id:", empLevel.level_id);
            return;
          }
          const levelComps = await dbQuery("level_competencies",
            `level_id=eq.${safeLevelId}&workspace_id=eq.${wsId}&select=competency_id,expected_level,competencies(name)`);

          if (levelComps?.length > 0 && !levelComps.error && levelName) {
            // Get previous per-competency ratings
            let prevCompMap: Record<string, number> = {};
            if (prevAssignments?.[0]?.id) {
              const safePrevAssignmentId = asUuid(prevAssignments[0].id);
              if (!safePrevAssignmentId) {
                console.warn("[WS3] sendManagerContext: invalid prev assignment id:", prevAssignments[0].id);
              } else {
                const prevResp = await dbQuery("review_responses",
                  `assignment_id=eq.${safePrevAssignmentId}&reviewer_role=eq.manager&select=competency_id,rating`);
                if (prevResp && !prevResp.error) {
                  for (const r of prevResp) {
                    if (r.competency_id && r.rating != null) prevCompMap[r.competency_id] = r.rating;
                  }
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

        const empData = await dbQuery("users", `id=eq.${safeEmployeeId}&select=slack_name`);
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
      // Defense in depth: validate UUIDs before they get interpolated.
      const safeAssignmentId = asUuid(assignmentId);
      const safeEmployeeId = asUuid(employeeId);
      const safeWsId = asUuid(wsId);
      if (!safeAssignmentId || !safeEmployeeId || !safeWsId) {
        console.error("[getCompetenciesForAssignment] invalid id rejected:",
          { assignmentId, employeeId, wsId });
        return { competencies: [], empName: "Employee", cycleId: null, scoreDescriptorsByComp: {} };
      }
      const emps = await dbQuery("users", `id=eq.${safeEmployeeId}&select=id,slack_name,level_id`);
      const emp = emps?.[0];
      const empName = emp?.slack_name || "Employee";

      const assignments = await dbQuery("review_assignments", `id=eq.${safeAssignmentId}&select=cycle_id`);
      const cycleId = assignments?.[0]?.cycle_id;

      let competencies: any[] = [];

      if (cycleId) {
        // cycleId is a server UUID from DB — validate before use.
        const safeCycleId = asUuid(cycleId);
        if (safeCycleId) {
          const cqs = await dbQuery(
            "cycle_questions",
            `cycle_id=eq.${safeCycleId}&question_type=eq.competency&select=id,competency_id,prompt,sort_order,competencies(id,name,category,description)&order=sort_order`
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
      }

      if (competencies.length === 0 && emp?.level_id) {
        const safeLevelId = asUuid(emp.level_id);
        if (safeLevelId) {
          const lc = await dbQuery(
            "level_competencies",
            `level_id=eq.${safeLevelId}&workspace_id=eq.${safeWsId}&select=competency_id,competencies(id,name,category,description)&order=competencies(category),competencies(name)`
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
      }

      if (competencies.length === 0) {
        const all = await dbQuery("competencies", `workspace_id=eq.${safeWsId}&select=id,name,category,is_core&order=category,name`);
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
        // Validate every competency UUID before joining into in.() filter
        const compIds = competencies
          .map((c: any) => asUuid(c.id))
          .filter((v: string | null): v is string => v !== null);
        if (compIds.length > 0) {
          const sds = await dbQuery(
            "competency_score_descriptors",
            `workspace_id=eq.${safeWsId}&competency_id=in.(${compIds.join(",")})&select=competency_id,score,description`
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
      // Defense in depth: validate UUIDs before they get interpolated.
      const safeAssignmentId = asUuid(assignmentId);
      const safeEmployeeId = asUuid(employeeId);
      const safeWsId = asUuid(wsId);
      if (!safeAssignmentId || !safeEmployeeId || !safeWsId) {
        console.error("[buildReviewForm] invalid id rejected:",
          { assignmentId, employeeId, wsId });
        // Return a valid (but empty) modal so the upstream views.open call
        // either presents a sensible message or fails noisily — never silently
        // emits a malformed PostgREST URL.
        return {
          type: "modal",
          callback_id: "cycle_review_submit",
          title: { type: "plain_text", text: "Review" },
          close: { type: "plain_text", text: "Close" },
          blocks: [{ type: "section", text: { type: "mrkdwn", text: "Couldn't load this review." } }],
        };
      }
      const emps = await dbQuery("users", `id=eq.${safeEmployeeId}&select=id,slack_name,level_id`);
      const emp = emps?.[0];
      const empName = emp?.slack_name || "Employee";

      const assignments = await dbQuery("review_assignments", `id=eq.${safeAssignmentId}&select=cycle_id`);
      const cycleId = assignments?.[0]?.cycle_id;

      let competencies: any[] = [];
      let textQuestions: any[] = [];
      let levelLabel = "";
      let usedCycleQuestions = false;

      if (cycleId) {
        const safeCycleId = asUuid(cycleId);
        if (safeCycleId) {
          const cqs = await dbQuery(
            "cycle_questions",
            `cycle_id=eq.${safeCycleId}&select=id,question_type,competency_id,prompt,sort_order,required,competencies(id,name,category)&order=sort_order`
          );
          if (cqs && cqs.length > 0 && !cqs.error) {
            usedCycleQuestions = true;
            let expectedMap: Record<string, number> = {};
            if (emp?.level_id) {
              const safeLevelId = asUuid(emp.level_id);
              if (safeLevelId) {
                const lc = await dbQuery("level_competencies", `level_id=eq.${safeLevelId}&select=competency_id,expected_level`);
                if (lc && !lc.error) {
                  for (const row of lc) expectedMap[row.competency_id] = row.expected_level;
                }
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
      }

      if (!usedCycleQuestions) {
        if (emp?.level_id) {
          const safeLevelId = asUuid(emp.level_id);
          if (safeLevelId) {
            const lc = await dbQuery(
              "level_competencies",
              `level_id=eq.${safeLevelId}&workspace_id=eq.${safeWsId}&select=competency_id,expected_level,weight,competencies(id,name,category)&order=competencies(category),competencies(name)`
            );
            if (lc && lc.length > 0 && !lc.error) {
              competencies = lc.map((row: any) => ({ id: row.competencies.id, name: row.competencies.name, category: row.competencies.category, expected: row.expected_level }));
            }
          }
        }
        if (competencies.length === 0) {
          const all = await dbQuery("competencies", `workspace_id=eq.${safeWsId}&select=id,name,category,is_core&order=category,name`);
          if (all && all.length > 0 && !all.error) {
            const core = all.filter((c: any) => c.is_core);
            competencies = (core.length >= 3 ? core : all).map((c: any) => ({ id: c.id, name: c.name, category: c.category, expected: null }));
          }
          // If still empty, workspace has no competencies — review will proceed with text questions only
        }
      }

      if (emp?.level_id) {
        const safeLevelId = asUuid(emp.level_id);
        if (safeLevelId) {
          const levels = await dbQuery("levels", `id=eq.${safeLevelId}&select=name,grade,job_families(name)`);
          if (levels[0]) {
            const l = levels[0];
            levelLabel = `${l.job_families?.name || ""} - ${l.name}${l.grade ? " (" + l.grade + ")" : ""}`;
          }
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
          workspaceId: safeWsId, assignmentId: safeAssignmentId, reviewRole, employeeId: safeEmployeeId,
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

        // convId is server-generated (we set it in the original DM), but came
        // back through Slack's modal — validate before any URL interpolation.
        const safeConvId = asUuid(convId);
        if (!safeConvId && convId) {
          console.error("[nami_comment_submit] invalid convId rejected:", convId);
        }
        if (safeConvId && comment) {
          const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=*`);
          const conv = convStates?.[0];
          if (conv) {
            const compIds = conv.competency_ids || [];
            const currentIdx = conv.current_index || 0;
            const currentCompId = compIds[currentIdx];
            const ratings = conv.ratings || {};

            if (currentCompId && ratings[currentCompId]) {
              ratings[currentCompId].comment = comment;
              await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
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
              await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
                current_index: nextIndex,
                ratings,
                updated_at: new Date().toISOString(),
              });
              const sdByComp = conv.score_descriptors_by_comp || {};
              const compSd = sdByComp[compIds[nextIndex]] || undefined;
              const blocks = buildCompetencyPrompt(compNames[nextIndex], compDescs[nextIndex] || "", nextIndex, compNames.length, safeConvId, conv.assignment_id, convRatingScale, compSd);
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
                await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
                  phase: "text_questions",
                  current_index: 0,
                  ratings,
                  updated_at: new Date().toISOString(),
                });
                const { buildTextQuestionPrompt } = await import("../_shared/nami-blocks.ts");
                const tqBlocks = buildTextQuestionPrompt(textQuestionPrompts[0], 0, textQuestionIds.length, safeConvId, conv.assignment_id);
                await slackApi(botToken, "chat.postMessage", {
                  channel: payload.user.id,
                  text: textQuestionPrompts[0],
                  blocks: tqBlocks,
                });
              } else {
                // Show summary. Signature is
                // buildReviewSummary(empName, compNames[], ratings[],
                //                    textQuestions[], textResponses[],
                //                    convId, ratingScale?). The previous
                // call passed compIds and ratings (object) into the wrong
                // slots — .map() on a ratings object would throw at runtime
                // and silently kill the comment-submit flow.
                const { buildReviewSummary } = await import("../_shared/nami-blocks.ts");
                const ratingValues: number[] = compIds.map((id: string) => (ratings as Record<string, { rating?: number }>)[id]?.rating ?? 0);
                const summaryBlocks = buildReviewSummary(
                  conv.employee_name,
                  compNames,
                  ratingValues,
                  [],
                  [],
                  safeConvId,
                  convRatingScale,
                );
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
        // Always trust the signature-derived workspace; metadata field is ignored.
        const view = await buildReviewForm(selection.assignmentId, selection.reviewRole || "manager", selection.employeeId, wsId);
        return json({ response_action: "update", view });
      }

      // -- CYCLE REVIEW SUBMIT --
      if (cbId === "cycle_review_submit") {
        const meta = safeParse(payload.view.private_metadata);
        const { assignmentId, reviewRole, competencyIds, textQuestionIds } = meta;

        // Validate Slack-supplied / metadata IDs before any URL interpolation.
        const safeAssignmentId = asUuid(assignmentId);
        if (!safeAssignmentId) {
          console.error("[cycle_review_submit] invalid assignmentId rejected:", assignmentId);
          return json({ response_action: "errors", errors: { comment_block: "This review is no longer valid." } });
        }

        // CRITICAL: verify the target assignment belongs to this caller's
        // workspace BEFORE any writes. Service_role bypasses RLS so the
        // application layer is the only boundary; a malicious workspace
        // admin who obtains another workspace's assignment_id could
        // otherwise cross tenants here.
        if (!(await validateAssignmentWorkspace(safeAssignmentId))) {
          return json({
            response_action: "errors",
            errors: { comment_block: "This review belongs to a different workspace." },
          });
        }

        // Always use the signature-derived ws.id. Ignoring any workspaceId
        // hint in private_metadata removes the spoofing surface where an
        // attacker could craft a view with a foreign workspaceId.
        const safeUserId = asSlackUserId(payload.user.id);
        if (!safeUserId) {
          console.warn("[cycle_review_submit] invalid Slack user id:", payload.user.id);
          return json({ response_action: "clear" });
        }
        const reviewer = await getOrCreateUser(wsId, safeUserId, botToken);
        if (!reviewer) return json({ response_action: "clear" });
        const safeReviewerId = asUuid(reviewer.id);
        if (!safeReviewerId) {
          console.error("[cycle_review_submit] invalid reviewer id from DB:", reviewer.id);
          return json({ response_action: "clear" });
        }

        // reviewer_role is a constrained enum; encodeURIComponent for safety.
        const safeRoleFilter = encodeURIComponent(reviewRole || "manager");
        // Check if already submitted (avoid duplicates)
        const alreadySubmitted = await dbQuery("review_responses", `assignment_id=eq.${safeAssignmentId}&reviewer_id=eq.${safeReviewerId}&reviewer_role=eq.${safeRoleFilter}&select=id&limit=1`);
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
            assignment_id: safeAssignmentId, reviewer_id: safeReviewerId,
            reviewer_role: reviewRole || "manager", competency_id: r.competencyId, rating: r.rating,
          });
        }

        if (textResponses.length > 0) {
          // Validate each cycle_question UUID before joining into in.() filter.
          const tqIds = textResponses
            .map(t => asUuid(t.questionId))
            .filter((v: string | null): v is string => v !== null);
          if (tqIds.length > 0) {
            const cycleQs = await dbQuery("cycle_questions", `id=in.(${tqIds.join(",")})&select=id,prompt`);
            const promptMap: Record<string, string> = {};
            if (cycleQs && !cycleQs.error) {
              for (const q of cycleQs) promptMap[q.id] = q.prompt || "";
            }
            for (const tr of textResponses) {
              await dbInsert("review_responses", {
                assignment_id: safeAssignmentId, reviewer_id: safeReviewerId,
                reviewer_role: reviewRole || "manager", comment: `[${promptMap[tr.questionId] || ""}] ${tr.answer}`,
              });
            }
          }
        }

        if (overallComment) {
          await dbInsert("review_responses", {
            assignment_id: safeAssignmentId, reviewer_id: safeReviewerId,
            reviewer_role: reviewRole || "manager", comment: overallComment,
          });
        }

        // Update assignment status
        let avgRating = 0;
        if ((reviewRole === "manager" || reviewRole === "upward") && ratings.length > 0) {
          avgRating = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
          await dbUpdate("review_assignments", `id=eq.${safeAssignmentId}`, {
            status: "completed", overall_rating: Math.round(avgRating * 100) / 100,
            updated_at: new Date().toISOString(),
          });
        } else if (reviewRole === "self") {
          if (ratings.length > 0) avgRating = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
          await dbUpdate("review_assignments", `id=eq.${safeAssignmentId}`, {
            status: "in_progress", updated_at: new Date().toISOString(),
          });
        }

        // Look up employee name for confirmation
        const empData = await dbQuery("review_assignments", `id=eq.${safeAssignmentId}&select=employee:users!review_assignments_employee_id_fkey(slack_name),cycle_id`);
        const empName = empData?.[0]?.employee?.slack_name || "your team member";
        const cId = empData?.[0]?.cycle_id;

        // Count remaining reviews
        let remainingText = "";
        if (cId) {
          const safeCId = asUuid(cId);
          if (safeCId) {
            const remaining = await dbQuery("review_assignments", `cycle_id=eq.${safeCId}&status=in.(pending,in_progress)&or=(manager_id.eq.${safeReviewerId},reviewer_id.eq.${safeReviewerId})&select=id`);
            const remCount = Array.isArray(remaining) ? remaining.length : 0;
            remainingText = remCount > 0 ? `You have *${remCount} more review${remCount > 1 ? "s" : ""}* in this cycle. Check the Nami app Home Tab to continue.` : ":tada: *All caught up!* No more reviews in this cycle.";
          }
        }

        // Compact confirmation message with time-limited Edit button
        const avgStr = avgRating > 0 ? (Math.round(avgRating * 10) / 10).toString() : "N/A";
        const confirmLabel = reviewRole === "upward" ? "Upward feedback" : "Review";
        const editDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min window
        const editValue = JSON.stringify({ assignmentId: safeAssignmentId, reviewRole, employeeId: meta.employeeId, deadline: editDeadline });
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
        updateOriginalNotification(safeAssignmentId).catch(console.error);

        // WS5: Check for completion milestones
        if (cId) {
          const safeCId = asUuid(cId);
          if (safeCId) {
            checkAndNotifyCompletion(safeAssignmentId, safeCId, wsId).catch(console.error);
          }
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
          const configRows = await dbQuery("feedback_form_configs", `workspace_id=eq.${wsId}&select=fields&limit=1`);
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

        // Validate the Slack-supplied user IDs before they get sent through
        // any DB lookup that could interpolate them into a URL via getOrCreateUser.
        const safeFromUserId = asSlackUserId(payload.user.id);
        const rawToId = toId!;
        const safeToUserId = rawToId ? asSlackUserId(rawToId) : null;
        if (!safeFromUserId) {
          console.warn("[feedback_modal] invalid sender Slack id:", payload.user.id);
          return json({ response_action: "clear" });
        }
        if (rawToId && !safeToUserId) {
          console.warn("[feedback_modal] invalid recipient Slack id:", rawToId);
          return json({ response_action: "errors", errors: { recipient_block: "Invalid recipient." } });
        }
        const from = await getOrCreateUser(wsId, safeFromUserId, botToken);
        const to = safeToUserId ? await getOrCreateUser(wsId, safeToUserId, botToken) : null;

        // Determine shared_with_employee: for dynamic config, default to true unless explicitly set
        const isShared = typeof sharedWithEmployee !== "undefined" ? sharedWithEmployee : true;

        if (from && to) {
          await dbInsert("continuous_feedback", {
            workspace_id: wsId,
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
              channel: safeToUserId!,
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

        // Validate UUIDs from view metadata before any URL interpolation.
        const safeParticipantId = asUuid(participantId);
        const safeSurveyId = asUuid(surveyId);
        if (!safeParticipantId || !safeSurveyId) {
          console.error("[survey_modal_submit] invalid id rejected:", { participantId, surveyId });
          return json({ response_action: "clear" });
        }

        // Check if already completed (prevent duplicate submissions)
        const existingParticipant = await dbQuery("survey_participants", `id=eq.${safeParticipantId}&select=status`);
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
        const participants = await dbQuery("survey_participants", `id=eq.${safeParticipantId}&select=subject_user_id`);
        const participant = participants?.[0];

        // INSERT is now guarded by uniq_survey_response_* indexes. A 23505
        // means "already submitted" — from Slack retry, dual tab, or two
        // submits racing past the soft status check above. Treat identically
        // to the status-completed branch: ack, show the thank-you, move on.
        const insertRes = await dbInsert("survey_responses", {
          survey_id: safeSurveyId,
          participant_id: safeParticipantId,
          subject_user_id: participant?.subject_user_id || null,
          answers,
          workspace_id: wsId,
        });
        const insertWasDuplicate =
          insertRes && typeof insertRes === "object" &&
          !Array.isArray(insertRes) &&
          (insertRes as any).code === "23505";

        if (!insertWasDuplicate) {
          await dbUpdate("survey_participants", `id=eq.${safeParticipantId}&workspace_id=eq.${wsId}`, {
            status: "completed",
            completed_at: new Date().toISOString(),
          });
        }

        // Send thank-you confirmation to the user
        const surveyForConfirm = await dbQuery("surveys", `id=eq.${safeSurveyId}&select=name`);
        const surveyName = surveyForConfirm?.[0]?.name || "the survey";
        const confirmText = insertWasDuplicate
          ? `:white_check_mark: *Already recorded.* Your response to *${surveyName}* is saved — no duplicate created.`
          : `:white_check_mark: *Thank you!* Your response to *${surveyName}* has been recorded.`;
        await slackApi(botToken, "chat.postMessage", {
          channel: payload.user.id,
          text: `Survey submitted — ${surveyName}`,
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: confirmText } },
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
        // Validate UUIDs from select-option metadata before URL interpolation.
        const safeParticipantId = asUuid(participantId);
        const safeSurveyId = asUuid(surveyId);
        if (!safeParticipantId || !safeSurveyId) {
          console.error("[survey_select] invalid id rejected:", { participantId, surveyId });
          return json({ response_action: "clear" });
        }

        // Check if already completed
        const existingSP = await dbQuery("survey_participants", `id=eq.${safeParticipantId}&select=status`);
        if (existingSP?.[0]?.status === "completed") {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: You've already completed this survey. Thank you!",
          });
          return json({ response_action: "clear" });
        }

        const surveys = await dbQuery("surveys", `id=eq.${safeSurveyId}&select=id,type,name,config,workspace_id`);
        const survey = surveys?.[0];
        if (!survey || survey.workspace_id !== wsId) return json({ response_action: "clear" });

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
          private_metadata: JSON.stringify({ participantId: safeParticipantId, surveyId: safeSurveyId, workspaceId: wsId }),
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
      console.log(`[block_actions] action_id=${action?.action_id ?? "<none>"} value=${typeof action?.value === "string" ? action.value.slice(0, 80) : "<none>"} hasResponseUrl=${!!responseUrlForRecovery}`);

      // -- Open cycle review modal --
      if (action?.action_id === "open_cycle_review") {
        const assignmentId = action.value;
        // Defense in depth: action.value is server-generated, but validate before
        // it gets interpolated into PostgREST URLs.
        const safeAssignmentId = asUuid(assignmentId);
        if (!safeAssignmentId) {
          console.error("[open_cycle_review] invalid assignmentId rejected:", assignmentId);
          return json({});
        }
        if (!await validateAssignmentWorkspace(safeAssignmentId)) return json({});
        const assignments = await dbQuery("review_assignments", `id=eq.${safeAssignmentId}&select=id,employee_id,manager_id,status,assignment_type,reviewer_id,cycle_id`);
        const assignment = assignments?.[0];
        if (!assignment) return json({});

        const user = await getOrCreateUser(wsId, payload.user.id, botToken);
        if (!user) return json({});
        const safeUserId = asUuid(user.id);
        if (!safeUserId) {
          console.error("[open_cycle_review] invalid user UUID from DB:", user.id);
          return json({});
        }

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
        const safeRoleFilter = encodeURIComponent(reviewRole);
        const existing = await dbQuery("review_responses", `assignment_id=eq.${safeAssignmentId}&reviewer_id=eq.${safeUserId}&reviewer_role=eq.${safeRoleFilter}&select=id&limit=1`);
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

        // Placeholder-then-update pattern: trigger_id only lasts 3s, and
        // buildReviewForm + sendManagerContext above can easily eat that.
        const placeholderView = {
          type: "modal" as const,
          callback_id: "review_loading_placeholder",
          title: { type: "plain_text" as const, text: "Loading…" },
          close: { type: "plain_text" as const, text: "Close" },
          blocks: [{ type: "section", text: { type: "mrkdwn", text: "_Loading your review…_" } }],
        };
        const openResult = await slackApi(botToken, "views.open", {
          trigger_id: payload.trigger_id,
          view: placeholderView,
        });
        if (!openResult?.ok) {
          console.warn(`[open_cycle_review] placeholder views.open failed (${openResult?.error ?? "unknown"})`);
          const reviewUrl = await buildAuthedDashboardUrl(
            SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_URL!, user.id,
            `/dashboard/reviews/${safeAssignmentId}`,
          );
          await slackApi(botToken, "chat.postEphemeral", {
            channel: payload.channel?.id || payload.user.id,
            user: payload.user.id,
            text: "Couldn't open the review modal here.",
            blocks: [
              { type: "section", text: { type: "mrkdwn", text: `Couldn't open the review modal. <${reviewUrl}|Open it on the dashboard>.` } },
            ],
          });
          return json({});
        }
        const viewId = openResult.view?.id;
        try {
          const view = await buildReviewForm(safeAssignmentId, reviewRole, assignment.employee_id, wsId);
          const updRes = await slackApi(botToken, "views.update", { view_id: viewId, view });
          if (!updRes?.ok) throw new Error(`views.update failed: ${updRes?.error}`);
        } catch (e: any) {
          console.error(`[open_cycle_review] form build/update failed:`, e?.message ?? e);
          const reviewUrl = await buildAuthedDashboardUrl(
            SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_URL!, user.id,
            `/dashboard/reviews/${safeAssignmentId}`,
          );
          await slackApi(botToken, "views.update", {
            view_id: viewId,
            view: {
              type: "modal",
              callback_id: "review_load_failed",
              title: { type: "plain_text", text: "Couldn't load" },
              close: { type: "plain_text", text: "Close" },
              blocks: [{ type: "section", text: { type: "mrkdwn", text: `Couldn't load this review in Slack. <${reviewUrl}|Open it on the dashboard> to continue.` } }],
            },
          });
        }
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
        // Validate the server-generated UUID embedded in our own button payload.
        const safeAssignmentId = asUuid(assignmentId);
        if (!safeAssignmentId) {
          console.error("[start_dm_review] invalid assignmentId rejected:", assignmentId);
          return json({});
        }
        if (!await validateAssignmentWorkspace(safeAssignmentId)) return json({});

        const slackUserId = payload.user.id;
        const safeSlackUserId = asSlackUserId(slackUserId);
        if (!safeSlackUserId) {
          console.warn("[start_dm_review] invalid Slack user id:", slackUserId);
          return json({});
        }
        const user = await getOrCreateUser(wsId, safeSlackUserId, botToken);
        if (!user) return json({});
        const safeUserId = asUuid(user.id);
        if (!safeUserId) return json({});

        const assignments = await dbQuery("review_assignments", `id=eq.${safeAssignmentId}&select=id,employee_id,manager_id,status,cycle_id,assignment_type,reviewer_id,performance_cycles(name)`);
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
        const safeRoleFilter = encodeURIComponent(reviewRole);
        const existingResp = await dbQuery("review_responses", `assignment_id=eq.${safeAssignmentId}&reviewer_id=eq.${safeUserId}&reviewer_role=eq.${safeRoleFilter}&select=id&limit=1`);
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

        const { competencies, empName, scoreDescriptorsByComp } = await getCompetenciesForAssignment(safeAssignmentId, assignment.employee_id, wsId);
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

        await dbUpdate("conversation_states", `slack_user_id=eq.${safeSlackUserId}&assignment_id=eq.${safeAssignmentId}&status=eq.active`, { status: "expired" });

        const convState = await dbInsert("conversation_states", {
          workspace_id: wsId,
          user_id: safeUserId,
          slack_user_id: safeSlackUserId,
          assignment_id: safeAssignmentId,
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
          safeAssignmentId, true
        );

        if (msgTs) {
          const safeConvStateId = asUuid(convState[0].id);
          if (safeConvStateId) {
            await dbUpdate("conversation_states", `id=eq.${safeConvStateId}`, { last_message_ts: msgTs });
          }
        }
      }

      // -- WS2: DM review submit (from summary buttons) --
      if (action?.action_id === "dm_review_submit") {
        const meta = safeParse(action.value);
        const convId = meta.convId;
        if (!convId) return json({});
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[dm_review_submit] invalid convId rejected:", convId);
          return json({});
        }

        // Fetch the conversation state
        const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=*`);
        const conv = convStates?.[0];
        if (!conv) return json({});
        // Validate the assignment_id and user_id from the DB row before they
        // get interpolated into queries.
        const safeConvAssignmentId = asUuid(conv.assignment_id);
        const safeConvUserId = asUuid(conv.user_id);
        if (!safeConvAssignmentId || !safeConvUserId) {
          console.error("[dm_review_submit] invalid convo state ids:", conv);
          return json({});
        }
        const safeReviewRoleFilter = encodeURIComponent(conv.review_role || "manager");

        // Check if already submitted (via web or another Slack flow)
        const alreadyDone = await dbQuery("review_responses", `assignment_id=eq.${safeConvAssignmentId}&reviewer_id=eq.${safeConvUserId}&reviewer_role=eq.${safeReviewRoleFilter}&select=id&limit=1`);
        if (alreadyDone && alreadyDone.length > 0 && !alreadyDone.error) {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: ":white_check_mark: This review has already been submitted. You can view or edit it on the dashboard.",
          });
          await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, { status: "expired" });
          return json({});
        }

        // Mark as completed
        await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
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
            assignment_id: safeConvAssignmentId,
            reviewer_id: safeConvUserId,
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
              assignment_id: safeConvAssignmentId,
              reviewer_id: safeConvUserId,
              reviewer_role: reviewRole,
              comment: `[${textQuestionPrompts[i] || ""}] ${answer}`,
            });
          }
        }

        // Update assignment status
        const avgRating = ratedCount > 0 ? Math.round((totalRating / ratedCount) * 100) / 100 : 0;
        if ((reviewRole === "manager" || reviewRole === "upward") && ratedCount > 0) {
          await dbUpdate("review_assignments", `id=eq.${safeConvAssignmentId}`, {
            status: "completed",
            overall_rating: avgRating,
            updated_at: new Date().toISOString(),
          });
        } else if (reviewRole === "self") {
          await dbUpdate("review_assignments", `id=eq.${safeConvAssignmentId}`, {
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

        const dashUrl = await buildAuthedDashboardUrl(
          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_URL,
          conv.user_id, "/dashboard",
        );
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
                url: dashUrl, action_id: "open_dashboard" },
            ]},
          ],
        });

        // WS4 + WS5: Update notification & check completions
        updateOriginalNotification(safeConvAssignmentId).catch(console.error);
        const aData = await dbQuery("review_assignments", `id=eq.${safeConvAssignmentId}&select=cycle_id`);
        if (aData?.[0]?.cycle_id) {
          const safeAssignCycleId = asUuid(aData[0].cycle_id);
          if (safeAssignCycleId) {
            checkAndNotifyCompletion(safeConvAssignmentId, safeAssignCycleId, wsId).catch(console.error);
          }
        }
      }

      // -- WS2: DM review edit (go back to re-rate) --
      if (action?.action_id === "dm_review_edit") {
        const meta = safeParse(action.value);
        const convId = meta.convId;
        if (!convId) return json({});
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[dm_review_edit] invalid convId rejected:", convId);
          return json({});
        }

        await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
          phase: "competencies",
          current_index: 0,
          updated_at: new Date().toISOString(),
        });

        const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=competency_names,competency_ids,employee_name,cycle_name,assignment_id`);
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
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[dm_review_cancel] invalid convId rejected:", convId);
          return json({});
        }

        await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
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
        const safeParticipantId = asUuid(participantId);
        const safeSurveyId = asUuid(surveyId);
        if (!safeParticipantId || !safeSurveyId) {
          console.error("[open_survey_modal] invalid id rejected:", { participantId, surveyId });
          return json({});
        }

        // Check if already completed
        const existingP = await dbQuery("survey_participants", `id=eq.${safeParticipantId}&select=status`);
        if (existingP?.[0]?.status === "completed") {
          await slackApi(botToken, "chat.postEphemeral", {
            channel: payload.channel?.id || payload.user.id,
            user: payload.user.id,
            text: ":white_check_mark: You've already completed this survey. Thank you!",
          });
          return json({});
        }

        const surveys = await dbQuery("surveys", `id=eq.${safeSurveyId}&select=id,type,name,config,workspace_id`);
        const survey = surveys?.[0];
        if (!survey || survey.workspace_id !== wsId) return json({});

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
          private_metadata: JSON.stringify({ participantId: safeParticipantId, surveyId: safeSurveyId, workspaceId: wsId }),
          blocks: blocks.length > 0 ? blocks : [
            { type: "section", text: { type: "mrkdwn", text: "_This survey has no questions configured._" } }
          ],
        };

        const openSurveyResult = await slackApi(botToken, "views.open", { trigger_id: payload.trigger_id, view });
        if (!openSurveyResult?.ok) {
          // Surveys don't have a direct dashboard deeplink the same way reviews do,
          // so fall back to an ephemeral so the user isn't left with silence.
          console.warn(`[open_survey_modal] views.open failed (${openSurveyResult?.error ?? "unknown"})`);
          await slackApi(botToken, "chat.postEphemeral", {
            channel: payload.channel?.id || payload.user.id,
            user: payload.user.id,
            text: openSurveyResult?.error === "expired_trigger_id"
              ? "The button took a moment too long — please click it again."
              : "Couldn't open the survey here. Please try again.",
          });
        }
        return json({});
      }

      // -- eNPS inline submit --
      if (action?.action_id === "enps_submit") {
        const { participantId, surveyId } = safeParse(action.value) || {};
        if (!participantId) return json({});
        const safeParticipantId = asUuid(participantId);
        const safeSurveyId = asUuid(surveyId);
        if (!safeParticipantId || !safeSurveyId) {
          console.error("[enps_submit] invalid id rejected:", { participantId, surveyId });
          return json({});
        }

        // Check if already completed
        const existingEnps = await dbQuery("survey_participants", `id=eq.${safeParticipantId}&select=status`);
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
            survey_id: safeSurveyId,
            participant_id: safeParticipantId,
            answers: { score, follow_up: followup || "" },
            workspace_id: wsId,
          });
          await dbUpdate("survey_participants", `id=eq.${safeParticipantId}&workspace_id=eq.${wsId}`, {
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
        console.log(`[nami_start_review] received action.value=${action.value} user=${payload.user.id}`);
        const raw = action.value || "";
        // Value format: "self_<assignmentId>" | "mgr_<assignmentId>" | "upward_<assignmentId>"
        const underscoreIdx = raw.indexOf("_");
        const rolePrefix = raw.slice(0, underscoreIdx);
        const assignmentId = raw.slice(underscoreIdx + 1);
        if (!assignmentId) {
          console.warn(`[nami_start_review] empty assignmentId`);
          return json({});
        }
        const safeAssignmentId = asUuid(assignmentId);
        if (!safeAssignmentId) {
          console.error("[nami_start_review] invalid assignmentId rejected:", assignmentId);
          return json({});
        }
        if (!await validateAssignmentWorkspace(safeAssignmentId)) {
          console.warn(`[nami_start_review] validateAssignmentWorkspace failed for ${safeAssignmentId} in ws ${wsId}`);
          // The button is wired to an assignment from a different workspace.
          // Most likely the user is clicking an old DM after a workspace
          // reset or assignment delete. Apologise via the response_url so
          // they don't just see silence.
          if (responseUrlForRecovery) {
            try {
              await fetch(responseUrlForRecovery, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  response_type: "ephemeral",
                  replace_original: false,
                  text: "This review isn't available anymore — the cycle may have been removed or recreated. Please check the dashboard.",
                }),
              });
            } catch (e) { console.error("[nami_start_review] response_url notify failed", e); }
          }
          return json({});
        }

        const slackUserId = payload.user.id;
        const user = await getOrCreateUser(wsId, slackUserId, botToken);
        if (!user) {
          console.warn(`[nami_start_review] getOrCreateUser returned null for slackUser ${slackUserId} ws ${wsId}`);
          if (responseUrlForRecovery) {
            try {
              await fetch(responseUrlForRecovery, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  response_type: "ephemeral",
                  replace_original: false,
                  text: "We couldn't find your Nami account in this workspace. Ask your admin to add you, or sign in on the dashboard.",
                }),
              });
            } catch (e) { console.error("[nami_start_review] response_url notify failed", e); }
          }
          return json({});
        }
        const safeUserId = asUuid(user.id);
        if (!safeUserId) return json({});

        const assignments = await dbQuery("review_assignments", `id=eq.${safeAssignmentId}&select=id,employee_id,manager_id,status,cycle_id,assignment_type,reviewer_id,performance_cycles(name)`);
        const assignment = assignments?.[0];
        if (!assignment) {
          console.warn(`[nami_start_review] assignment ${safeAssignmentId} not found in DB`);
          if (responseUrlForRecovery) {
            try {
              await fetch(responseUrlForRecovery, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  response_type: "ephemeral",
                  replace_original: false,
                  text: "This review no longer exists — it may have been deleted by your admin.",
                }),
              });
            } catch (e) { console.error("[nami_start_review] response_url notify failed", e); }
          }
          return json({});
        }

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
        const safeRoleFilter = encodeURIComponent(reviewRole);
        const existingResp = await dbQuery("review_responses", `assignment_id=eq.${safeAssignmentId}&reviewer_id=eq.${safeUserId}&reviewer_role=eq.${safeRoleFilter}&select=id&limit=1`);
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

        // Slack trigger_id expires in 3 seconds. Heavy DB work in
        // buildReviewForm (cycle_questions, level_competencies, competencies,
        // levels lookups) can blow that budget under load. Open a placeholder
        // modal IMMEDIATELY so the trigger is consumed cleanly, then use
        // views.update to render the real form when we have it. This is
        // Slack's recommended pattern for slow modals.
        const placeholderView = {
          type: "modal" as const,
          callback_id: "review_loading_placeholder",
          title: { type: "plain_text" as const, text: "Loading…" },
          close: { type: "plain_text" as const, text: "Close" },
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: "_Loading your review…_" } },
          ],
        };
        const openResult = await slackApi(botToken, "views.open", {
          trigger_id: payload.trigger_id,
          view: placeholderView,
        });

        if (!openResult?.ok) {
          // The trigger itself was rejected — fall back to a DM with a deeplink.
          console.warn(`[nami_start_review] placeholder views.open failed (${openResult?.error ?? "unknown"}); sending dashboard fallback DM to ${slackUserId} for assignment ${safeAssignmentId}`);
          const reviewUrl = await buildAuthedDashboardUrl(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            DASHBOARD_URL!,
            user.id,
            `/dashboard/reviews/${safeAssignmentId}`,
          );
          const friendly =
            openResult?.error === "expired_trigger_id"
              ? "The button took a moment too long. Open your review on the dashboard instead:"
              : openResult?.error === "trigger_id_already_used"
                ? "Looks like you've already opened this review elsewhere. You can continue on the dashboard:"
                : "Couldn't open the review modal in Slack. Open it on the dashboard:";
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: friendly,
            blocks: [
              {
                type: "section",
                text: { type: "mrkdwn", text: `${friendly}\n<${reviewUrl}|Open your review>` },
              },
            ],
          });
          return json({});
        }

        // Placeholder is open. Build the real form and swap it in.
        const viewId = openResult.view?.id;
        try {
          const view = await buildReviewForm(safeAssignmentId, reviewRole, assignment.employee_id, wsId);
          const updateResult = await slackApi(botToken, "views.update", { view_id: viewId, view });
          if (!updateResult?.ok) {
            // Update failed after placeholder showed — swap to a deeplink view.
            console.warn(`[nami_start_review] views.update failed (${updateResult?.error ?? "unknown"}) for assignment ${safeAssignmentId}`);
            const reviewUrl = await buildAuthedDashboardUrl(
              SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY,
              DASHBOARD_URL!,
              user.id,
              `/dashboard/reviews/${safeAssignmentId}`,
            );
            await slackApi(botToken, "views.update", {
              view_id: viewId,
              view: {
                type: "modal",
                callback_id: "review_load_failed",
                title: { type: "plain_text", text: "Couldn't load" },
                close: { type: "plain_text", text: "Close" },
                blocks: [
                  { type: "section", text: { type: "mrkdwn", text: `We couldn't load this review in Slack right now. <${reviewUrl}|Open it on the dashboard> to continue.` } },
                ],
              },
            });
          }
        } catch (buildErr: any) {
          console.error(`[nami_start_review] buildReviewForm or update threw:`, buildErr?.message ?? buildErr);
          // Best-effort swap to a deeplink view so the modal isn't stuck on "Loading…"
          try {
            const reviewUrl = await buildAuthedDashboardUrl(
              SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY,
              DASHBOARD_URL!,
              user.id,
              `/dashboard/reviews/${safeAssignmentId}`,
            );
            await slackApi(botToken, "views.update", {
              view_id: viewId,
              view: {
                type: "modal",
                callback_id: "review_load_failed",
                title: { type: "plain_text", text: "Couldn't load" },
                close: { type: "plain_text", text: "Close" },
                blocks: [
                  { type: "section", text: { type: "mrkdwn", text: `We couldn't load this review in Slack. <${reviewUrl}|Open it on the dashboard> to continue.` } },
                ],
              },
            });
          } catch {
            // If even the recovery update fails, the user sees the spinner
            // but the outer catch will still log the original error.
          }
        }
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

        const safeAssignmentId = asUuid(assignmentId);
        if (!safeAssignmentId) {
          console.error("[nami_edit_submitted_review] invalid assignmentId rejected:", assignmentId);
          return json({});
        }

        if (!await validateAssignmentWorkspace(safeAssignmentId)) return json({});

        const user = await getOrCreateUser(wsId, payload.user.id, botToken);
        if (!user) return json({});
        const safeUserId = asUuid(user.id);
        if (!safeUserId) return json({});

        // Delete existing responses so the modal submission can re-insert cleanly
        const safeRoleFilter = encodeURIComponent(reviewRole || "manager");
        await dbDelete("review_responses", `assignment_id=eq.${safeAssignmentId}&reviewer_id=eq.${safeUserId}&reviewer_role=eq.${safeRoleFilter}`);

        // Reset assignment status back to pending so the submit handler can update it
        await dbUpdate("review_assignments", `id=eq.${safeAssignmentId}`, {
          status: "pending", overall_rating: null, updated_at: new Date().toISOString(),
        });

        // Same placeholder-then-update pattern as nami_start_review to
        // dodge trigger_id expiry on heavy DB work.
        const placeholderView = {
          type: "modal" as const,
          callback_id: "review_loading_placeholder",
          title: { type: "plain_text" as const, text: "Loading…" },
          close: { type: "plain_text" as const, text: "Close" },
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: "_Loading your review…_" } },
          ],
        };
        const editOpenResult = await slackApi(botToken, "views.open", {
          trigger_id: payload.trigger_id,
          view: placeholderView,
        });
        if (!editOpenResult?.ok) {
          console.warn(`[nami_edit_submitted_review] placeholder views.open failed (${editOpenResult?.error ?? "unknown"}) for assignment ${safeAssignmentId}`);
          const reviewUrl = await buildAuthedDashboardUrl(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            DASHBOARD_URL!,
            user.id,
            `/dashboard/reviews/${safeAssignmentId}`,
          );
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: "Couldn't reopen the review modal — continue on the dashboard:",
            blocks: [
              {
                type: "section",
                text: { type: "mrkdwn", text: `Couldn't reopen the review modal in Slack. <${reviewUrl}|Open your review on the dashboard>` },
              },
            ],
          });
          return json({});
        }

        const viewId = editOpenResult.view?.id;
        try {
          const view = await buildReviewForm(safeAssignmentId, reviewRole || "manager", employeeId, wsId);
          const updateResult = await slackApi(botToken, "views.update", { view_id: viewId, view });
          if (!updateResult?.ok) {
            console.warn(`[nami_edit_submitted_review] views.update failed (${updateResult?.error ?? "unknown"}) for assignment ${safeAssignmentId}`);
            const reviewUrl = await buildAuthedDashboardUrl(
              SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY,
              DASHBOARD_URL!,
              user.id,
              `/dashboard/reviews/${safeAssignmentId}`,
            );
            await slackApi(botToken, "views.update", {
              view_id: viewId,
              view: {
                type: "modal",
                callback_id: "review_load_failed",
                title: { type: "plain_text", text: "Couldn't load" },
                close: { type: "plain_text", text: "Close" },
                blocks: [
                  { type: "section", text: { type: "mrkdwn", text: `We couldn't reload this review in Slack. <${reviewUrl}|Open it on the dashboard> to continue.` } },
                ],
              },
            });
          }
        } catch (buildErr: any) {
          console.error(`[nami_edit_submitted_review] buildReviewForm or update threw:`, buildErr?.message ?? buildErr);
        }
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
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[nami_rate_*] invalid convId rejected:", convId);
          return json({});
        }

        const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=*`);
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

        await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
          ratings,
          updated_at: new Date().toISOString(),
        });

        // Send comment prompt
        const compNames = conv.competency_names || [];
        const currentCompName = compNames[currentIdx] || compName || "this competency";
        const blocks = buildCommentPrompt(currentCompName, safeConvId);
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
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[nami_open_comment_modal] invalid convId rejected:", convId);
          return json({});
        }

        const commentOpenRes = await slackApi(botToken, "views.open", {
          trigger_id: payload.trigger_id,
          view: {
            type: "modal",
            callback_id: "nami_comment_submit",
            private_metadata: JSON.stringify({ convId: safeConvId, compName }),
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
        if (!commentOpenRes?.ok) {
          // No deeplink fallback here — the comment is part of an in-flight
          // Slack conversation. Tell the user they can just type the
          // comment as a regular message instead.
          console.warn(`[nami_open_comment_modal] views.open failed (${commentOpenRes?.error ?? "unknown"})`);
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Couldn't open the comment modal — please type your comment on *${compName}* as a regular message in this conversation.`,
          });
        }
        return json({});
      }

      if (action?.action_id === "nami_skip_comment") {
        const meta = safeParse(action.value);
        const { convId } = meta;
        if (!convId) return json({});
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[nami_skip_comment] invalid convId rejected:", convId);
          return json({});
        }

        const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=*`);
        const conv = convStates?.[0];
        if (!conv) return json({});

        const compIds = conv.competency_ids || [];
        const compNames = conv.competency_names || [];
        const compDescs = conv.competency_descriptions || compIds.map(() => "");
        const convRatingScale = conv.rating_scale || undefined;
        const nextIndex = (conv.current_index || 0) + 1;

        if (nextIndex < compIds.length) {
          // More competencies to rate
          await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
            current_index: nextIndex,
            updated_at: new Date().toISOString(),
          });

          const sdByComp2 = conv.score_descriptors_by_comp || {};
          const compSd2 = sdByComp2[compIds[nextIndex]] || undefined;
          const blocks = buildCompetencyPrompt(compNames[nextIndex], compDescs[nextIndex] || "", nextIndex, compNames.length, safeConvId, conv.assignment_id, convRatingScale, compSd2);
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
            const safeConvAssignmentId = asUuid(conv.assignment_id);
            if (safeConvAssignmentId) {
              const aData = await dbQuery("review_assignments", `id=eq.${safeConvAssignmentId}&select=cycle_id`);
              const cycleId = aData?.[0]?.cycle_id;
              const safeCycleId = asUuid(cycleId);
              if (safeCycleId) {
                const tqs = await dbQuery("cycle_questions", `cycle_id=eq.${safeCycleId}&question_type=eq.text&select=id,prompt&order=sort_order`);
                if (tqs && tqs.length > 0 && !tqs.error) {
                  textQuestionIds = tqs.map((q: any) => q.id);
                  textQuestionPrompts = tqs.map((q: any) => q.prompt || "Additional comments");
                }
              }
            }
          }

          if (textQuestionIds.length > 0) {
            // Transition to text_questions phase
            await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
              phase: "text_questions",
              current_index: 0,
              text_question_ids: textQuestionIds,
              text_question_prompts: textQuestionPrompts,
              updated_at: new Date().toISOString(),
            });

            const blocks = buildTextQuestionPrompt(textQuestionPrompts[0], 0, textQuestionPrompts.length, safeConvId);
            await slackApi(botToken, "chat.postMessage", {
              channel: payload.user.id,
              text: `Question 1/${textQuestionPrompts.length}`,
              blocks,
            });
          } else {
            // No text questions — go to summary
            await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
              phase: "summary",
              updated_at: new Date().toISOString(),
            });

            const ratings = conv.ratings || {};
            const ratingValues = compIds.map((id: string) => ratings[id]?.rating || 0);
            const textResponses = conv.text_responses || {};
            const tqPrompts = conv.text_question_prompts || [];
            const tqIds = conv.text_question_ids || [];
            const tqResponses = tqIds.map((id: string) => textResponses[id] || "");

            const blocks = buildReviewSummary(conv.employee_name, compNames, ratingValues, tqPrompts, tqResponses, safeConvId, convRatingScale);
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
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[nami_submit_review] invalid convId rejected:", convId);
          return json({});
        }

        const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=*`);
        const conv = convStates?.[0];
        if (!conv) return json({});
        const safeConvAssignmentId = asUuid(conv.assignment_id);
        const safeConvUserId = asUuid(conv.user_id);
        if (!safeConvAssignmentId || !safeConvUserId) {
          console.error("[nami_submit_review] invalid convo state ids:", conv);
          return json({});
        }
        const safeReviewRoleFilter = encodeURIComponent(conv.review_role || "manager");

        // Check if already submitted (e.g. via web while Slack flow was in progress)
        const alreadyDone = await dbQuery("review_responses", `assignment_id=eq.${safeConvAssignmentId}&reviewer_id=eq.${safeConvUserId}&reviewer_role=eq.${safeReviewRoleFilter}&select=id&limit=1`);
        if (alreadyDone && alreadyDone.length > 0 && !alreadyDone.error) {
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: "⚠️ This review was already submitted (possibly via the dashboard). Your Slack responses were not saved to avoid duplicates.",
          });
          await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, { status: "expired" });
          return json({});
        }

        // Mark as completed
        await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
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
            assignment_id: safeConvAssignmentId,
            reviewer_id: safeConvUserId,
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
              assignment_id: safeConvAssignmentId,
              reviewer_id: safeConvUserId,
              reviewer_role: reviewRole,
              comment: `[${textQuestionPrompts[i] || ""}] ${answer}`,
            });
          }
        }

        // Update assignment status
        const avgRating = ratedCount > 0 ? Math.round((totalRating / ratedCount) * 100) / 100 : 0;
        if ((reviewRole === "manager" || reviewRole === "upward") && ratedCount > 0) {
          await dbUpdate("review_assignments", `id=eq.${safeConvAssignmentId}`, {
            status: "completed",
            overall_rating: avgRating,
            updated_at: new Date().toISOString(),
          });
        } else if (reviewRole === "self") {
          await dbUpdate("review_assignments", `id=eq.${safeConvAssignmentId}`, {
            status: "in_progress",
            updated_at: new Date().toISOString(),
          });

          // Notify the manager that this employee's self-review is done
          (async () => {
            try {
              const assignments = await dbQuery("review_assignments", `id=eq.${safeConvAssignmentId}&select=manager_id,cycle_id,cycle:performance_cycles!review_assignments_cycle_id_fkey(name)`);
              const a = assignments?.[0];
              if (a?.manager_id) {
                const safeManagerId = asUuid(a.manager_id);
                if (!safeManagerId) {
                  console.error("[nami_submit_review] invalid manager_id from DB:", a.manager_id);
                  return;
                }
                const managers = await dbQuery("users", `id=eq.${safeManagerId}&select=slack_user_id,slack_name`);
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

        const dashUrl2 = await buildAuthedDashboardUrl(
          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_URL,
          conv.user_id, "/dashboard",
        );
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
                url: dashUrl2, action_id: "open_dashboard" },
            ]},
          ],
        });

        // WS4 + WS5: Update notification & check completions
        updateOriginalNotification(safeConvAssignmentId).catch(console.error);
        const aData = await dbQuery("review_assignments", `id=eq.${safeConvAssignmentId}&select=cycle_id`);
        if (aData?.[0]?.cycle_id) {
          const safeAssignCycleId = asUuid(aData[0].cycle_id);
          if (safeAssignCycleId) {
            checkAndNotifyCompletion(safeConvAssignmentId, safeAssignCycleId, wsId).catch(console.error);
          }
        }
        return json({});
      }

      // ================================================================
      //  NAMI: Edit review (go back to first competency)
      // ================================================================
      if (action?.action_id === "nami_edit_review") {
        const convId = action.value;
        if (!convId) return json({});
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[nami_edit_review] invalid convId rejected:", convId);
          return json({});
        }

        const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=*`);
        const conv = convStates?.[0];
        if (!conv) return json({});

        await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
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
          const blocks = buildCompetencyPrompt(compNames[0], compDescsEdit[0] || "", 0, compNames.length, safeConvId, conv.assignment_id, editRatingScale, editSdByComp[compIds[0]] || undefined);
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
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[nami_cancel_review] invalid convId rejected:", convId);
          return json({});
        }

        await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
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
        const safeParticipantId = asUuid(participantId);
        const safeSurveyId = asUuid(surveyId);
        if (!safeParticipantId || !safeSurveyId) {
          console.error("[nami_start_survey] invalid id rejected:", { participantId, surveyId });
          return json({});
        }

        const slackUserId = payload.user.id;
        const safeSlackUserId = asSlackUserId(slackUserId);
        if (!safeSlackUserId) {
          console.warn("[nami_start_survey] invalid Slack user id:", slackUserId);
          return json({});
        }

        // Check if already completed
        const existingP = await dbQuery("survey_participants", `id=eq.${safeParticipantId}&select=status`);
        if (existingP?.[0]?.status === "completed") {
          await slackApi(botToken, "chat.postMessage", {
            channel: slackUserId,
            text: ":white_check_mark: You've already completed this survey. Thank you!",
          });
          return json({});
        }

        const user = await getOrCreateUser(wsId, safeSlackUserId, botToken);
        if (!user) return json({});
        const safeUserId = asUuid(user.id);
        if (!safeUserId) return json({});

        const surveys = await dbQuery("surveys", `id=eq.${safeSurveyId}&select=id,name,config,workspace_id`);
        const survey = surveys?.[0];
        if (!survey || survey.workspace_id !== wsId) return json({});

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
        await dbUpdate("conversation_states", `slack_user_id=eq.${safeSlackUserId}&status=eq.active&flow_type=eq.survey`, { status: "expired" });

        const convState = await dbInsert("conversation_states", {
          workspace_id: wsId,
          user_id: safeUserId,
          slack_user_id: safeSlackUserId,
          status: "active",
          flow_type: "survey",
          phase: "survey_questions",
          survey_id: safeSurveyId,
          survey_participant_id: safeParticipantId,
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
          0, questions.length, convState[0].id, safeSurveyId,
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
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[nami_survey_rate_*] invalid convId rejected:", convId);
          return json({});
        }

        const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=*`);
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
          await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
            survey_answers: answers,
            current_index: nextIndex,
            updated_at: new Date().toISOString(),
          });

          const nextQ = questions[nextIndex];
          const blocks = buildSurveyQuestionPrompt(
            { prompt: nextQ.label || nextQ.prompt, type: nextQ.type, options: nextQ.options },
            nextIndex, questions.length, safeConvId, surveyId,
          );
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Question ${nextIndex + 1}/${questions.length}`,
            blocks,
          });
        } else {
          // Survey complete — save responses
          await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
            survey_answers: answers,
            status: "completed",
            phase: "completed",
            updated_at: new Date().toISOString(),
          });

          const participantId = conv.survey_participant_id;
          const safeParticipantId = asUuid(participantId);
          if (!safeParticipantId) {
            console.error("[nami_survey_rate_*] invalid participantId from DB:", participantId);
            return json({});
          }
          const participants = await dbQuery("survey_participants", `id=eq.${safeParticipantId}&select=subject_user_id`);
          const participant = participants?.[0];

          await dbInsert("survey_responses", {
            survey_id: conv.survey_id,
            participant_id: safeParticipantId,
            subject_user_id: participant?.subject_user_id || null,
            answers,
            workspace_id: wsId,
          });
          await dbUpdate("survey_participants", `id=eq.${safeParticipantId}&workspace_id=eq.${wsId}`, {
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
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[nami_survey_select_*] invalid convId rejected:", convId);
          return json({});
        }

        const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=*`);
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
          await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
            survey_answers: answers,
            current_index: nextIndex,
            updated_at: new Date().toISOString(),
          });

          const nextQ = questions[nextIndex];
          const blocks = buildSurveyQuestionPrompt(
            { prompt: nextQ.label || nextQ.prompt, type: nextQ.type, options: nextQ.options },
            nextIndex, questions.length, safeConvId, surveyId,
          );
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Question ${nextIndex + 1}/${questions.length}`,
            blocks,
          });
        } else {
          // Survey complete — save responses
          await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
            survey_answers: answers,
            status: "completed",
            phase: "completed",
            updated_at: new Date().toISOString(),
          });

          const participantId = conv.survey_participant_id;
          const safeParticipantId = asUuid(participantId);
          if (!safeParticipantId) {
            console.error("[nami_survey_select_*] invalid participantId from DB:", participantId);
            return json({});
          }
          const participants = await dbQuery("survey_participants", `id=eq.${safeParticipantId}&select=subject_user_id`);
          const participant = participants?.[0];

          await dbInsert("survey_responses", {
            survey_id: conv.survey_id,
            participant_id: safeParticipantId,
            subject_user_id: participant?.subject_user_id || null,
            answers,
            workspace_id: wsId,
          });
          await dbUpdate("survey_participants", `id=eq.${safeParticipantId}&workspace_id=eq.${wsId}`, {
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
        const safeConvId = asUuid(convId);
        if (!safeConvId) {
          console.error("[nami_survey_skip] invalid convId rejected:", convId);
          return json({});
        }

        const convStates = await dbQuery("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}&select=*`);
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
          await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
            current_index: nextIndex,
            updated_at: new Date().toISOString(),
          });

          const nextQ = questions[nextIndex];
          const blocks = buildSurveyQuestionPrompt(
            { prompt: nextQ.label || nextQ.prompt, type: nextQ.type, options: nextQ.options },
            nextIndex, questions.length, safeConvId, surveyId,
          );
          await slackApi(botToken, "chat.postMessage", {
            channel: payload.user.id,
            text: `Question ${nextIndex + 1}/${questions.length}`,
            blocks,
          });
        } else {
          // Survey complete — save responses (with skipped questions omitted)
          const answers = conv.survey_answers || {};
          await dbUpdate("conversation_states", `id=eq.${safeConvId}&workspace_id=eq.${wsId}`, {
            status: "completed",
            phase: "completed",
            updated_at: new Date().toISOString(),
          });

          const participantId = conv.survey_participant_id;
          const safeParticipantId = asUuid(participantId);
          if (!safeParticipantId) {
            console.error("[nami_survey_skip] invalid participantId from DB:", participantId);
            return json({});
          }
          const participants = await dbQuery("survey_participants", `id=eq.${safeParticipantId}&select=subject_user_id`);
          const participant = participants?.[0];

          await dbInsert("survey_responses", {
            survey_id: conv.survey_id,
            participant_id: safeParticipantId,
            subject_user_id: participant?.subject_user_id || null,
            answers,
            workspace_id: wsId,
          });
          await dbUpdate("survey_participants", `id=eq.${safeParticipantId}&workspace_id=eq.${wsId}`, {
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

      // ───────────────────────────────────────────────────────────────────
      // Notification-prefs handlers (Sprint 3): snooze, wake, mode-switch.
      // The RPC set_notification_prefs uses auth_user_id() and won't work
      // from the service-role context this edge function runs in, so we
      // do a direct read-modify-write on users.notification_prefs.
      // ───────────────────────────────────────────────────────────────────
      async function updatePrefs(
        appUserId: string,
        patch: Record<string, unknown>,
      ): Promise<void> {
        const safeId = asUuid(appUserId);
        if (!safeId) return;
        const rows = await dbQuery(
          "users",
          `id=eq.${safeId}&select=notification_prefs`,
        );
        const current = (rows?.[0]?.notification_prefs as Record<string, unknown>) ?? {
          mode: "realtime",
          digest_hour: 9,
          digest_timezone: "UTC",
          snoozed_until: null,
        };
        const next = { ...current, ...patch };
        await dbUpdate("users", `id=eq.${safeId}`, { notification_prefs: next });
      }

      if (action?.action_id?.startsWith("snooze_")) {
        const slackUserId = asSlackUserId(payload.user?.id);
        if (!slackUserId) return json({});
        const appUser = await getOrCreateUser(wsId, slackUserId, botToken);
        if (!appUser?.id) return json({});

        const hours =
          action.action_id === "snooze_4h"
            ? 4
            : action.action_id === "snooze_24h"
              ? 24
              : null; // snooze_until_done

        // "until done" = far-future timestamp (1 year). User can wake via
        // App Home or by clicking the dashboard "wake me up" control.
        const snoozedUntil = hours
          ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        await updatePrefs(appUser.id, { snoozed_until: snoozedUntil });

        const message = hours
          ? `Snoozed for ${hours}h. We'll only ping you for critical updates until then.`
          : "Paused. Open Nami's home tab whenever you want to resume.";
        return json({
          response_type: "ephemeral",
          replace_original: false,
          text: message,
        });
      }

      if (action?.action_id === "clear_snooze") {
        const slackUserId = asSlackUserId(payload.user?.id);
        if (!slackUserId) return json({});
        const appUser = await getOrCreateUser(wsId, slackUserId, botToken);
        if (!appUser?.id) return json({});
        await updatePrefs(appUser.id, { snoozed_until: null });
        return json({
          response_type: "ephemeral",
          replace_original: false,
          text: "Welcome back — reminders re-enabled.",
        });
      }

      if (action?.action_id === "set_notification_mode_realtime") {
        // One-click "switch back to realtime" — used as a danger button on
        // the daily digest DM. No selected_option, just a hardcoded mode.
        const slackUserId = asSlackUserId(payload.user?.id);
        if (!slackUserId) return json({});
        const appUser = await getOrCreateUser(wsId, slackUserId, botToken);
        if (!appUser?.id) return json({});
        await updatePrefs(appUser.id, { mode: "realtime" });
        return json({
          response_type: "ephemeral",
          replace_original: false,
          text: "Switched to realtime — you'll get pings as things happen.",
        });
      }

      if (action?.action_id === "set_notification_mode") {
        const slackUserId = asSlackUserId(payload.user?.id);
        if (!slackUserId) return json({});
        const appUser = await getOrCreateUser(wsId, slackUserId, botToken);
        if (!appUser?.id) return json({});
        const mode = action.selected_option?.value;
        if (mode !== "realtime" && mode !== "digest" && mode !== "critical_only") {
          return json({});
        }
        await updatePrefs(appUser.id, { mode });
        return json({
          response_type: "ephemeral",
          replace_original: false,
          text:
            mode === "realtime"
              ? "Switched to realtime — you'll get pings as things happen."
              : mode === "digest"
                ? "Switched to daily digest — one DM per day, snoozable."
                : "Switched to critical only — you'll only hear from us for cycle launches, grade releases, and final escalations.",
        });
      }
    }

    return json({});
  } catch (err: any) {
    // Surface the full stack so production logs show WHERE the error
    // happened — bare "unhandled error: <message>" without a stack made it
    // impossible to debug silent failures.
    const stack = err?.stack ?? "(no stack)";
    const message = err?.message ?? String(err);
    console.error(`[interactivity] unhandled error: ${message}\n${stack}`);

    // Best-effort: tell the user something went wrong rather than silently
    // returning an empty 200. response_url is captured before any throw so
    // we can still apologise even when the failure was at a DB query during
    // workspace resolution.
    if (responseUrlForRecovery) {
      try {
        await fetch(responseUrlForRecovery, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: false,
            text: "Something went wrong on Nami's side opening this. We've logged it — please try again, or open the dashboard from namihr.com.",
          }),
        });
      } catch (postErr) {
        console.error("[interactivity] response_url fallback also failed:", postErr);
      }
    }
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