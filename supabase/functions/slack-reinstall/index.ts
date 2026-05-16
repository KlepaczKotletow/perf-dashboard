import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { signOAuthState } from "../_shared/oauth-state.ts";

// Co-locate state signing with slack-oauth's state verification: both functions
// use the same OAUTH_STATE_SECRET on the Supabase side, so a Vercel/Supabase
// secret drift can't break the reinstall round-trip. (The dashboard-auth
// function uses the same trick for its install-fallback path.)
//
// Hit by the Vercel /reinstall page after it has confirmed the caller is an
// admin of an existing workspace. Slack admin auth on the consent screen is
// the actual gate — this function just produces a signed state and the OAuth
// URL.

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") || "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "")
  .trim()
  .replace(/\/+$/, "");

const SCOPES =
  "app_mentions:read,chat:write,commands,im:history,im:read,im:write,users:read,users:read.email";
const USER_SCOPES = "identity.basic,identity.email";

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const team = (url.searchParams.get("team") || "").trim();
  // Slack team IDs are short, ASCII, prefixed with T. Reject anything else
  // outright rather than forwarding random query strings to slack.com.
  const safeTeam = /^T[A-Z0-9_-]{1,32}$/i.test(team) ? team : "";

  const redirectUri = `${SUPABASE_URL}/functions/v1/slack-oauth`;
  const state = await signOAuthState({ purpose: "reinstall" });

  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: SCOPES,
    user_scope: USER_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  if (safeTeam) params.set("team", safeTeam);

  return Response.redirect(
    `https://slack.com/oauth/v2/authorize?${params.toString()}`,
    302,
  );
});
