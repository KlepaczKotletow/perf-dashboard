-- Make subscriptions table ready for Stripe-driven subscription lifecycle.
--
-- The architectural intent is: a Stripe Checkout Session creates a row
-- *before* the workspace exists (Slack OAuth happens after Stripe payment).
-- The schema previously required workspace_id NOT NULL with a column-level
-- UNIQUE, which contradicted that intent. After this migration:
--
--   * workspace_id is nullable (in-flight checkouts have no workspace yet).
--   * A partial unique index keeps "one workspace = one subscription" once
--     workspace_id is populated.
--   * A partial unique index on stripe_subscription_id makes /setup and the
--     webhook idempotent under their inherent race (both can attempt insert
--     after Stripe Checkout completes; the second loses with conflict).
--   * 'pro' is added to the plan CHECK so the new single-tier label can land.

-- 1. Allow workspace_id to be null
ALTER TABLE public.subscriptions ALTER COLUMN workspace_id DROP NOT NULL;

-- 2. Replace the column-level UNIQUE on workspace_id with a partial unique index
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_workspace_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_workspace_id_unique_when_set
  ON public.subscriptions (workspace_id)
  WHERE workspace_id IS NOT NULL;

-- 3. Partial unique index on stripe_subscription_id for /setup-vs-webhook idempotency.
-- Drop the existing non-unique index since the partial unique covers the same lookup.
DROP INDEX IF EXISTS public.idx_subscriptions_stripe_subscription;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_unique_when_set
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- 4. Allow 'pro' as a plan value (single-tier rebranding)
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'starter', 'professional', 'enterprise', 'pro'));
