-- Fix: replace partial unique index on stripe_subscription_id with a plain
-- UNIQUE index so ON CONFLICT (stripe_subscription_id) inference works.
--
-- 20260428_subscriptions_stripe_ready.sql created a PARTIAL unique index
-- (WHERE stripe_subscription_id IS NOT NULL). Postgres does not use a partial
-- unique index for ON CONFLICT inference unless the same WHERE predicate is
-- repeated in the inference clause, and the supabase-js .upsert() API has no
-- way to supply that predicate. As a result, every upsert in
-- /api/webhooks/stripe and /setup raised "there is no unique or exclusion
-- constraint matching the ON CONFLICT specification". The callers never read
-- the returned .error, so the failure was silent — no row was inserted after
-- Stripe Checkout completed, and the billing page kept showing the trial CTA.
--
-- A plain UNIQUE index produces the same allow-multiple-NULLs behavior
-- (Postgres treats NULL as distinct in UNIQUE indexes by default) without
-- the partial-predicate inference requirement.

DROP INDEX IF EXISTS public.subscriptions_stripe_sub_unique_when_set;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
  ON public.subscriptions (stripe_subscription_id);
