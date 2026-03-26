/**
 * SECURE client-side workspace/user identity lookup.
 *
 * NEVER trust user_metadata.workspace_id or user_metadata.app_user_id —
 * those values are user-editable via supabase.auth.updateUser().
 *
 * Instead, we look up the caller's identity by their email address
 * (which comes from the auth provider and cannot be spoofed).
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface ClientIdentity {
  authEmail: string;
  userId: string;        // app-level user ID from the users table
  workspaceId: string;   // workspace_id from the users table
  role: string;          // role from the users table
  slackName: string;
}

/**
 * Securely resolve the current user's identity from the DB.
 * Returns null if not authenticated or user not found.
 */
export async function getClientIdentity(
  supabase: SupabaseClient
): Promise<ClientIdentity | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, workspace_id, role, slack_name")
    .eq("slack_email", authUser.email)
    .single();

  if (!dbUser) return null;

  return {
    authEmail: authUser.email,
    userId: dbUser.id,
    workspaceId: dbUser.workspace_id,
    role: dbUser.role || "user",
    slackName: dbUser.slack_name || "",
  };
}
