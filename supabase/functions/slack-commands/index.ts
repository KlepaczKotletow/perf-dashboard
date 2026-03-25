/**
 * Edge function: slack-commands
 *
 * Handles Slack slash-command payloads (application/x-www-form-urlencoded).
 * Currently supports:
 *   /kudos  – opens the dynamic feedback modal built via the Form Builder
 */

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
  return `v0=${hex}` === slackSig;
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

async function slackApi(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Modal builder ────────────────────────────────────────────────────────────

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  multiline?: boolean;
  options?: string[];
}

function buildFeedbackModalBlocks(fields: FormField[]) {
  const blocks: unknown[] = [];

  for (const field of fields) {
    if (field.type === "user_select") {
      blocks.push({
        type: "input",
        block_id: field.id,
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
        block_id: field.id,
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
        block_id: field.id,
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
        block_id: field.id,
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
        block_id: field.id,
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
      blocks.push({
        type: "input",
        block_id: field.id,
        optional: true,
        element: {
          type: "checkboxes",
          action_id: field.id,
          options: field.options.map((o) => ({
            text: { type: "plain_text", text: o },
            value: o.toLowerCase().replace(/\s+/g, "_"),
          })),
        },
        label: { type: "plain_text", text: field.label },
      });
    }
  }

  return blocks;
}

// Default fields if no config exists in DB
const DEFAULT_FIELDS: FormField[] = [
  { id: "recipient", type: "user_select", label: "Who is this feedback for?", required: true },
  {
    id: "feedback_type",
    type: "single_select",
    label: "Feedback Type",
    required: true,
    options: ["Praise", "Constructive", "General"],
  },
  { id: "message", type: "text", label: "Your Feedback", required: true, multiline: true },
  { id: "anonymous", type: "checkbox", label: "Privacy", required: false, options: ["Send anonymously"] },
];

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const body = await req.text();

  // Verify Slack signature
  const valid = await verifySlackSignature(req, body);
  if (!valid) return new Response("Invalid signature", { status: 403 });

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
    // Look up workspace
    const wsRows = await dbQuery("workspaces", `team_id=eq.${teamId}&select=id,bot_token&limit=1`);
    const ws = wsRows?.[0];
    if (!ws?.bot_token) {
      return new Response(
        JSON.stringify({ response_type: "ephemeral", text: "Workspace not connected. Please reinstall the app." }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Load form config (or use defaults)
    const configRows = await dbQuery(
      "feedback_form_configs",
      `workspace_id=eq.${ws.id}&select=fields&limit=1`,
    );
    const fields: FormField[] = configRows?.[0]?.fields || DEFAULT_FIELDS;
    const blocks = buildFeedbackModalBlocks(fields);

    const view = {
      type: "modal" as const,
      callback_id: "feedback_modal",
      title: { type: "plain_text" as const, text: "Give Kudos" },
      submit: { type: "plain_text" as const, text: "Send" },
      close: { type: "plain_text" as const, text: "Cancel" },
      private_metadata: JSON.stringify({ usedConfig: true }),
      blocks,
    };

    const result = await slackApi(ws.bot_token, "views.open", {
      trigger_id: triggerId,
      view,
    });

    if (!result.ok) {
      console.error("views.open failed:", result.error);
      return new Response(
        JSON.stringify({ response_type: "ephemeral", text: "Failed to open form. Please try again." }),
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
