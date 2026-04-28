import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { verifySeatSync } from "@/lib/seat-sync";

export const runtime = "nodejs";

// active, trialing: obvious. past_due: keep syncing so quantity stays accurate
// during dunning — otherwise customers who deactivate users while delinquent
// would be unfairly billed for those seats once they recover.
const BILLABLE_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-seat-sync-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const rawBody = await request.text();
  const secret = process.env.SEAT_SYNC_SECRET;
  if (!secret || !verifySeatSync(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let workspace_id: string;
  try {
    ({ workspace_id } = JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!workspace_id) {
    return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("workspace_id", workspace_id)
    .maybeSingle();

  if (!sub?.stripe_subscription_id || !BILLABLE_STATUSES.has(sub.status)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace_id)
    .neq("employee_status", "deactivated");

  const billableSeats = count ?? 0;

  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const item = stripeSub.items.data[0];
  if (!item) {
    return NextResponse.json({ error: "No subscription item" }, { status: 500 });
  }

  if (item.quantity === billableSeats) {
    return NextResponse.json({ ok: true, noop: true, quantity: billableSeats });
  }

  await stripe.subscriptions.update(
    sub.stripe_subscription_id,
    {
      items: [{ id: item.id, quantity: billableSeats }],
      proration_behavior: "create_prorations",
    },
    {
      idempotencyKey: `seat-sync-${workspace_id}-${billableSeats}-${Math.floor(Date.now() / 60000)}`,
    },
  );

  return NextResponse.json({ ok: true, quantity: billableSeats });
}
