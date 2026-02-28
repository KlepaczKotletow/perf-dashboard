import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refresh session if expired
    const { data: { user } } = await supabase.auth.getUser()

    // Protect dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
      const loginUrl = new URL('/', request.url)
      loginUrl.searchParams.set('signin', 'required')
      return NextResponse.redirect(loginUrl)
    }

    // Subscription enforcement for dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard') && user) {
      const workspaceId = user.user_metadata?.workspace_id

      // Allow billing page always (so admin can fix subscription)
      const isBillingPage = request.nextUrl.pathname.startsWith('/dashboard/settings/billing')

      if (workspaceId && !isBillingPage) {
        // Check subscription status
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('workspace_id', workspaceId)
          .maybeSingle()

        // Only block if subscription exists AND is explicitly canceled/past_due
        // Missing subscription = free tier (allowed)
        if (subscription && subscription.status !== 'active' && subscription.status !== 'trialing') {
          const billingUrl = new URL('/dashboard/settings/billing', request.url)
          billingUrl.searchParams.set('inactive', 'true')
          return NextResponse.redirect(billingUrl)
        }
      }
    }
  } catch (e) {
    console.error('Middleware error:', e)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
