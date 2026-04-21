import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { setWorkspaceSlackTokens } from "../_shared/workspace-tokens.ts";
import { verifyOAuthState } from "../_shared/oauth-state.ts";

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") || "";
const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET") || "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim().replace(/\/+$/, "");
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
  console.error("[slack-oauth] Failed to create Supabase client:", e?.message);
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
    console.error("[slack-oauth] Failed to parse action_link:", e?.message);
  }
  return null;
}

// Get installer's email and name using multiple Slack API methods
async function getInstallerInfo(authedUserId: string, authedUserToken: string | undefined, botToken: string): Promise<{ email: string; name: string }> {
  let email = "";
  let name = "";

  // Method 1: users.identity with user token (most reliable — works with identity.email scope)
  if (authedUserToken) {
    try {
      const res = await fetch("https://slack.com/api/users.identity", {
        method: "GET",
        headers: { "Authorization": `Bearer ${authedUserToken}` },
      });
      const data = await res.json();
      if (data.ok) {
        email = data.user?.email || "";
        name = data.user?.name || "";
      }
    } catch (e: any) {
      console.error("[slack-oauth] users.identity failed:", e?.message);
    }
  }

  // Method 2: users.info with user token
  if (!email && authedUserToken) {
    try {
      const res = await fetch("https://slack.com/api/users.info", {
        method: "POST",
        headers: { "Authorization": `Bearer ${authedUserToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user: authedUserId }),
      });
      const data = await res.json();
      if (data.ok) {
        name = name || data.user.real_name || data.user.name || "";
        email = email || data.user.profile?.email || "";
      }
    } catch (e: any) {
      console.error("[slack-oauth] users.info (user token) failed:", e?.message);
    }
  }

  // Method 3: users.info with bot token (least reliable for email)
  if (!email) {
    try {
      const res = await fetch("https://slack.com/api/users.info", {
        method: "POST",
        headers: { "Authorization": `Bearer ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user: authedUserId }),
      });
      const data = await res.json();
      if (data.ok) {
        name = name || data.user.real_name || data.user.name || "";
        email = email || data.user.profile?.email || "";
      }
    } catch (e: any) {
      console.error("[slack-oauth] users.info (bot token) failed:", e?.message);
    }
  }

  return { email, name };
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const state = url.searchParams.get("state");

    if (error) {
      return Response.redirect(`${DASHBOARD_URL}/auth/error?error=${error}`, 302);
    }

    if (!code) {
      return new Response(JSON.stringify({ error: "Missing authorization code" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // CSRF: reject requests without a state parameter
    if (!state) {
      console.error("[slack-oauth] Missing state parameter — possible CSRF");
      return Response.redirect(`${DASHBOARD_URL}/auth/error?error=invalid_request`, 302);
    }

    // State validation. Three accepted formats:
    //   1. signed       → HMAC-signed payload from Task 3 (preferred). Carries
    //                     an optional `setup_token` extra used to link the new
    //                     install to a pre-paid Stripe subscription.
    //   2. <uuid>       → legacy raw setup_token from the /setup checkout
    //                     flow, before Task 3.
    //   3. nonce_<uuid> → legacy CSRF nonce from landing/dashboard-auth, before
    //                     Task 3.
    // Legacy formats are accepted with a warn log until OAUTH_STATE_LEGACY_DEADLINE
    // (unix ms). After that they are rejected.
    const verifiedState = await verifyOAuthState(state);
    let setupTokenFromState: string | null = null;
    if (verifiedState) {
      // Signed state. Surface setup_token (if present) for subscription linking.
      const st = verifiedState.setup_token;
      if (typeof st === "string" && st.length > 0) setupTokenFromState = st;
    } else {
      const NONCE_PATTERN = /^nonce_[0-9a-f-]{32,40}$/i;
      const UUID_PATTERN = /^[0-9a-f-]{32,40}$/i;
      const isLegacy = NONCE_PATTERN.test(state) || UUID_PATTERN.test(state);
      const deadline = parseInt(Deno.env.get("OAUTH_STATE_LEGACY_DEADLINE") ?? "0", 10);
      if (isLegacy && deadline > 0 && Date.now() < deadline) {
        console.warn(
          "[slack-oauth] accepting legacy state format (grace window, expires",
          new Date(deadline).toISOString(),
          ")",
        );
        // Bare-UUID legacy state is itself the setup_token from /setup.
        if (UUID_PATTERN.test(state) && !NONCE_PATTERN.test(state)) {
          setupTokenFromState = state;
        }
      } else {
        console.error(
          "[slack-oauth] invalid or expired state, rejecting:",
          state.slice(0, 20),
        );
        return Response.redirect(`${DASHBOARD_URL}/auth/error?error=invalid_state`, 302);
      }
    }

    if (!supabase) {
      console.error("[slack-oauth] Supabase client not initialized");
      return Response.redirect(`${DASHBOARD_URL}/auth/error?error=supabase_init_failed`, 302);
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/slack-oauth`;

    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      return Response.redirect(`${DASHBOARD_URL}/auth/error?error=${tokenData.error}`, 302);
    }

    // Validate that Slack actually granted every scope Nami needs. If the
    // admin dropped one during reinstall (or Slack's scope-upgrade flow
    // didn't complete), fail loudly at install time instead of letting a
    // later slash-command / DM silently error out with "missing_scope".
    const REQUIRED_BOT_SCOPES = [
      "chat:write",
      "commands",
      "users:read",
      "users:read.email",
      "team:read",
      "im:write",
      "im:history",
      "app_mentions:read",
      "reactions:read",
      "channels:read",
    ];
    const grantedScopes = String(tokenData.scope ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const missingScopes = REQUIRED_BOT_SCOPES.filter(
      (s) => !grantedScopes.includes(s),
    );
    if (missingScopes.length > 0) {
      console.error(
        "[slack-oauth] install rejected, missing scopes:",
        missingScopes.join(","),
      );
      const errQuery = new URLSearchParams({
        error: "missing_scopes",
        scopes: missingScopes.join(","),
      }).toString();
      return Response.redirect(`${DASHBOARD_URL}/auth/error?${errQuery}`, 302);
    }

    const { team, access_token, refresh_token, expires_in, bot_user_id } = tokenData;
    const authedUserId = tokenData.authed_user?.id;
    const authedUserToken = tokenData.authed_user?.access_token;

    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Upsert workspace WITHOUT tokens — tokens go through the Vault RPC below.
    // We select xmax so we can tell whether this row was just inserted vs
    // updated: xmax = '0' (PostgREST returns it as a string) means a fresh
    // INSERT, anything else means we collided with an existing row and
    // performed an UPDATE.
    const { data: workspace, error: dbError } = await supabase
      .from("workspaces")
      .upsert(
        {
          team_id: team.id,
          team_name: team.name,
          bot_user_id: bot_user_id,
          installed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "team_id" }
      )
      .select("id, xmax")
      .single();

    if (dbError || !workspace) {
      console.error("[slack-oauth] DB error:", dbError);
      return Response.redirect(`${DASHBOARD_URL}/auth/error?error=database_error`, 302);
    }

    const wasNewlyInserted = String((workspace as any).xmax) === "0";

    // Persist tokens encrypted-at-rest via Vault. Failure here means the
    // install is unusable, so bail rather than leaving a workspace row
    // without callable tokens.
    const tokensStored = await setWorkspaceSlackTokens(
      workspace.id,
      access_token,
      refresh_token || null,
      tokenExpiresAt,
    );
    if (!tokensStored) {
      // Don't leak a half-installed workspace row if this was a fresh
      // install. Re-installs (xmax !== '0') keep their previous secret
      // pointer intact, so leaving the row alone is correct.
      if (wasNewlyInserted) {
        await supabase.from("workspaces").delete().eq("id", workspace.id);
      }
      console.error("[slack-oauth] vault write failed for workspace", workspace.id);
      return Response.redirect(`${DASHBOARD_URL}/auth/error?error=token_storage`, 302);
    }

    // Handle subscription linking — setup_token comes either from the signed
    // state's `setup_token` extra (new) or from the raw legacy UUID state.
    if (setupTokenFromState) {
      await supabase
        .from("subscriptions")
        .update({ workspace_id: workspace.id, setup_token: null, updated_at: new Date().toISOString() })
        .eq("setup_token", setupTokenFromState)
        .is("workspace_id", null);
    }

    const { data: existingSubs } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("workspace_id", workspace.id)
      .limit(1);

    if (!existingSubs || existingSubs.length === 0) {
      await supabase.from("subscriptions").insert({
        workspace_id: workspace.id, plan: "free", status: "active", user_limit: 999,
      });
    }

    // Check if this workspace already has any users
    const { count: existingUserCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id);

    const isFirstUser = (existingUserCount || 0) === 0;

    // Create/find installer user
    let adminUser: any = null;
    let adminEmail = "";
    let adminName = "";
    let isNewInstall = false;

    if (authedUserId) {
      const { data: existingUsers } = await supabase
        .from("users")
        .select("id, role, slack_email, slack_name")
        .eq("workspace_id", workspace.id)
        .eq("slack_user_id", authedUserId)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        adminUser = existingUsers[0];
        adminEmail = adminUser.slack_email || "";
        adminName = adminUser.slack_name || "";

        // If existing user has no email, try to fetch it now
        if (!adminEmail) {
          const info = await getInstallerInfo(authedUserId, authedUserToken, access_token);
          if (info.email) {
            adminEmail = info.email;
            adminName = info.name || adminName;
            await supabase.from("users").update({ slack_email: adminEmail, slack_name: adminName || undefined }).eq("id", adminUser.id);
          }
        }
      } else {
        isNewInstall = true;
        const info = await getInstallerInfo(authedUserId, authedUserToken, access_token);
        adminEmail = info.email;
        adminName = info.name;

        const assignedRole = isFirstUser ? "admin" : "user";

        const { data: newUser, error: userErr } = await supabase
          .from("users")
          .insert({ workspace_id: workspace.id, slack_user_id: authedUserId, slack_name: adminName, slack_email: adminEmail, role: assignedRole })
          .select("id, role, slack_email, slack_name")
          .single();

        if (userErr) {
          console.error("[slack-oauth] Failed to create user:", userErr);
        } else {
          adminUser = newUser;
        }
      }
    }

    // Generate magic link and redirect through the app's /auth/callback
    if (adminUser && adminEmail) {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: adminEmail,
        options: {
          data: {
            slack_user_id: authedUserId,
            workspace_id: workspace.id,
            workspace_name: team.name,
            name: adminName,
            role: adminUser.role,
            app_user_id: adminUser.id,
          },
          redirectTo: `${DASHBOARD_URL}/dashboard`,
        },
      });

      if (linkError) {
        console.error("[slack-oauth] Magic link error:", linkError.message);
      } else if (linkData?.properties?.action_link) {
        const callbackUrl = extractCallbackUrl(linkData.properties.action_link);
        if (callbackUrl) {
          sendWelcomeDM(access_token, authedUserId, isNewInstall).catch((e: any) => console.error("[slack-oauth] Welcome DM error:", e?.message));
          return Response.redirect(callbackUrl, 302);
        }
        sendWelcomeDM(access_token, authedUserId, isNewInstall).catch((e: any) => console.error("[slack-oauth] Welcome DM error:", e?.message));
        return Response.redirect(linkData.properties.action_link, 302);
      }
    }

    // SECURITY FALLBACK: redirect to success page with needs_signin flag
    if (authedUserId && access_token) {
      sendWelcomeDM(access_token, authedUserId, isNewInstall).catch((e: any) => console.error("[slack-oauth] Welcome DM error:", e?.message));
    }
    return Response.redirect(`${DASHBOARD_URL}/auth/success?installed=true&needs_signin=true`, 302);

  } catch (err: any) {
    console.error("[slack-oauth] UNHANDLED ERROR:", err?.message || String(err), "stack:", err?.stack);
    return Response.redirect(`${DASHBOARD_URL}/auth/error?error=server_error`, 302);
  }
});

async function sendWelcomeDM(botToken: string, userId: string, isNewInstall: boolean) {
  try {
    const dmResponse = await fetch("https://slack.com/api/conversations.open", {
      method: "POST",
      headers: { "Authorization": `Bearer ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ users: userId }),
    });
    const dmData = await dmResponse.json();
    if (dmData.ok && dmData.channel?.id) {
      const blocks = isNewInstall
        ? [
            { type: "section", text: { type: "mrkdwn", text: ":wave: *Welcome to Nami!* Your workspace is all set up." } },
            { type: "section", text: { type: "mrkdwn", text: "Here's how to get started:\n\n:one: *Sync your team* \u2014 Import your Slack members into Nami\n:two: *Set up org structure* \u2014 Assign managers and departments\n:three: *Define competencies* \u2014 Set skills that matter for your team\n:four: *Launch a review cycle* \u2014 Start your first performance review" } },
            { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open Dashboard" }, url: `${DASHBOARD_URL}/dashboard`, style: "primary" }] }
          ]
        : [
            { type: "section", text: { type: "mrkdwn", text: ":wave: *Welcome back to Nami!* The app has been re-installed for your workspace." } },
            { type: "section", text: { type: "mrkdwn", text: "Your existing data is intact. Head to the dashboard to continue." } },
            { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open Dashboard" }, url: `${DASHBOARD_URL}/dashboard`, style: "primary" }] }
          ];

      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { "Authorization": `Bearer ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: dmData.channel.id,
          blocks,
          text: isNewInstall
            ? "Welcome to Nami! Your workspace is all set up."
            : "Welcome back to Nami! The app has been re-installed.",
        }),
      });
    }
  } catch (e: any) {
    console.error("[slack-oauth] sendWelcomeDM error:", e?.message);
  }
}
