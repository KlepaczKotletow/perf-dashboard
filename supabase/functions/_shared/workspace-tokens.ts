// =========================================================================
//  Read/write Slack tokens via SECURITY DEFINER RPCs that wrap Supabase
//  Vault. Edge functions must use these helpers — never select bot_token
//  directly from the workspaces table.
//
//  Token rotation (Slack rotating tokens, 12h TTL):
//    Slack apps with token rotation enabled issue 12h-TTL bot tokens
//    plus a long-lived refresh_token. The workspaces table stores both
//    plus the expiry. `getWorkspaceSlackTokens` auto-refreshes when
//    the token is within REFRESH_BUFFER_MS of expiry (or already past).
// =========================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") || "";
const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET") || "";

// Refresh when fewer than 5 minutes remain. Slack tokens are valid for
// 12h, so this gives us comfortable runway without burning a refresh on
// every call.
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface WorkspaceTokens {
  botToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;  // ISO timestamp
}

export async function getWorkspaceSlackTokens(
  workspaceId: string,
): Promise<WorkspaceTokens | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_workspace_slack_tokens`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ p_workspace_id: workspaceId }),
    },
  );
  if (!res.ok) {
    console.error(
      `[workspace-tokens] get RPC failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row?.bot_token) return null;
  const current: WorkspaceTokens = {
    botToken: row.bot_token,
    refreshToken: row.refresh_token ?? null,
    tokenExpiresAt: row.token_expires_at ?? null,
  };

  // Auto-refresh if expired or about to expire. Static (non-rotating)
  // tokens have token_expires_at=null and refresh_token=null — leave
  // those alone.
  if (current.refreshToken && current.tokenExpiresAt) {
    const expiresMs = Date.parse(current.tokenExpiresAt);
    if (Number.isFinite(expiresMs) && expiresMs - Date.now() <= REFRESH_BUFFER_MS) {
      const refreshed = await refreshSlackToken(workspaceId, current.refreshToken);
      if (refreshed) return refreshed;
      console.warn(
        `[workspace-tokens] refresh failed for ${workspaceId}; returning stale token (Slack will reject if truly expired)`,
      );
    }
  }

  return current;
}

/**
 * Exchange a refresh_token for a fresh bot token. Persists the new
 * tokens (refresh_token rotates on each call) and returns them.
 *
 * Returns null if Slack rejects the refresh (e.g. invalid_refresh_token,
 * token_revoked) — in that case the workspace needs a full reinstall.
 */
export async function refreshSlackToken(
  workspaceId: string,
  refreshToken: string,
): Promise<WorkspaceTokens | null> {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    console.error("[workspace-tokens] SLACK_CLIENT_ID/SECRET not configured — cannot refresh");
    return null;
  }
  let res: Response;
  try {
    res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
      }),
    });
  } catch (err) {
    console.error(`[workspace-tokens] refresh fetch threw for ${workspaceId}:`, err);
    return null;
  }
  const data = await res.json().catch(() => null) as {
    ok?: boolean;
    error?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  if (!data?.ok || !data.access_token) {
    const slackError = data?.error ?? "unknown";
    console.error(
      `[workspace-tokens] refresh rejected for ${workspaceId}: ${slackError}`,
    );
    // Terminal refresh errors mean reinstall is the only fix. Flip the
    // dashboard banner so the admin sees it instead of every DM silently
    // failing. We don't fail this call's caller — they get null and decide
    // how to surface it.
    const isTerminal =
      slackError === "invalid_auth" ||
      slackError === "token_revoked" ||
      slackError === "invalid_refresh_token" ||
      slackError === "account_inactive";
    if (isTerminal) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/workspaces?id=eq.${workspaceId}`, {
          method: "PATCH",
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            requires_reinstall: true,
            requires_reinstall_at: new Date().toISOString(),
          }),
        });
      } catch (flagErr) {
        console.error(`[workspace-tokens] requires_reinstall flag write failed for ${workspaceId}:`, flagErr);
      }
    }
    return null;
  }
  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;
  const ok = await setWorkspaceSlackTokens(
    workspaceId,
    data.access_token,
    data.refresh_token ?? refreshToken,
    newExpiresAt,
  );
  if (!ok) {
    console.error(`[workspace-tokens] persist after refresh failed for ${workspaceId}`);
    // Even if persisting failed, the token we got from Slack is valid right now —
    // return it so the caller can complete this request. The next call will hit
    // Slack again (one extra refresh) until the row is fixed.
  }
  console.log(`[workspace-tokens] refreshed token for ${workspaceId}, expires=${newExpiresAt}`);
  return {
    botToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    tokenExpiresAt: newExpiresAt,
  };
}

export async function setWorkspaceSlackTokens(
  workspaceId: string,
  botToken: string,
  refreshToken: string | null,
  tokenExpiresAt: string | null,
): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/set_workspace_slack_tokens`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        p_workspace_id: workspaceId,
        p_bot_token: botToken,
        p_refresh_token: refreshToken,
        p_token_expires_at: tokenExpiresAt,
      }),
    },
  );
  if (!res.ok) {
    console.error(
      `[workspace-tokens] set RPC failed: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}
