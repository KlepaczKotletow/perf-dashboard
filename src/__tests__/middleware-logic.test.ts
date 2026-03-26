import { describe, it, expect } from 'vitest'

/**
 * Tests for middleware authorization logic.
 * Since the actual middleware depends on Supabase client creation with cookies,
 * we test the decision logic extracted as pure functions.
 */

// Extract the decision logic from the middleware
function shouldRedirectToLogin(pathname: string, user: { id: string } | null): boolean {
  return pathname.startsWith('/dashboard') && !user
}

function shouldRedirectToBilling(
  pathname: string,
  user: { user_metadata?: { workspace_id?: string } } | null,
  subscription: { status: string } | null
): boolean {
  if (!pathname.startsWith('/dashboard') || !user) return false

  const workspaceId = user.user_metadata?.workspace_id
  const isBillingPage = pathname.startsWith('/dashboard/settings/billing')

  if (!workspaceId || isBillingPage) return false

  // Missing subscription = free tier (allowed)
  if (!subscription) return false

  // Only block if subscription exists AND is explicitly not active/trialing
  return subscription.status !== 'active' && subscription.status !== 'trialing'
}

describe('Middleware: shouldRedirectToLogin', () => {
  it('redirects unauthenticated users from dashboard', () => {
    expect(shouldRedirectToLogin('/dashboard', null)).toBe(true)
    expect(shouldRedirectToLogin('/dashboard/reviews', null)).toBe(true)
    expect(shouldRedirectToLogin('/dashboard/settings/billing', null)).toBe(true)
  })

  it('allows authenticated users to dashboard', () => {
    expect(shouldRedirectToLogin('/dashboard', { id: 'u1' })).toBe(false)
    expect(shouldRedirectToLogin('/dashboard/reviews', { id: 'u1' })).toBe(false)
  })

  it('allows unauthenticated users to public pages', () => {
    expect(shouldRedirectToLogin('/', null)).toBe(false)
    expect(shouldRedirectToLogin('/pricing', null)).toBe(false)
  })
})

describe('Middleware: shouldRedirectToBilling', () => {
  const activeUser = { user_metadata: { workspace_id: 'ws-1' } }
  const noWorkspaceUser = { user_metadata: {} }

  it('does not redirect for active subscriptions', () => {
    expect(shouldRedirectToBilling('/dashboard', activeUser, { status: 'active' })).toBe(false)
  })

  it('does not redirect for trialing subscriptions', () => {
    expect(shouldRedirectToBilling('/dashboard', activeUser, { status: 'trialing' })).toBe(false)
  })

  it('redirects for canceled subscriptions', () => {
    expect(shouldRedirectToBilling('/dashboard', activeUser, { status: 'canceled' })).toBe(true)
  })

  it('redirects for past_due subscriptions', () => {
    expect(shouldRedirectToBilling('/dashboard', activeUser, { status: 'past_due' })).toBe(true)
  })

  it('does not redirect when no subscription (free tier)', () => {
    expect(shouldRedirectToBilling('/dashboard', activeUser, null)).toBe(false)
  })

  it('always allows billing page regardless of subscription', () => {
    expect(shouldRedirectToBilling('/dashboard/settings/billing', activeUser, { status: 'canceled' })).toBe(false)
  })

  it('does not redirect for non-dashboard routes', () => {
    expect(shouldRedirectToBilling('/', activeUser, { status: 'canceled' })).toBe(false)
    expect(shouldRedirectToBilling('/pricing', activeUser, { status: 'canceled' })).toBe(false)
  })

  it('does not redirect when user has no workspace_id', () => {
    expect(shouldRedirectToBilling('/dashboard', noWorkspaceUser, { status: 'canceled' })).toBe(false)
  })

  it('does not redirect when user is null', () => {
    expect(shouldRedirectToBilling('/dashboard', null, { status: 'canceled' })).toBe(false)
  })
})
