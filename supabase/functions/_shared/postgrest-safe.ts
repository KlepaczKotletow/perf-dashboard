// Validators + escapers for values that get interpolated into PostgREST
// query strings. Use these at every boundary where a Slack-supplied
// string flows into a fetch URL.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLACK_TEAM_RE = /^T[A-Z0-9]{6,}$/;
const SLACK_USER_RE = /^[UW][A-Z0-9]{6,}$/;
const SLACK_CHANNEL_RE = /^[CDG][A-Z0-9]{6,}$/;

export function asUuid(v: unknown): string | null {
  return typeof v === "string" && UUID_RE.test(v) ? v : null;
}
export function asSlackTeamId(v: unknown): string | null {
  return typeof v === "string" && SLACK_TEAM_RE.test(v) ? v : null;
}
export function asSlackUserId(v: unknown): string | null {
  return typeof v === "string" && SLACK_USER_RE.test(v) ? v : null;
}
export function asSlackChannelId(v: unknown): string | null {
  return typeof v === "string" && SLACK_CHANNEL_RE.test(v) ? v : null;
}

// For values that don't fit a known pattern (search terms, comments),
// percent-encode so they can never break out of the value position.
export function pgEscape(v: string): string {
  return encodeURIComponent(v);
}
