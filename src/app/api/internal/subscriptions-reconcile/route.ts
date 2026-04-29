import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { syncSubscriptionState } from "@/lib/subscription-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily backstop: refetches every linked Stripe subscription and overwrites
// status / cancel_at_period_end / current_period_end in our DB. Catches
// state drift from missed webhooks (we were down longer than Stripe's retry
// window, signature mismatch during a key rotation, etc.).
//
// Auth: bearer SEAT_SYNC_SECRET (same shared secret as the seat-sync routes
// — see comment in seat-sync-reconcile/route.ts for why).
export async function GET(request: NextRequest) {
  const secret = process.env.SEAT_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SEAT_SYNC_SECRET missing" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .not("stripe_subscription_id", "is", null);

  if (error || !subs) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const results = await Promise.allSettled(
    subs.map((s) => syncSubscriptionState(s.stripe_subscription_id as string)),
  );

  const failed = results
    .map((r, i) => ({ r, sub: subs[i].stripe_subscription_id }))
    .filter(({ r }) => r.status === "rejected")
    .map(({ sub, r }) => ({
      stripe_subscription_id: sub,
      error: (r as PromiseRejectedResult).reason instanceof Error
        ? (r as PromiseRejectedResult & { reason: Error }).reason.message
        : String((r as PromiseRejectedResult).reason),
    }));

  return NextResponse.json({
    total: subs.length,
    successes: results.length - failed.length,
    failures: failed.length,
    failed,
  });
}
