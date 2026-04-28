import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error(`Stripe webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Stripe API 2025-03-31 / SDK v18+ moved the subscription reference off the
// top-level Invoice object onto `parent.subscription_details.subscription`.
// Live webhook payloads still emit the legacy top-level `subscription` field,
// so we read the typed location first and fall back to the legacy field.
function extractSubscriptionId(inv: Stripe.Invoice): string | null {
  const fromParent = inv.parent?.subscription_details?.subscription;
  const legacy = (inv as unknown as { subscription?: string | Stripe.Subscription }).subscription;
  const ref = fromParent ?? legacy;
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      // current_period_end was relocated to subscription items in Stripe API
      // 2025-03-31 / SDK v18+, but still appears on the top-level object in
      // event payloads. Read from the item for type-safe access, fall back to
      // the legacy top-level field for older payloads.
      const periodEnd =
        sub.items?.data[0]?.current_period_end ??
        (sub as unknown as { current_period_end?: number }).current_period_end;
      const supabase = createServiceRoleClient();
      await supabase
        .from("subscriptions")
        .update({
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
          current_period_end: periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
        })
        .eq("stripe_subscription_id", sub.id);
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const supabase = createServiceRoleClient();
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
        })
        .eq("stripe_subscription_id", sub.id);
      return;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = extractSubscriptionId(inv);
      if (!subId) return;
      const supabase = createServiceRoleClient();
      await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("stripe_subscription_id", subId);
      return;
    }
    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = extractSubscriptionId(inv);
      if (!subId) return;
      const supabase = createServiceRoleClient();
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          current_period_end: new Date(inv.period_end * 1000).toISOString(),
        })
        .eq("stripe_subscription_id", subId);
      return;
    }
    default:
      // Unknown / ignored event types — return 200 to avoid Stripe retries.
      return;
  }
}
