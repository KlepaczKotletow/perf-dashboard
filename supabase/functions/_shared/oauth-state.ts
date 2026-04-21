// HMAC-signed OAuth state. Format: base64url(payload).base64url(sig)
// payload = JSON { iat: number, csrf: string, ... }
// sig     = HMAC-SHA256(payload, OAUTH_STATE_SECRET)

const SECRET = Deno.env.get("OAUTH_STATE_SECRET");
if (!SECRET) {
  throw new Error("[oauth-state] OAUTH_STATE_SECRET not set — refusing to boot");
}
// One-line digest at boot so we can confirm Vercel + Supabase have the same secret.
crypto.subtle
  .digest("SHA-256", new TextEncoder().encode(SECRET))
  .then((d) => {
    const hex = Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
    console.log(`[oauth-state] boot — secret digest=${hex.slice(0, 8)}`);
  });

const STATE_TTL_MS = 10 * 60 * 1000;  // 10 min

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64uDecode(s: string): Uint8Array {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/")
                  + "=".repeat((4 - s.length % 4) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  if (!SECRET) throw new Error("OAUTH_STATE_SECRET not configured");
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64u(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signOAuthState(extras: Record<string, unknown> = {}): Promise<string> {
  const payload = { iat: Date.now(), csrf: crypto.randomUUID(), ...extras };
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig  = await hmac(body);
  return `${body}.${sig}`;
}

export interface VerifiedState {
  iat: number;
  csrf: string;
  [key: string]: unknown;
}

export async function verifyOAuthState(state: string): Promise<VerifiedState | null> {
  if (!state || !state.includes(".")) return null;
  const dot = state.indexOf(".");
  const body = state.slice(0, dot);
  const sig  = state.slice(dot + 1);
  const expected = await hmac(body).catch(() => null);
  if (!expected) return null;
  if (!constantTimeEqual(sig, expected)) return null;
  let parsed: VerifiedState;
  try { parsed = JSON.parse(dec.decode(b64uDecode(body))); }
  catch { return null; }
  if (typeof parsed.iat !== "number") return null;
  if (Date.now() - parsed.iat > STATE_TTL_MS) return null;  // expired
  if (Date.now() < parsed.iat) return null;                  // future-dated
  return parsed;
}
