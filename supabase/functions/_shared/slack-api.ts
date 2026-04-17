// =============================================================================
//  Shared Slack API helper with rate limit handling
//
//  Two-tier retry strategy:
//  1. In-process: one quick retry for transient bursts (Retry-After <= 10s).
//  2. Persistent: throw SlackRateLimitError so the queue worker can requeue
//     with next_attempt_at = now() + retryAfter, WITHOUT burning an attempt.
//
//  The old behaviour capped delay at 120s and burned all 3 attempt slots on a
//  single rate-limit incident, which stranded jobs in last_error state for
//  hours. Now long Retry-After values bubble up to the queue layer where
//  they belong.
// =============================================================================

const QUICK_RETRY_THRESHOLD_SECONDS = 10;

/**
 * Call a Slack Web API method.
 *
 * On 429: if Retry-After <= 10s, sleep and retry once in-process.
 * Otherwise throw SlackRateLimitError — the queue worker can catch it and
 * requeue the job for the requested delay without consuming an attempt.
 */
export async function callSlackApi(
  token: string,
  method: string,
  body: Record<string, unknown>,
  _alreadyRetried: boolean = false,
): Promise<any> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Handle rate limiting (429 Too Many Requests at HTTP layer)
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
    if (!_alreadyRetried && retryAfter <= QUICK_RETRY_THRESHOLD_SECONDS) {
      console.warn(`[slack-api] Rate limited on ${method}, quick-retrying after ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      return callSlackApi(token, method, body, true);
    }
    throw new SlackRateLimitError(retryAfter);
  }

  const data = await res.json();

  // Slack can also return ok:false with a ratelimited error in the body
  if (!data.ok && data.error === "ratelimited") {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
    if (!_alreadyRetried && retryAfter <= QUICK_RETRY_THRESHOLD_SECONDS) {
      console.warn(`[slack-api] Rate limited (body) on ${method}, quick-retrying after ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      return callSlackApi(token, method, body, true);
    }
    throw new SlackRateLimitError(retryAfter);
  }

  return data;
}

/**
 * Send a Slack message with rate-limit handling.
 * Convenience wrapper around callSlackApi for chat.postMessage.
 */
export async function sendSlackMessage(
  token: string,
  channel: string,
  text: string,
  blocks?: unknown[],
): Promise<any> {
  const payload: Record<string, unknown> = { channel, text };
  if (blocks) payload.blocks = blocks;
  return callSlackApi(token, "chat.postMessage", payload);
}

/**
 * Send multiple messages with a delay between each to avoid hitting rate limits.
 * Uses a 1-second gap between messages (Slack Tier 1 rate limit is ~1 msg/sec).
 */
export async function sendSlackMessagesBulk(
  token: string,
  messages: Array<{ channel: string; text: string; blocks?: unknown[] }>,
): Promise<void> {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    await sendSlackMessage(token, msg.channel, msg.text, msg.blocks);
    // Throttle: 1 second between messages to stay within Slack's Tier 1 rate limit
    if (i < messages.length - 1) {
      await sleep(1000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
//  Slack rate-limit sentinel — thrown when Slack returns 429 and the caller
//  should requeue the job instead of burning in-process retries.
// =============================================================================
export class SlackRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Slack rate-limited, retry after ${retryAfterSeconds}s`);
    this.name = "SlackRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// =============================================================================
//  Authed dashboard deep-links — mint a short-lived dashboard_link_token and
//  build `${DASHBOARD_URL}/api/auth/slack-link?t=<token>`. The slack-link
//  route redeems the token and forwards the user through a magic-link sign-in
//  to the stored target_path. Falls back to the raw URL on any error so a
//  Slack send never fails solely because the token service is unavailable.
// =============================================================================

export async function mintDashboardLinkToken(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  targetPath: string,
  ttlSeconds: number = 60 * 60 * 24 * 7, // 7 days; Slack messages sit in inboxes
): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/mint_dashboard_link_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_target_path: targetPath,
        p_ttl_seconds: ttlSeconds,
      }),
    });
    if (!res.ok) {
      console.warn(`[mintDashboardLinkToken] RPC failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return (data && typeof data.token === "string") ? data.token : null;
  } catch (err) {
    console.warn("[mintDashboardLinkToken] fetch error:", err);
    return null;
  }
}

/**
 * Build a Slack-embedded URL that authenticates the recipient on click.
 * Falls back to the raw public URL if token minting fails — never blocks a send.
 */
export async function buildAuthedDashboardUrl(
  supabaseUrl: string,
  serviceRoleKey: string,
  dashboardUrl: string,
  userId: string | null | undefined,
  targetPath: string,
  ttlSeconds?: number,
): Promise<string> {
  const rawUrl = `${dashboardUrl}${targetPath}`;
  if (!userId) return rawUrl;
  const token = await mintDashboardLinkToken(
    supabaseUrl, serviceRoleKey, userId, targetPath, ttlSeconds,
  );
  if (!token) return rawUrl;
  return `${dashboardUrl}/api/auth/slack-link?t=${encodeURIComponent(token)}`;
}
