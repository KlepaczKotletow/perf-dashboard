// =============================================================================
//  Admin alerting — fire-and-forget DM to a single admin Slack user when an
//  outer catch fires in any Slack-facing function.
//
//  Why this exists: the May 2026 Slack outage went undetected for an unknown
//  number of hours because every webhook handler returned 200 OK after its
//  outer catch swallowed `crypto.subtle.timingSafeEqual` is not a function`.
//  No alerting, no paging, no Slack DM — production was silently dead until
//  the user manually clicked a button and reported "didn't work".
//
//  alertAdmin() guarantees:
//    1. NEVER throws. A failing alert can't break the caller's response path.
//    2. NEVER blocks. The DM is fire-and-forget — callers should NOT await it
//       on the critical path of a Slack-deadline-bound handler.
//    3. Deduped. A 5-minute in-memory cooldown per (fnName + error-shape) so
//       a tight error loop doesn't spam the admin with thousands of DMs.
//
//  Config (Supabase secrets):
//    ADMIN_ALERT_SLACK_USER_ID  — Slack user ID (e.g. "U07RJJAUNF3") to DM
//    ADMIN_ALERT_WORKSPACE_ID   — workspaces.id whose bot token to use
//
//  If either secret is missing, alertAdmin logs and returns — never throws.
// =============================================================================

import { callSlackApi } from "./slack-api.ts";
import { getWorkspaceSlackTokens } from "./workspace-tokens.ts";

const ALERT_USER_ID = Deno.env.get("ADMIN_ALERT_SLACK_USER_ID") || "";
const ALERT_WORKSPACE_ID = Deno.env.get("ADMIN_ALERT_WORKSPACE_ID") || "";

// In-memory dedupe. Edge function instances are short-lived so this is a
// soft floor, not a hard guarantee — but it's enough to stop a tight error
// loop within a single instance from generating thousands of DMs in seconds.
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const lastAlertedAt = new Map<string, number>();

export interface AlertContext {
  /** The function emitting the alert (e.g. "slack-interactivity"). */
  fnName: string;
  /** Free-form details — request method, action_id, user_id, etc. Stringified. */
  details?: Record<string, unknown>;
}

/**
 * Fire-and-forget admin DM. Use this from outer catches so we hear about
 * silent failures the moment they happen.
 *
 * Returns a Promise so callers can optionally `await` it during tests, but
 * production callers should call without await — the alert must not block
 * the response that Slack is waiting on.
 */
export async function alertAdmin(err: unknown, context: AlertContext): Promise<void> {
  try {
    if (!ALERT_USER_ID || !ALERT_WORKSPACE_ID) {
      // Misconfigured — log and bail. We can't DM if we don't know where.
      console.warn(
        `[alerting] skipping admin DM — ADMIN_ALERT_SLACK_USER_ID and/or ADMIN_ALERT_WORKSPACE_ID not set`,
      );
      return;
    }

    const errMessage = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.name : "Error";
    const dedupeKey = `${context.fnName}:${errName}:${errMessage.slice(0, 120)}`;

    const now = Date.now();
    const last = lastAlertedAt.get(dedupeKey);
    if (last && now - last < COOLDOWN_MS) {
      // Already alerted within the cooldown window — skip.
      return;
    }
    lastAlertedAt.set(dedupeKey, now);

    const tokens = await getWorkspaceSlackTokens(ALERT_WORKSPACE_ID);
    if (!tokens?.botToken) {
      console.warn(
        `[alerting] no bot token for workspace ${ALERT_WORKSPACE_ID}; cannot DM admin`,
      );
      return;
    }

    const stack = err instanceof Error && err.stack
      ? "\n```\n" + err.stack.slice(0, 1500) + "\n```"
      : "";
    const detailsBlock = context.details
      ? "\n*Context:*\n```\n" + safeStringify(context.details) + "\n```"
      : "";

    const text = [
      `:rotating_light: *${context.fnName}* threw an unhandled error`,
      "",
      `*Error:* \`${errName}: ${errMessage}\``,
      detailsBlock,
      stack,
      "",
      `_Sent at ${new Date(now).toISOString()}_`,
    ].join("\n");

    await callSlackApi(tokens.botToken, "chat.postMessage", {
      channel: ALERT_USER_ID, // DMing a user ID auto-opens the IM channel
      text,
      unfurl_links: false,
      unfurl_media: false,
    });
  } catch (alertErr) {
    // CRITICAL: never let alerting throw. If we can't reach Slack, the
    // caller's response path must still complete.
    console.error("[alerting] alertAdmin itself failed:", alertErr);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2).slice(0, 1500);
  } catch {
    return String(value).slice(0, 1500);
  }
}
