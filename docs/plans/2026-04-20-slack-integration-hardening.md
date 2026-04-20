# Slack Integration Hardening Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Production-harden the Slack integration (OAuth, events, commands, interactivity, message-sending queue) so Nami can ship as a SaaS without leaking customer tokens, double-sending messages, or timing out under load.

**Architecture:**
- **Defense-in-depth at every Slack trust boundary.** Signature verification is already correct — this plan secures everything that runs *after* a valid signature.
- **Move side-effects out of the request thread.** Slack expects `200 OK` within 3s. Long fan-outs (cycle launches, surveys, deadline reminders) belong in `slack_send_queue` rows the cron drainer chews through.
- **Effectively-once delivery.** Combine event-level dedup (incoming) with `notification_log` checks (outgoing) so neither Slack retries nor queue retries double-send.
- **Encrypt secrets at rest** via Supabase Vault. Edge functions read tokens through `SECURITY DEFINER` RPCs; plaintext columns disappear after a one-shot migration.
- **One commit per task.** Anything in this plan should be revertable with a single `git revert`.

**Tech Stack:** Deno edge functions (Supabase), Postgres (with `vault` + `pgcrypto` extensions), Slack Web API + Events API + Block Kit interactivity, Vitest for any logic that can be extracted to plain TS.

**Test framework note:** Edge functions don't have a local Deno test harness in this repo. The verification pattern is: deploy the function under a `-test` slug to the dev project, exercise it with `curl`, then promote by re-deploying under the canonical slug. Pure helpers (signature check, state signing, dedupe key generation) get extracted into `_shared/*.ts` and unit-tested with Vitest.

**`_shared` deployment note (REQUIRED — verified by inspecting an existing nami-bot deploy):** When deploying via `mcp__supabase__deploy_edge_function`, you must include every imported `_shared/*.ts` file in the `files[]` array alongside the function's `index.ts`. There is no "shared layer" — each function ships its own copy. Concretely, every fn that imports `workspace-tokens.ts` (Task 1), `oauth-state.ts` (Task 3), or `postgrest-safe.ts` (Task 7) must include those files at deploy time. Existing examples to model: `nami-bot` already ships `_shared/nami-blocks.ts` + `_shared/slack-api.ts` this way.

**Pre-flight verified (DB):** All required extensions installed (`vault`, `pg_cron`, `pgcrypto`). `vault.create_secret(text, text, text, uuid) → uuid` and `vault.update_secret(uuid, text, text, text, uuid) → void` signatures confirmed. `notification_log_dedup` UNIQUE INDEX on `(workspace_id, user_id, event_type, reference_id)` already exists — Task 6 builds on this rather than recreating it.

---

## Task Order & Dependencies

Three phases, ordered by ship-blocker severity. Phase 1 must merge before public sales. Phase 2 is the next sprint. Phase 3 is backlog cleanup.

| #  | Task                                                          | Phase | Risk   | User action needed?              |
|----|---------------------------------------------------------------|-------|--------|----------------------------------|
| 1  | Encrypt bot/refresh tokens in Vault, RPC for read/write       | 1     | high   | run migration + redeploy fns     |
| 2  | Slack `event_id` deduplication                                | 1     | low    | run migration                    |
| 3  | OAuth state: HMAC-signed nonce                                | 1     | low    | set `OAUTH_STATE_SECRET` secret  |
| 4  | Honor `X-Slack-Retry-Num` short-circuit                       | 2     | low    | no                               |
| 5  | Move bulk launches (`launch_cycle`/`launch_survey`) to queue  | 2     | medium | no                               |
| 6  | Idempotent message sends via `notification_log`               | 2     | medium | run migration (uniqueness)       |
| 7  | PostgREST input sanitization helper + apply at all call sites | 2     | medium | no                               |
| 8  | Tighten signature timestamp check (no future-dating)          | 3     | low    | no                               |
| 9  | `dbQuery` checks `res.ok`, throws on error                    | 3     | low    | no                               |
| 10 | Require auth on `drain_send_queue`                            | 3     | low    | no                               |
| 11 | Strip token IDs from logs                                     | 3     | low    | no                               |
| 12 | Validate `feedback_form_configs.fields` schema before render  | 3     | low    | no                               |
| 13 | Surface "reinstall required" when refresh fails               | 3     | low    | no                               |

**Cross-task dependencies:**
- Task 1 changes the token read path. Tasks 4–13 must read tokens via the new RPC, not the dropped columns. Don't merge Task 1 in isolation — pair with the deploy of every fn that reads tokens.
- **Tasks 5 and 6 are interlocked and should ship together as one PR.** Task 5's queue handlers call `sendSlackBlocksWithTs` (defined in Task 6.2). Task 5's removal of inline `rollbackNotification` calls is documented in Task 6.5. Recommended order to write/commit: 6.1 migration → 6.2 helper → 5.1 action handlers → 5.2 fan-out refactor → 6.3 drainer ts wiring → 6.5 rollback audit → joint smoke test (5.5 + 6.6) → single commit covering both. Don't try to ship Task 5 without Task 6 — you'll have an inline-loop-and-queue hybrid that is worse than today.
- Task 7 should land before any new feature that exposes user input to PostgREST. Independent of other tasks.
- Task 13 ("requires_reinstall" flag) replaces the `bot_token = NULL` writes in `slack-events` (Pattern C in Task 1.5). Sequence: ship Task 13 first, then Task 1.5 Pattern C edits become trivial.

---

# Phase 1 — Ship-blockers

## Task 1: Encrypt Slack tokens in Supabase Vault

**Files:**
- Create: `supabase/migrations/20260420_01_vault_slack_tokens.sql`
- Create: `supabase/migrations/20260420_02_drop_plaintext_tokens.sql` (separate migration, runs after Task 1 fns deploy)
- Modify: `supabase/functions/slack-oauth/index.ts:200-216` (write path)
- Modify: `supabase/functions/slack-commands/index.ts:60-95` (`getFreshBotToken`)
- Modify: `supabase/functions/slack-interactivity/index.ts` (same `getFreshBotToken` pattern)
- Modify: `supabase/functions/slack-events/index.ts` (anywhere `bot_token` is read)
- Modify: `supabase/functions/nami-bot/index.ts` (anywhere `bot_token`/`refresh_token` is read)
- Modify: `supabase/functions/cycle-notifications/index.ts` (token read)
- Modify: `supabase/functions/send-deadline-reminders/index.ts` (token read)
- Create: `supabase/functions/_shared/workspace-tokens.ts` (Deno helper that wraps the RPC)

**Problem:** `workspaces.bot_token` and `workspaces.refresh_token` are plaintext. A leaked service-role key, an RLS misconfig, or a DB backup leak exposes every customer's `xoxb` token.

### Step 1.1: Migration — add Vault wrappers and RPCs

Create `supabase/migrations/20260420_01_vault_slack_tokens.sql`:

```sql
-- =========================================================================
-- Encrypt Slack bot/refresh tokens at rest using Supabase Vault.
-- After this migration:
--   * Edge functions read tokens via get_workspace_slack_tokens() RPC
--   * Edge functions write tokens via set_workspace_slack_tokens() RPC
--   * The plaintext columns remain for backwards compat until the next
--     migration drops them. Reads fall back to plaintext if no secret yet.
-- =========================================================================

-- 1. Track which Vault secret holds each workspace's tokens.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS slack_tokens_secret_name text;

-- 2. Writer: upsert tokens into Vault, link from workspaces, clear plaintext.
CREATE OR REPLACE FUNCTION public.set_workspace_slack_tokens(
  p_workspace_id      uuid,
  p_bot_token         text,
  p_refresh_token     text,
  p_token_expires_at  timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_name    text := 'slack_tokens_' || p_workspace_id::text;
  v_payload text := jsonb_build_object(
                      'bot', p_bot_token,
                      'refresh', p_refresh_token
                    )::text;
  v_id      uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = v_name;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_payload, v_name,
      'Slack bot+refresh token bundle for workspace ' || p_workspace_id);
  ELSE
    PERFORM vault.update_secret(v_id, v_payload);
  END IF;

  UPDATE workspaces
     SET slack_tokens_secret_name = v_name,
         token_expires_at = p_token_expires_at,
         bot_token = NULL,
         refresh_token = NULL,
         updated_at = now()
   WHERE id = p_workspace_id;
END;
$$;

-- 3. Reader: returns decrypted tokens. Falls back to plaintext during migration.
CREATE OR REPLACE FUNCTION public.get_workspace_slack_tokens(
  p_workspace_id uuid
) RETURNS TABLE(
  bot_token         text,
  refresh_token     text,
  token_expires_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_payload jsonb;
  v_name    text;
BEGIN
  SELECT slack_tokens_secret_name, w.token_expires_at
    INTO v_name, token_expires_at
    FROM workspaces w
   WHERE w.id = p_workspace_id;

  IF v_name IS NOT NULL THEN
    SELECT decrypted_secret::jsonb INTO v_payload
      FROM vault.decrypted_secrets WHERE name = v_name;
    bot_token     := v_payload ->> 'bot';
    refresh_token := v_payload ->> 'refresh';
  ELSE
    -- Migration fallback: workspaces not yet vaulted still have plaintext.
    SELECT bot_token, refresh_token, w.token_expires_at
      INTO bot_token, refresh_token, token_expires_at
      FROM workspaces w
     WHERE w.id = p_workspace_id;
  END IF;

  RETURN NEXT;
END;
$$;

-- 4. Lock down. Only service_role may call.
REVOKE ALL ON FUNCTION public.set_workspace_slack_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_workspace_slack_tokens FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_workspace_slack_tokens TO service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_slack_tokens TO service_role;

-- 5. One-shot vaulting of existing plaintext tokens.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, bot_token, refresh_token, token_expires_at
      FROM workspaces
     WHERE bot_token IS NOT NULL
       AND slack_tokens_secret_name IS NULL
  LOOP
    PERFORM public.set_workspace_slack_tokens(
      r.id, r.bot_token, r.refresh_token, r.token_expires_at);
  END LOOP;
END;
$$;
```

### Step 1.2: Apply the migration via MCP

```
mcp__supabase__apply_migration name="vault_slack_tokens" query=<file contents>
```

Then verify:

```sql
SELECT id, slack_tokens_secret_name IS NOT NULL AS vaulted,
       bot_token IS NULL AS plaintext_cleared
  FROM workspaces;
```

**Expected:** every row has `vaulted=true` and `plaintext_cleared=true`. If any workspace fails to vault, fix before proceeding.

### Step 1.3: Create the shared Deno helper

Create `supabase/functions/_shared/workspace-tokens.ts`:

```ts
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
```

### Step 1.4: Update slack-oauth write path

In `supabase/functions/slack-oauth/index.ts`, replace lines 200–216 (the `.upsert({ bot_token, refresh_token, ... })` block):

```ts
import { setWorkspaceSlackTokens } from "../_shared/workspace-tokens.ts";

// ... after computing access_token, refresh_token, tokenExpiresAt ...

// Upsert the workspace row WITHOUT tokens.
const { data: workspace, error: dbError } = await supabase
  .from("workspaces")
  .upsert(
    {
      team_id: team.id,
      team_name: team.name,
      bot_user_id: bot_user_id,
      installed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "team_id" },
  )
  .select("id")
  .single();

if (dbError || !workspace) {
  console.error("[slack-oauth] DB error:", dbError);
  return Response.redirect(`${DASHBOARD_URL}/auth/error?error=database_error`, 302);
}

// Then write tokens via the vault RPC.
const ok = await setWorkspaceSlackTokens(
  workspace.id, access_token, refresh_token || null, tokenExpiresAt);
if (!ok) {
  console.error("[slack-oauth] failed to vault tokens for", workspace.id);
  return Response.redirect(`${DASHBOARD_URL}/auth/error?error=token_storage`, 302);
}
```

### Step 1.5: Update every read site (~30 sites — measured, not estimated)

Pattern — search for `bot_token` everywhere:

```bash
grep -rn "bot_token" supabase/functions/
```

The codebase has ~30 hits across 8 fn files. They fall into three patterns:

**Pattern A — direct select (~10 sites):**
```ts
const ws = await dbQuery("workspaces", `team_id=eq.${teamId}&select=id,bot_token,refresh_token,token_expires_at`);
```
Becomes:
```ts
const ws = await dbQuery("workspaces", `team_id=eq.${teamId}&select=id`);
const tokens = await getWorkspaceSlackTokens(ws[0].id);
```

**Pattern B — joined select via PostgREST relationship (~12 sites):**
```ts
const { data: cycle } = await supabase
  .from("performance_cycles")
  .select("id, name, workspace_id, workspaces(bot_token)")
  .eq("id", cycleId)
  .single();
const botToken = (cycle as any).workspaces?.bot_token;
```
Becomes:
```ts
const { data: cycle } = await supabase
  .from("performance_cycles")
  .select("id, name, workspace_id")  // drop the join entirely
  .eq("id", cycleId)
  .single();
const tokens = await getWorkspaceSlackTokens(cycle.workspace_id);
const botToken = tokens?.botToken;
```

**Pattern C — write (`bot_token: null` after revoke, ~2 sites in `slack-events`):**
```ts
await supabase.from("workspaces").update({ bot_token: null }).eq("id", workspaceId);
```
After Task 13 lands, this becomes:
```ts
await supabase.from("workspaces")
  .update({ requires_reinstall: true, requires_reinstall_at: new Date().toISOString() })
  .eq("id", workspaceId);
```
Until then, leave the existing line alone — the column still exists during the migration window. Final cleanup happens in Task 1.8 alongside the column drop.

**`getFreshBotToken` signature change.** The existing helper takes the workspace row directly (`ws.bot_token`, `ws.refresh_token`, `ws.token_expires_at`, `ws.id`). After Task 1, callers no longer have those fields, so the signature must change to `(workspaceId: string)`:

```ts
import { getWorkspaceSlackTokens, setWorkspaceSlackTokens } from "../_shared/workspace-tokens.ts";

async function getFreshBotToken(workspaceId: string): Promise<string | null> {
  const tokens = await getWorkspaceSlackTokens(workspaceId);
  if (!tokens) return null;

  const expiresAt = tokens.tokenExpiresAt
    ? new Date(tokens.tokenExpiresAt).getTime()
    : null;
  const needsRefresh = expiresAt !== null
    && expiresAt - Date.now() < 5 * 60 * 1000;

  if (!needsRefresh || !tokens.refreshToken) return tokens.botToken;

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("[getFreshBotToken] refresh failed:", data.error);
    return tokens.botToken;  // serve stale rather than fail
  }

  await setWorkspaceSlackTokens(
    workspaceId,
    data.access_token,
    data.refresh_token ?? null,
    new Date(Date.now() + (data.expires_in || 43200) * 1000).toISOString(),
  );
  return data.access_token;
}
```

Update every call site to pass `workspace_id` instead of the row. Both `slack-commands` and `slack-interactivity` have copies of this helper — refactor both identically.

**Budget:** 4–6 hours of mechanical refactoring across 8 fn files.

### Step 1.6: Deploy all edge functions in one batch

Functions touching tokens must redeploy together — old fn versions reading `bot_token` directly will get `NULL` after the first OAuth that vaults the token.

**Each deploy must include** `_shared/workspace-tokens.ts` in the `files[]` array, plus any other `_shared/*.ts` files the fn already imports (`nami-blocks.ts`, `slack-api.ts`). Verified by inspecting the existing `nami-bot` deployment, which ships `functions/_shared/nami-blocks.ts` and `functions/_shared/slack-api.ts` alongside its entrypoint.

```
For each fn in [slack-oauth, slack-events, slack-commands, slack-interactivity,
                nami-bot, cycle-notifications, send-deadline-reminders]:
  mcp__supabase__deploy_edge_function
    name=<fn>
    entrypoint_path="index.ts"
    verify_jwt=<existing setting — do NOT change>
    files=[
      { name: "index.ts", content: <fn body> },
      { name: "../_shared/workspace-tokens.ts", content: <helper body> },
      ...other _shared files this fn already imports...
    ]
```

If you skip a `_shared` file the fn imports, the deploy returns 200 but the fn boots with "module not found" and 500s on every request. Sanity-check: hit the fn once via curl after each deploy.

### Step 1.7: Smoke test in production

1. Reinstall the app to one staging workspace via the install link.
2. Verify `vault.secrets` has a row named `slack_tokens_<workspace_id>`.
3. Verify `workspaces.bot_token IS NULL` for that row.
4. Send a kudos via `/kudos` — confirms read path works.
5. Trigger a deadline reminder — confirms cron path works.

### Step 1.8: Drop plaintext columns

After ≥48h of clean smoke metrics in step 1.7, create `supabase/migrations/20260420_02_drop_plaintext_tokens.sql`:

```sql
-- All workspaces must have slack_tokens_secret_name populated before this runs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM workspaces
              WHERE slack_tokens_secret_name IS NULL
                AND team_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Refusing to drop plaintext columns: % workspaces still un-vaulted',
      (SELECT count(*) FROM workspaces
        WHERE slack_tokens_secret_name IS NULL AND team_id IS NOT NULL);
  END IF;
END;
$$;

ALTER TABLE workspaces
  DROP COLUMN bot_token,
  DROP COLUMN refresh_token;

-- Update get_workspace_slack_tokens to remove the plaintext fallback.
CREATE OR REPLACE FUNCTION public.get_workspace_slack_tokens(
  p_workspace_id uuid
) RETURNS TABLE(
  bot_token text, refresh_token text, token_expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, extensions
AS $$
DECLARE
  v_payload jsonb;
  v_name text;
BEGIN
  SELECT slack_tokens_secret_name, w.token_expires_at
    INTO v_name, token_expires_at
    FROM workspaces w WHERE w.id = p_workspace_id;
  IF v_name IS NULL THEN RETURN; END IF;
  SELECT decrypted_secret::jsonb INTO v_payload
    FROM vault.decrypted_secrets WHERE name = v_name;
  bot_token := v_payload ->> 'bot';
  refresh_token := v_payload ->> 'refresh';
  RETURN NEXT;
END;
$$;
```

### Step 1.9: Commit

```bash
git add supabase/migrations/20260420_01_vault_slack_tokens.sql \
        supabase/functions/_shared/workspace-tokens.ts \
        supabase/functions/slack-oauth/ \
        supabase/functions/slack-commands/ \
        supabase/functions/slack-interactivity/ \
        supabase/functions/slack-events/ \
        supabase/functions/nami-bot/ \
        supabase/functions/cycle-notifications/ \
        supabase/functions/send-deadline-reminders/
git commit -m "security: encrypt Slack tokens at rest via Supabase Vault"
```

Then 48h later, separate commit for the column drop.

---

## Task 2: Slack `event_id` deduplication

**Files:**
- Create: `supabase/migrations/20260420_03_slack_processed_events.sql`
- Modify: `supabase/functions/slack-events/index.ts:182-205`

**Problem:** Slack retries any event that doesn't get a 200 within 3s, plus on transient network errors — same `event_id` can hit our handler 3+ times. Without dedup, `team_leave` cancels review_assignments multiple times, `app_uninstalled` clears tokens then runs again on a now-broken workspace, etc.

### Step 2.1: Migration

Create `supabase/migrations/20260420_03_slack_processed_events.sql`:

```sql
-- Inbox table for Slack event_ids. INSERT is the dedup primitive — a
-- conflict on event_id means we've already processed (or are processing)
-- this event and must short-circuit.
CREATE TABLE IF NOT EXISTS slack_processed_events (
  event_id     text PRIMARY KEY,
  team_id      text NOT NULL,
  event_type   text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_processed_events_received
  ON slack_processed_events(received_at);

ALTER TABLE slack_processed_events ENABLE ROW LEVEL SECURITY;
-- Service-role only. No user-facing policies.

-- Daily cleanup. Slack's retry window is ~1 hour; 24h gives us a
-- comfortable margin without the table growing forever.
CREATE OR REPLACE FUNCTION cleanup_slack_processed_events()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM slack_processed_events WHERE received_at < now() - interval '24 hours';
$$;

REVOKE ALL ON FUNCTION cleanup_slack_processed_events FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_slack_processed_events TO service_role;

-- Schedule the cleanup. pg_cron is already enabled (see slack_send_queue cron).
SELECT cron.schedule(
  'cleanup-slack-processed-events',
  '17 3 * * *',  -- 03:17 UTC daily
  $$ SELECT public.cleanup_slack_processed_events() $$
);
```

### Step 2.2: Apply via MCP and verify

```
mcp__supabase__apply_migration name="slack_processed_events" query=<file>
```

```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-slack-processed-events';
-- Expect 1 row.
```

### Step 2.3: Patch slack-events handler

In `supabase/functions/slack-events/index.ts`, replace lines 182–205 with:

```ts
Deno.serve(async (req) => {
  const body = await req.text();

  if (!await verifySlackSignature(req, body)) {
    return new Response("Invalid signature", { status: 403 });
  }

  let event: any;
  try { event = JSON.parse(body); }
  catch { return new Response("Bad request", { status: 400 }); }

  // URL verification — never has an event_id, handle before dedup.
  if (event.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: event.challenge }),
      { headers: { "Content-Type": "application/json" } });
  }

  if (event.type !== "event_callback") {
    return new Response("OK", { status: 200 });
  }

  // Idempotency: every Events API delivery has a unique event_id.
  // INSERT into the inbox; if it conflicts, we've seen it before — return
  // 200 immediately so Slack stops retrying. If the insert succeeds we
  // own the event and run side effects exactly once.
  const eventId = event.event_id;
  if (eventId) {
    const dedupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/slack_processed_events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          event_id: eventId,
          team_id: event.team_id ?? "unknown",
          event_type: event.event?.type ?? event.type,
        }),
      },
    );
    if (dedupRes.status === 409) {
      console.log(`[slack-events] duplicate event_id ${eventId}, skipping`);
      return new Response("OK", { status: 200 });
    }
    if (!dedupRes.ok) {
      console.error(`[slack-events] dedup insert failed: ${dedupRes.status}`);
      // Fall through — better to risk a duplicate than drop the event.
    }
  }

  const innerEvent = event.event;
  // ... existing dispatch logic continues below ...
```

### Step 2.4: Deploy + smoke test

Deploy `slack-events`. Then trigger a duplicate by hand:

```
curl -X POST https://<project>.supabase.co/functions/v1/slack-events \
  -H "Content-Type: application/json" \
  -H "x-slack-signature: <signed>" \
  -H "x-slack-request-timestamp: <now>" \
  -d '{"type":"event_callback","event_id":"E_TEST_DEDUP_$(date +%s)","team_id":"T123","event":{"type":"app_home_opened","user":"U..."}}'
# repeat the same request immediately — second should log "duplicate event_id".
```

Verify in `slack_processed_events`:

```sql
SELECT event_id, event_type, received_at FROM slack_processed_events
 WHERE event_id LIKE 'E_TEST_DEDUP_%' ORDER BY received_at DESC LIMIT 5;
```

### Step 2.5: Commit

```bash
git add supabase/migrations/20260420_03_slack_processed_events.sql \
        supabase/functions/slack-events/index.ts
git commit -m "security: dedupe Slack events by event_id to prevent retry double-processing"
```

---

## Task 3: HMAC-signed OAuth state

**Files:**
- Modify: `supabase/functions/slack-oauth/index.ts:114-130` (state validation)
- Modify: wherever the install URL is built (search for `nonce_`) — likely the dashboard's "Install to Slack" button at `src/app/setup/page.tsx` and the dashboard-auth fn.
- Create: `supabase/functions/_shared/oauth-state.ts`

**Problem:** Current state check is just `regex /^nonce_[uuid]/`. Anyone can send themselves through the install flow with any state value — there's no binding between the state we issued and the state Slack returns. An attacker who tricks a victim into clicking a crafted install URL can complete OAuth with the attacker's chosen state, potentially linking workspaces under attacker control.

**Required env:** `OAUTH_STATE_SECRET` — set in Supabase Edge Function secrets via:
```
supabase secrets set OAUTH_STATE_SECRET=$(openssl rand -hex 32)
```

### Step 3.1: Shared signer/verifier

Create `supabase/functions/_shared/oauth-state.ts`:

```ts
// HMAC-signed OAuth state. Format: base64url(payload).base64url(sig)
// payload = JSON { iat: number, csrf: string, ... }
// sig     = HMAC-SHA256(payload, OAUTH_STATE_SECRET)

const SECRET = Deno.env.get("OAUTH_STATE_SECRET");
if (!SECRET) console.warn("[oauth-state] OAUTH_STATE_SECRET not set");

const STATE_TTL_MS = 10 * 60 * 1000;  // 10 min

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64uDecode(s: string): Uint8Array {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/")
                  + "=".repeat((4 - s.length % 4) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  if (!SECRET) throw new Error("OAUTH_STATE_SECRET not configured");
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64u(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signOAuthState(extras: Record<string, unknown> = {}): Promise<string> {
  const payload = { iat: Date.now(), csrf: crypto.randomUUID(), ...extras };
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig  = await hmac(body);
  return `${body}.${sig}`;
}

export interface VerifiedState {
  iat: number;
  csrf: string;
  [key: string]: unknown;
}

export async function verifyOAuthState(state: string): Promise<VerifiedState | null> {
  if (!state || !state.includes(".")) return null;
  const dot = state.indexOf(".");
  const body = state.slice(0, dot);
  const sig  = state.slice(dot + 1);
  const expected = await hmac(body).catch(() => null);
  if (!expected) return null;
  if (!constantTimeEqual(sig, expected)) return null;
  let parsed: VerifiedState;
  try { parsed = JSON.parse(dec.decode(b64uDecode(body))); }
  catch { return null; }
  if (typeof parsed.iat !== "number") return null;
  if (Date.now() - parsed.iat > STATE_TTL_MS) return null;  // expired
  if (Date.now() < parsed.iat) return null;                  // future-dated
  return parsed;
}
```

### Step 3.2: Issue signed state at install time

Find every place that builds the Slack install URL — start with `grep -rn "oauth/v2/authorize" supabase/ src/`. Replace `nonce_${crypto.randomUUID()}` with `await signOAuthState()`.

Example for `dashboard-auth/index.ts:107`:

```ts
import { signOAuthState } from "../_shared/oauth-state.ts";

// ... inside the install branch ...
const oauthState = await signOAuthState({ origin: "dashboard-auth" });
const installUrl = `https://slack.com/oauth/v2/authorize?...&state=${encodeURIComponent(oauthState)}`;
```

### Step 3.3: Verify state on callback

Replace the `slack-oauth/index.ts:114-130` regex check with:

```ts
import { verifyOAuthState } from "../_shared/oauth-state.ts";

// ... inside the OAuth callback handler ...
const state = url.searchParams.get("state");
if (!state) {
  console.error("[slack-oauth] missing state parameter");
  return Response.redirect(`${DASHBOARD_URL}/auth/error?error=missing_state`, 302);
}
// Setup-token states (linking checkout → install) start with "stp_" and are
// verified separately. Everything else must be a signed state.
if (!state.startsWith("stp_")) {
  const verified = await verifyOAuthState(state);
  if (!verified) {
    console.error("[slack-oauth] invalid or expired state");
    return Response.redirect(`${DASHBOARD_URL}/auth/error?error=invalid_state`, 302);
  }
}
```

### Step 3.4: Set the secret in Supabase

```
supabase secrets set OAUTH_STATE_SECRET=$(openssl rand -hex 32)
```

(Or via the dashboard Secrets UI.)

### Step 3.5: Deploy + smoke

Deploy `slack-oauth` and `dashboard-auth`. Then:

1. Click "Install to Slack" from the setup page → confirm install completes.
2. Hit `https://<project>.supabase.co/functions/v1/slack-oauth?code=fake&state=garbage` → expect redirect to `/auth/error?error=invalid_state`.
3. Hit with `state=` from a 30-min-old install attempt → expect `invalid_state`.

### Step 3.6: Commit

```bash
git add supabase/functions/_shared/oauth-state.ts \
        supabase/functions/slack-oauth/index.ts \
        supabase/functions/dashboard-auth/index.ts
git commit -m "security: HMAC-sign OAuth state to prevent CSRF / state forgery"
```

---

# Phase 2 — Reliability

## Task 4: Honor `X-Slack-Retry-Num`

**Files:**
- Modify: `supabase/functions/slack-events/index.ts` (top of `Deno.serve`)
- Modify: `supabase/functions/slack-commands/index.ts` (top of `Deno.serve`)
- Modify: `supabase/functions/slack-interactivity/index.ts` (top of `Deno.serve`)

**Problem:** When our handler is slow (>3s), Slack retries up to 3 times. Each retry runs the same DB writes again. With Task 2 in place, dedup catches duplicates for events — but commands and interactivity have no event_id, and Task 2's protection only works *after* the dedup INSERT, which itself takes time.

### Step 4.1: Add the header check

At the top of each `Deno.serve` handler, after signature verification but before any side-effect work:

```ts
// Slack retried because we were slow. Either:
//  (a) we already finished the work and Slack didn't get our response —
//      doing it again would double-side-effect (dedup table catches some
//      cases but not all). Acknowledge and bail.
//  (b) we never finished — but if we couldn't do it in 3s the first time,
//      we can't do it in 3s now either. Acknowledge so Slack stops, and
//      let the original execution complete in the background.
const retryNum = req.headers.get("x-slack-retry-num");
if (retryNum) {
  console.warn(
    `[slack-${endpointName}] retry #${retryNum} (reason=${
      req.headers.get("x-slack-retry-reason") ?? "?"})`);
  return new Response("OK", { status: 200 });
}
```

Replace `${endpointName}` with `events`, `commands`, or `interactivity`.

### Step 4.2: Deploy three fns

```
mcp__supabase__deploy_edge_function name="slack-events" ...
mcp__supabase__deploy_edge_function name="slack-commands" ...
mcp__supabase__deploy_edge_function name="slack-interactivity" ...
```

### Step 4.3: Smoke test

Easiest way to trigger a retry: temporarily add `await sleep(5000)` to the top of `slack-events`, deploy, send any message in a Slack channel where the bot is. Watch logs — first delivery times out, retry arrives with `x-slack-retry-num=1`, logs "retry #1", returns 200, no duplicate work. Remove the sleep, redeploy.

### Step 4.4: Commit

```bash
git add supabase/functions/slack-events/index.ts \
        supabase/functions/slack-commands/index.ts \
        supabase/functions/slack-interactivity/index.ts
git commit -m "reliability: short-circuit Slack retries on X-Slack-Retry-Num"
```

---

## Task 5: Move bulk launches to `slack_send_queue`

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts`:
  - `handleCycleLaunch` (line 254 — splits into "fan out" + per-recipient queue handler)
  - `handleSurveyLaunch` (line 495 — same split)
  - `handleReleaseGrades` (line 1270 — same split)
  - `handleDrainSendQueue` (line 1588 — adds new action branches)

**Problem:** Each launch handler iterates every assignment with `await sendSlackBlocks()` + `await throttle()`. A 200-person cycle = 200+ seconds, well past edge-runtime limits. The dashboard times out → user clicks again → second launch starts. The existing `notification_log_dedup` UNIQUE INDEX prevents *most* duplicates, but Task 6 closes the remaining hole.

**Verified context (don't re-design these):**
- Drainer at line 1588 dispatches via action: `notify_feedback`, `notify_new_reviewer`, `refresh_home_tab`. Add new branches; don't replace.
- Drainer uses RPCs `claim_slack_send_jobs(p_limit)` and `complete_slack_send_job(p_id, p_success, p_error)` — all queue handlers must call these, not raw SQL.
- `SlackRateLimitError` at the queue layer is already handled (line 1621).
- Existing `handleCycleLaunch` already calls `logNotification` then `sendSlackBlocks` then `rollbackNotification`-on-failure. Reuse this exact pattern in the queue handler so we don't fork the idempotency logic.

### Step 5.1: Add new action handlers in the drainer

In `nami-bot/index.ts`, add these branches inside `handleDrainSendQueue`'s action switch (around line 1607):

```ts
} else if (job.action === "send_cycle_dm") {
  result = await sendCycleLaunchDm(job);
} else if (job.action === "send_survey_invite") {
  result = await sendSurveyInviteDm(job);
} else if (job.action === "send_grade_release") {
  result = await sendGradeReleaseDm(job);
}
```

Each handler is an extract-method of one iteration of the existing loop. For `sendCycleLaunchDm` (extracted from lines 350–387 of the existing self-review branch — exact line numbers will shift as you refactor):

```ts
interface CycleDmJobPayload {
  cycle_id: string;
  cycle_name: string;
  deadline_iso: string | null;
  workspace_id: string;
  assignment_id: string;
  role: "self" | "manager" | "upward";
  recipient_app_user_id: string;  // users.id
  recipient_slack_user_id: string;
  // Pre-resolved name fields so the handler doesn't need extra lookups:
  recipient_name: string;
  subject_name?: string;  // employee being reviewed (manager + upward roles)
  manager_context?: unknown;  // pre-fetched for manager role
}

async function sendCycleLaunchDm(job: QueueJob): Promise<{ ok: boolean; error?: string }> {
  const p = job.payload as CycleDmJobPayload;
  const refId = `${p.role === "manager" ? "mgr" : p.role}_${p.assignment_id}`;
  const eventType = "nami_initial";

  // logNotification is the existing race-free claim — it INSERTs into
  // notification_log, returning false if (workspace, user, event_type, refId)
  // is already present. This is the per-recipient idempotency primitive.
  const canSend = await logNotification(
    p.workspace_id, p.recipient_app_user_id, eventType, refId);
  if (!canSend) return { ok: true };  // already delivered, no-op

  const botToken = await getBotTokenForJob(job);
  if (!botToken) {
    await rollbackNotification(p.workspace_id, p.recipient_app_user_id, eventType, refId);
    return { ok: false, error: "no bot token" };
  }

  const deadline = p.deadline_iso
    ? new Date(p.deadline_iso).toLocaleDateString("en-GB",
        { day: "numeric", month: "short", year: "numeric" })
    : "no deadline set";

  let blocks, text: string;
  if (p.role === "self") {
    blocks = buildSelfReviewOpening(p.recipient_name, p.cycle_name, deadline, p.assignment_id);
    text = `Your self-review for ${p.cycle_name} is ready`;
  } else if (p.role === "manager") {
    blocks = buildManagerReviewOpening(p.recipient_name, p.subject_name ?? "a team member",
      p.cycle_name, deadline, p.assignment_id, p.manager_context);
    text = `Time to review ${p.subject_name ?? "a team member"} for ${p.cycle_name}`;
  } else {
    blocks = buildUpwardFeedbackOpening(p.recipient_name, p.subject_name ?? "your manager",
      p.cycle_name, deadline, p.assignment_id);
    text = `Upward feedback requested for ${p.subject_name ?? "your manager"}`;
  }

  const sendResult = await sendSlackBlocksWithTs(botToken, p.recipient_slack_user_id, text, blocks);
  if (sendResult.ok) {
    return { ok: true };  // notification_log row stays; complete_slack_send_job sets completed_at
  }

  // CAUTION (Task 6.5): only rollback the notification_log row when we KNOW
  // Slack rejected the message (e.g. ok:false in the response body).
  // Don't roll back on indeterminate errors (network reset, timeout) —
  // doing so would let the next queue retry double-send.
  if (sendResult.knownRejected) {
    await rollbackNotification(p.workspace_id, p.recipient_app_user_id, eventType, refId);
  }
  return { ok: false, error: sendResult.error };
}
```

Note `sendSlackBlocksWithTs` is a new helper that returns `{ ok, ts?, knownRejected, error? }` instead of the existing `boolean` return — see Task 6 for its definition.

`getBotTokenForJob(job)` reads `job.workspace_id` and calls `getWorkspaceSlackTokens(workspace_id)` (Task 1 helper). The existing per-fn `getFreshBotToken` doesn't fit because it needs an HMAC-able workspace ID, not a row.

### Step 5.2: Refactor `handleCycleLaunch` to fan-out only

Replace the entire `for` loop body with a queue insert. The fan-out function does the JOIN once, builds N job payloads, and bulk-inserts:

```ts
async function handleCycleLaunch(cycleId: string, mode: "all" | "missed" = "all") {
  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("id, name, review_deadline, workspace_id")  // dropped workspaces(bot_token) — Task 1
    .eq("id", cycleId)
    .single();
  if (!cycle) return { queued: 0, error: "Cycle not found" };

  const { data: assignments } = await supabase
    .from("review_assignments")
    .select(`id, employee_id, manager_id, reviewer_id, assignment_type,
      employee:users!review_assignments_employee_id_fkey(id, slack_user_id, slack_name),
      manager:users!review_assignments_manager_id_fkey(id, slack_user_id, slack_name),
      reviewer:users!review_assignments_reviewer_id_fkey(id, slack_user_id, slack_name)`)
    .eq("cycle_id", cycleId);
  if (!assignments) return { queued: 0 };

  // Keep the existing "missed" filter — it's a perf win, not idempotency.
  // (idempotency is enforced by notification_log_dedup at insert time.)
  let filtered = assignments;
  if (mode === "missed") {
    filtered = await filterMissedAssignments(assignments, cycle.workspace_id);
  }

  // Build job payloads. One per (assignment, role) pair.
  const jobs: any[] = [];
  for (const a of filtered as any[]) {
    if (a.employee?.slack_user_id && a.assignment_type === "standard") {
      jobs.push(makeCycleDmJob(cycle, a, "self", a.employee));
    }
    if (a.manager?.slack_user_id && a.assignment_type === "standard") {
      jobs.push(makeCycleDmJob(cycle, a, "manager", a.manager, a.employee?.slack_name));
    }
    if (a.reviewer?.slack_user_id && a.assignment_type === "upward") {
      jobs.push(makeCycleDmJob(cycle, a, "upward", a.reviewer, a.employee?.slack_name));
    }
  }

  if (jobs.length === 0) {
    await supabase.from("performance_cycles")
      .update({ nami_confirmed: true }).eq("id", cycleId);
    return { queued: 0 };
  }

  // Insert via supabase-js so we get back the same error semantics the rest
  // of the file uses. ignore-duplicates lets re-launch be idempotent at the
  // queue layer (dedupe_key from Task 6).
  const { data: inserted, error: insErr } = await supabase
    .from("slack_send_queue")
    .upsert(jobs, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (insErr) {
    console.error("[handleCycleLaunch] queue insert failed:", insErr);
    return { queued: 0, error: insErr.message };
  }

  await supabase.from("performance_cycles")
    .update({ nami_confirmed: true }).eq("id", cycleId);
  return { queued: inserted?.length ?? jobs.length };
}

function makeCycleDmJob(cycle: any, assignment: any, role: "self"|"manager"|"upward",
                        recipient: any, subjectName?: string) {
  const refRole = role === "manager" ? "mgr" : role;
  return {
    workspace_id: cycle.workspace_id,
    action: "send_cycle_dm",
    dedupe_key: `cycle_dm:${assignment.id}:${refRole}`,
    payload: {
      cycle_id: cycle.id,
      cycle_name: cycle.name,
      deadline_iso: cycle.review_deadline,
      workspace_id: cycle.workspace_id,
      assignment_id: assignment.id,
      role,
      recipient_app_user_id: recipient.id,
      recipient_slack_user_id: recipient.slack_user_id,
      recipient_name: recipient.slack_name || "there",
      subject_name: subjectName,
    } satisfies CycleDmJobPayload,
  };
}
```

### Step 5.3: Same shape for `handleSurveyLaunch` and `handleReleaseGrades`

Extract the per-recipient send into `sendSurveyInviteDm(job)` and `sendGradeReleaseDm(job)`. Use distinct `dedupe_key` prefixes (`survey_dm:`, `grade_dm:`) and distinct `event_type` values (`nami_survey_invite`, `nami_grade_release`) so they don't collide with `nami_initial` in `notification_log`.

### Step 5.4: HTTP handler responses

The existing `launch_cycle` HTTP handler at line 1752 just awaits `handleCycleLaunch` and returns its result — no change needed; it now returns in <1s with `{ queued: N }` instead of `{ sent, skipped, failed }`. **Update the dashboard caller** if it reads `result.sent` (search `src/` for `launch_cycle` to confirm). If yes, change the dashboard to display `queued` and tell the user "DMs are being sent in the background".

### Step 5.5: Smoke test

1. **Pre-test:** smoke-test the upsert + ignoreDuplicates pattern in isolation (it has zero existing usage in this codebase — Gap G in the plan-verification pass):
   ```sql
   INSERT INTO slack_send_queue (workspace_id, action, payload, dedupe_key)
   VALUES ('<a real ws id>', 'test', '{}'::jsonb, 'smoke_test_1');
   -- Then via PostgREST:
   POST /rest/v1/slack_send_queue?on_conflict=workspace_id,dedupe_key
   Prefer: resolution=ignore-duplicates,return=representation
   { workspace_id: ..., action: 'test', payload: {}, dedupe_key: 'smoke_test_1' }
   -- Expect 201 with empty array (duplicate ignored). Clean up: DELETE the row.
   ```
2. Create a 5-person test cycle.
3. Hit `launch_cycle` — response in <1s with `{ queued: ~10 }` (5 self + 5 manager DMs).
4. Inspect `slack_send_queue` — 10 rows with `action=send_cycle_dm`, `completed_at IS NULL`.
5. Wait for cron drainer tick (or call `drain_send_queue` manually) — rows transition to `completed_at IS NOT NULL`.
6. Verify each test user got exactly one DM (not zero, not two).
7. Re-launch the same cycle. Expect `{ queued: 0 }` (all dedupe_keys collide; nothing new).

### Step 5.6: Commit

```bash
git add supabase/functions/nami-bot/index.ts
git commit -m "reliability: enqueue launch DMs instead of sending synchronously"
```

---

## Task 6: Idempotent message sends

**Files:**
- Create: `supabase/migrations/20260420_04_send_queue_dedupe.sql`
- Modify: drainer in `supabase/functions/nami-bot/index.ts` (action handlers added in Task 5)
- Modify: `sendSlackBlocks` helper (or add `sendSlackBlocksWithTs`) so callers can distinguish "Slack rejected" from "we don't know"

**Problem:** Three failure modes can cause double-sends today:
1. **Double-launch by admin** — admin clicks "Launch cycle" twice. Existing `notification_log_dedup` prevents the duplicate `nami_initial` row but the *second* launch still does the entire fan-out + N Slack API calls before each one is rejected. Wastes time/rate-limit budget.
2. **Queue retry after indeterminate failure** — Slack accepts a post but the network resets before we read the response. Our handler returns "failed" → existing code calls `rollbackNotification` (deletes the log row) → next retry re-sends.
3. **No `message_ts` capture** — without storing the Slack-returned `ts`, we can't audit what was sent or detect "Slack got it, we just lost the response".

**Verified context:** The `notification_log_dedup` UNIQUE INDEX on `(workspace_id, user_id, event_type, reference_id)` already exists. `logNotification`/`rollbackNotification` already use it as the per-recipient idempotency primitive. **Don't reinvent this** — just close the gaps around it.

### Step 6.1: Migration

Create `supabase/migrations/20260420_04_send_queue_dedupe.sql`:

```sql
-- Stable dedupe key — producers compute at enqueue time. Closes failure
-- mode #1 (double-launch) by collapsing repeat enqueues into a single job.
ALTER TABLE slack_send_queue
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Partial unique index — only enforced for pending jobs. Once a job
-- completes, the next enqueue with the same dedupe_key may proceed
-- (e.g. a future cycle reuses the same recipient).
CREATE UNIQUE INDEX IF NOT EXISTS slack_send_queue_pending_dedupe
  ON slack_send_queue(workspace_id, dedupe_key)
  WHERE completed_at IS NULL AND dedupe_key IS NOT NULL;

-- Track Slack message_ts on success — closes failure mode #3 (auditing,
-- and we can use it to detect "already sent" on retry).
ALTER TABLE slack_send_queue
  ADD COLUMN IF NOT EXISTS slack_message_ts text;

-- Helper RPC that lets the drainer mark a job complete + record the
-- Slack ts in one round-trip. Service-role only.
CREATE OR REPLACE FUNCTION public.complete_slack_send_job_with_ts(
  p_id uuid,
  p_slack_message_ts text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE slack_send_queue
     SET completed_at = now(),
         slack_message_ts = p_slack_message_ts,
         locked_at = NULL,
         last_error = NULL
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.complete_slack_send_job_with_ts FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_slack_send_job_with_ts TO service_role;
```

### Step 6.2: New `sendSlackBlocksWithTs` helper

Add to `_shared/slack-api.ts`:

```ts
export interface SlackSendResult {
  ok: boolean;
  ts?: string;            // populated on Slack acceptance
  knownRejected: boolean; // true only if Slack returned ok:false with an error
  error?: string;
}

// Wraps chat.postMessage with explicit "we don't know" semantics. Critical
// for safe retries: only rollback notification_log when knownRejected=true.
export async function sendSlackBlocksWithTs(
  token: string,
  channel: string,
  text: string,
  blocks?: unknown[],
): Promise<SlackSendResult> {
  try {
    const result = await callSlackApi(token, "chat.postMessage", {
      channel, text, ...(blocks ? { blocks } : {}),
    });
    if (result?.ok && result?.ts) {
      return { ok: true, ts: result.ts, knownRejected: false };
    }
    // ok:false with an error code = Slack explicitly rejected. Safe to rollback.
    if (result?.ok === false && typeof result?.error === "string") {
      return { ok: false, knownRejected: true, error: result.error };
    }
    // Unknown shape — treat as indeterminate.
    return { ok: false, knownRejected: false, error: "unknown response shape" };
  } catch (err) {
    if (err instanceof SlackRateLimitError) throw err;  // bubble to queue layer
    // Network errors, timeouts, JSON parse failures = indeterminate.
    return { ok: false, knownRejected: false,
             error: err instanceof Error ? err.message : String(err) };
  }
}
```

### Step 6.3: Wire `slack_message_ts` into the drainer's success path

In `handleDrainSendQueue`, when a `send_cycle_dm` (or other queue handler that already returns a ts) job succeeds, prefer `complete_slack_send_job_with_ts` over the existing `complete_slack_send_job`:

```ts
if (result.ok && (result as any).ts) {
  await supabase.rpc("complete_slack_send_job_with_ts", {
    p_id: job.id,
    p_slack_message_ts: (result as any).ts,
  });
} else {
  await supabase.rpc("complete_slack_send_job", {
    p_id: job.id,
    p_success: result.ok,
    p_error: result.ok ? null : result.error ?? null,
  });
}
```

The new queue action handlers (`send_cycle_dm`, etc., from Task 5) need to return `{ ok, ts?, error? }` instead of `{ ok, error }` so the dispatcher can route to the right RPC.

### Step 6.4: Apply migration + deploy

```
mcp__supabase__apply_migration name="send_queue_dedupe" query=<file>
mcp__supabase__deploy_edge_function name="nami-bot" files=[index.ts, _shared/slack-api.ts, _shared/nami-blocks.ts, _shared/workspace-tokens.ts]
```

### Step 6.5: Audit existing rollback callsites (CRITICAL — failure mode #2)

In `nami-bot/index.ts`, find every `rollbackNotification(...)` after `sendSlackBlocks(...) === false`:

```bash
grep -n -B1 -A5 "rollbackNotification" supabase/functions/nami-bot/index.ts
```

Expect ~3 sites in `handleCycleLaunch` (lines 375, 418, 461) plus mirror sites in `handleSurveyLaunch` and `handleReleaseGrades`. Each looks like:

```ts
const ok = await sendSlackBlocks(botToken, slackUserId, text, blocks);
if (ok) { sent++; }
else {
  await rollbackNotification(workspaceId, userId, "nami_initial", refId);
  failed++;
}
```

After Task 5, the inline launch handlers no longer send. The new queue handlers use `sendSlackBlocksWithTs` and only rollback when `knownRejected=true`. **Delete the inline `rollbackNotification` calls in `handleCycleLaunch` etc. as part of Task 5's refactor** — they're dead code once the loop is gone. The new queue handler in Task 5 already shows the safe pattern.

### Step 6.6: Smoke test

1. Manually insert two queue jobs with the same `(workspace_id, dedupe_key)`:
   ```sql
   INSERT INTO slack_send_queue (workspace_id, action, payload, dedupe_key)
   VALUES ('<ws>', 'test', '{}'::jsonb, 'smoke_dedupe_1');
   INSERT INTO slack_send_queue (workspace_id, action, payload, dedupe_key)
   VALUES ('<ws>', 'test', '{}'::jsonb, 'smoke_dedupe_1');
   -- Expect: second INSERT raises "duplicate key value violates unique constraint
   -- slack_send_queue_pending_dedupe". Clean up: DELETE both.
   ```
2. Insert a job with a fake `slack_message_ts`, leave `completed_at=NULL`, run the drainer manually — it should ignore the existing ts (since the action handler hasn't been told to read it) and try to send again. **This is fine** — the dedupe_key + notification_log_dedup combination prevents double-delivery; `slack_message_ts` is just for audit and future-proofing.
3. Force `sendSlackBlocksWithTs` to return `{ok:false, knownRejected:false}` (e.g. by stubbing the token to garbage). Verify the notification_log row is **not** rolled back. Next drainer tick: same dedupe_key blocks the queue insert path, but if the queue job is still pending it will retry — and `logNotification` will return false (row still present), so the handler no-ops. ✅

### Step 6.7: Commit

```bash
git add supabase/migrations/20260420_04_send_queue_dedupe.sql \
        supabase/functions/_shared/slack-api.ts \
        supabase/functions/nami-bot/index.ts
git commit -m "reliability: idempotent Slack sends via dedupe_key + safe rollback"
```

---

## Task 7: PostgREST input sanitization

**Files:**
- Create: `supabase/functions/_shared/postgrest-safe.ts`
- Modify: every `dbQuery` / fetch call in `slack-commands/index.ts`, `slack-interactivity/index.ts`, `slack-events/index.ts`, `nami-bot/index.ts` that interpolates a Slack-supplied string

**Problem:** Strings from `payload.actions[].value`, `payload.view.private_metadata`, and even `team_id` flow into PostgREST URLs via template literals. `&`, `,`, `(`, `)` and operator names in those values can rewrite the query.

### Step 7.1: Helper

Create `supabase/functions/_shared/postgrest-safe.ts`:

```ts
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
```

### Step 7.2: Apply at every call site

Pattern — wherever you see ``${someVar}`` inside a PostgREST URL:

```ts
// BEFORE
const ws = (await dbQuery("workspaces",
  `team_id=eq.${teamId}&select=id,...`))[0];

// AFTER
const safeTeamId = asSlackTeamId(teamId);
if (!safeTeamId) return json({ response_action: "clear" });
const ws = (await dbQuery("workspaces",
  `team_id=eq.${safeTeamId}&select=id,...`))[0];
```

For UUIDs (assignment_id, conv_id, cycle_id, etc.):

```ts
const safeConvId = asUuid(convId);
if (!safeConvId) return json({ error: "invalid id" });
const conv = (await dbQuery("conversation_states",
  `id=eq.${safeConvId}&workspace_id=eq.${ws.id}&select=*`))[0];
```

Run a grep to find every site:

```bash
grep -nE 'eq\.\$\{|in\.\(\$\{' supabase/functions/
```

Audit each hit. Add a validator. ~30 sites estimated; budget the whole task for a 2-hour session.

### Step 7.3: Deploy

Deploy all four affected functions. No migration needed.

### Step 7.4: Smoke

For each fn, send one valid request — should still work. Then send a request with a malformed value (e.g. `team_id=T123,id=eq.evil`) → should be rejected without reaching the DB.

### Step 7.5: Commit

```bash
git add supabase/functions/_shared/postgrest-safe.ts \
        supabase/functions/slack-commands/index.ts \
        supabase/functions/slack-interactivity/index.ts \
        supabase/functions/slack-events/index.ts \
        supabase/functions/nami-bot/index.ts
git commit -m "security: validate Slack-supplied IDs before PostgREST interpolation"
```

---

# Phase 3 — Hardening backlog

## Task 8: Tighten signature timestamp check

**Files:**
- Modify: `supabase/functions/slack-events/index.ts:30`
- Modify: `supabase/functions/slack-commands/index.ts:24`
- Modify: `supabase/functions/slack-interactivity/index.ts:28`

In each `verifySlackSignature`, replace:

```ts
if (isNaN(parsedTs) || Math.abs(Date.now() / 1000 - parsedTs) > 300) return false;
```

with:

```ts
const nowSec = Date.now() / 1000;
// Reject if missing, in the future, or older than 5 min.
if (isNaN(parsedTs) || parsedTs > nowSec + 5 || nowSec - parsedTs > 300) {
  console.warn(`[slack-sig] timestamp out of range: ts=${parsedTs} now=${nowSec}`);
  return false;
}
```

Deploy three fns. Commit:

```bash
git commit -m "security: reject future-dated Slack signature timestamps"
```

---

## Task 9: `dbQuery` checks `res.ok`

**Files:**
- Modify: `supabase/functions/slack-commands/index.ts:45-53`
- Modify: `supabase/functions/slack-interactivity/index.ts:55-91`
- Modify: any `nami-bot/index.ts` site with the same pattern

Wrap each `dbQuery` (and its sibling `dbUpdate`/`dbInsert`):

```ts
async function dbQuery<T = any>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[dbQuery] ${table} ${res.status}: ${body}`);
    throw new Error(`dbQuery ${table} failed: ${res.status}`);
  }
  return res.json() as Promise<T[]>;
}
```

Then audit callers — anywhere that did `if (rows[0])` against a possibly-error response can stay; anywhere that ignored a failure now throws and needs a try/catch with a Slack-visible "something went wrong" reply.

Deploy + commit:

```bash
git commit -m "reliability: dbQuery throws on PostgREST errors instead of returning the error body"
```

---

## Task 10: Auth `drain_send_queue`

**Files:**
- Modify: `supabase/functions/nami-bot/index.ts:1711`

Remove `drain_send_queue` from `ACTIONS_WITHOUT_AUTH`:

```ts
const ACTIONS_WITHOUT_AUTH = new Set<string>([]);  // empty — every action requires auth
```

The pg_cron caller already supplies `Authorization: Bearer <anon_key>` per the existing cron migration, but check whether the drainer cron job uses anon or service-role; if anon, the JWT auth path won't grant `hasJwtAuth=true`. If needed, change the cron to use the CRON_SECRET header.

Smoke: hit the function with no auth — expect 401. With CRON_SECRET — expect 200.

Commit:

```bash
git commit -m "security: require auth on drain_send_queue endpoint"
```

---

## Task 11: Strip token IDs from logs

**Files:**
- Modify: `supabase/functions/slack-events/index.ts:635`

Replace:

```ts
console.log("[slack-events] tokens_revoked oauth:", revokedTokens.oauth);
```

with:

```ts
console.log(`[slack-events] tokens_revoked: ${revokedTokens.oauth?.length ?? 0} oauth, ${revokedTokens.bot?.length ?? 0} bot`);
```

Sweep the rest of the file with `grep -n "console.log.*token\|console.log.*headers" supabase/functions/`. For any hit that includes a token, channel cookie, or full request header dump, replace with summary metadata.

Commit:

```bash
git commit -m "security: stop logging Slack token identifiers"
```

---

## Task 12: Validate `feedback_form_configs.fields` schema

**Files:**
- Create: `supabase/functions/_shared/form-config-schema.ts`
- Modify: `supabase/functions/slack-commands/index.ts:268`

Helper:

```ts
type FieldType = "user_select" | "single_select" | "text" | "checkbox";
const ALLOWED_TYPES: ReadonlySet<FieldType> = new Set([
  "user_select", "single_select", "text", "checkbox",
]);

export interface SafeFormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export function validateFormFields(input: unknown): SafeFormField[] {
  if (!Array.isArray(input)) return [];
  const out: SafeFormField[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    if (typeof f.id !== "string" || !/^[a-z0-9_]{1,64}$/.test(f.id)) continue;
    if (typeof f.type !== "string" || !ALLOWED_TYPES.has(f.type as FieldType)) continue;
    if (typeof f.label !== "string" || f.label.length > 200) continue;
    out.push({
      id: f.id,
      type: f.type as FieldType,
      label: f.label,
      required: f.required === true,
      options: Array.isArray(f.options)
        ? f.options.filter((o: any) =>
            o && typeof o.value === "string" && typeof o.label === "string"
            && o.value.length <= 100 && o.label.length <= 200
          ).slice(0, 50)
        : undefined,
      placeholder: typeof f.placeholder === "string"
        && f.placeholder.length <= 200 ? f.placeholder : undefined,
    });
  }
  return out.slice(0, 20);  // hard cap on field count
}
```

In `slack-commands/index.ts` near line 268:

```ts
import { validateFormFields } from "../_shared/form-config-schema.ts";

// ... where rawFields comes out of the DB ...
const fields = validateFormFields(configRows[0].fields);
```

Commit:

```bash
git commit -m "security: validate kudos form field schema before Block Kit render"
```

---

## Task 13: Surface "reinstall required" on refresh failure

**Files:**
- Migration: `supabase/migrations/20260420_05_workspace_reinstall_flag.sql`
- Modify: `supabase/functions/_shared/workspace-tokens.ts` (or wherever refresh lives after Task 1)
- Modify: `src/lib/supabase-server.ts:38` (`getUserWorkspace`) — surface the flag
- Modify: `src/app/dashboard/layout.tsx` — render banner if flag is set

Migration:

```sql
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS requires_reinstall boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_reinstall_at timestamptz;
```

Edge fn — when `getFreshBotToken` refresh fails with `invalid_auth` or `token_revoked`:

```ts
await fetch(`${SUPABASE_URL}/rest/v1/workspaces?id=eq.${workspaceId}`, {
  method: "PATCH",
  headers: serviceHeaders,
  body: JSON.stringify({
    requires_reinstall: true,
    requires_reinstall_at: new Date().toISOString(),
  }),
});
```

Dashboard banner — in `layout.tsx`, near the top of the main content:

```tsx
{workspace.requiresReinstall && (
  <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
    Slack connection expired. <a href="/setup" className="underline font-medium">Reinstall to restore notifications</a>.
  </div>
)}
```

Update `getUserWorkspace` to select and return `requires_reinstall`.

Commit:

```bash
git commit -m "ux: surface reinstall banner when Slack refresh token fails"
```

---

# Verification matrix

After all phases ship, verify the integration against this matrix manually (~30 min):

| Scenario                                           | Expected result                                                |
|----------------------------------------------------|----------------------------------------------------------------|
| Fresh install via Add to Slack                     | Workspace row created, tokens vaulted, no plaintext columns set |
| Send `/kudos` slash command                        | Modal opens, submission succeeds, kudos in DB                  |
| Click button in a Nami DM                          | Interactivity handler responds in <2s                          |
| Launch a 50-person cycle from dashboard            | Returns in <1s with `queued: ~100`, queue drains in ~2 min     |
| Trigger Slack to retry an event (artificial sleep) | Second delivery logs "duplicate event_id" or "retry #N"        |
| Hit `slack-oauth?state=garbage`                    | Redirects to `/auth/error?error=invalid_state`                 |
| Hit `nami-bot` with `action=drain_send_queue` no auth | 401                                                          |
| Send a kudos with a stored form config containing a malicious field | Field is dropped, modal still renders                        |
| Revoke the bot in Slack workspace settings         | Next Nami DM attempt sets `requires_reinstall=true`, dashboard shows banner |

---

# Rollback plan

Each task is one commit. If any task causes a production incident:

```bash
git revert <commit-sha>
git push
# then redeploy any affected edge functions to undo their version
```

For Task 1 (token vaulting), rollback is more involved because the plaintext columns are dropped after step 1.8. Until then, `git revert` of the function changes is sufficient. After step 1.8, rollback requires re-adding the columns and one-shot decrypting from vault back to plaintext — script provided here as a safety net:

```sql
-- EMERGENCY ROLLBACK: restore plaintext token columns from Vault.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS bot_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text;

UPDATE workspaces w
SET bot_token = (SELECT decrypted_secret::jsonb ->> 'bot'
                   FROM vault.decrypted_secrets WHERE name = w.slack_tokens_secret_name),
    refresh_token = (SELECT decrypted_secret::jsonb ->> 'refresh'
                       FROM vault.decrypted_secrets WHERE name = w.slack_tokens_secret_name)
WHERE w.slack_tokens_secret_name IS NOT NULL;
```
