import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock getUserWorkspace
const mockGetUserWorkspace = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  getUserWorkspace: () => mockGetUserWorkspace(),
}))

// Mock Stripe
const mockCreate = vi.fn()
const mockPricesList = vi.fn()
vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(function () {
    return {
      checkout: {
        sessions: {
          create: mockCreate,
        },
      },
      prices: {
        list: mockPricesList,
      },
    }
  })
  return { default: MockStripe }
})

// Import after mocks
import { POST } from '../route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('returns 403 when user is not authenticated', async () => {
    mockGetUserWorkspace.mockResolvedValue(null)
    const res = await POST(makeRequest({ plan: 'starter' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'user',
      email: 'user@test.com',
      workspaceId: 'ws-1',
    })
    const res = await POST(makeRequest({ plan: 'starter' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 for manager role', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'manager',
      email: 'manager@test.com',
      workspaceId: 'ws-1',
    })
    const res = await POST(makeRequest({ plan: 'starter' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 for HR role', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'hr',
      email: 'hr@test.com',
      workspaceId: 'ws-1',
    })
    const res = await POST(makeRequest({ plan: 'starter' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing plan', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'admin',
      email: 'admin@test.com',
      workspaceId: 'ws-1',
    })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid plan name', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'admin',
      email: 'admin@test.com',
      workspaceId: 'ws-1',
    })
    const res = await POST(makeRequest({ plan: 'nonexistent_plan' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid plan')
  })

  it('creates checkout session for admin with valid plan', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'admin',
      email: 'admin@test.com',
      workspaceId: 'ws-1',
    })
    mockPricesList.mockResolvedValue({
      data: [{ id: 'price_123' }],
    })
    mockCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_123',
    })

    const res = await POST(makeRequest({ plan: 'starter' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://checkout.stripe.com/session_123')

    expect(mockPricesList).toHaveBeenCalledWith({
      lookup_keys: ['starter_monthly'],
      active: true,
      limit: 1,
    })
  })

  it('uses annual lookup key when annual flag is true', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'admin',
      email: 'admin@test.com',
      workspaceId: 'ws-1',
    })
    mockPricesList.mockResolvedValue({
      data: [{ id: 'price_annual_123' }],
    })
    mockCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_annual',
    })

    await POST(makeRequest({ plan: 'professional', annual: true }))

    expect(mockPricesList).toHaveBeenCalledWith({
      lookup_keys: ['professional_annual'],
      active: true,
      limit: 1,
    })
  })

  it('uses authenticated user email, not request body email', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'admin',
      email: 'real-admin@test.com',
      workspaceId: 'ws-1',
    })
    mockPricesList.mockResolvedValue({
      data: [{ id: 'price_123' }],
    })
    mockCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/s' })

    await POST(makeRequest({ plan: 'starter', email: 'attacker@evil.com' }))

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'real-admin@test.com',
      })
    )
  })

  it('returns 500 when price not found in Stripe', async () => {
    mockGetUserWorkspace.mockResolvedValue({
      role: 'admin',
      email: 'admin@test.com',
      workspaceId: 'ws-1',
    })
    mockPricesList.mockResolvedValue({ data: [] })

    const res = await POST(makeRequest({ plan: 'starter' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Price not found')
  })
})
