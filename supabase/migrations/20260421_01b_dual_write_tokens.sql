-- =========================================================================
-- Follow-up to 20260420_01_vault_slack_tokens.sql.
-- Two corrections:
--   1. set_workspace_slack_tokens now dual-writes plaintext + vault, so
--      old edge-fn versions reading bot_token directly keep working until
--      Task 1B refactors them to use the RPC. The plaintext columns will
--      be nulled in a later migration (Task 1.8) once all reads go via
--      get_workspace_slack_tokens.
--   2. Adds an existence guard so calling the writer with a non-existent
--      workspace_id raises instead of silently creating an orphan vault
--      secret.
-- =========================================================================

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
  -- Verify the workspace exists BEFORE touching vault, so a bad caller
  -- can't leak orphaned vault secrets.
  IF NOT EXISTS (SELECT 1 FROM workspaces WHERE id = p_workspace_id) THEN
    RAISE EXCEPTION 'workspace % does not exist', p_workspace_id;
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = v_name;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_payload, v_name,
      'Slack bot+refresh token bundle for workspace ' || p_workspace_id);
  ELSE
    PERFORM vault.update_secret(v_id, v_payload);
  END IF;

  -- Dual-write: keep plaintext columns in sync until Task 1.8 drops them.
  -- Old edge-fn versions still read bot_token directly; the vault payload
  -- is the canonical source for new code paths.
  UPDATE workspaces
     SET slack_tokens_secret_name = v_name,
         token_expires_at = p_token_expires_at,
         bot_token = p_bot_token,
         refresh_token = p_refresh_token,
         updated_at = now()
   WHERE id = p_workspace_id;
END;
$$;
