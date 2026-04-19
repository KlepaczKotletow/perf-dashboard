import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") || "";
const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DASHBOARD_URL_RAW = Deno.env.get("DASHBOARD_URL");
if (!DASHBOARD_URL_RAW) {
  throw new Error("DASHBOARD_URL secret is not configured for this Supabase project");
}
const DASHBOARD_URL = DASHBOARD_URL_RAW.replace(/\/+$/, "");

let supabase: any;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (e: any) {
  console.error("[dashboard-auth] Failed to create Supabase client:", e?.message);
}

function extractCallbackUrl(actionLink: string): string | null {
  try {
    const linkUrl = new URL(actionLink);
    const tokenHash = linkUrl.searchParams.get("token") || linkUrl.searchParams.get("token_hash");
    const type = linkUrl.searchParams.get("type") || "magiclink";
    if (tokenHash) {
      return `${DASHBOARD_URL}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${type}&next=/dashboard`;
    }
  } catch (e: any) {
    console.error("[dashboard-auth] Failed to parse action_link:", e?.message);
  }
  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const returnedState = url.searchParams.get("state");

  if (error) {
    return Response.redirect(`${DASHBOARD_URL}/auth/error?message=${encodeURIComponent(error)}`, 302);
  }

  if (!code) {
    // Initial request — redirect to Slack OIDC with CSRF state
    const redirectUri = `${SUPABASE_URL}/functions/v1/dashboard-auth`;
    const scopes = "openid,email,profile";
    const csrfState = `oidc_${crypto.randomUUID()}`;
    const slackAuthUrl = `https://slack.com/openid/connect/authorize?response_type=code&client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${csrfState}&nonce=${crypto.randomUUID()}`;
    return Response.redirect(slackAuthUrl, 302);
  }

  // Callback — validate state parameter exists (CSRF protection)
  if (!returnedState) {
    console.error("[dashboard-auth] Missing state parameter — possible CSRF");
    return Response.redirect(`${DASHBOARD_URL}/auth/error?message=Invalid+request+(missing+state)`, 302);
  }

  try {
    const redirectUri = `${SUPABASE_URL}/functions/v1/dashboard-auth`;
    const tokenResponse = await fetch("https://slack.com/api/openid.connect.token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokens.ok) {
      console.error("[dashboard-auth] Token exchange failed:", tokens);
      return Response.redirect(`${DASHBOARD_URL}/auth/error?message=Token+exchange+failed`, 302);
    }

    const userInfoResponse = await fetch("https://slack.com/api/openid.connect.userInfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    if (!userInfo.ok) {
      console.error("[dashboard-auth] User info failed:", userInfo);
      return Response.redirect(`${DASHBOARD_URL}/auth/error?message=User+info+failed`, 302);
    }

    const slackUserId = userInfo.sub;
    const email = userInfo.email;
    const name = userInfo.name;
    const teamId = userInfo["https://slack.com/team_id"];

    // Find workspace
    const { data: workspaces } = await supabase
      .from("workspaces")
      .select("id, team_name")
      .eq("team_id", teamId)
      .limit(1);

    if (!workspaces || workspaces.length === 0) {
      // Workspace doesn't exist yet — redirect to install flow instead of dead-end error
      const scopes = "app_mentions:read,chat:write,commands,im:history,im:read,im:write,users:read,users:read.email";
      const userScopes = "identity.basic,identity.email";
      const installRedirectUri = `${SUPABASE_URL}/functions/v1/slack-oauth`;
      const oauthState = `nonce_${crypto.randomUUID()}`;
      const installUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&user_scope=${userScopes}&redirect_uri=${encodeURIComponent(installRedirectUri)}&state=${oauthState}`;
      return Response.redirect(installUrl, 302);
    }

    const workspace = workspaces[0];

    // Find or create user
    const { data: existingUsers } = await supabase
      .from("users")
      .select("id, role")
      .eq("workspace_id", workspace.id)
      .eq("slack_user_id", slackUserId)
      .limit(1);

    let appUser = existingUsers?.[0];

    if (!appUser) {
      const { data: allUsers } = await supabase
        .from("users")
        .select("id")
        .eq("workspace_id", workspace.id)
        .limit(1);

      const isFirstUser = !allUsers || allUsers.length === 0;
      const role = isFirstUser ? "admin" : "user";

      const { data: newUser, error: userErr } = await supabase
        .from("users")
        .insert({
          workspace_id: workspace.id,
          slack_user_id: slackUserId,
          slack_email: email,
          slack_name: name,
          role: role,
        })
        .select("id, role")
        .single();

      if (userErr) {
        console.error("[dashboard-auth] User create error:", userErr);
      } else {
        appUser = newUser;
      }
    }

    const userRole = appUser?.role || "user";

    // Generate magic link via SDK, then redirect through app's /auth/callback
    console.log("[dashboard-auth] Generating magic link for:", email);
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        data: {
          slack_user_id: slackUserId,
          workspace_id: workspace.id,
          workspace_name: workspace.team_name,
          name: name,
          role: userRole,
          app_user_id: appUser?.id,
        },
        redirectTo: `${DASHBOARD_URL}/dashboard`,
      },
    });

    if (linkError) {
      console.error("[dashboard-auth] Magic link error:", linkError.message);
      return Response.redirect(`${DASHBOARD_URL}/auth/error?message=${encodeURIComponent(linkError.message || "Auth failed")}`, 302);
    }

    const actionLink = linkData?.properties?.action_link;
    if (actionLink) {
      const callbackUrl = extractCallbackUrl(actionLink);
      if (callbackUrl) {
        console.log("[dashboard-auth] Redirecting to auth callback");
        return Response.redirect(callbackUrl, 302);
      }
      console.log("[dashboard-auth] Falling back to action_link directly");
      return Response.redirect(actionLink, 302);
    }

    console.error("[dashboard-auth] No action_link in response");
    return Response.redirect(`${DASHBOARD_URL}/auth/error?message=Link+generation+failed`, 302);

  } catch (err: any) {
    console.error("[dashboard-auth] Error:", err?.message, err?.stack);
    return Response.redirect(`${DASHBOARD_URL}/auth/error?message=Authentication+failed`, 302);
  }
});
