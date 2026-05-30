// Single source of truth for the public "Add to Slack" and "Sign in" CTA URLs.
// Mirrors the inline computation in src/app/page.tsx so every marketing page
// (landing, guides, compare) shares identical, conversion-tracked entry points.
//
// addToSlackUrl points at the Supabase slack-reinstall edge function, which
// signs the OAuth state with Supabase's OAUTH_STATE_SECRET and 302s to Slack.
// Signing on Vercel would require a second copy of that secret that drifts from
// Supabase's — see the comment block atop supabase/functions/slack-reinstall.

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");

/** Slack OAuth install handoff. `purpose` is echoed back so analytics can
 *  attribute the install to the page that sent it. */
export function getAddToSlackUrl(purpose = "landing"): string {
  return `${SUPABASE_URL}/functions/v1/slack-reinstall?purpose=${purpose}`;
}

/** Dashboard sign-in (Slack OAuth) handoff. */
export function getSignInUrl(): string {
  return `${SUPABASE_URL}/functions/v1/dashboard-auth`;
}
