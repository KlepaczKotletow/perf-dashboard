# Launch-readiness plan — 2026-05-27

Synthesis of three parallel audits (security, operations, commercial). Pre-launch SaaS, zero customers yet, target = ship to first paying clients.

Filter applied to every item: **only what blocks a customer signing, paying, staying, or trusting us in a procurement review.** No speculative features. No "nice to haves dressed up as P1."

---

## TL;DR

The product is more solid than expected. Slack queue semantics, RLS coverage, security page, help docs, demo videos, CSV import — all above average for pre-launch. What's missing falls into four buckets:

1. **Four 1-day security fixes** that will fail any procurement security questionnaire
2. **No signal layer** — every regression today is discovered via a customer email; the prior crypto.subtle outage was silent for months
3. **Billing & trial lifecycle is half-built** — "what happens when my trial ends?" has no answer in code or docs
4. **No procurement-friendly sales path** — no DPA download, no annual plan, no invoice/PO option, no calendar booking

Everything else is post-launch polish.

---

## P0 — Block launch until these ship (≈ 5 working days)

### Security (each is a deal-killer, each is ≤ 1 day)

| # | What | File | Fix |
|---|---|---|---|
| S1 | `dashboard-auth` OAuth callback never verifies the signed `state` HMAC → login-CSRF (attacker logs victim into attacker's Slack account). | `supabase/functions/dashboard-auth/index.ts:74-78` | Call `verifyOAuthState(returnedState)` and assert `purpose === "signin"` immediately after the existence check. Mirror what `slack-oauth/index.ts:133` already does. Add regression test. |
| S2 | Open redirect on `/auth/callback?next=…` — `NextResponse.redirect(new URL(next, request.url))` resolves `//evil.com/x` off-domain. | `src/app/auth/callback/route.ts:11,43,48` | Reuse existing `isValidTargetPath` — reject anything starting with `//` or not starting with `/`. |
| S3 | `launch_cycle` (SECURITY DEFINER, EXECUTE granted to `authenticated`) doesn't enforce same-workspace on caller-supplied `employee_id` / `reviewer_id` / `manager_id`. Referenced safety-net trigger `validate_review_assignment_tenant` is **revoked** in migrations but never defined. | `supabase/migrations/20260515_01_launch_cycle_allow_no_manager.sql:68-79`; `20260429_lockdown_security_definer_rpcs.sql:94-101` | Inside `launch_cycle`, RAISE if any supplied UUID's `workspace_id != v_workspace_id`. Materialize the missing trigger functions in a new migration. |
| S4 | Survey export route has no role check — any authenticated user (role=`user`) can download rater-attributed 360 results. The product promises this is confidential. | `src/app/api/surveys/[id]/export/route.ts:12-15` | Add `if (!isHROrAbove(workspace.role)) return 403`. Matches three sibling export routes. |
| S5 | Plaintext Slack bot/refresh tokens dual-written to `workspaces` table — Vault migration removed them, follow-up dual-write was a transition, "Task 1.8" was never landed. | `supabase/migrations/20260421_01b_dual_write_tokens.sql:49-54` | New migration: `UPDATE workspaces SET bot_token = NULL, refresh_token = NULL;` + remove dual-write inside `set_workspace_slack_tokens` RPC. |
| S6 | Non-constant-time `!==` secret compare on two reconcile endpoints (adjacent `/seat-sync` already uses HMAC). | `src/app/api/internal/seat-sync-reconcile/route.ts:19`; `src/app/api/internal/subscriptions-reconcile/route.ts:21` | `crypto.timingSafeEqual` after length check. |
| S7 | Migration drift — multiple referenced functions exist on prod but not in tracked migrations. Auditor can't bootstrap the schema from code. | `supabase/migrations/` | Dump prod, diff against `supabase db reset` on a clean DB, fill the gap. |
| S8 | Delete `/api/dev/demo-login` from production bundle (hardcoded password `AcmeDemo2026!` for a real prod account, gated only by `NODE_ENV`). | `src/app/api/dev/demo-login/route.ts` | Either delete or gate behind a server-only secret + dev build flag. |

### Operations (must exist before the first customer touches prod)

| # | What | Why | Cost |
|---|---|---|---|
| O1 | Wire **Sentry** (or equivalent — Axiom/BetterStack/Logflare) on both Next.js and Supabase Edge Functions. Capture in `dashboard/error.tsx`, every Edge Function outer catch, Stripe webhook, cron health endpoint on non-200. | Today every error is `console.error` and prayer. The `crypto.subtle.timingSafeEqual` outage was silent for months. This is the **single highest-leverage gap.** | ½ day |
| O2 | External uptime monitor on `https://namihr.com/api/health/install` at 5-min cadence with SMS + email alerts. | The existing endpoint is well-built but the Vercel daily cron in `vercel.json` only runs at 00:00 UTC and its failures vanish into Vercel logs nobody reads. | 15 min |
| O3 | New `/api/health/crons` endpoint that reads `cron.job_run_details` for the last 24h of: `nami-daily-reminders`, `nami_drain_send_queue`, `seat-sync-reconcile-hourly`, `subscriptions-reconcile-daily`, `nami_dashboard_link_tokens_cleanup`, `nami_conversation_state_cleanup`. 503 if any missing/errored. Point uptime monitor at it. | The daily reminder cron failed silently from 2026-04-17 to 2026-04-21 (4 days, no DMs sent) — see `20260421_09_fix_daily_reminders_cron.sql`. This will happen again. | 2 hrs |
| O4 | `.github/workflows/test.yml` — run `npm test` + `next build` on every PR, block merges on failure. | No CI exists. Vitest is run manually. Tests for the bugs that already cost the product (Slack signature, OAuth state, token refresh) don't even live on `main`. | 30 min |
| O5 | Port `slack-signature.test.ts` from the worktree to `supabase/functions/_shared/__tests__/`. Add tests for `oauth-state.ts` and `workspace-tokens.ts` refresh path. | These three functions are responsible for every Slack-class outage in the project's history. | 2-3 hrs |
| O6 | Send-queue DLQ visibility — after 5 attempts a row goes to `completed_at = now()` with `last_error` and nobody sees it. Add `slack_send_queue_dlq` view, expose count in `/api/health/install`, alert > 0. | A workspace whose bot token was revoked silently accumulates DLQ rows. Customer churns; founder never knows. | 1 hr |
| O7 | Unschedule the dead `deadline-reminders-daily` cron (the function it points at is a `deprecated: true` no-op). Delete the stale `[functions.stripe-webhook]` entry from `supabase/config.toml` — Stripe webhook lives at `src/app/api/webhooks/stripe`. | Drift = future foot-guns. | 15 min |
| O8 | Confirm Supabase PITR tier is on (Pro = 7d, Team = 14d). Write a one-page DR runbook to `docs/operations/disaster-recovery.md` covering: Vercel deploy rollback, Supabase PITR restore, secret rotation. | If the founder can't roll back fast, every incident becomes a postmortem. | 30 min |

### Billing & lifecycle (must exist to actually take money)

| # | What | Why | Cost |
|---|---|---|---|
| B1 | Define and implement trial-end behavior. `src/app/api/checkout/route.ts:35-39` sets `trial_period_days: 14` + `payment_method_collection: "if_required"` with **no** `trial_settings.end_behavior`. Behavior is undefined. Pick one: (a) require card up front, or (b) cancel-on-trial-end + 7-day grace + reactivation. Then build 3 reminder DMs/emails at T-7, T-3, T-1 + in-app trial countdown banner from T-7. | Procurement reviewer asks "what happens when my trial expires?" — we cannot answer today. | 1-2 days |
| B2 | Resolve the "Free indefinitely for teams ≤ 10" claim — currently promised on `src/app/page.tsx:53,112` but `user_limit` is hardcoded to 10000 in `setup/page.tsx:75` and `webhooks/stripe/route.ts:125`, with zero enforcement anywhere. Either build the enforcement (seat check, soft paywall, upgrade prompt) or strike the claim. | Misleading-marketing exposure at minimum; this will be exploited if not enforced. | ½–1 day |
| B3 | Enable Stripe Tax on Checkout: `automatic_tax: { enabled: true }`, `tax_id_collection: { enabled: true }`, `customer_update: { name: 'auto', address: 'auto' }`. | First EU customer's finance team blocks until VAT is collected/reverse-charged correctly. | 1 hr |
| B4 | Dunning workflow on `invoice.payment_failed`: Stripe Smart Retries + 3-step email + Slack DM to admin at +1d / +3d / +7d. Today the workspace silently drifts to `past_due` while DMs keep working (seat-sync route explicitly includes `past_due` in `BILLABLE_STATUSES`) → invisible churn. | Failed renewals are silent. | ½ day |
| B5 | Add annual plan (`pro_annual` lookup key, 15-20% discount). Add "Talk to sales" calendar booking (Cal.com) for invoice/PO billing on ≥ 25 seats. | Every deal > 50 seats stalls a week today because the only path is credit-card Stripe Checkout. | ½ day |

### Trust & procurement (must exist before answering the first security questionnaire)

| # | What | Why | Cost |
|---|---|---|---|
| T1 | DPA download at `/dpa` (static PDF), linked from `/security` and `/privacy`. | Today says "DPA available on request via hello@namihr.com." Procurement teams will not initiate that email — they tick "no DPA" and move on. | 1 hr |
| T2 | Subprocessors page listing Vercel, Supabase, Stripe, Slack with location + purpose + each subprocessor's DPA link. Email-list signup for change notifications (Privacy §6 promises this). | Standard procurement checklist item. | 1 hr |
| T3 | Status page (StatusPage free / Hyperping / Instatus). Even an empty shell with "no incidents" answers the question. | Procurement asks "where can I see your uptime history?" — needs a URL, not "we're working on it." | 30 min |

---

## P1 — Ship within 4 weeks of launch

### Activation & onboarding (drives trial → paid conversion)

| # | What | Where |
|---|---|---|
| A1 | Replace the no-op "Welcome" onboarding (`src/app/onboarding/onboarding-client.tsx:22-37` only flips three flags) with a real wizard: import team → assign managers → pick first cycle template → schedule kickoff DM. "First cycle launched" is the leading indicator of paid conversion. | `src/app/onboarding/` |
| A2 | Founder activation alerts — Slack DM to founder when: workspace > 5 days old with no cycle launched, no team imported, or admin not returned since day 1. The first "stuck workspace" CRM, no SaaS needed. | New Edge Function + cron |
| A3 | Bulk "Nudge all pending reviewers" button on cycles page. Today the only lever is the auto-scheduled cadence. | `src/app/dashboard/cycles/` |
| A4 | Surface `team/import` CSV import from the onboarding checklist. It's an 859-line gem hidden one click deep. | `src/app/dashboard/page.tsx:713-719` + `src/app/onboarding/` |
| A5 | "Try with sample data" button — read-only sandbox view of the Acme fixture inside the admin's workspace, so they can see populated dashboards before importing real data. | New route under `/dashboard` |

### Support (so trial users don't ghost)

| # | What | Where |
|---|---|---|
| SP1 | In-app help/contact widget (Crisp or Plain free tier — async, not live chat). "?" button on every screen. Today the only escalation is `mailto:hello@namihr.com` and trial users won't draft an email. | Layout-level component |
| SP2 | Public mirror of the 33 MDX articles at `/help` for SEO + procurement evaluation (currently locked behind `/dashboard/help`). | `content/help/` + new public route |
| SP3 | Per-employee review packet PDF export. Today's "Print to PDF" via `window.print()` is not a board-ready handoff. | `src/app/dashboard/analytics/analytics-export-button.tsx` |

### Sales / GTM

| # | What | Where |
|---|---|---|
| G1 | Replace every `mailto:hello@namihr.com` CTA with a Cal.com / Calendly booking link (pricing page, partner program, support page). 24-72h reply lag is killing inbound. | Multiple |
| G2 | ROI calculator + comparison page for Lattice (others can follow). SEO win for "Lattice alternative"; answers buyer's "why not the incumbent." | `src/app/compare/lattice/page.tsx` |
| G3 | Logo strip + 1 case study placeholder on landing page. Land first 2 customers → ship within a week. | `src/app/page.tsx` |

### Operations (less urgent than P0 ops)

| # | What | Where |
|---|---|---|
| O9 | Paginate cycles list (`src/app/dashboard/cycles/page.tsx:32-52` is unbounded — joins to every assignment row in workspace history) and replace hardcoded `.limit(10000)` in analytics (`src/app/dashboard/analytics/page.tsx:509-512`) with a materialized view. | Dashboard data layer |
| O10 | Internal `/dashboard/admin/ops` (hardcoded email gate) with five tiles: ready queue depth, DLQ count, cycles active this week, Slack sends last 24h, errors last 24h. Half a day. Situational awareness in every customer call. | New route |
| O11 | Correlation IDs on user-facing errors. `src/app/dashboard/error.tsx` shows "Something went wrong" with no ID — customer screenshots are uncorrelatable to logs. | Error boundary + log helper |

### Defense-in-depth follow-ups to P0 security

| # | What | Where |
|---|---|---|
| AU1 | Drop the `wsId` parameter from Slack interactivity read-path helpers. Always use the signature-bound `wsId` already set near `slack-interactivity/index.ts:304`. The submit path is correct; read paths still accept caller-supplied wsId from `private_metadata`. Easy to regress. | `supabase/functions/slack-interactivity/index.ts` |
| AU2 | Rate-limiting on `slack-oauth`, `slack-reinstall`, `dashboard-auth`. Attacker firing junk callbacks burns the Slack token-exchange API quota for the whole Nami Slack app. Upstash Redis or Deno KV token bucket. | Edge Functions |
| AU3 | Regression test that every SECURITY DEFINER RPC enumerated in `20260429_lockdown_security_definer_rpcs.sql` rejects a forged target-user UUID. | New test file |

---

## P2 — Defer until 5+ paying customers

- Feature flags / per-workspace canary (currently every release ships to everyone)
- Internationalization (Polish/EU localization)
- Mobile dashboard polish (calibration grid on phone)
- Global search across employees/reviews/cycles
- Board-ready chart export (PowerPoint / PNG copy)
- Admin UI for notification cadence customization
- External HR-partner invite without Slack workspace membership
- SOC 2 Type II — start observation period now via Drata/Vanta, expect 6–9 months to a report

---

## What's solid — don't regress

- `src/app/security/page.tsx` — 657 lines, honest, names what's not certified, lists subprocessors, gives RPO/RTO targets. Best pre-launch security page seen.
- Slack send-queue semantics — exponential backoff, `FOR UPDATE SKIP LOCKED`, attempt cap. Migrations `20260416_20_*` and `20260416_24_*`.
- Slack reinstall + OAuth state signing (`slack-oauth/index.ts` does verify state correctly).
- Help center (33 MDX articles, 11 categories) at `content/help/`.
- Landing-page recorded demos — 5 .mp4/.webm/.gif clips with poster fallback.
- CSV import flow — 859 lines of careful UX, fuzzy column matching, manager linking.
- RLS lockdown discipline (`20260429_lockdown_security_definer_rpcs.sql` and v2).
- Migration discipline — no `DROP COLUMN`, no destructive `ALTER` across 66 migrations.

---

## Suggested 10-day sequence (solo founder)

| Day | Block |
|---|---|
| 1 | Security S1, S2, S4, S6, S8 (the 1-hour-each ones) |
| 2 | Security S3, S5, S7 (the half-day-each ones) |
| 3 | Ops O1 (Sentry) + O4 (CI) + O5 (tests) |
| 4 | Ops O2 + O3 + O6 + O7 + O8 |
| 5 | Billing B1 (trial end) + B2 (free-tier decision) |
| 6 | Billing B3 (Stripe Tax) + B4 (dunning) + B5 (annual + sales calendar) |
| 7 | Trust T1 + T2 + T3 |
| 8 | Activation A1 (real wizard) |
| 9 | Activation A2 + A3 + A4 + A5 |
| 10 | Sales G1 + G2 + Support SP1 |

After day 10: open to 5–10 design-partner customers at heavy discount, watch the signal layer, ship P2 reactively from real customer pain.
