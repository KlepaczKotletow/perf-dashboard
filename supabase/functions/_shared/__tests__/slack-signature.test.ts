import { describe, it, expect } from "vitest";
import { verifySlackSignature } from "../slack-signature";

// Cross-runtime helper: re-derive what Slack would send so the test
// doesn't depend on hard-coded magic strings (avoids drift if we ever
// change the algorithm). Mirrors the production helper exactly except
// the comparison step is trusted output (we sign, we don't verify).
async function signPayload(secret: string, timestamp: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`v0:${timestamp}:${body}`));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `v0=${hex}`;
}

describe("verifySlackSignature", () => {
  const SECRET = "test_signing_secret_dont_use_in_prod";
  const NOW = new Date("2026-05-17T12:00:00Z");
  const TS = String(Math.floor(NOW.getTime() / 1000));
  const BODY = "payload=%7B%22type%22%3A%22block_actions%22%7D";

  it("returns true for a freshly signed request", async () => {
    const sig = await signPayload(SECRET, TS, BODY);
    expect(
      await verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: TS,
        signatureHeader: sig,
        body: BODY,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("rejects when the signing secret doesn't match", async () => {
    const sig = await signPayload("wrong_secret", TS, BODY);
    expect(
      await verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: TS,
        signatureHeader: sig,
        body: BODY,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("rejects when the body has been tampered with", async () => {
    const sig = await signPayload(SECRET, TS, BODY);
    expect(
      await verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: TS,
        signatureHeader: sig,
        body: BODY + "&injected=true", // body changed; sig now stale
        now: NOW,
      }),
    ).toBe(false);
  });

  it("rejects when the timestamp is older than the tolerance (replay protection)", async () => {
    const oldTs = String(Math.floor(NOW.getTime() / 1000) - 301); // 1s past 5min cutoff
    const sig = await signPayload(SECRET, oldTs, BODY);
    expect(
      await verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: oldTs,
        signatureHeader: sig,
        body: BODY,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("rejects when the timestamp is in the future (clock-skew defense)", async () => {
    const futureTs = String(Math.floor(NOW.getTime() / 1000) + 100);
    const sig = await signPayload(SECRET, futureTs, BODY);
    expect(
      await verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: futureTs,
        signatureHeader: sig,
        body: BODY,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("rejects when the timestamp header is missing or malformed", async () => {
    const sig = await signPayload(SECRET, TS, BODY);
    expect(
      await verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: null,
        signatureHeader: sig,
        body: BODY,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      await verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: "not-a-number",
        signatureHeader: sig,
        body: BODY,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("rejects when the signature header is missing", async () => {
    expect(
      await verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: TS,
        signatureHeader: null,
        body: BODY,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("rejects when the signing secret is empty (security misconfiguration)", async () => {
    // No signing step — the production helper must short-circuit on an
    // empty secret before it would attempt to import it as an HMAC key
    // (which would throw DataError). The signature header value here is
    // arbitrary; the helper should reject regardless.
    expect(
      await verifySlackSignature({
        signingSecret: "",
        timestampHeader: TS,
        signatureHeader: "v0=anything",
        body: BODY,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("rejects signatures with different byte lengths (early-out, no crash)", async () => {
    expect(
      await verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: TS,
        signatureHeader: "v0=abc", // intentionally too short
        body: BODY,
        now: NOW,
      }),
    ).toBe(false);
  });

  // Regression test for the May 2026 outage: crypto.subtle.timingSafeEqual
  // is a Node-only API that doesn't exist in Deno's edge runtime. If this
  // test starts failing with "TypeError: ... is not a function", a future
  // refactor has reintroduced a non-portable comparison.
  it("does not throw on any invalid input (must short-circuit cleanly)", async () => {
    await expect(
      verifySlackSignature({
        signingSecret: SECRET,
        timestampHeader: "",
        signatureHeader: "",
        body: "",
        now: NOW,
      }),
    ).resolves.toBe(false);
  });
});
