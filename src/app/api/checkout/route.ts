import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

// Map plan names to Stripe price lookup keys
// These must match the lookup_keys you configure in Stripe Dashboard
const PLAN_LOOKUP_KEYS: Record<string, string> = {
  starter: "starter_monthly",
  professional: "professional_monthly",
  enterprise: "enterprise_monthly",
  starter_annual: "starter_annual",
  professional_annual: "professional_annual",
  enterprise_annual: "enterprise_annual",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, email, annual } = body as {
      plan: string;
      email: string;
      annual?: boolean;
    };

    if (!plan || !email) {
      return NextResponse.json(
        { error: "Missing plan or email" },
        { status: 400 }
      );
    }

    const lookupKey = annual
      ? PLAN_LOOKUP_KEYS[`${plan}_annual`]
      : PLAN_LOOKUP_KEYS[plan];

    if (!lookupKey) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const stripe = getStripe();

    // Look up the price by its lookup key
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      active: true,
      limit: 1,
    });

    if (prices.data.length === 0) {
      return NextResponse.json(
        { error: "Price not found. Please configure Stripe prices." },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: prices.data[0].id,
          // For per-seat pricing, start with quantity 1 (the admin)
          // Quantity updates happen via webhook when new users join
          quantity: 1,
        },
      ],
      metadata: {
        plan,
        annual: annual ? "true" : "false",
      },
      success_url: `${siteUrl}/setup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing`,
      subscription_data: {
        metadata: {
          plan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Checkout error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
