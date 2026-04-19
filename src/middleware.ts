import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Coarse first-line auth check for /dashboard/* routes.
 *
 * Pages still call getUserWorkspace() for workspace-scoped checks and
 * role enforcement. This middleware exists so new layouts/pages under
 * /dashboard can't accidentally skip the auth check — if you're not
 * signed in, you don't get past this point.
 *
 * Also refreshes the Supabase session cookie on every request, which
 * prevents the "stale session" bug where the access token expires mid-
 * navigation.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "?signin=required";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Match dashboard routes only. Public landing, auth callbacks, and
  // API routes that set their own auth are excluded.
  matcher: ["/dashboard/:path*"],
};
