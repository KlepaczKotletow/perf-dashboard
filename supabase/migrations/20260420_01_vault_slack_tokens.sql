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

-- 1b. The plaintext bot_token column was originally NOT NULL. Now that tokens
-- live in Vault, the writer RPC nulls the plaintext column out after
-- vaulting, so the constraint must be relaxed. The column itself stays for
-- one more migration window to keep older clients buildable.
ALTER TABLE workspaces
  ALTER COLUMN bot_token DROP NOT NULL;

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
