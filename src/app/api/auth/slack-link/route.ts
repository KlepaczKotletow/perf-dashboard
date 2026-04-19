/**
 * Consumes a short-lived `dashboard_link_tokens` token and signs the user
 * in before redirecting to their target path. Called from Slack-embedded
 * dashboard links so clicks don't dump the user at /?signin=required.
 *
 * Flow:
 *   1. Nami-bot (or anywhere we build Slack UIs) calls
 *      mint_dashboard_link_token(user_id, path) and embeds the resulting
 *      token in Slack-rendered URLs as ?t=<token>.
 *   2. User clicks the link → lands here.
 *   3. This route redeems the token (single-use, 2 min TTL by default),
 *      resolves the app user's email via Supabase Auth admin, generates
 *      a magic link, and redirects to its callback URL.
 *   4. The existing /auth/callback handler picks up from there.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { isValidTargetPath } from "./validate-target-path";

export const runtime = "nodejs";

function errorRedirect(dashboardUrl: string, code: string): NextResponse {
  // Land on the login with a specific error query so we can tune copy later.
  return NextResponse.redirect(`${dashboardUrl}/?signin=required&reason=${code}`);
}

export async function GET(request: NextRequest) {
  // Resolve dashboard URL from env only — no hardcoded fallback so that
  // preview/staging deploys can't silently redirect users to production.
  const DASHBOARD_URL = env.DASHBOARD_URL;
  if (!DASHBOARD_URL) {
    console.error("[slack-link] DASHBOARD_URL env var missing");
    // Fall back to the request's own origin so the user at least lands back
    // on the site they came from instead of getting a broken redirect.
    return NextResponse.redirect(`${request.nextUrl.origin}/?signin=required&reason=server_misconfigured`);
  }

  const token = request.nextUrl.searchParams.get("t");
  if (!token || token.length < 32) {
    return errorRedirect(DASHBOARD_URL, "missing_token");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[slack-link] SUPABASE_SERVICE_ROLE_KEY missing");
    return errorRedirect(DASHBOARD_URL, "server_misconfigured");
  }

  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1. Redeem the token atomically (single-use, TTL-checked in SQL).
  const { data: redeemed, error: redeemErr } = await admin.rpc(
    "redeem_dashboard_link_token",
    { p_token: token },
  );
  if (redeemErr) {
    console.error("[slack-link] redeem failed:", redeemErr.message);
    return errorRedirect(DASHBOARD_URL, "redeem_failed");
  }
  if (!redeemed || typeof redeemed !== "object") {
    return errorRedirect(DASHBOARD_URL, "token_invalid_or_expired");
  }
  const { user_id: appUserId, target_path: targetPath } = redeemed as {
    user_id: string;
    target_path: string;
  };

  // Defense-in-depth: tokens are minted server-side today, but treat the
  // stored path as untrusted in case a future bug or compromise allows
  // attacker-controlled values. Reject anything outside /dashboard.
  if (!isValidTargetPath(targetPath)) {
    console.error("[slack-link] invalid target path rejected:", targetPath);
    return errorRedirect(DASHBOARD_URL, "invalid_target");
  }

  // 2. Resolve the app user → their email via the slack_user_id link.
  //    (auth.users.raw_user_meta_data->>'slack_user_id' is the canonical link
  //    established at install time.)
  const { data: appUser, error: appUserErr } = await admin
    .from("users")
    .select("slack_user_id, slack_email, slack_name")
    .eq("id", appUserId)
    .single();
  if (appUserErr || !appUser?.slack_email) {
    console.error("[slack-link] app user lookup failed:", appUserErr?.message);
    return errorRedirect(DASHBOARD_URL, "user_not_found");
  }

  // 3. Generate a magic link and redirect the browser to its callback URL.
  //    The existing /auth/callback handler exchanges the hash for a session.
  const redirectTo = `${DASHBOARD_URL}${targetPath.startsWith("/") ? targetPath : "/" + targetPath}`;
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: appUser.slack_email,
    options: { redirectTo },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error("[slack-link] generateLink failed:", linkErr?.message);
    return errorRedirect(DASHBOARD_URL, "link_failed");
  }

  return NextResponse.redirect(linkData.properties.action_link);
}
