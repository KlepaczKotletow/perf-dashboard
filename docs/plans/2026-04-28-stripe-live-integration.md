# Stripe live-mode integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the NamiHR Stripe account (live mode) to the app so paid Pro subscriptions work end-to-end — checkout, 14-day no-card trial, ongoing per-seat billing synced via Postgres trigger, lifecycle webhook, and rebuilt billing dashboard.

**Architecture:** Single product (`Nami`) with one $5/seat/month price. `/api/checkout` redirects to Stripe Checkout with `trial_period_days: 14` and `payment_method_collection: "if_required"`. A Postgres trigger on the `users` table fires `pg_net.http_post` to `/api/internal/seat-sync` whenever the billable-seat count changes, which calls `stripe.subscriptions.update` with proration. A signed webhook at `/api/webhooks/stripe` keeps the local `subscriptions` table in sync with Stripe (cancellations, payment failures, renewals). Tenant isolation: every webhook write filters by the unique `stripe_subscription_id`; seat-sync HMAC ensures only the trigger can call it.

**Tech Stack:** Next.js 16, Supabase (Postgres + RLS), Stripe Node SDK 20, Vitest, pg_net.

**Design doc:** [docs/plans/2026-04-28-stripe-live-integration-design.md](./2026-04-28-stripe-live-integration-design.md)

**Stripe account:** NamiHR (`acct_1TR8PrRDOszymcTK`) — verified empty (zero products, zero prices).

---

## Conventions

- Test framework: Vitest. Run with `npm test` (one-shot) or `npm run test:watch`.
- Run a single file: `npm test -- src/path/file.test.ts`
- Lint: `npm run lint`. Build: `npm run build`.
- Commit format: matches existing repo style (`type: short summary`, lower-case, no body unless needed). Use `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Stripe MCP: server `mcp__d23d7e3d-a2d7-411b-a8ee-6eb3ad63db20__*`. Already authenticated to NamiHR live account.
- Supabase MCP: server `mcp__e1e21cfb-a8b7-4fda-9a99-9f6b1a80d231__*`. Project ref `zhfvxfvmdlpdfgxrwtdn`.
- For Stripe MCP write operations in live mode, use `stripe_api_execute` rather than the convenience tools when the convenience tool doesn't expose the parameter you need (e.g., `lookup_key` on prices).

---

## Phase A — Foundation (no live-mode impact)

### Task 1: Add a typed service-role Supabase helper

The webhook handler and seat-sync endpoint both need a service-role client. The repo currently inlines `createClient(URL, SERVICE_ROLE_KEY)` in [setup/page.tsx](src/app/setup/page.tsx). Extract once.

**Files:**
- Modify: `src/lib/supabase-server.ts`

**Step 1: Add `createServiceRoleClient` export**

Append to the bottom of `src/lib/supabase-server.ts`:

```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — call sites are responsible for
 * scoping queries by tenant identifier (workspace_id / stripe_subscription_id).
 * Never expose to the browser; only use in route handlers and server actions.
 */
export function createServiceRoleClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service-role operations");
  }
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

If `createClient` is already imported at the top of the file under a different name, use the existing import instead of adding a second one. Read the file first to check.

**Step 2: Run lint + tests to verify nothing broke**

```bash
npm run lint
npm test
```
Expected: PASS.

**Step 3: Commit**

```bash
git add src/lib/supabase-server.ts
git commit -m "lib: add createServiceRoleClient helper for webhook + seat-sync routes"
```

---

### Task 2: Extend `env.ts` with new optional vars

Add the two new server-only secrets. Keep `STRIPE_SECRET_KEY` `optional` for now (we'll promote to `required` in Task 19 once everything is wired).

**Files:**
- Modify: `src/lib/env.ts`

**Step 1: Add fields to `EnvShape` and `env` singleton**

Read [env.ts](src/lib/env.ts), then add two entries:

```ts
type EnvShape = {
  // ... existing fields
  STRIPE_WEBHOOK_SECRET: string | undefined;
  SEAT_SYNC_SECRET: string | undefined;
};

export const env: EnvShape = {
  // ... existing fields
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET"),
  SEAT_SYNC_SECRET: optional("SEAT_SYNC_SECRET"),
};
```

**Step 2: Update `.env.local.example`**

Read [.env.local.example](.env.local.example), then replace the Stripe stanza with:

```
# Stripe (NamiHR live account)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
# Random 32-byte hex; generate with: openssl rand -hex 32
SEAT_SYNC_SECRET=
```

Drop `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Checkout-redirect flow doesn't need it.

**Step 3: Verify type-check passes**

```bash
npx tsc --noEmit
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/env.ts .env.local.example
git commit -m "env: add STRIPE_WEBHOOK_SECRET and SEAT_SYNC_SECRET (still optional)"
```

---

### Task 3: Extract `getStripe()` to `src/lib/stripe.ts`

`getStripe` currently lives in [/api/checkout](src/app/api/checkout/route.ts), [/api/billing-portal](src/app/api/billing-portal/route.ts), and [/setup/page.tsx](src/app/setup/page.tsx). Three copies, all slightly different. Centralize.

**Files:**
- Create: `src/lib/stripe.ts`
- Modify: `src/app/api/checkout/route.ts` (delete local `getStripe`, import shared one)
- Modify: `src/app/api/billing-portal/route.ts` (same)
- Modify: `src/app/setup/page.tsx` (same)

**Step 1: Write `src/lib/stripe.ts`**

```ts
import Stripe from "stripe";

/**
 * Throws a recognisable, generic error if STRIPE_SECRET_KEY is missing
 * so callers can return "Payments not configured" without leaking SDK
 * internals. The `code` is checked by /api/checkout.
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    const e = new Error("Payments not configured");
    (e as Error & { code?: string }).code = "stripe_not_configured";
    throw e;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-01-28.clover",
  });
}
```

**Step 2: Replace local `getStripe` in the three files**

In each: remove the local `function getStripe() { ... }`, replace `import Stripe from "stripe"` with `import { getStripe } from "@/lib/stripe"` (keep `import type Stripe from "stripe"` where types are still used — e.g., setup/page.tsx uses `Stripe.Checkout.Session`).

**Step 3: Run tests**

```bash
npm test -- src/app/api/checkout/__tests__/route.test.ts
```
Expected: PASS (the existing mock of `'stripe'` covers the new helper too).

**Step 4: Commit**

```bash
git add src/lib/stripe.ts src/app/api/checkout/route.ts src/app/api/billing-portal/route.ts src/app/setup/page.tsx
git commit -m "lib: extract getStripe to a single helper used by checkout, portal, setup"
```

---

## Phase B — Webhook handler (TDD)

### Task 4: Webhook test scaffolding + signature verification

**Files:**
- Create: `src/app/api/webhooks/stripe/__tests__/route.test.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`

**Step 1: Write the failing test for signature verification**

```ts
// src/app/api/webhooks/stripe/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockConstructEvent = vi.fn()
vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  }))
  return { default: MockStripe }
})

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
  maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
}
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => mockSupabase,
}))

import { POST } from '../route'

function makeRequest(body: string, signature: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature !== null) headers['stripe-signature'] = signature
  return new NextRequest('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers,
  })
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await POST(makeRequest('{}', null))
    expect(res.status).toBe(400)
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const res = await POST(makeRequest('{}', 'bogus'))
    expect(res.status).toBe(400)
  })

  it('returns 200 and ignores unknown event types', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.created',
      data: { object: {} },
    })
    const res = await POST(makeRequest('{}', 'valid'))
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run to confirm it fails**

```bash
npm test -- src/app/api/webhooks/stripe/__tests__/route.test.ts
```
Expected: FAIL — `Cannot find module '../route'`.

**Step 3: Implement minimal route to pass the three tests**

```ts
// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error(`Stripe webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event) {
  const supabase = createServiceRoleClient();
  switch (event.type) {
    // event handlers added in Tasks 5, 6, 7
    default:
      // Unknown / ignored event types — return 200 to avoid Stripe retries.
      return;
  }
  // Suppress unused-variable warning for skeleton implementation.
  void supabase;
}
```

**Step 4: Run tests — verify they pass**

```bash
npm test -- src/app/api/webhooks/stripe/__tests__/route.test.ts
```
Expected: PASS (3/3).

**Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/__tests__/route.test.ts src/app/api/webhooks/stripe/route.ts
git commit -m "feat(webhooks): add Stripe webhook handler scaffold with signature verification"
```

---

### Task 5: Webhook — `customer.subscription.updated` and `.deleted`

**Files:**
- Modify: `src/app/api/webhooks/stripe/__tests__/route.test.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Step 1: Add failing tests**

Append inside the `describe` block:

```ts
it('updates subscription row on customer.subscription.updated', async () => {
  mockConstructEvent.mockReturnValue({
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_123',
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: 1735689600,
        items: { data: [{ price: { lookup_key: 'pro_monthly' } }] },
      },
    },
  })
  const res = await POST(makeRequest('{}', 'valid'))
  expect(res.status).toBe(200)
  expect(mockSupabase.update).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: expect.any(String),
    }),
  )
  expect(mockSupabase.eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
})

it('marks subscription canceled on customer.subscription.deleted', async () => {
  mockConstructEvent.mockReturnValue({
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_456' } },
  })
  const res = await POST(makeRequest('{}', 'valid'))
  expect(res.status).toBe(200)
  expect(mockSupabase.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'canceled' }),
  )
  expect(mockSupabase.eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_456')
})
```

**Step 2: Run — confirm both fail**

```bash
npm test -- src/app/api/webhooks/stripe/__tests__/route.test.ts
```
Expected: FAIL on both new tests (handlers not implemented).

**Step 3: Implement the two handlers**

In `route.ts`, replace the `switch (event.type)` body:

```ts
switch (event.type) {
  case "customer.subscription.updated": {
    const sub = event.data.object as Stripe.Subscription;
    await supabase
      .from("subscriptions")
      .update({
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", sub.id);
    return;
  }
  case "customer.subscription.deleted": {
    const sub = event.data.object as Stripe.Subscription;
    await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", sub.id);
    return;
  }
  default:
    return;
}
```

**Step 4: Run — verify pass**

```bash
npm test -- src/app/api/webhooks/stripe/__tests__/route.test.ts
```
Expected: PASS (5/5).

**Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/__tests__/route.test.ts src/app/api/webhooks/stripe/route.ts
git commit -m "feat(webhooks): handle subscription updated + deleted"
```

---

### Task 6: Webhook — invoice events (`payment_failed`, `payment_succeeded`)

**Files:**
- Modify: `src/app/api/webhooks/stripe/__tests__/route.test.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Step 1: Add failing tests**

```ts
it('marks subscription past_due on invoice.payment_failed', async () => {
  mockConstructEvent.mockReturnValue({
    type: 'invoice.payment_failed',
    data: { object: { subscription: 'sub_789' } },
  })
  const res = await POST(makeRequest('{}', 'valid'))
  expect(res.status).toBe(200)
  expect(mockSupabase.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'past_due' }),
  )
  expect(mockSupabase.eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_789')
})

it('reactivates subscription on invoice.payment_succeeded', async () => {
  mockConstructEvent.mockReturnValue({
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        subscription: 'sub_999',
        period_end: 1735689600,
      },
    },
  })
  const res = await POST(makeRequest('{}', 'valid'))
  expect(res.status).toBe(200)
  expect(mockSupabase.update).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'active',
      current_period_end: expect.any(String),
    }),
  )
  expect(mockSupabase.eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_999')
})
```

**Step 2: Run — confirm fail**

```bash
npm test -- src/app/api/webhooks/stripe/__tests__/route.test.ts
```
Expected: FAIL on both new tests.

**Step 3: Implement handlers**

Add cases above `default:`:

```ts
case "invoice.payment_failed": {
  const inv = event.data.object as Stripe.Invoice;
  if (!inv.subscription) return;
  const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription.id;
  await supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId);
  return;
}
case "invoice.payment_succeeded": {
  const inv = event.data.object as Stripe.Invoice;
  if (!inv.subscription) return;
  const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription.id;
  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_end: new Date(inv.period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subId);
  return;
}
```

**Step 4: Run — verify pass**

```bash
npm test -- src/app/api/webhooks/stripe/__tests__/route.test.ts
```
Expected: PASS (7/7).

**Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/__tests__/route.test.ts src/app/api/webhooks/stripe/route.ts
git commit -m "feat(webhooks): handle invoice payment failed/succeeded"
```

---

### Task 7: Webhook — `checkout.session.completed` safety net

The `/setup` page already creates the `subscriptions` row when the customer is redirected. The webhook is the safety net for browsers that die mid-redirect. Both flows must be **idempotent** — if the row already exists for a given `stripe_subscription_id`, we don't insert a duplicate.

**Files:**
- Modify: `src/app/api/webhooks/stripe/__tests__/route.test.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Step 1: Add failing tests**

```ts
it('inserts subscription row on checkout.session.completed when not present', async () => {
  mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  mockConstructEvent.mockReturnValue({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        subscription: 'sub_new',
        customer: 'cus_new',
        customer_email: 'admin@acme.com',
        metadata: { plan: 'pro' },
      },
    },
  })
  const res = await POST(makeRequest('{}', 'valid'))
  expect(res.status).toBe(200)
  expect(mockSupabase.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      stripe_subscription_id: 'sub_new',
      stripe_customer_id: 'cus_new',
      stripe_customer_email: 'admin@acme.com',
      plan: 'pro',
      status: 'trialing',
    }),
  )
})

it('skips insert on checkout.session.completed when row exists', async () => {
  mockSupabase.maybeSingle.mockResolvedValueOnce({
    data: { id: 'existing-id' },
    error: null,
  })
  mockConstructEvent.mockReturnValue({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_2',
        subscription: 'sub_existing',
        customer: 'cus_existing',
      },
    },
  })
  const res = await POST(makeRequest('{}', 'valid'))
  expect(res.status).toBe(200)
  expect(mockSupabase.insert).not.toHaveBeenCalled()
})
```

**Step 2: Run — confirm fail**

```bash
npm test -- src/app/api/webhooks/stripe/__tests__/route.test.ts
```

**Step 3: Implement**

Add a case above `default:`:

```ts
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  const subId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;
  if (!subId) return;

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();

  if (existing) return;

  const customerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id || "";

  await supabase.from("subscriptions").insert({
    stripe_subscription_id: subId,
    stripe_customer_id: customerId,
    stripe_customer_email: session.customer_email || "",
    plan: session.metadata?.plan || "pro",
    status: "trialing",
    user_limit: 10000,
    setup_token: crypto.randomUUID(),
  });
  return;
}
```

**Step 4: Run — verify pass**

```bash
npm test -- src/app/api/webhooks/stripe/__tests__/route.test.ts
```
Expected: PASS (9/9).

**Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/__tests__/route.test.ts src/app/api/webhooks/stripe/route.ts
git commit -m "feat(webhooks): idempotent checkout.session.completed safety net"
```

---

## Phase C — Per-seat sync endpoint (TDD)

### Task 8: `/api/internal/seat-sync` — HMAC verification + count + Stripe update

**Files:**
- Create: `src/lib/seat-sync.ts` (HMAC helper + sync function — testable in isolation)
- Create: `src/app/api/internal/seat-sync/__tests__/route.test.ts`
- Create: `src/app/api/internal/seat-sync/route.ts`

**Step 1: Write `src/lib/seat-sync.ts`**

```ts
import crypto from "node:crypto";

export function signSeatSync(workspaceId: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify({ workspace_id: workspaceId }))
    .digest("hex");
}

export function verifySeatSync(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
```

**Step 2: Write the failing test**

```ts
// src/app/api/internal/seat-sync/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { signSeatSync } from '@/lib/seat-sync'

const mockSubscriptionsUpdate = vi.fn()
const mockSubscriptionsRetrieve = vi.fn()
vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    subscriptions: {
      update: mockSubscriptionsUpdate,
      retrieve: mockSubscriptionsRetrieve,
    },
  }))
  return { default: MockStripe }
})

const mockChain = {
  from: vi.fn(() => mockChain),
  select: vi.fn(() => mockChain),
  eq: vi.fn(() => mockChain),
  is: vi.fn(() => mockChain),
  not: vi.fn(() => mockChain),
  maybeSingle: vi.fn(),
}
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => mockChain,
}))

import { POST } from '../route'

const SECRET = 'test-secret-12345'

function makeRequest(workspaceId: string, signature?: string) {
  const body = JSON.stringify({ workspace_id: workspaceId })
  return new NextRequest('http://localhost:3000/api/internal/seat-sync', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-Seat-Sync-Signature': signature ?? signSeatSync(workspaceId, SECRET),
    },
  })
}

describe('POST /api/internal/seat-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    process.env.SEAT_SYNC_SECRET = SECRET
  })

  it('rejects requests without a signature header', async () => {
    const req = new NextRequest('http://localhost:3000/api/internal/seat-sync', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: 'ws-1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('rejects requests with an invalid signature', async () => {
    const res = await POST(makeRequest('ws-1', 'a'.repeat(64)))
    expect(res.status).toBe(401)
  })

  it('returns 200 noop when workspace has no subscription row', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const res = await POST(makeRequest('ws-no-sub'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 noop when subscription is canceled', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { stripe_subscription_id: 'sub_x', status: 'canceled' },
      error: null,
    })
    const res = await POST(makeRequest('ws-canceled'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled()
  })

  it('updates Stripe quantity to billable seat count', async () => {
    // First maybeSingle: subscription row
    mockChain.maybeSingle
      .mockResolvedValueOnce({
        data: { stripe_subscription_id: 'sub_active', status: 'active' },
        error: null,
      })
    // Mock count query: chain ends with .not().is() returning {count: 7}
    mockChain.is.mockReturnValueOnce(
      Promise.resolve({ count: 7, error: null }) as never,
    )
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_1', quantity: 1 }] },
    })

    const res = await POST(makeRequest('ws-active'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_active', {
      items: [{ id: 'si_1', quantity: 7 }],
      proration_behavior: 'create_prorations',
    })
  })

  it('skips Stripe update when quantity already matches', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { stripe_subscription_id: 'sub_match', status: 'trialing' },
      error: null,
    })
    mockChain.is.mockReturnValueOnce(
      Promise.resolve({ count: 5, error: null }) as never,
    )
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_1', quantity: 5 }] },
    })

    const res = await POST(makeRequest('ws-noop'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled()
  })
})
```

**Step 3: Run — confirm fail**

```bash
npm test -- src/app/api/internal/seat-sync/__tests__/route.test.ts
```
Expected: FAIL — module not found.

**Step 4: Implement `route.ts`**

```ts
// src/app/api/internal/seat-sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { verifySeatSync } from "@/lib/seat-sync";

export const runtime = "nodejs";

const BILLABLE_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-seat-sync-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const rawBody = await request.text();
  const secret = process.env.SEAT_SYNC_SECRET;
  if (!secret || !verifySeatSync(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let workspace_id: string;
  try {
    ({ workspace_id } = JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!workspace_id) {
    return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("workspace_id", workspace_id)
    .maybeSingle();

  if (!sub?.stripe_subscription_id || !BILLABLE_STATUSES.has(sub.status)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace_id)
    .not("employee_status", "is", "deactivated");

  const billableSeats = count ?? 0;

  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const item = stripeSub.items.data[0];
  if (!item) {
    return NextResponse.json({ error: "No subscription item" }, { status: 500 });
  }

  if (item.quantity === billableSeats) {
    return NextResponse.json({ ok: true, noop: true, quantity: billableSeats });
  }

  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [{ id: item.id, quantity: billableSeats }],
    proration_behavior: "create_prorations",
  });

  return NextResponse.json({ ok: true, quantity: billableSeats });
}
```

Adjust the count-query line in the test mock chain if Supabase's actual `head: true` count call differs from the chain stub. The implementation uses the documented Supabase API; the test mock may need a minor tweak if a chain method order is wrong. Run tests and adapt the mock — **not** the implementation — until they pass.

**Step 5: Run — verify pass**

```bash
npm test -- src/app/api/internal/seat-sync/__tests__/route.test.ts
```
Expected: PASS (6/6). If the count-query mock fails, fix the mock to match the actual chain order.

**Step 6: Commit**

```bash
git add src/lib/seat-sync.ts src/app/api/internal/seat-sync/__tests__/route.test.ts src/app/api/internal/seat-sync/route.ts
git commit -m "feat: add /api/internal/seat-sync with HMAC verification and Stripe quantity update"
```

---

### Task 9: Daily reconciliation cron `/api/internal/seat-sync-reconcile`

Backstop in case the Postgres trigger ever drops a call.

**Files:**
- Create: `src/app/api/internal/seat-sync-reconcile/route.ts`
- Modify: `vercel.json`

**Step 1: Implement reconciliation route**

```ts
// src/app/api/internal/seat-sync-reconcile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { signSeatSync } from "@/lib/seat-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.SEAT_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SEAT_SYNC_SECRET missing" }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("workspace_id")
    .in("status", ["active", "trialing", "past_due"])
    .not("workspace_id", "is", null);

  if (error || !subs) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const results = await Promise.allSettled(
    subs.map(async (s) => {
      const body = JSON.stringify({ workspace_id: s.workspace_id });
      const sig = signSeatSync(s.workspace_id, secret);
      const res = await fetch(`${siteUrl}/api/internal/seat-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Seat-Sync-Signature": sig },
        body,
      });
      return { workspace_id: s.workspace_id, status: res.status };
    }),
  );

  return NextResponse.json({
    total: subs.length,
    successes: results.filter((r) => r.status === "fulfilled").length,
    failures: results.filter((r) => r.status === "rejected").length,
  });
}
```

**Step 2: Add cron to `vercel.json`**

Replace the file contents with:

```json
{
  "regions": ["lhr1"],
  "crons": [
    {
      "path": "/api/internal/seat-sync-reconcile",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Step 3: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```
Expected: PASS.

**Step 4: Add `CRON_SECRET` to env example + env.ts**

Append to `.env.local.example`:
```
# Vercel cron auth (auto-set by Vercel; required for /api/internal/seat-sync-reconcile)
CRON_SECRET=
```
(`CRON_SECRET` is auto-injected by Vercel when crons are configured — no manual setup in production. Add to `.env.local` only if you want to test the cron locally.)

In `src/lib/env.ts`, add `CRON_SECRET: string | undefined` and `CRON_SECRET: optional("CRON_SECRET")`.

**Step 5: Commit**

```bash
git add src/app/api/internal/seat-sync-reconcile/route.ts vercel.json src/lib/env.ts .env.local.example
git commit -m "feat: add daily seat-sync reconciliation cron at 03:00 UTC"
```

---

## Phase D — Stripe-side configuration (LIVE — careful)

### Task 10: Create `Nami` product + `pro_monthly` price in Stripe live mode

**This task uses Stripe MCP. Mistakes can be archived but not deleted. Verify before each MCP call.**

**Step 1: Verify the account is still empty**

Use `mcp__d23d7e3d-a2d7-411b-a8ee-6eb3ad63db20__list_products` with `limit: 100`. Expected: `[]`. If non-empty, STOP and report to user.

**Step 2: Create the product**

Use `mcp__d23d7e3d-a2d7-411b-a8ee-6eb3ad63db20__stripe_api_execute` with method `POST`, endpoint `products`, body:

```json
{
  "name": "Nami",
  "description": "Performance reviews, 360 feedback, and OKRs in Slack"
}
```

Capture the returned `id` (starts with `prod_`).

**Step 3: Create the price**

`stripe_api_execute`, method `POST`, endpoint `prices`, body:

```json
{
  "product": "<prod_id from step 2>",
  "currency": "usd",
  "unit_amount": 500,
  "recurring": {
    "interval": "month",
    "usage_type": "licensed"
  },
  "lookup_key": "pro_monthly"
}
```

Capture the returned price `id` (starts with `price_`).

**Step 4: Verify**

`list_products` and `list_prices` — confirm exactly one product (`Nami`) and one price (`$5.00`, monthly, `lookup_key=pro_monthly`).

**Step 5: Record IDs in design doc**

Append to `docs/plans/2026-04-28-stripe-live-integration-design.md` under a new `## Live IDs` section the product id and price id (so we have a record).

```bash
git add docs/plans/2026-04-28-stripe-live-integration-design.md
git commit -m "docs: record Stripe live product + price IDs"
```

---

### Task 11: Confirm production domain and register webhook endpoint

**Step 1: Ask the user**

Print: "Confirm production domain for the webhook endpoint. Default assumption: `https://app.namihr.com`. Reply with the actual domain to use." Wait for response. Use the confirmed domain in Step 2.

**Step 2: Register webhook endpoint via Stripe API**

Use `stripe_api_execute`, method `POST`, endpoint `webhook_endpoints`, body:

```json
{
  "url": "https://<confirmed-domain>/api/webhooks/stripe",
  "enabled_events[]": [
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
    "invoice.payment_succeeded",
    "customer.subscription.trial_will_end"
  ],
  "description": "Nami app - subscription lifecycle"
}
```

Capture the returned `secret` (starts with `whsec_`). **Print it ONCE so the user can copy it into env vars** — Stripe only shows the signing secret on creation. Then proceed to Task 12.

---

### Task 12: User pastes Stripe secrets into `.env.local` and Vercel

**This task is performed by the user manually.** Print these instructions:

> ```
> 1. STRIPE_SECRET_KEY: get the live key from
>    https://dashboard.stripe.com/acct_1TR8PrRDOszymcTK/apikeys
>    (revealed once; copy now). Paste into:
>      - .env.local: STRIPE_SECRET_KEY=sk_live_...
>      - Vercel project settings → Environment Variables → Production +
>        Preview: STRIPE_SECRET_KEY=sk_live_...
>
> 2. STRIPE_WEBHOOK_SECRET: use the whsec_... value printed in Task 11.
>    Same two places.
>
> 3. SEAT_SYNC_SECRET: generate with `openssl rand -hex 32`.
>    Same two places. Keep a copy — it'll go into the Postgres GUC in
>    Task 13.
>
> Reply "done" when all three are pasted in both .env.local and Vercel.
> ```

**Wait for explicit "done" reply before proceeding.**

---

## Phase E — Per-seat trigger migration

### Task 13: Supabase migration for `notify_seat_sync` trigger

**Files:**
- Create: `supabase/migrations/20260428_seat_sync.sql`

**Step 1: Write the migration**

```sql
-- Per-seat sync trigger.
-- Fires fire-and-forget HTTP call to the Next.js app whenever a workspace's
-- billable-seat count might change. The app counts and pushes the new
-- quantity to Stripe.
--
-- HMAC: the trigger signs the body with app.seat_sync_secret; the Next.js
-- endpoint verifies. Without HMAC, anyone could call the endpoint and force
-- arbitrary Stripe quantity updates.

create extension if not exists pg_net;
create extension if not exists pgcrypto;

-- Set GUCs (replace placeholders before applying).
-- These are session-level defaults; safe to re-run.
alter database postgres set app.seat_sync_secret = 'PLACEHOLDER_SET_VIA_MCP';
alter database postgres set app.dashboard_url = 'PLACEHOLDER_SET_VIA_MCP';

create or replace function public.notify_seat_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  body  text;
  sig   text;
begin
  ws_id := coalesce(new.workspace_id, old.workspace_id);
  if ws_id is null then
    return null;
  end if;

  body := json_build_object('workspace_id', ws_id)::text;
  sig  := encode(
    extensions.hmac(body::bytea, current_setting('app.seat_sync_secret')::bytea, 'sha256'),
    'hex'
  );

  perform net.http_post(
    url     := current_setting('app.dashboard_url') || '/api/internal/seat-sync',
    body    := body::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Seat-Sync-Signature', sig
    )
  );
  return null;
end;
$$;

drop trigger if exists users_seat_sync on public.users;
create trigger users_seat_sync
after insert or delete or update of employee_status on public.users
for each row execute function public.notify_seat_sync();
```

**Step 2: Apply via Supabase MCP**

Replace the two `PLACEHOLDER_...` lines locally before applying — substitute the real `SEAT_SYNC_SECRET` and the production dashboard URL (from Task 11). Then use `mcp__e1e21cfb-a8b7-4fda-9a99-9f6b1a80d231__apply_migration` with name `20260428_seat_sync` and the substituted SQL as the query.

After apply, **revert the local migration file** to use the placeholders (don't commit the secret).

**Step 3: Sanity-check the trigger**

Use `mcp__e1e21cfb-a8b7-4fda-9a99-9f6b1a80d231__execute_sql`:

```sql
select tgname, tgenabled from pg_trigger where tgname = 'users_seat_sync';
```

Expected: one row, `tgenabled='O'`.

```sql
select prosrc from pg_proc where proname = 'notify_seat_sync';
```

Expected: source code visible.

**Step 4: Commit migration (placeholders only — no secrets)**

```bash
git add supabase/migrations/20260428_seat_sync.sql
git commit -m "feat(db): seat-sync trigger fires HTTP POST to /api/internal/seat-sync on user mutations"
```

---

## Phase F — Update checkout API

### Task 14: Update existing checkout test for single-tier + trial-no-card

**Files:**
- Modify: `src/app/api/checkout/__tests__/route.test.ts`

**Step 1: Rewrite test cases for new contract**

Replace the existing tests that reference `plan` and `annual` parameters. New shape:

```ts
// Replace the body of the file. Keep the existing mock setup; rewrite the test cases.

  it('returns 200 and creates trial session for admin (no card required)', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'admin',
      email: 'admin@test.com',
      workspaceId: 'ws-1',
    })
    mockPricesList.mockResolvedValue({ data: [{ id: 'price_pro' }] })
    mockCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/s' })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)

    expect(mockPricesList).toHaveBeenCalledWith({
      lookup_keys: ['pro_monthly'],
      active: true,
      limit: 1,
    })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        payment_method_collection: 'if_required',
        subscription_data: expect.objectContaining({
          trial_period_days: 14,
        }),
        line_items: [expect.objectContaining({ quantity: 1, price: 'price_pro' })],
      }),
    )
  })

  it('uses authenticated user email, not request body email', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'admin',
      email: 'real@test.com',
      workspaceId: 'ws-1',
    })
    mockPricesList.mockResolvedValue({ data: [{ id: 'price_pro' }] })
    mockCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/s' })

    await POST(makeRequest({ email: 'attacker@evil.com' }))

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer_email: 'real@test.com' }),
    )
  })
```

Keep the existing `403` (unauth, non-admin, manager, hr) tests — adjust them to use empty body `{}` instead of `{ plan: 'starter' }`. Delete the old `400 missing plan`, `400 invalid plan`, and `annual lookup key` tests — those parameters no longer exist.

**Step 2: Run — confirm tests fail (assertions don't match current code)**

```bash
npm test -- src/app/api/checkout/__tests__/route.test.ts
```
Expected: FAIL — assertions about `payment_method_collection`, `trial_period_days`, and `pro_monthly` lookup key don't match current implementation.

**Step 3: Update the implementation**

Rewrite `src/app/api/checkout/route.ts`. Replace `PLAN_LOOKUP_KEYS` map and the body parsing:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/roles";

const PRO_LOOKUP_KEY = "pro_monthly";

export async function POST(_request: NextRequest) {
  try {
    const workspace = await getUserWorkspace();
    if (!workspace || !isAdmin(workspace.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const stripe = getStripe();

    const prices = await stripe.prices.list({
      lookup_keys: [PRO_LOOKUP_KEY],
      active: true,
      limit: 1,
    });
    if (prices.data.length === 0) {
      return NextResponse.json(
        { error: "Price not found. Please configure Stripe prices." },
        { status: 500 },
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: workspace.email,
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      payment_method_collection: "if_required",
      subscription_data: {
        trial_period_days: 14,
        metadata: { plan: "pro" },
      },
      metadata: { plan: "pro" },
      success_url: `${siteUrl}/setup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Checkout error:", err);
    const code = (err as Error & { code?: string })?.code;
    if (code === "stripe_not_configured") {
      return NextResponse.json(
        { error: "Payments are not configured. Contact support." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
```

**Step 4: Run — verify pass**

```bash
npm test -- src/app/api/checkout/__tests__/route.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/checkout/__tests__/route.test.ts src/app/api/checkout/route.ts
git commit -m "feat(checkout): single Pro tier with 14-day no-card trial"
```

---

### Task 15: Update `/setup` page to accept `no_payment_required`

**Files:**
- Modify: `src/app/setup/page.tsx`

**Step 1: Relax the payment-status check**

Find the line:
```ts
if (session.payment_status !== "paid") {
  redirect("/pricing?error=payment_incomplete");
}
```

Replace with:

```ts
if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
  redirect("/pricing?error=payment_incomplete");
}
```

Also update the inserted row's `status` to reflect trial:

```ts
status: session.payment_status === "no_payment_required" ? "trialing" : "active",
```

(Replace the existing `status: "active",` literal at the insert.)

**Step 2: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```
Expected: PASS.

**Step 3: Commit**

```bash
git add src/app/setup/page.tsx
git commit -m "feat(setup): accept trial sessions (no_payment_required) and mark status as trialing"
```

---

## Phase G — UI cleanup

### Task 16: Pricing page — collapse to single Pro tier

**Files:**
- Modify: `src/app/pricing/page.tsx`

**Step 1: Read current file**

Read [src/app/pricing/page.tsx](src/app/pricing/page.tsx) end-to-end. Note the `plans` array and the `handleCheckout` flow.

**Step 2: Replace the `plans` array**

```tsx
const plans = [
  {
    id: "pro",
    name: "Nami",
    description: "Performance reviews, 360 feedback, and OKRs — in Slack.",
    monthlyPrice: 5,
    userLimit: "Unlimited",
    features: [
      "Unlimited review cycles",
      "360° reviews via Slack",
      "9-box calibration",
      "Competency frameworks",
      "Goal & OKR tracking",
      "Pulse surveys & eNPS",
      "Smart Slack reminders",
      "Trend analytics",
    ],
    cta: "Start 14-day free trial",
  },
];
```

**Step 3: Remove annual toggle and email-input flow**

In the same file:
- Delete `useState`s for `annual` and `email`/`showEmail`. Replace with just `loadingPlan`.
- Delete the annual-toggle UI.
- Replace `handleCheckout` body — direct POST to `/api/checkout` with empty body, then redirect to returned `url`. Drop the email-collection step (Stripe Checkout collects email itself).
- Replace per-card price rendering: just `$5/user/month` — drop the annual conditional and the "X users included" sub-line (replace with "No credit card required").

**Step 4: Add small "Need custom?" footer**

Below the plan card, add:

```tsx
<p className="text-center text-sm text-muted-foreground mt-8">
  Need custom pricing or onboarding?{" "}
  <a href="mailto:hello@namihr.com" className="text-primary hover:underline">
    Talk to us
  </a>
</p>
```

**Step 5: Build + lint**

```bash
npm run build
npm run lint
```
Expected: PASS, no warnings about unused imports.

**Step 6: Verify in preview**

Start the dev server (`preview_start` or already running), navigate to `/pricing`. Confirm:
- One card visible, $5/user/month
- Single CTA "Start 14-day free trial"
- "Talk to us" footer link
- No annual toggle, no email input, no Starter/Enterprise cards

Take a `preview_screenshot` for the user.

**Step 7: Commit**

```bash
git add src/app/pricing/page.tsx
git commit -m "ux(pricing): collapse to single Pro tier matching namihr.com"
```

---

### Task 17: Billing dashboard — status block + simplified plan card

**Files:**
- Modify: `src/app/dashboard/settings/billing/page.tsx`
- Modify: `src/app/dashboard/settings/billing/upgrade-button.tsx`

**Step 1: Add a server helper `getStripeBillingState`**

At the top of `billing/page.tsx`, add:

```tsx
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

type BillingState =
  | { kind: "free" }
  | { kind: "trialing_no_card"; daysLeft: number; trialEnd: Date }
  | { kind: "trialing_with_card"; trialEnd: Date; nextAmountCents: number }
  | { kind: "active"; nextChargeDate: Date; nextAmountCents: number }
  | { kind: "past_due" }
  | { kind: "canceled" };

async function getStripeBillingState(
  subRow: { stripe_subscription_id: string | null; stripe_customer_id: string | null; status: string } | null,
  billableSeats: number,
): Promise<BillingState> {
  if (!subRow?.stripe_subscription_id) return { kind: "free" };

  const stripe = getStripe();
  let stripeSub: Stripe.Subscription;
  try {
    stripeSub = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id, {
      expand: ["default_payment_method"],
    });
  } catch (e) {
    console.error("Failed to fetch Stripe subscription:", e);
    return { kind: "free" };
  }

  const nextAmountCents = billableSeats * 500;

  if (stripeSub.status === "canceled") return { kind: "canceled" };
  if (stripeSub.status === "past_due" || stripeSub.status === "unpaid") return { kind: "past_due" };

  if (stripeSub.status === "trialing" && stripeSub.trial_end) {
    const trialEnd = new Date(stripeSub.trial_end * 1000);
    const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000));
    if (stripeSub.default_payment_method) {
      return { kind: "trialing_with_card", trialEnd, nextAmountCents };
    }
    return { kind: "trialing_no_card", daysLeft, trialEnd };
  }

  return {
    kind: "active",
    nextChargeDate: new Date(stripeSub.current_period_end * 1000),
    nextAmountCents,
  };
}

async function getRecentInvoices(customerId: string) {
  try {
    const stripe = getStripe();
    const list = await stripe.invoices.list({ customer: customerId, limit: 5 });
    return list.data;
  } catch (e) {
    console.error("Failed to list invoices:", e);
    return [];
  }
}
```

**Step 2: Compute billable seats and call helpers**

In the page component, after `subscription` and `userCount` are loaded, add:

```tsx
const supabase = await createServerSupabaseClient();
const { count: billableSeats } = await supabase
  .from("users")
  .select("id", { count: "exact", head: true })
  .eq("workspace_id", workspace!.workspaceId)
  .not("employee_status", "is", "deactivated");

const billingState = await getStripeBillingState(subscription, billableSeats ?? 0);
const invoices = subscription?.stripe_customer_id
  ? await getRecentInvoices(subscription.stripe_customer_id)
  : [];
```

**Step 3: Replace `planDetails` map and the four-card comparison grid**

Delete the `planDetails` map. Delete the entire "Compare Plans" `<Card>` block.

**Step 4: Add a new status block**

Above the existing "Current Plan" card, render:

```tsx
{billingState.kind === "trialing_no_card" && (
  <Card className="border-primary">
    <CardContent className="pt-6 flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold">14-day free trial — {billingState.daysLeft} days left</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add a payment method before {format(billingState.trialEnd, "MMM d")} to keep your team going.
        </p>
      </div>
      <UpgradeButton workspaceId={workspace?.workspaceId} customerId={subscription?.stripe_customer_id} isManage />
    </CardContent>
  </Card>
)}
{billingState.kind === "trialing_with_card" && (
  <Card>
    <CardContent className="pt-6">
      <p className="font-semibold">Trial ends {format(billingState.trialEnd, "MMM d")}</p>
      <p className="text-sm text-muted-foreground mt-1">
        First charge: ${(billingState.nextAmountCents / 100).toFixed(2)} ({billableSeats} billable users × $5).
      </p>
    </CardContent>
  </Card>
)}
{billingState.kind === "past_due" && (
  <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
    <CardContent className="pt-6 flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold text-red-800 dark:text-red-200">Payment failed</p>
        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
          Update your payment method to restore access.
        </p>
      </div>
      <UpgradeButton workspaceId={workspace?.workspaceId} customerId={subscription?.stripe_customer_id} isManage />
    </CardContent>
  </Card>
)}
{billingState.kind === "canceled" && (
  <Card>
    <CardContent className="pt-6 flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold">Subscription canceled</p>
        <p className="text-sm text-muted-foreground mt-1">Resubscribe to continue using Nami.</p>
      </div>
      <UpgradeButton workspaceId={workspace?.workspaceId} />
    </CardContent>
  </Card>
)}
{billingState.kind === "active" && (
  <Card>
    <CardContent className="pt-6">
      <p className="font-semibold">
        ${(billingState.nextAmountCents / 100).toFixed(2)}/month
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Next charge {format(billingState.nextChargeDate, "MMM d, yyyy")} ({billableSeats} billable users × $5).
      </p>
    </CardContent>
  </Card>
)}
```

**Step 5: Simplify the existing "Current Plan" card**

Replace the body with a single panel:
- Title: "Nami"
- Subtitle: "$5 per billable user / month"
- Feature list: same 8 features used on pricing page (extract to a shared constant if it feels right; otherwise duplicate)
- Manage button as before

Drop the seat-utilization grid at the bottom (the "X% Seat Utilization" thing is meaningless with unlimited seats); replace with a single "Y billable users" line.

**Step 6: Add invoices block**

Below the plan card:

```tsx
{invoices.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle>Recent invoices</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="divide-y">
        {invoices.map((inv) => (
          <li key={inv.id} className="py-2 flex items-center justify-between">
            <div>
              <p className="font-medium">
                {inv.created ? format(new Date(inv.created * 1000), "MMM d, yyyy") : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                ${((inv.amount_paid ?? inv.amount_due ?? 0) / 100).toFixed(2)} · {inv.status}
              </p>
            </div>
            {inv.hosted_invoice_url && (
              <a
                href={inv.hosted_invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View
              </a>
            )}
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
)}
```

**Step 7: Update `upgrade-button.tsx`**

The button currently says "Upgrade Plan" / "Manage Subscription". Standardize to "Manage billing" when `isManage`, "Start 14-day free trial" otherwise. Update the labels in [upgrade-button.tsx](src/app/dashboard/settings/billing/upgrade-button.tsx).

**Step 8: Build + lint**

```bash
npm run build
npm run lint
```
Expected: PASS.

**Step 9: Verify in preview**

Hit `/dashboard/settings/billing` as an admin (you'll need a workspace with a subscription row to fully exercise the states; for now, the `kind: "free"` path should render). Take a screenshot.

**Step 10: Commit**

```bash
git add src/app/dashboard/settings/billing/page.tsx src/app/dashboard/settings/billing/upgrade-button.tsx
git commit -m "ux(billing): single-tier dashboard with status block, seat math, and recent invoices"
```

---

## Phase H — Make `STRIPE_SECRET_KEY` required

### Task 18: Promote `STRIPE_SECRET_KEY` from optional to required

Now that everything is wired and the user has confirmed env vars are in place, fail loudly at startup if Stripe isn't configured in production.

**Files:**
- Modify: `src/lib/env.ts`

**Step 1: Edit `env.ts`**

Change:

```ts
STRIPE_SECRET_KEY: string | undefined;
// ...
STRIPE_SECRET_KEY: optional("STRIPE_SECRET_KEY"),
```

to:

```ts
STRIPE_SECRET_KEY: string;
// ...
STRIPE_SECRET_KEY: required("STRIPE_SECRET_KEY"),
```

Same for `STRIPE_WEBHOOK_SECRET` and `SEAT_SYNC_SECRET` — promote to `required`. (`CRON_SECRET` stays optional — only Vercel needs it.)

The existing `getStripe()` function in `src/lib/stripe.ts` will become slightly redundant (it checks for missing key and throws — but the key is now required at module load). Keep the function as-is for defensive programming and so tests can null it out.

**Step 2: Build + test**

```bash
npm run build
npm test
```
Expected: PASS — both because `.env.local` already has the keys.

**Step 3: Commit**

```bash
git add src/lib/env.ts
git commit -m "env: promote STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SEAT_SYNC_SECRET to required"
```

---

## Phase I — End-to-end live verification

### Task 19: Manual verification on a throwaway Slack workspace

This task is performed by the user with Claude observing. Follow design doc's "Verification plan" section, in order.

**Step 1: Deploy to production**

```bash
git push origin main
```

Wait for Vercel deploy to complete. Confirm deploy URL.

**Step 2: Run the verification scenarios**

Walk through scenarios 1–10 in [docs/plans/2026-04-28-stripe-live-integration-design.md](./2026-04-28-stripe-live-integration-design.md#verification-plan):

1. Fresh Slack workspace → click "Start 14-day free trial".
2. Confirm checkout completes without card prompt.
3. Verify `subscriptions` row via Supabase MCP `execute_sql_readonly`.
4. Add 3 users; verify Stripe quantity becomes 4 within seconds.
5. Deactivate a user; verify quantity drops to 3.
6. Add a card via Stripe portal.
7. End trial early via Stripe Dashboard.
8. Verify webhook fired (check Stripe webhook delivery log) and DB updated.
9. Verify first invoice charged correctly.
10. Cancel via Stripe portal; verify proxy redirects.

After each scenario, Claude reports observed state. If anything diverges, file a follow-up issue rather than patching live.

**Step 3: Wrap up**

Once verification is clean, summarize results. Offer to /schedule a one-time agent to remove the daily reconciliation cron once we have 2 weeks of zero-drift evidence (it can stay forever, but the offer reflects YAGNI hygiene if the trigger turns out to be 100% reliable).

---

## Done

You've shipped:
- Live Stripe integration on the NamiHR account
- Single $5/seat/month Pro tier with 14-day no-card trial
- Per-seat metering via Postgres trigger + HMAC-protected endpoint
- 6-event webhook handler with full tenant isolation
- Rebuilt billing dashboard with trial countdown, seat math, and invoice history
- Daily reconciliation cron as a safety net
