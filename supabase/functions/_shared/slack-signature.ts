// =============================================================================
//  Slack request signature verification.
//
//  Previously this function lived (duplicated) inline in slack-events,
//  slack-interactivity, and slack-commands. On 2026-05-17 we discovered one
//  of those three copies had been silently throwing on every request for
//  an unknown duration because it used `crypto.subtle.timingSafeEqual` — a
//  Node-only API that doesn't exist in Deno's edge runtime. The outer
//  try/catch swallowed the TypeError and returned 200 OK, so every Slack
//  click, slash command, and event in production was silently dead.
//
//  Three preventive measures came out of that incident:
//    1. Single source of truth (this file) — no more 3-way drift.
//    2. Unit test (__tests__/slack-signature.test.ts) that exercises a known
//       signature pair and would catch any future runtime-API regression.
//    3. The implementation uses ONLY portable Web Crypto + a manual
//       XOR-accumulator constant-time compare — no Node-only APIs.
//
//  Returns true on a valid Slack signature, false on anything else.
//  Never throws — return false on bad input so callers can return 403
//  without an outer-catch round trip.
//
//  See: https://api.slack.com/authentication/verifying-requests-from-slack
// =============================================================================

export interface VerifySlackSignatureInput {
  signingSecret: string;
  timestampHeader: string | null; // x-slack-request-timestamp
  signatureHeader: string | null; // x-slack-signature  (e.g. "v0=abc123...")
  body: string;
  now?: Date; // override for tests
  toleranceSeconds?: number; // default 300 (Slack's recommended max age)
  futureSkewSeconds?: number; // default 5 (allow small clock skew)
}

export async function verifySlackSignature(input: VerifySlackSignatureInput): Promise<boolean> {
  const {
    signingSecret,
    timestampHeader,
    signatureHeader,
    body,
    now = new Date(),
    toleranceSeconds = 300,
    futureSkewSeconds = 5,
  } = input;

  if (!signingSecret) return false;
  if (!timestampHeader || !signatureHeader) return false;

  const parsedTs = parseInt(timestampHeader, 10);
  const nowSec = Math.floor(now.getTime() / 1000);
  if (Number.isNaN(parsedTs)) return false;
  if (parsedTs > nowSec + futureSkewSeconds) return false; // future
  if (nowSec - parsedTs > toleranceSeconds) return false; // stale

  const baseString = `v0:${timestampHeader}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const computed = encoder.encode(`v0=${hex}`);
  const received = encoder.encode(signatureHeader);

  // Constant-time XOR-accumulator. Do NOT use crypto.subtle.timingSafeEqual —
  // it is a Node.js extension and does not exist in Deno's edge runtime.
  if (computed.byteLength !== received.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < computed.byteLength; i++) {
    diff |= computed[i] ^ received[i];
  }
  return diff === 0;
}
