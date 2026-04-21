-- Phase 3 / Task 13: surface "reinstall required" state on the dashboard.
--
-- When a Slack token refresh fails terminally (invalid_auth / token_revoked)
-- or when we receive a tokens_revoked / app_uninstalled event, we now flip
-- this flag so the dashboard can show an admin-actionable banner instead of
-- silently failing every Slack send.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS requires_reinstall boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_reinstall_at timestamptz;
