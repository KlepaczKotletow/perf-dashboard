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
})
