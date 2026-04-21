/**
 * Edge function: slack-commands
 *
 * Handles Slack slash-command payloads (application/x-www-form-urlencoded).
 * Currently supports:
 *   /kudos  – opens the dynamic feedback modal built via the Form Builder
 */

import { callSlackApi } from "../_shared/slack-api.ts";
import { getWorkspaceSlackTokens, setWorkspaceSlackTokens } from "../_shared/workspace-tokens.ts";
import { asSlackTeamId, asUuid } from "../_shared/postgrest-safe.ts";

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") || "";
const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET") || "";
const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function verifySlackSignature(req: Request, body: string): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET) return false;
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";
  const slackSig = req.headers.get("x-slack-signature") || "";
  const parsedTs = parseInt(timestamp);
  if (isNaN(parsedTs) || Math.abs(Date.now() / 1000 - parsedTs) > 300) return false;
  const baseString = `v0:${timestamp}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SLACK_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Timing-safe comparison to prevent timing attacks
  const computed = encoder.encode(`v0=${hex}`);
  const received = encoder.encode(slackSig);
  if (computed.byteLength !== received.byteLength) return false;
  return crypto.subtle.timingSafeEqual(computed, received);
}

async function dbQuery(table: string, query: string) {
  return (
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
  ).json();
}

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
    console.error("Token refresh failed:", data.error);
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

async function slackApi(token: string, method: string, body: Record<string, unknown>) {
  return callSlackApi(token, method, body);
}

// ── Modal builder ────────────────────────────────────────────────────────────

interface FormField {
  id: string;
  blockId?: string; // If set, used as block_id (action_id stays as id)
  type: string;
  label: string;
  required: boolean;
  multiline?: boolean;
  options?: string[];
  initialOptions?: string[]; // Pre-selected checkbox options
}

function buildFeedbackModalBlocks(fields: FormField[]) {
  const blocks: unknown[] = [];

  for (const field of fields) {
    if (field.type === "user_select") {
      blocks.push({
        type: "input",
        block_id: field.blockId || field.id,
        optional: !field.required,
        element: {
          type: "users_select",
          action_id: field.id,
          placeholder: { type: "plain_text", text: field.label },
        },
        label: { type: "plain_text", text: field.label },
      });
    } else if (field.type === "text") {
      blocks.push({
        type: "input",
        block_id: field.blockId || field.id,
        optional: !field.required,
        element: {
          type: field.multiline ? "plain_text_input" : "plain_text_input",
          action_id: field.id,
          multiline: !!field.multiline,
          placeholder: { type: "plain_text", text: `Enter ${field.label.toLowerCase()}…` },
        },
        label: { type: "plain_text", text: field.label },
      });
    } else if (field.type === "single_select" && field.options?.length) {
      blocks.push({
        type: "input",
        block_id: field.blockId || field.id,
        optional: !field.required,
        element: {
          type: "static_select",
          action_id: field.id,
          placeholder: { type: "plain_text", text: `Select ${field.label.toLowerCase()}` },
          options: field.options.map((o) => ({
            text: { type: "plain_text", text: o },
            value: o.toLowerCase().replace(/\s+/g, "_"),
          })),
        },
        label: { type: "plain_text", text: field.label },
      });
    } else if (field.type === "multi_select" && field.options?.length) {
      blocks.push({
        type: "input",
        block_id: field.blockId || field.id,
        optional: !field.required,
        element: {
          type: "multi_static_select",
          action_id: field.id,
          placeholder: { type: "plain_text", text: `Select ${field.label.toLowerCase()}` },
          options: field.options.map((o) => ({
            text: { type: "plain_text", text: o },
            value: o.toLowerCase().replace(/\s+/g, "_"),
          })),
        },
        label: { type: "plain_text", text: field.label },
      });
    } else if (field.type === "rating") {
      // Rating as a 1-5 static select
      blocks.push({
        type: "input",
        block_id: field.blockId || field.id,
        optional: !field.required,
        element: {
          type: "static_select",
          action_id: field.id,
          placeholder: { type: "plain_text", text: "Rate 1-5" },
          options: [1, 2, 3, 4, 5].map((n) => ({
            text: { type: "plain_text", text: `${"★".repeat(n)}${"☆".repeat(5 - n)} (${n})` },
            value: String(n),
          })),
        },
        label: { type: "plain_text", text: field.label },
      });
    } else if (field.type === "checkbox" && field.options?.length) {
      const allOpts = field.options.map((o) => ({
        text: { type: "plain_text" as const, text: o },
        value: o.toLowerCase().replace(/\s+/g, "_"),
      }));
      const element: any = {
        type: "checkboxes",
        action_id: field.id,
        options: allOpts,
      };
      // Pre-select specific options (e.g. "Share with recipient")
      if (field.initialOptions?.length) {
        element.initial_options = allOpts.filter((o) =>
          field.initialOptions!.some((init) => init.toLowerCase().replace(/\s+/g, "_") === o.value)
        );
      }
      blocks.push({
        type: "input",
        block_id: field.blockId || field.id,
        optional: true,
        element,
        label: { type: "plain_text", text: field.label },
      });
    }
  }

  return blocks;
}

// Default fields if no config exists in DB
// IDs must match the hardcoded fallback in slack-interactivity's feedback_modal handler.
// block_id = "<name>_block", action_id = "<name>"
const DEFAULT_FIELDS: FormField[] = [
  { id: "recipient", blockId: "recipient_block", type: "user_select", label: "Who is this feedback for?", required: true },
  { id: "feedback_type", blockId: "feedback_type_block", type: "single_select", label: "Feedback Type", required: true, options: ["Praise", "Constructive", "General"] },
  { id: "message", blockId: "message_block", type: "text", label: "Your Feedback", required: true, multiline: true },
  { id: "anonymous", blockId: "anonymous_block", type: "checkbox", label: "Privacy", required: false, options: ["Send anonymously", "Share with recipient"], initialOptions: ["Share with recipient"] },
];

// ── Main handler ─────────────────────────────────────────────────────────────

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
      `[slack-commands] retry #${retryNum} (reason=${
        req.headers.get("x-slack-retry-reason") ?? "?"
      }), short-circuiting to 200`,
    );
    return new Response("OK", { status: 200 });
  }

  const params = new URLSearchParams(body);
  const command = params.get("command") || "";
  const triggerId = params.get("trigger_id") || "";
  const teamId = params.get("team_id") || "";

  if (!triggerId) {
    return new Response(JSON.stringify({ text: "Missing trigger_id" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── /kudos ───────────────────────────────────────────────────────────────
  if (command === "/kudos") {
    // Validate Slack-supplied team_id before interpolating into PostgREST URL
    const safeTeamId = asSlackTeamId(teamId);
    if (!safeTeamId) {
      console.warn(`[slack-commands] invalid team_id rejected:`, teamId);
      return new Response(
        JSON.stringify({ response_type: "ephemeral", text: "Workspace not connected. Please reinstall the app." }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    // Look up workspace
    const wsRows = await dbQuery("workspaces", `team_id=eq.${safeTeamId}&select=id&limit=1`);
    const ws = wsRows?.[0];
    if (!ws?.id) {
      return new Response(
        JSON.stringify({ response_type: "ephemeral", text: "Workspace not connected. Please reinstall the app." }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Defense in depth: ws.id is server-generated UUID, but validate before URL interpolation
    const safeWsId = asUuid(ws.id);
    if (!safeWsId) {
      console.error(`[slack-commands] invalid workspace UUID from DB:`, ws.id);
      return new Response(
        JSON.stringify({ response_type: "ephemeral", text: "Workspace not connected. Please reinstall the app." }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Load form config (or use defaults)
    const configRows = await dbQuery(
      "feedback_form_configs",
      `workspace_id=eq.${safeWsId}&select=fields&limit=1`,
    );
    const hasConfig = configRows?.[0]?.fields?.length > 0;
    const fields: FormField[] = hasConfig ? configRows[0].fields : DEFAULT_FIELDS;
    const blocks = buildFeedbackModalBlocks(fields);

    const view = {
      type: "modal" as const,
      callback_id: "feedback_modal",
      title: { type: "plain_text" as const, text: "Give Kudos" },
      submit: { type: "plain_text" as const, text: "Send" },
      close: { type: "plain_text" as const, text: "Cancel" },
      private_metadata: JSON.stringify({ usedConfig: hasConfig }),
      blocks,
    };

    const botToken = await getFreshBotToken(ws.id);
    if (!botToken) {
      return new Response(
        JSON.stringify({ response_type: "ephemeral", text: "Workspace not connected. Please reinstall the app." }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await slackApi(botToken, "views.open", {
      trigger_id: triggerId,
      view,
    });

    if (!result.ok) {
      console.error("views.open failed:", result.error);
      // Disambiguate the common failure modes so users know whether to retry,
      // reinstall, or contact their admin. Matches what Lattice / Leapsome
      // surface when a workspace install is misconfigured.
      const err = String(result.error ?? "");
      let msg: string;
      if (err.includes("invalid_auth") || err.includes("token")) {
        msg = ":warning: Nami's connection to Slack looks expired. Ask your workspace admin to reinstall Nami, then try again.";
      } else if (err.includes("missing_scope") || err === "not_allowed_token_type") {
        msg = ":warning: Nami is missing a Slack permission it needs. Ask your workspace admin to reinstall Nami to grant the required scopes.";
      } else if (err.includes("trigger")) {
        msg = ":warning: Slack trigger expired before the form could open. Try the command again — this usually happens after a 3-second pause.";
      } else if (err.includes("ratelimited")) {
        msg = ":hourglass: Slack is rate-limiting Nami right now. Try again in about a minute.";
      } else {
        msg = `:warning: Couldn't open the form (Slack error: ${err || "unknown"}). If this keeps happening, let your admin know.`;
      }
      return new Response(
        JSON.stringify({ response_type: "ephemeral", text: msg }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Return empty 200 — modal is open
    return new Response("", { status: 200 });
  }

  // Unknown command
  return new Response(
    JSON.stringify({ response_type: "ephemeral", text: `Unknown command: ${command}` }),
    { headers: { "Content-Type": "application/json" } },
  );
});
