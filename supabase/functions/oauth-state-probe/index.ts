import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  signOAuthState,
  verifyOAuthState,
} from "../_shared/oauth-state.ts";

// Health-check helper: signs a throwaway state and immediately verifies it
// on the same side. If this returns ok=false the OAUTH_STATE_SECRET on
// Supabase is broken (missing, rotated mid-deploy, etc.) and every install /
// reinstall round-trip is dead.
//
// Hit by /api/health/install on Vercel. Public on purpose — the response
// contains no secret material, just a pass/fail.

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const state = await signOAuthState({ purpose: "probe" });
    const verified = await verifyOAuthState(state);
    if (!verified || verified.purpose !== "probe") {
      return new Response(
        JSON.stringify({ ok: false, reason: "verify_failed" }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "exception",
        message: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
