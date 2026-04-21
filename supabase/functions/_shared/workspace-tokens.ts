// =========================================================================
//  Read/write Slack tokens via SECURITY DEFINER RPCs that wrap Supabase
//  Vault. Edge functions must use these helpers — never select bot_token
//  directly from the workspaces table.
// =========================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  return {
    botToken: row.bot_token,
    refreshToken: row.refresh_token ?? null,
    tokenExpiresAt: row.token_expires_at ?? null,
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
