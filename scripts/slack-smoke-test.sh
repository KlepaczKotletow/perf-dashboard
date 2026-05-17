#!/usr/bin/env bash
# =============================================================================
#  Slack edge-function smoke test
#
#  Sends a freshly-signed request to each of the three Slack-facing edge
#  functions (slack-events, slack-interactivity, slack-commands) and asserts:
#    - HTTP 200 (NOT 403 — that would mean signature verification broke)
#    - NOT 401 (would mean Supabase gateway is rejecting again — verify_jwt)
#    - NOT 5xx (would mean an uncaught throw inside the handler)
#
#  This is the test that would have caught the May 2026 outage in <60s
#  before users started clicking. Run it on every deploy.
#
#  Usage:
#    SLACK_SIGNING_SECRET=xxxxx SUPABASE_PROJECT_REF=zhfvxfvmdlpdfgxrwtdn \
#      ./scripts/slack-smoke-test.sh
#
#  Or, if you have a .env.local with these vars:
#    set -a && source .env.local && set +a && ./scripts/slack-smoke-test.sh
#
#  Exit code: 0 on all green, 1 on any failure. Suitable for CI.
# =============================================================================

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-zhfvxfvmdlpdfgxrwtdn}"
SIGNING_SECRET="${SLACK_SIGNING_SECRET:-}"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"

if [[ -z "$SIGNING_SECRET" ]]; then
  echo "ERROR: SLACK_SIGNING_SECRET not set." >&2
  echo "       Pull it from Supabase secrets:" >&2
  echo "         supabase secrets list --project-ref $PROJECT_REF" >&2
  echo "       and export it in your shell before running this script." >&2
  exit 1
fi

# Slack-compatible v0 signature. Same algorithm as the production helper.
sign_request() {
  local body="$1"
  local timestamp="$2"
  local base_string="v0:${timestamp}:${body}"
  local hmac
  hmac=$(printf "%s" "$base_string" \
    | openssl dgst -sha256 -hmac "$SIGNING_SECRET" \
    | sed 's/^.*= //')
  printf "v0=%s" "$hmac"
}

# Wrapper that POSTs a signed request and asserts a non-error response.
# Returns 0 on success, 1 on any failure (logged with details).
post_signed() {
  local label="$1"
  local url="$2"
  local body="$3"
  local content_type="$4"

  local timestamp
  timestamp=$(date +%s)
  local signature
  signature=$(sign_request "$body" "$timestamp")

  local response
  local http_code
  response=$(curl -sS -o /tmp/slack-smoke-body -w "%{http_code}" \
    -X POST "$url" \
    -H "Content-Type: $content_type" \
    -H "X-Slack-Request-Timestamp: $timestamp" \
    -H "X-Slack-Signature: $signature" \
    --data-binary "$body" 2>&1) || {
      echo "  [FAIL] $label — curl failed: $response"
      return 1
    }
  http_code="$response"

  local body_excerpt
  body_excerpt=$(head -c 200 /tmp/slack-smoke-body 2>/dev/null || echo "")

  # 200 is the only fully-green answer. 403 = signature broken (regression!).
  # 401 = gateway rejecting (verify_jwt misconfigured). 5xx = handler threw.
  case "$http_code" in
    200)
      echo "  [PASS] $label — HTTP 200"
      return 0
      ;;
    403)
      echo "  [FAIL] $label — HTTP 403 (signature rejected!)"
      echo "         body: $body_excerpt"
      echo "         This is the May-2026 outage shape. Check _shared/slack-signature.ts."
      return 1
      ;;
    401)
      echo "  [FAIL] $label — HTTP 401 (Supabase gateway rejecting)"
      echo "         body: $body_excerpt"
      echo "         Check supabase/config.toml — verify_jwt must be false for this function."
      return 1
      ;;
    5*)
      echo "  [FAIL] $label — HTTP $http_code (handler threw)"
      echo "         body: $body_excerpt"
      echo "         Check function logs for the stack trace."
      return 1
      ;;
    *)
      echo "  [WARN] $label — unexpected HTTP $http_code"
      echo "         body: $body_excerpt"
      return 1
      ;;
  esac
}

echo "── Slack smoke test ────────────────────────────────────────────────"
echo "  Project: $PROJECT_REF"
echo "  Base URL: $BASE_URL"
echo

failures=0

# ── 1. slack-events: send a url_verification challenge.
# This is what Slack does when you add an Events API URL, and it must
# return the challenge string verbatim. We assert HTTP 200 only here; if
# you want stricter assertion, parse the body and compare.
echo "[1/3] slack-events"
EVENTS_BODY='{"token":"smoke","challenge":"smoke-challenge-value","type":"url_verification"}'
post_signed "slack-events url_verification" \
  "$BASE_URL/slack-events" \
  "$EVENTS_BODY" \
  "application/json" \
  || failures=$((failures + 1))

# ── 2. slack-interactivity: send a minimal block_actions payload.
# An unknown action_id should be handled gracefully — empty JSON 200.
# The point isn't to make something happen, it's to make sure the
# signature path + dispatcher don't throw.
echo "[2/3] slack-interactivity"
INTERACT_PAYLOAD='{"type":"block_actions","user":{"id":"USMOKE"},"team":{"id":"TSMOKE"},"actions":[{"action_id":"smoke_test_unknown_action","block_id":"smoke"}],"trigger_id":"smoke","response_url":"https://example.invalid/smoke"}'
# Slack interactivity arrives URL-encoded as payload=<json>.
INTERACT_BODY="payload=$(printf "%s" "$INTERACT_PAYLOAD" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")"
post_signed "slack-interactivity unknown-action" \
  "$BASE_URL/slack-interactivity" \
  "$INTERACT_BODY" \
  "application/x-www-form-urlencoded" \
  || failures=$((failures + 1))

# ── 3. slack-commands: send an unknown slash command.
# Slash commands also come URL-encoded. An unknown command returns an
# ephemeral "Unknown command" — what matters is HTTP 200.
echo "[3/3] slack-commands"
COMMAND_BODY="token=smoke&team_id=TSMOKE&team_domain=smoke&channel_id=CSMOKE&channel_name=smoke&user_id=USMOKE&user_name=smoke&command=%2Fsmoke_unknown&text=&response_url=https%3A%2F%2Fexample.invalid%2Fsmoke&trigger_id=smoke"
post_signed "slack-commands unknown-cmd" \
  "$BASE_URL/slack-commands" \
  "$COMMAND_BODY" \
  "application/x-www-form-urlencoded" \
  || failures=$((failures + 1))

echo
echo "────────────────────────────────────────────────────────────────────"
if [[ $failures -eq 0 ]]; then
  echo "  All Slack functions answered 200 — smoke test PASSED"
  exit 0
else
  echo "  $failures function(s) failed — smoke test FAILED"
  exit 1
fi
