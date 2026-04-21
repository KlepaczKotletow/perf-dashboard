import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

    // Authenticated users hitting the landing page → skip Slack OAuth, go straight to dashboard
    if (request.nextUrl.pathname === '/' && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Protect dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
      const loginUrl = new URL('/', request.url)
      loginUrl.searchParams.set('signin', 'required')
      return NextResponse.redirect(loginUrl)
    }

    // Subscription enforcement for dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard') && user) {
      // Allow billing page always (so admin can fix subscription)
      const isBillingPage = request.nextUrl.pathname.startsWith('/dashboard/settings/billing')

      if (!isBillingPage) {
        // SECURITY: Resolve slack_user_id via the SECURITY DEFINER RPC that
        // reads raw_app_meta_data (service-role-writable only). Reading
        // user.user_metadata.slack_user_id from the JWT is a cross-tenant data
        // leak — users can rewrite their own user_metadata via
        // supabase.auth.updateUser({ data: { ... } }) and pivot the
        // subscription check to another workspace.
        const { data: slackUserId } = await supabase.rpc('get_my_slack_user_id')
        if (slackUserId) {
          const { data: dbUser } = await supabase
            .from('users')
            .select('workspace_id')
            .eq('slack_user_id', slackUserId)
            .single()

          if (dbUser?.workspace_id) {
            // RLS ensures we can only read our own workspace's subscription
            const { data: subscription } = await supabase
              .from('subscriptions')
              .select('status')
              .eq('workspace_id', dbUser.workspace_id)
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
      }
    }
  } catch (e) {
    console.error('Proxy error (subscription enforcement may be degraded):', e)
    // On error, allow request through to avoid blocking users during outages.
    // This is a deliberate fail-open for availability — subscription enforcement
    // is defense-in-depth, not the sole access control mechanism.
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
