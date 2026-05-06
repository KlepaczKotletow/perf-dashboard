# Nami

Performance reviews your team will actually complete. Nami lives inside Slack and runs 360° reviews, goals, surveys, and analytics — no new tools, no forms.

This repo is the Nami web application: the marketing site, billing surface, and admin dashboard. The Slack bot itself lives in [`supabase/functions/`](supabase/functions/) as Edge Functions.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Supabase** — Postgres, Auth (magic link), Edge Functions for the Slack bot
- **Stripe** — subscriptions with seat-based pricing, 14-day trial, `pro_monthly` lookup key
- **Tailwind v4** + **shadcn/ui** + **Radix UI**
- **Vitest** for tests
- **Vercel** for hosting; cron jobs run via Vercel Cron and Supabase pg_cron

## Project layout

```
src/app/                  # Routes
  page.tsx                # Landing
  pricing/, privacy/,     # Marketing
  terms/, security/,
  support/, roadmap/
  setup/                  # Post-install Slack setup wizard
  onboarding/             # First-run dashboard tour
  dashboard/              # Authenticated app
  auth/                   # Magic link callback + error pages
  api/                    # Route handlers
    checkout/             # Stripe Checkout session
    billing-portal/       # Stripe customer portal
    webhooks/stripe/      # Subscription lifecycle webhook
    auth/slack-link/      # Slack-issued magic link redemption
    internal/             # Cron-protected reconciliation jobs
src/lib/                  # Server utilities (env, supabase clients, oauth-state, stripe)
src/components/           # UI components and dashboard widgets
supabase/migrations/      # Database schema, RLS, RPCs
supabase/functions/       # Slack bot (slash commands, events, OAuth)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy [`.env.local.example`](.env.local.example) to `.env.local` and fill in every variable. Notes on the non-obvious ones:

| Variable | Required | Notes |
|---|---|---|
| `OAUTH_STATE_SECRET` | yes | Must be **identical** in Vercel env *and* Supabase Edge Function secrets — both [`src/lib/oauth-state.ts`](src/lib/oauth-state.ts) and [`supabase/functions/_shared/oauth-state.ts`](supabase/functions/_shared/oauth-state.ts) read it and signatures must interoperate. Generate with `openssl rand -hex 32`. |
| `SEAT_SYNC_SECRET` | yes | HMAC for internal seat-sync calls between Slack events and the API. Generate with `openssl rand -hex 32`. |
| `DASHBOARD_URL` | yes | The dashboard host. Single-domain setups should mirror `NEXT_PUBLIC_SITE_URL`. No trailing slash. |
| `STRIPE_WEBHOOK_SECRET` | yes (prod) | From the Stripe webhook endpoint settings. Only required where the webhook handler runs. |
| `CRON_SECRET` | auto | Auto-set by Vercel; required for `/api/internal/seat-sync-reconcile`. |

### 3. Set up Supabase

The repo includes 60+ migrations under [`supabase/migrations/`](supabase/migrations/). Apply them via the Supabase CLI or MCP:

```bash
supabase db push
```

Edge Functions for the Slack bot are deployed separately:

```bash
supabase functions deploy
```

The same `OAUTH_STATE_SECRET` and `DASHBOARD_URL` must also be set as Edge Function secrets.

### 4. Set up the Slack app

Create a Slack app at https://api.slack.com/apps with:

- **Bot scopes:** `app_mentions:read`, `chat:write`, `commands`, `im:history`, `im:read`, `im:write`, `users:read`, `users:read.email`
- **User scopes:** `identity.basic`, `identity.email`
- **Redirect URL:** `https://<your-supabase-project>.supabase.co/functions/v1/slack-oauth`
- **Slash commands and events** as configured in `supabase/functions/slack-events`

Set `NEXT_PUBLIC_SLACK_CLIENT_ID` to the resulting client ID.

### 5. Run the dev server

```bash
npm run dev
```

The app expects to be running on the URL set in `NEXT_PUBLIC_SITE_URL`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (also runs `tsc --noEmit`) |
| `npm run start` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |

## Deployment

Hosted on Vercel. The repo includes [`vercel.json`](vercel.json) for cron registration. Required production env vars are the same as `.env.local.example`. The Stripe webhook endpoint should target `/api/webhooks/stripe` and use the `pro_monthly` price lookup key.

## Security

- All workspace tables enforce Row Level Security; tenant isolation is covered by [`supabase/migrations/20260317_fix_workspace_isolation.sql`](supabase/migrations/) and follow-ups.
- Slack OAuth state is HMAC-signed with replay protection (10-minute TTL).
- Slack-issued magic links are single-use and target-path validated.

Disclosure: hello@namihr.com.

## Support

- User-facing help: [`/support`](src/app/support/page.tsx)
- Contact: hello@namihr.com
