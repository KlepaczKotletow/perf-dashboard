import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { signSeatSync } from '@/lib/seat-sync'

const mockSubscriptionsUpdate = vi.fn()
const mockSubscriptionsRetrieve = vi.fn()
vi.mock('stripe', () => {
  const MockStripe = vi.fn(function () {
    return {
      subscriptions: {
        update: mockSubscriptionsUpdate,
        retrieve: mockSubscriptionsRetrieve,
      },
    }
  })
  return { default: MockStripe }
})

// Two separate chain stubs so reads (.maybeSingle) and counts (.eq) terminate correctly.
const mockReadChain = {
  from: vi.fn((_table: string) => mockReadChain),
  select: vi.fn((_cols: string) => mockReadChain),
  eq: vi.fn((_col: string, _val: unknown) => mockReadChain),
  maybeSingle: vi.fn(),
}
const mockCountResult = { count: 0, error: null as { message: string } | null }
const mockCountChain = {
  from: vi.fn((_table: string) => mockCountChain),
  select: vi.fn((_cols: string, _opts?: unknown) => mockCountChain),
  eq: vi.fn((_col: string, _val: unknown) => mockCountChain),
  neq: vi.fn((_col: string, _val: unknown) => mockCountChain),
  // Make awaitable: returns the count result.
  then: (resolve: (v: typeof mockCountResult) => void) => resolve(mockCountResult),
}

const mockSupabase = {
  from: (_table: string) => mockReadChain as unknown,
}
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => mockSupabase,
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
    mockCountResult.count = 0
    mockCountResult.error = null
    mockSupabase.from = (table: string) => {
      if (table === 'subscriptions') return mockReadChain.from(table)
      if (table === 'users') return mockCountChain.from(table)
      throw new Error(`unexpected table: ${table}`)
    }
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
    mockReadChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const res = await POST(makeRequest('ws-no-sub'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 noop when subscription is canceled', async () => {
    mockReadChain.maybeSingle.mockResolvedValueOnce({
      data: { stripe_subscription_id: 'sub_x', status: 'canceled' },
      error: null,
    })
    const res = await POST(makeRequest('ws-canceled'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled()
  })

  it('updates Stripe quantity to billable seat count', async () => {
    mockReadChain.maybeSingle.mockResolvedValueOnce({
      data: { stripe_subscription_id: 'sub_active', status: 'active' },
      error: null,
    })
    mockCountResult.count = 7
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_1', quantity: 1 }] },
    })

    const res = await POST(makeRequest('ws-active'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      'sub_active',
      expect.objectContaining({
        items: [{ id: 'si_1', quantity: 7 }],
        proration_behavior: 'create_prorations',
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining('seat-sync-ws-active-7-') }),
    )
  })

  it('skips Stripe update when quantity already matches', async () => {
    mockReadChain.maybeSingle.mockResolvedValueOnce({
      data: { stripe_subscription_id: 'sub_match', status: 'trialing' },
      error: null,
    })
    mockCountResult.count = 5
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_1', quantity: 5 }] },
    })

    const res = await POST(makeRequest('ws-noop'))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled()
  })
})
