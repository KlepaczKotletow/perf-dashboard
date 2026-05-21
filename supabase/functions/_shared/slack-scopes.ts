// Single source of truth for Slack scopes inside Deno edge functions.
// Mirrors src/lib/slack-scopes.ts on the Next.js side; the two files are
// asserted equal at build time by __tests__/slack-scopes.test.ts. Drift
// between them is the bug class that took down install in PR #19 and
// silently broke sign-in for new workspaces (dashboard-auth install-fallback
// regression) — so we centralise the list and let the test catch divergence.
//
// Alphabetised so any drift is a clean diff.

export const SLACK_BOT_SCOPES = [
  "app_mentions:read",
  "channels:read",
  "chat:write",
  "commands",
  "im:history",
  "im:read",
  "im:write",
  "reactions:read",
  "team:read",
  "users:read",
  "users:read.email",
] as const;

export const SLACK_BOT_SCOPE_STRING = SLACK_BOT_SCOPES.join(",");

export const SLACK_USER_SCOPES = "identity.basic,identity.email";
