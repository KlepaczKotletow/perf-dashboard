// Single source of truth for the Slack bot scopes Nami requires at install
// time. Must stay in lockstep with REQUIRED_BOT_SCOPES in
// supabase/functions/slack-oauth/index.ts and the SCOPES array in
// supabase/functions/slack-reinstall/index.ts. The /api/health/install
// route asserts all three lists match — that's the runtime safety net.
//
// Alphabetised so a drift shows up as a clean diff.

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
