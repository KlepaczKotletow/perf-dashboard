# Stripe live-mode integration — design

**Date:** 2026-04-28
**Stripe account:** NamiHR (`acct_1TR8PrRDOszymcTK`)
**Mode:** Live

## Goal

Connect the NamiHR Stripe account to the app so paid Pro subscriptions work end-to-end: checkout, trial, ongoing per-seat billing, lifecycle sync, and dashboard visibility.

## Pricing model (source of truth: namihr.com)

- **Tier:** Pro
- **Price:** $5 USD per billable seat per month
- **Trial:** 14 days, no credit card required
- **Free-for-≤10 rule from the marketing site:** out of scope for this task; treat anyone who clicks upgrade as a paying customer.
- **Billable seat:** any user where `users.employee_status != 'deactivated'` (matches the existing `IS DISTINCT FROM 'deactivated'` pattern in the codebase). Includes `active`, `onboarding`, `inactive`. Excludes `deactivated`.

## Existing state

Already in place:

- Stripe SDK installed (`stripe@^20.3.1`).
- `src/app/api/checkout/route.ts` — creates Checkout Sessions (built for 6 plan/period combinations; needs to collapse to one).
- `src/app/api/billing-portal/route.ts` — creates Stripe Billing Portal sessions.
- `src/app/setup/page.tsx` — post-checkout handler that retrieves the session, inserts a `subscriptions` row with a `setup_token`, and produces the Add-to-Slack URL.
- `src/app/dashboard/settings/billing/page.tsx` — admin billing UI (built for 4 tiers).
- `src/app/pricing/page.tsx` — public pricing page (built for 3 tiers + annual toggle).
- `src/proxy.ts` — middleware that redirects workspaces with non-`active`/`trialing` subscriptions to billing.
- `subscriptions` table (referenced in code; lives in Supabase, no local migration).

Missing:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SEAT_SYNC_SECRET` env vars.
- Any product or price in the Stripe account (verified empty via MCP).
- Stripe webhook handler — `/api/webhooks/stripe` does not exist.
- Per-seat quantity sync — `quantity: 1` is set at checkout and never changes.
- A registered webhook endpoint in Stripe.

## Section 1 — Stripe products & prices (live mode, via Stripe MCP)

Create exactly one product and one price.

- Product: name `Nami`, description "Performance reviews, 360 feedback, and OKRs in Slack".
- Price: $5.00 USD recurring monthly, `lookup_key=pro_monthly`, `usage_type=licensed` (per-seat).
- No annual price.
- No tax behavior set.

## Section 2 — Checkout changes

`src/app/api/checkout/route.ts`:

- Replace the 6-key `PLAN_LOOKUP_KEYS` map with a single constant `PRO_LOOKUP_KEY = "pro_monthly"`.
- Drop the `plan` and `annual` request body fields. The body becomes empty (or just `{}`).
- Add to `stripe.checkout.sessions.create`:
  - `payment_method_collection: "if_required"` — honors the "no credit card" trial promise.
  - `subscription_data.trial_period_days: 14`.
- Keep `quantity: 1` at checkout time. The workspace doesn't exist yet at this point — the first seat-sync after Slack install reconciles to the real count.

`src/app/setup/page.tsx`:

- Currently rejects `session.payment_status !== "paid"` and redirects to `/pricing?error=payment_incomplete`. With trial-no-card, the value will be `"no_payment_required"` — relax the check to allow either `"paid"` or `"no_payment_required"`. Reject `"unpaid"`.

## Section 3 — Per-seat metering

Centralize via a Postgres trigger so the sync fires regardless of which code path mutates `users` (Slack OAuth edge function, slack-events auto-create, dashboard team admin, etc.).

### 3a. New Supabase migration

Trigger on `users` AFTER INSERT, DELETE, OR UPDATE OF `employee_status`. The trigger function calls `pg_net.http_post` to `/api/internal/seat-sync` with `{ workspace_id }` and an HMAC header. Fire-and-forget — user mutations never block on Stripe.

Pseudocode:

```sql
CREATE OR REPLACE FUNCTION public.notify_seat_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ws_id uuid;
  body  text;
  sig   text;
BEGIN
  ws_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  body  := json_build_object('workspace_id', ws_id)::text;
  sig   := encode(hmac(body, current_setting('app.seat_sync_secret'), 'sha256'), 'hex');

  PERFORM net.http_post(
    url     := current_setting('app.dashboard_url') || '/api/internal/seat-sync',
    body    := body,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Seat-Sync-Signature', sig
    )
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER users_seat_sync
AFTER INSERT OR DELETE OR UPDATE OF employee_status ON public.users
FOR EACH ROW EXECUTE FUNCTION public.notify_seat_sync();
```

`app.seat_sync_secret` and `app.dashboard_url` are set as Postgres GUCs in the migration (`ALTER DATABASE ... SET app.seat_sync_secret = '...'`).

### 3b. New endpoint `src/app/api/internal/seat-sync/route.ts`

- Reads raw body and `X-Seat-Sync-Signature` header.
- Recomputes HMAC; rejects with 401 on mismatch.
- Counts `users` for `workspace_id` where `employee_status != 'deactivated'`.
- Reads `subscriptions` row for the workspace via service-role client.
- Skips (200 OK, noop) when:
  - No subscription row.
  - Subscription status is `canceled` or `incomplete_expired`.
  - Stripe subscription quantity already matches the count (avoid no-op API calls).
- Otherwise calls `stripe.subscriptions.update(subId, { items: [{ id: itemId, quantity: count }], proration_behavior: "create_prorations" })`.
- Logs failures to console, returns 500 — the trigger doesn't retry, but the next user mutation re-fires it, and the daily reconciliation cron is a backstop.

### 3c. Daily reconciliation cron

Vercel cron at `/api/internal/seat-sync-reconcile`, runs at 03:00 UTC. Iterates every workspace with an active or trialing subscription and runs the same sync logic. Catches drift if a trigger call ever drops.

### 3d. Behavior during trial

Quantity updates are still applied during the 14-day trial. Stripe meters the count when the trial ends and the first invoice is generated.

## Section 4 — Stripe webhook handler

New file: `src/app/api/webhooks/stripe/route.ts`. Stripe → app sync.

### Events handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Idempotent safety net — same insert logic as `setup/page.tsx`, in case the customer's browser dies mid-redirect. |
| `customer.subscription.updated` | Upsert `subscriptions` row: `status`, `cancel_at_period_end`, `current_period_end`, plan metadata. |
| `customer.subscription.deleted` | Set `status='canceled'`. Proxy enforcement already redirects canceled workspaces to billing. |
| `invoice.payment_failed` | Set `status='past_due'`. Same enforcement. |
| `invoice.payment_succeeded` | Bump `current_period_end`, ensure `status='active'`. Belt-and-suspenders. |
| `customer.subscription.trial_will_end` | Logged only — Stripe sends emails automatically. |

### Implementation rules

- `export const runtime = 'nodejs'` (Edge default doesn't expose raw body).
- Read raw body via `await request.text()` (calling `.json()` corrupts the signature payload).
- Verify with `stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)`. Reject with 400 on failure, before any DB call.
- Each handler is idempotent (webhook delivery can repeat). Use upserts/conditionals.
- Service-role Supabase client (no auth context for webhooks).
- Returns 200 quickly on success; logs errors and returns 500 so Stripe retries.

### Tenant isolation guarantees

1. All DB writes use `.eq("stripe_subscription_id", subId)`. `stripe_subscription_id` is generated by Stripe and unique — no cross-tenant collision possible.
2. Never trust a workspace_id from event metadata.
3. Signature verification runs first, before any DB read or write.
4. Service-role client bypasses RLS — discipline lives at the query level (always filtering by `stripe_subscription_id`).
5. `/api/internal/seat-sync` requires a valid HMAC over `workspace_id`. The Postgres trigger only ever signs the workspace_id of the row that mutated, so there's no path to write to another tenant.
6. Existing user-facing routes (`/api/checkout`, `/api/billing-portal`) already use `getUserWorkspace()` and are RLS-scoped.

### Stripe-side configuration

Register the webhook endpoint via Stripe MCP pointing at `https://<prod-domain>/api/webhooks/stripe` (confirm domain before creating). Subscribe to the 6 event types above. The returned `whsec_...` becomes `STRIPE_WEBHOOK_SECRET`.

## Section 5 — Dashboard billing UI

`src/app/dashboard/settings/billing/page.tsx`. Built for 4 plans; rebuild for single-tier + trial-no-card.

### Status block (new, top of page)

- **Trialing, no card**: "14-day free trial — N days left. Add a card to keep your team going." + prominent "Add payment method" button → Stripe portal.
- **Trialing, card on file**: "Trial ends MMM dd. You'll be charged $X then." (X = billable seats × $5)
- **Active**: "$X/month, next charge MMM dd (Y billable seats × $5)."
- **Past due**: red banner "Payment failed — update card" + portal button.
- **Canceled**: "Subscription canceled. Resubscribe to continue." + start-checkout button.

Trial state distinguished by reading the Stripe subscription's `default_payment_method` (null = no card) — fetched server-side on page load.

### Plan block (simplified)

- Drop the 4-plan comparison grid.
- Show: "Nami — $5 per billable user / month" + the feature list from namihr.com.
- Live counter: "Y billable users × $5 = $X/mo".

### Recent invoices (new)

- Fetch last 5 via `stripe.invoices.list({ customer: customerId, limit: 5 })` server-side on page load.
- Show date, amount, status (paid/open/uncollectible), download link to `invoice.hosted_invoice_url`.
- Hidden when no `stripe_customer_id`.

### Manage button

Rename "Upgrade" → "Manage billing"; open Stripe portal in new tab. Wire-up unchanged (`/api/billing-portal`).

## Section 6 — Pricing page cleanup

`src/app/pricing/page.tsx`. Collapse to match namihr.com:

- Single Pro card. Headline "$5/user/month".
- Single CTA: "Start 14-day free trial". Replaces the email-input-then-checkout flow.
- Drop annual toggle.
- Keep Enterprise as a small "Need custom?" footer linking `mailto:hello@namihr.com` (matches namihr.com's "Partners Programme").

## Section 7 — Env vars & deployment

### New env vars (server-only)

- `STRIPE_SECRET_KEY` — `sk_live_...` from NamiHR dashboard.
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` from the registered webhook endpoint.
- `SEAT_SYNC_SECRET` — random 32-byte hex (use `openssl rand -hex 32`).

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is **not** needed — Checkout-redirect flow doesn't use Stripe Elements.

### Where to add

- `.env.local` (local dev — paste in by hand).
- Vercel project settings: production + preview.
- `.env.local.example`: uncomment Stripe entries, add `SEAT_SYNC_SECRET`.
- `src/lib/env.ts`: promote `STRIPE_SECRET_KEY` from `optional` to `required`; add `STRIPE_WEBHOOK_SECRET` and `SEAT_SYNC_SECRET` as required.
- Postgres GUCs: `ALTER DATABASE ... SET app.seat_sync_secret = '...'; ALTER DATABASE ... SET app.dashboard_url = 'https://app.namihr.com';` (run as part of the seat-sync migration).

### Domain for webhook endpoint

Confirm production domain before registering in Stripe. Default assumption: `https://app.namihr.com`.

## Out of scope (explicit non-goals)

- Free-for-≤10 enforcement.
- Annual billing.
- Multi-currency.
- Stripe Tax.
- Coupons / promo codes.
- Self-serve cancellation in-app (Stripe portal handles it).
- Updating `subscriptions.user_limit` based on plan (single tier; the column becomes informational only).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Webhook endpoint registered with wrong domain | Verify production domain before creating endpoint via Stripe MCP; ask user to confirm. |
| Postgres trigger fires before Stripe subscription exists (e.g., during free workspace onboarding) | Endpoint short-circuits when no subscription row exists. Returns 200 noop. |
| Trigger HTTP call fails silently | Daily reconciliation cron re-syncs every workspace. |
| `quantity: 1` at checkout charges admin only $5 even with 50 seats | First seat-sync after Slack install bumps quantity, with proration. Net effect: customer is charged for the right count from day one of the post-trial billing period. |
| Live-mode mistakes can't be undone | Only one product + one price created. Anything we get wrong, we archive (not delete) and re-create. Confirm domain and prices via MCP before mutation. |
| Trial-no-card abuse | Out of scope for this task. Stripe's standard trial cancellation policy applies; abuse vectors handled at signup-flow level later. |

## Live IDs (NamiHR account, live mode)

- Product: `prod_UQ14QLfAhKaVsX` (`Nami`)
- Price: `price_1TRB2gRDOszymcTKty32wLKa` ($5.00 USD/month, `lookup_key=pro_monthly`, `usage_type=licensed`)

## Verification plan

After implementation, test in live mode with a real card on a throwaway workspace:

1. Create a fresh Slack workspace, click "Start 14-day free trial" on `/pricing`.
2. Confirm checkout completes without prompting for a card.
3. Confirm `subscriptions` row created with `status='trialing'`, `current_period_end` ≈ now + 14 days.
4. Add 3 users to the Slack workspace.
5. Confirm Stripe subscription quantity is now 4 (admin + 3) within seconds — check via Stripe Dashboard or MCP.
6. Deactivate one user via dashboard team page.
7. Confirm Stripe quantity drops to 3.
8. Add a card via Stripe portal. Confirm `default_payment_method` populated; billing page status block updates.
9. End trial early via Stripe Dashboard ("end trial now"). Confirm `customer.subscription.updated` webhook fires; `subscriptions` row updates to `status='active'`; first invoice for $15 (3 seats × $5) is paid.
10. Cancel via Stripe portal. Confirm `subscriptions` row → `status='canceled'`. Confirm proxy redirects subsequent dashboard requests to `/dashboard/settings/billing?inactive=true`.
