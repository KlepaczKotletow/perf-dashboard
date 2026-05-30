# Launch-readiness supplement — 2026-05-28

Companion to [`2026-05-27-launch-readiness.md`](2026-05-27-launch-readiness.md). **That plan still stands** — nothing was shipped against it in the last 24h (zero commits since the plan landed). This supplement adds gaps the prior audits missed, found in a focused second pass on four areas: GDPR data lifecycle, DB correctness, billing/cancel lifecycle, and Slack/email platform.

Same filter as before: **only what blocks a customer signing, paying, staying, or trusting us.** Items below are ordered by launch impact, not by area.

---

## Critical adds — must ship before first paying customer

These belong alongside yesterday's S-series / O-series P0s. Each is independently verified.

### NEW-1: `slack_interactivity_debug` is a public table with RLS disabled
- **Severity:** Cross-tenant data leak readable with the anon key. Day-one pen-test fail.
- **What:** Public table exposed to PostgREST, `rowsecurity=false`. Contains raw Slack interactivity payloads (user ids, action text, button clicks across every workspace).
- **Evidence:** Supabase advisor `rls_disabled_in_public` ERROR; `pg_tables.rowsecurity=false` for `public.slack_interactivity_debug`.
- **Fix:** New migration — `ALTER TABLE public.slack_interactivity_debug ENABLE ROW LEVEL SECURITY;` Add deny-all policy, or drop the table if it was meant to be debug-only.
- **Cost:** 15 min.

### NEW-2: Stripe webhook has zero idempotency table
- **Severity:** Stripe retries every webhook on 5xx and can replay on demand. We will reprocess `customer.subscription.deleted` → multiple cancel side-effects; future audit-log or email side-effects will double-fire.
- **What:** Handler dispatches every event ID to `syncSubscriptionState` / row UPDATEs with no dedupe.
- **Evidence:** `src/app/api/webhooks/stripe/route.ts:32-39,61-136` — no event-ID check anywhere.
- **Fix:** `processed_stripe_events(id text primary key, processed_at timestamptz)`. Insert-on-conflict-do-nothing as first action, bail on conflict.
- **Cost:** 2 hrs.

### NEW-3: Out-of-order Stripe webhooks silently drop signups
- **Severity:** Real signups fail invisibly. Customer pays, lands on /setup, has no idea why their workspace isn't connected.
- **What:** Stripe does **not** guarantee event order. If `customer.subscription.updated` arrives before `checkout.session.completed`, `syncSubscriptionState` does `UPDATE … WHERE stripe_subscription_id = X` against a non-existent row — zero rows affected, state lost. The handler logs "ok" and Stripe moves on.
- **Evidence:** `src/app/api/webhooks/stripe/route.ts:63-67,100-131`; `src/lib/subscription-sync.ts:18-28`.
- **Fix:** Convert `subscriptions` writes to `UPSERT` keyed on `stripe_subscription_id`, with workspace lookup retried in a fallback path.
- **Cost:** 2 hrs.

### NEW-4: Cancellation has zero downstream effect — bot keeps running, DMs keep flowing
- **Severity:** Cancelled customer keeps being processed for PII; if you ever email a refund-period notice they'll counter-claim "but you kept using my data." Liability + chargeback magnet.
- **What:** `customer.subscription.deleted` only flips `subscriptions.status='canceled'`. `BILLABLE_STATUSES` is only consulted by `seat-sync/route.ts:11`. Nothing in `slack-events`, `slack-commands`, `slack-interactivity`, `send-queue`, or the daily-reminders cron gates on subscription state. A cancelled workspace keeps receiving DMs, accepting reviews, processing surveys.
- **Evidence:** `src/app/api/webhooks/stripe/route.ts:68-77`; grep `BILLABLE_STATUSES|subscription_status` across `supabase/functions/` returns zero hits in any runtime path.
- **Fix:** Wrap the top of `nami-bot` send-queue drain and `slack-events`/`slack-commands` entry points in a `subscription_active(workspace_id)` check (default-allow for trialing/active/past_due during dunning grace, deny once cancelled/unpaid).
- **Cost:** ½ day.

### NEW-5: Privacy policy promises 30-day deletion. No code exists.
- **Severity:** Procurement reads the privacy policy. They will ask "show me the cron." We can't.
- **What:** Privacy §8.2 promises "permanently and irreversibly deleted" 30 days after cancellation. Zero cron / function / column / RPC implements this. Cancelled workspaces sit in the DB indefinitely.
- **Evidence:** `src/app/privacy/page.tsx:513-518`; no migration / function references workspace purge. `git grep -i "deletion_scheduled\|purge\|workspace_delete"` is empty.
- **Fix:** `workspaces.deletion_scheduled_at` column set on `subscription.deleted`. Nightly cron purges anything past +30d. Admin reactivation clears the flag.
- **Cost:** ½ day. **Pairs with NEW-9 (workspace-delete UI).**

### NEW-6: Slack `app_uninstalled` doesn't purge — keeps employees, reviews, comments forever
- **Severity:** GDPR Art. 5(1)(e) storage-limitation breach the moment the customer relationship ends. Procurement-blocking once flagged.
- **What:** Handler at `supabase/functions/slack-events/index.ts:791-836` only nulls Slack tokens and flips `requires_reinstall=true`. All employee PII, review responses, ratings, goals, comments retained indefinitely with no controller relationship.
- **Fix:** Treat uninstall as "schedule purge at +30 days, allow reinstall to cancel." Single column + cron — same machinery as NEW-5.
- **Cost:** Shared with NEW-5.

### NEW-7: Anonymous 360 ratings are traceable via `participant_id`; no min-N before aggregation
- **Severity:** `/security` page explicitly promises rater anonymity. With N=2 raters, HR can deduce who said what. If a customer or journalist surfaces this, it's a trust-destruction event.
- **What:** `survey_responses.participant_id` is a non-null FK to `survey_participants.user_id`. RLS hides it from HR today, but service-role queries, DB dumps, and any future RPC expose rater identity. Analytics aggregator has no `if rater_count < 3 then suppress` guard.
- **Evidence:** schema (introspected via Supabase MCP); `src/app/api/surveys/[id]/export/route.ts` has no min-N check; `src/app/security/page.tsx` makes the explicit promise.
- **Fix:** (a) After survey close, drop or hash `participant_id` (keep group-membership for participation tracking, lose the link). (b) Enforce `min_rater_count >= 3` before any per-subject 360 render, both in export and dashboard. Show "not enough responses to display anonymously" UX state.
- **Cost:** 2 days. The bigger lift is the analytics-side suppression UX, not the data change.

### NEW-8: No per-employee DM opt-out — `/nami pause` doesn't exist
- **Severity:** Slack App Directory will reject. EU works-council complaint risk. Customer admin gets revolt when employees can't snooze a forced HR bot.
- **What:** `employees.notification_prefs.mode` + snooze logic is implemented and honored in `nami-bot/index.ts:171-189`, but **only admins can change it via dashboard**. The only registered slash command is `/kudos` (`slack-commands/index.ts:299`). No `/nami pause`, no App Home toggle, no per-user UI.
- **Fix:** Add `/nami pause 1d|1w|off` + simple App Home view with three buttons (pause 1 day / pause 1 week / resume). Write to existing `notification_prefs` column.
- **Cost:** ½ day.

### NEW-9: No customer-initiated workspace deletion (GDPR Art. 17)
- **Severity:** Right-to-be-forgotten is non-negotiable for EU customers. Today the only way is a manual `DELETE` by the founder on the customer's typed request.
- **What:** Zero UI or API to delete a workspace. `src/app/dashboard/settings/settings-client.tsx` has no danger zone. Only existing delete path is the reinstall edge case in `slack-oauth/index.ts:270`.
- **Fix:** Settings → Danger Zone → "Delete workspace" with typed-confirmation modal. Calls a new RPC that cascades to all workspace-scoped tables (use `(SELECT table_name FROM information_schema.tables WHERE column_name='workspace_id')` to script the cascade — there are ~20 tables). Audit-log the action.
- **Cost:** 1–2 days.

### NEW-10: No transactional email — blocks every B1/B4/T-series item in yesterday's plan
- **Severity:** Yesterday's plan budgeted 1.5 days for B1 (trial reminders) + B4 (dunning) assuming email exists. It doesn't.
- **What:** Zero email provider integrated. No Resend / Postmark / SendGrid / SES / Mailgun in package.json. No `sendEmail` helper anywhere. No SMTP code.
- **Fix:** Resend SDK (cheapest, EU region, clean DKIM setup) + 5 templates: trial-ending-T7, trial-ending-T3, trial-ending-T1, payment-failed, account-canceled. One helper at `src/lib/email/send.ts`. Pair with **NEW-11**.
- **Cost:** 1 day for infra + 4 hrs for templates.

### NEW-11: `namihr.com` has no documented SPF / DKIM / DMARC posture
- **Severity:** Every reminder email lands in spam. Procurement security scanner flags `namihr.com` as misconfigured.
- **What:** No DNS docs in repo. `hello@namihr.com` is per `MEMORY.md` "the only outbound address" — likely a Workspace forward, not an authenticated sending domain.
- **Fix:** Add SPF (`v=spf1 include:resend.com -all` or whatever provider), DKIM CNAME, DMARC `p=reject` after warm-up. Document in `docs/operations/dns.md`. Send 10–20 test emails over 3 days before flipping DMARC to enforcement.
- **Cost:** 2 hrs DNS + 3 days warm-up clock.

---

## Important adds — within first 2 weeks of launch

These don't block launch but each one is a real procurement / churn / trust risk that compounds with scale.

| # | Title | Where | Fix |
|---|---|---|---|
| NEW-12 | **Audit log doesn't cover billing or destructive actions** — only logs cycle status, calibration, role changes. Missing: subscription transitions, employee deactivation, CSV import/delete, cycle deletion, settings changes, data exports. SOC2 CC6.1 + procurement checklist item. | `supabase/migrations/20260416_12_audit_log.sql:36-110` | Add triggers / explicit log writes. ½ day. |
| NEW-13 | **Per-employee data export** (GDPR Art. 15/20). Workspace admin can export, individual employee cannot self-serve "give me everything you have on me." | No `src/app/api/me/export` route. | JSON bundle endpoint: own user row + own responses + own assignments. 1 day. |
| NEW-14 | **Offboarded employee anonymization.** `deactivate-button.tsx:32` only flips `employee_status`. Their `slack_email`, `slack_name`, written `review_responses.comment`, goals retained verbatim and queryable by HR. | `src/app/dashboard/team/[id]/deactivate-button.tsx:32` | `anonymize_user` RPC: null email/name/avatar, retain aggregated ratings. Optional toggle on deactivate. 1 day. |
| NEW-15 | **Refund clause vs cancel UI drift.** Terms §4.7 says "no partial-period refunds"; §4.8 says "case-by-case." Stripe billing-portal default UX shows "cancel immediately" which implies pro-rata. Chargeback risk. | `src/app/terms/page.tsx:200-205,236-242`; `src/app/api/billing-portal/route.ts` uses Stripe defaults | Configure Stripe Portal explicitly: "Cancel at end of period" only. Reconcile Terms wording. 1 hr. |
| NEW-16 | **Log lines leak PII into Supabase log retention (60-90d, outside customer control).** `dashboard-auth/index.ts:180` logs plaintext email; `slack-oauth/index.ts:56-92` logs Slack identity error contents. | `supabase/functions/dashboard-auth/index.ts:180`; `supabase/functions/slack-oauth/index.ts:56,74,92` | Redact to domain only (`u***@example.com`) or hash. 1 hr. |
| NEW-17 | **`audit_log` / `notification_log` / `slack_send_queue` grow forever.** Only `link_tokens`, `conversation_states`, `slack_processed_events` have cleanup crons. `slack_send_queue.payload` JSONB contains employee names + review fragments. Storage-limitation drift. | No DELETE/cron for the three tables in `supabase/migrations/` | One cron: `delete from slack_send_queue where completed_at < now()-90d`; `audit_log`/`notification_log` retain 1 year. 2 hrs. |
| NEW-18 | **`progress_cycle_phases` fire-and-forget storms.** Every cycle-detail page render kicks an un-awaited SECURITY DEFINER RPC. No dedupe. Bot crawler + multiple admins = N concurrent phase-transition writes. Race + pool exhaustion at single-digit workspaces. | `src/app/dashboard/cycles/[id]/page.tsx:228-232` | Move to 5-min `pg_cron` over existing `idx_cycles_nami_pending` index. 2 hrs. |
| NEW-19 | **Analytics heatmap silently truncates at 10k rows.** `review_responses` has no `workspace_id` column; analytics fetches `.limit(10000)` with no workspace filter, then filters in Node via cycle-id set. Already broken at ~50 workspaces × 200 reviews — *correctness*, not perf. | `src/app/dashboard/analytics/page.tsx:508-512` | Denormalize `workspace_id` onto `review_responses`, backfill, index `(workspace_id, cycle_id)`, update RLS to use the direct column. 4 hrs. |
| NEW-20 | **Auth DB pool hard-capped at 10 absolute connections** (Supabase advisor: `auth_db_connections_absolute`). First Monday-9am team-wide login storm looks like an outage. | Supabase dashboard auth settings | Toggle from "absolute 10" to "percentage strategy." 5 min. |

---

## Deferrable — only after 3+ paying customers

| # | Title | Why deferred |
|---|---|---|
| NEW-21 | Slack Enterprise Grid support (`enterprise_id`, `is_enterprise_install`, org-token branching). | No Enterprise prospect in pipeline yet. Schema-only migration when one appears. 2 days when needed. |
| NEW-22 | Slack App Directory listing (`manifest.json`, screenshots, long description). | Slack review is 2–4 weeks — *start now if you want listing at launch*, otherwise post-launch. ½ day. |
| NEW-23 | Per-workspace fairness in send-queue drain (currently global FIFO; one 1000-DM cycle starves other tenants for 40+ min). | Bites only when 3+ paying customers coexist and one launches a large cycle simultaneously. ½ day. |
| NEW-24 | Drop 35 unused indexes + add 8 missing FK indexes (advisor findings). Write amplification today; FK gaps cause seq-scan on workspace cascade-delete (becomes relevant once NEW-9 ships). | 2 hrs cleanup; do once before the first large customer. |
| NEW-25 | Collapse multiple permissive RLS policies on `calibration_notes` + `rating_scales` (2× planner cost today, mostly invisible). | 1 hr. |
| NEW-26 | Drop send-queue drain cron from `* * * * *` to `*/2 * * * *` and add `cron.job_run_details` pruner. | Disk creep is slow. 30 min. |

---

## How this changes the 10-day sequence

Insert these blocks into yesterday's plan. The two are not redundant — combine them.

| Day | Block (combined) |
|---|---|
| 1 | **NEW-1** (RLS, 15 min) → yesterday's S1, S2, S4, S6, S8 |
| 2 | Yesterday's S3, S5, S7 → **NEW-2, NEW-3** (Stripe idempotency + ordering) |
| 3 | Yesterday's O1 (Sentry) + O4 (CI) + O5 (tests) |
| 4 | Yesterday's O2 + O3 + O6 + O7 + O8 |
| 5 | **NEW-10 + NEW-11** (email infra + DNS — *prerequisite for B1*) |
| 6 | Yesterday's B1 (trial end) + B2 (free tier) **+ NEW-4** (gate runtime on sub status) |
| 7 | Yesterday's B3 + B4 + B5 **+ NEW-15** (refund / portal reconcile) |
| 8 | **NEW-5 + NEW-6 + NEW-9** (retention promise + uninstall purge + workspace-delete UI — single shared cron) |
| 9 | **NEW-7** (anon 360 + N≥3 suppression) + **NEW-8** (`/nami pause`) |
| 10 | Yesterday's T1 + T2 + T3 (trust pages) + **NEW-12** (audit-log scope) + **NEW-16** (PII redaction) |

Days 11–14 (week 3, before invoicing first customer): NEW-13, NEW-14, NEW-17, NEW-18, NEW-19, NEW-20 plus yesterday's A-series activation and SP-series support.

---

## What I'm NOT recommending

Held back on purpose — would be feature-creep at this stage:

- **Audit-log UI for customer admins.** Internal log is enough until a customer asks.
- **Field-level encryption / customer-managed keys.** Only matters at enterprise sales. Not a launch blocker.
- **Webhook signature verification on outbound webhooks to customer Slack.** We don't send any outbound webhooks to customer systems.
- **Multi-region failover.** Single Supabase region (eu-west-1, verified) is fine for v1; PITR + Vercel rollback is the DR story.
- **A separate "Nami status" Slack workspace per customer.** Overengineering — yesterday's T3 (status page) covers it.
- **GDPR Records of Processing Activities (ROPA).** Required if you process EU data at scale; for now the privacy policy + DPA (T1) is sufficient. Revisit at 20+ customers.

---

## Verification of yesterday's plan

Spot-checked. All P0 items still apply:

- S1–S8 security items: code unchanged, still open
- O1 (Sentry): not wired (`grep -r "sentry\|@sentry" src/ supabase/functions/` empty)
- B1 trial-end: `src/app/api/checkout/route.ts:35-39` still missing `trial_settings.end_behavior`
- T1–T3: no `/dpa`, no `/subprocessors`, no status page

Don't relax the yesterday plan because today's supplement adds more. The supplement *amplifies* it — both ship together or the launch is brittle.
