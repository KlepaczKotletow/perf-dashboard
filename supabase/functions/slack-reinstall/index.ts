import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { signOAuthState } from "../_shared/oauth-state.ts";
import {
  SLACK_BOT_SCOPE_STRING,
  SLACK_USER_SCOPES,
} from "../_shared/slack-scopes.ts";

// Universal install-URL redirect for every Nami install entry point: the
// landing page "Add to Slack" CTA, the post-checkout /setup page, and the
// existing-install /reinstall page. Each caller hits this function with a
// `?purpose=` query and gets back a 302 to slack.com/oauth/v2/authorize with
// an HMAC-signed state.
//
// Why centralise here instead of signing on Vercel: Vercel and Supabase do
// not share OAUTH_STATE_SECRET in this project. Vercel-signed states fail
// verification on slack-oauth (Supabase) with invalid_state. PR #18 moved
// the /reinstall flow off Vercel; this commit completes the migration so
// every OAuth state in the system is signed and verified inside Supabase.
// Drift between the two stores can no longer break install/sign-in.
//
// Backward compat: callers that pass no `?purpose=` get the legacy
// "reinstall" tag, matching the original behaviour of this function.

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") || "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "")
  .trim()
  .replace(/\/+$/, "");

const ALLOWED_PURPOSES = new Set([
  "reinstall",
  "landing",
  "install",
  "setup",
]);

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(req.url);

  // Optional: pin install to a specific workspace so Slack skips the
  // workspace-picker on the consent screen. Used by /reinstall.
  const team = (url.searchParams.get("team") || "").trim();
  const safeTeam = /^T[A-Z0-9_-]{1,32}$/i.test(team) ? team : "";

  // Optional: caller-supplied purpose tag. Pure diagnostics — slack-oauth
  // does not gate on this. Whitelisted to keep the value bounded.
  const purposeRaw = (url.searchParams.get("purpose") || "").trim();
  const purpose = ALLOWED_PURPOSES.has(purposeRaw) ? purposeRaw : "reinstall";

  // Optional: setup_token from /setup, embedded into the state extras so
  // slack-oauth can link the eventual install to the pre-paid Stripe
  // subscription. UUID format from crypto.randomUUID().
  const setupTokenRaw = (url.searchParams.get("setup_token") || "").trim();
  const safeSetupToken = /^[A-Za-z0-9_-]{1,64}$/.test(setupTokenRaw)
    ? setupTokenRaw
    : "";

  const redirectUri = `${SUPABASE_URL}/functions/v1/slack-oauth`;

  const stateExtras: Record<string, unknown> = { purpose };
  if (safeSetupToken) stateExtras.setup_token = safeSetupToken;
  const state = await signOAuthState(stateExtras);

  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: SLACK_BOT_SCOPE_STRING,
    user_scope: SLACK_USER_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  if (safeTeam) params.set("team", safeTeam);

  return Response.redirect(
    `https://slack.com/oauth/v2/authorize?${params.toString()}`,
    302,
  );
});
