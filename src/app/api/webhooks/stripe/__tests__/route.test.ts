import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockConstructEvent = vi.fn()
const mockSubscriptionsRetrieve = vi.fn()
vi.mock('stripe', () => {
  const MockStripe = vi.fn(function () {
    return {
      webhooks: { constructEvent: mockConstructEvent },
      subscriptions: { retrieve: mockSubscriptionsRetrieve },
    }
  })
  return { default: MockStripe }
})

const mockSupabase: {
  from: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (resolve: (v: { data: null; error: { message: string } | null }) => unknown) => unknown
} = {
  from: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  // Read chain (.from().select().eq().maybeSingle()) needs eq to return the
  // chain so maybeSingle can be called. Write chain (.from().update().eq())
  // terminates by being awaited — handled by the thenable below.
  eq: vi.fn(() => mockSupabase),
  maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  // Make mockSupabase itself thenable so `await chain.eq(...)` resolves.
  // Plain function (not vi.fn) so vi.clearAllMocks() doesn't disturb it.
  then: (resolve) => resolve({ data: null, error: null }),
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

  it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(makeRequest('{}', 'any-sig'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Webhook not configured')
  })

  it('refetches subscription and updates row on customer.subscription.updated', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123' } },
    })
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: 1735689600 }] },
    })
    const res = await POST(makeRequest('{}', 'valid'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_123')
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

  it('refetches sub on invoice.payment_succeeded — keeps trialing for $0 trial invoices', async () => {
    // Stripe auto-pays $0 trial/proration invoices. The sub itself is still
    // trialing — we must NOT write status='active' just because the invoice
    // succeeded. Refetching the live sub is what protects against this.
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_trial',
          period_end: 1735689600,
        },
      },
    })
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_trial',
      status: 'trialing',
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: 1778673651 }] },
    })
    const res = await POST(makeRequest('{}', 'valid'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_trial')
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'trialing',
        current_period_end: expect.any(String),
      }),
    )
    expect(mockSupabase.eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_trial')
  })

  it('writes status from refetched sub on invoice.payment_succeeded — active for real period invoices', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: { object: { subscription: 'sub_999' } },
    })
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_999',
      status: 'active',
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: 1735689600 }] },
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

  it('returns 500 when supabase update reports an error', async () => {
    // supabase-js does not throw on PG errors — it returns them in .error.
    // Without throw-on-error, Stripe would receive 200 and never retry,
    // leaving the row stale on transient DB problems.
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_err' } },
    })
    // Override the chain's terminal thenable to surface a PG error once.
    const originalThen = mockSupabase.then
    mockSupabase.then = (resolve: (v: { data: null; error: { message: string } | null }) => unknown) =>
      resolve({ data: null, error: { message: 'connection lost' } })
    try {
      const res = await POST(makeRequest('{}', 'valid'))
      expect(res.status).toBe(500)
    } finally {
      mockSupabase.then = originalThen
    }
  })

  it('extracts subscription id from parent.subscription_details on invoice events', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: {
          parent: { subscription_details: { subscription: 'sub_typed_path' } },
        },
      },
    })
    const res = await POST(makeRequest('{}', 'valid'))
    expect(res.status).toBe(200)
    expect(mockSupabase.eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_typed_path')
  })

  it('returns 200 with no DB write when invoice has no subscription', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: {} },
    })
    const res = await POST(makeRequest('{}', 'valid'))
    expect(res.status).toBe(200)
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })

  it('inserts subscription row on checkout.session.completed when not present', async () => {
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
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_subscription_id: 'sub_new',
        stripe_customer_id: 'cus_new',
        stripe_customer_email: 'admin@acme.com',
        plan: 'pro',
        status: 'trialing',
      }),
      expect.objectContaining({
        onConflict: 'stripe_subscription_id',
        ignoreDuplicates: true,
      }),
    )
  })

  it('upserts with onConflict ignore on checkout.session.completed', async () => {
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
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_subscription_id: 'sub_existing' }),
      expect.objectContaining({
        onConflict: 'stripe_subscription_id',
        ignoreDuplicates: true,
      }),
    )
  })
})
