import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { syncSubscriptionState } from "@/lib/subscription-sync";

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

// Throw on supabase errors so the outer try/catch returns 500 and Stripe
// retries. supabase-js never throws on Postgres errors itself — silent
// .error swallowing here previously caused state drift.
function throwIfError(error: { message: string } | null, op: string): void {
  if (error) throw new Error(`${op}: ${error.message}`);
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscriptionState(sub.id);
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const supabase = createServiceRoleClient();
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", sub.id);
      throwIfError(error, "subscriptions cancel");
      return;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = extractSubscriptionId(inv);
      if (!subId) return;
      const supabase = createServiceRoleClient();
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("stripe_subscription_id", subId);
      throwIfError(error, "subscriptions past_due");
      return;
    }
    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = extractSubscriptionId(inv);
      if (!subId) return;
      // Refetch authoritative state from Stripe — see syncSubscriptionState.
      // Stripe auto-pays $0 trial and proration invoices, so we cannot infer
      // status from the invoice being paid.
      await syncSubscriptionState(subId);
      return;
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
      if (!subId) return;

      const customerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;

      const supabase = createServiceRoleClient();
      // Idempotency is guaranteed by the unique index on stripe_subscription_id
      // (migration 20260429_fix_subscriptions_stripe_sub_on_conflict). /setup
      // is the primary insert path; this webhook is the safety net for browsers
      // that die mid-redirect. Either path can run first; the second is a no-op.
      const { error } = await supabase
        .from("subscriptions")
        .upsert(
          {
            stripe_subscription_id: subId,
            stripe_customer_id: customerId,
            stripe_customer_email: session.customer_email ?? null,
            plan: session.metadata?.plan ?? "pro",
            status: "trialing",
            user_limit: 10000,
            setup_token: crypto.randomUUID(),
          },
          { onConflict: "stripe_subscription_id", ignoreDuplicates: true },
        );
      throwIfError(error, "subscriptions upsert");
      return;
    }
    default:
      // Unknown / ignored event types — return 200 to avoid Stripe retries.
      return;
  }
}
