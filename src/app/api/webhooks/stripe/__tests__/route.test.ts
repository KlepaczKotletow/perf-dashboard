import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockConstructEvent = vi.fn()
vi.mock('stripe', () => {
  const MockStripe = vi.fn(function () {
    return {
      webhooks: { constructEvent: mockConstructEvent },
    }
  })
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

  it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(makeRequest('{}', 'any-sig'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Webhook not configured')
  })

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
})
