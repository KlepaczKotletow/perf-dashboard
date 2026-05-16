import { redirect } from "next/navigation";
import Link from "next/link";
import { signOAuthState } from "@/lib/oauth-state";
import {
  createServerSupabaseClient,
  getUserWorkspace,
} from "@/lib/supabase-server";
import { env } from "@/lib/env";
import { isAdmin } from "@/lib/roles";

// signOAuthState produces a per-request token; never cache this page.
export const dynamic = "force-dynamic";

// Reinstall flow for an existing workspace whose Slack tokens are gone
// (token rotation failure, app_uninstalled, tokens_revoked). The dashboard
// banner at src/app/dashboard/layout.tsx points here. /setup is the wrong
// destination — that page is for the post-Stripe-checkout install and bounces
// to /pricing when there is no session_id.
export default async function ReinstallPage() {
  const workspace = await getUserWorkspace();
  if (!workspace?.workspaceId) {
    redirect("/");
  }

  if (!isAdmin(workspace.role)) {
    // Non-admins can land here from the banner. Render a small note rather
    // than starting an OAuth flow they can't complete.
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Only an admin can reinstall
          </h1>
          <p className="text-sm text-muted-foreground">
            Nami&apos;s Slack connection needs to be reinstalled by a workspace
            admin. Ask one of your admins to visit this page.
          </p>
          <Link
            href="/dashboard"
            className="inline-block text-sm text-primary hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Pin the install to this workspace's Slack team so the admin doesn't have
  // to pick from a dropdown (and can't accidentally install into the wrong
  // workspace). slack-oauth upserts on team_id, so this also keeps tenant
  // routing tight on the callback.
  const supabase = await createServerSupabaseClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("team_id")
    .eq("id", workspace.workspaceId)
    .single();
  const teamId = ws?.team_id ?? null;

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim().replace(/\/+$/, "");
  const slackClientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID || "";
  const slackRedirectUri = `${supabaseUrl}/functions/v1/slack-oauth`;
  // Match the scope list /setup uses for new installs. The slack-oauth
  // callback validates a superset and will surface any missing-scope error
  // at install time.
  const scopes =
    "app_mentions:read,chat:write,commands,im:history,im:read,im:write,users:read,users:read.email";

  const oauthState = await signOAuthState({ purpose: "reinstall" });
  const params = new URLSearchParams({
    client_id: slackClientId,
    scope: scopes,
    user_scope: "identity.basic,identity.email",
    redirect_uri: slackRedirectUri,
    state: oauthState,
  });
  if (teamId) params.set("team", teamId);

  redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}
