/**
 * Server-side logout endpoint.
 *
 * Why this exists: `supabase.auth.signOut()` in the browser clears the
 * access token locally, but without a server call the refresh token stays
 * valid server-side — a device already offline can keep using the old
 * session. Calling this endpoint with `scope: 'global'` revokes the
 * refresh token for the user across all devices.
 *
 * Called from the FooterDropdown before navigating away.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* ignore — can happen in edge runtimes */
          }
        },
      },
    },
  );

  // `global` scope revokes the refresh token across every device this
  // user has logged in from. If we ever want single-device signout,
  // switch to `local` (only revokes this session).
  const { error } = await supabase.auth.signOut({ scope: "global" });

  if (error) {
    console.error("[logout] signOut failed:", error.message);
    // Still return OK — the client will clear local session state
    // regardless, and we don't want a user stuck "signed in" because
    // of a transient Supabase error.
  }

  return NextResponse.json({ ok: true });
}
