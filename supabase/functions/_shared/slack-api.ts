// =============================================================================
//  Shared Slack API helper with rate limit handling
//  Detects 429 responses and retries after the Retry-After delay.
// =============================================================================

const MAX_RETRIES = 3;

/**
 * Call a Slack Web API method with automatic rate-limit retry.
 * Returns the parsed JSON response from Slack.
 */
export async function callSlackApi(
  token: string,
  method: string,
  body: Record<string, unknown>,
  retries = MAX_RETRIES,
): Promise<any> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Handle rate limiting (429 Too Many Requests)
  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
    // Honor Slack's Retry-After up to 120s. The previous 30s cap meant that
    // when Slack returned Retry-After: 60 we'd retry early and immediately
    // re-fail the same method — adding up to MAX_RETRIES wasted round-trips
    // and a user-visible error. 120s is the documented upper bound for
    // typical chat.postMessage bursts; longer waits indicate an incident.
    const delayMs = Math.min(retryAfter * 1000, 120_000);
    console.warn(`[slack-api] Rate limited on ${method}, retrying after ${retryAfter}s (${retries} retries left)`);
    await sleep(delayMs);
    return callSlackApi(token, method, body, retries - 1);
  }

  const data = await res.json();

  // Slack sometimes returns ok:false with a rate limit error in the body
  if (!data.ok && data.error === "ratelimited" && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
    const delayMs = Math.min(retryAfter * 1000, 120_000); // honor Slack up to 2 min
    console.warn(`[slack-api] Rate limited (body) on ${method}, retrying after ${retryAfter}s`);
    await sleep(delayMs);
    return callSlackApi(token, method, body, retries - 1);
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
