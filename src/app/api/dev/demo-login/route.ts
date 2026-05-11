import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

// Dev-only route: signs the browser in as a seeded Acme Corp demo user.
// Returns 404 in production. Used to record landing-page demo GIFs without
// having to run through the real Slack OAuth flow on every reseed.
//
// Usage:  GET /api/dev/demo-login            -> signs in as sarah@acme.demo
//         GET /api/dev/demo-login?next=/...  -> custom redirect target
//
// The seeded password lives in supabase/seed.sql alongside the rest of the
// Acme Corp fixture — this route is intentionally tied to that seed.
const DEMO_EMAIL = "sarah@acme.demo";
const DEMO_PASSWORD = "AcmeDemo2026!";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const next = new URL(request.url).searchParams.get("next") ?? "/dashboard";

  const cookieStore = await cookies();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll from a Server Component — ignored
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (error) {
    return new NextResponse(`Demo login failed: ${error.message}`, { status: 500 });
  }

  return NextResponse.redirect(new URL(next, request.url));
}
