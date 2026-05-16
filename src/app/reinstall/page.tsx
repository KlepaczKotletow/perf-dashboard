import { redirect } from "next/navigation";
import Link from "next/link";
import {
  createServerSupabaseClient,
  getUserWorkspace,
} from "@/lib/supabase-server";
import { env } from "@/lib/env";
import { isAdmin } from "@/lib/roles";

// Per-request: must not be cached, must not be statically rendered.
export const dynamic = "force-dynamic";

// Reinstall flow for an existing workspace whose Slack tokens are gone
// (token rotation failure, app_uninstalled, tokens_revoked). The dashboard
// banner at src/app/dashboard/layout.tsx points here. /setup is the wrong
// destination — that page is for the post-Stripe-checkout install and bounces
// to /pricing when there is no session_id.
//
// The OAuth state itself is signed by the slack-reinstall Supabase edge
// function (not here). Vercel and Supabase do not share the same
// OAUTH_STATE_SECRET in this project, so signing on Vercel and verifying on
// Supabase would fail with invalid_state — which is exactly what an earlier
// version of this page did. Sign-and-verify both happen on Supabase to keep
// the cross-side dependency at zero.
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

  // Look up team_id (RLS-scoped to this admin's workspace) so slack-reinstall
  // can pin the install to the right Slack workspace and the admin doesn't
  // have to pick from a dropdown.
  const supabase = await createServerSupabaseClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("team_id")
    .eq("id", workspace.workspaceId)
    .single();
  const teamId = ws?.team_id ?? null;

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim().replace(/\/+$/, "");
  const target = teamId
    ? `${supabaseUrl}/functions/v1/slack-reinstall?team=${encodeURIComponent(teamId)}`
    : `${supabaseUrl}/functions/v1/slack-reinstall`;
  redirect(target);
}
