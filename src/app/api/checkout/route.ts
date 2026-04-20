import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/roles";

function getStripe() {
  // Throw a recognisable, generic error if STRIPE_SECRET_KEY is missing so the
  // caller sees "Payments not configured" instead of leaking SDK internals like
  // "Neither apiKey nor config.authenticator provided".
  if (!process.env.STRIPE_SECRET_KEY) {
    const e = new Error("Payments not configured");
    (e as Error & { code?: string }).code = "stripe_not_configured";
    throw e;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
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
    const workspace = await getUserWorkspace();

    if (!workspace || !isAdmin(workspace.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { plan, annual } = body as {
      plan: string;
      annual?: boolean;
    };

    // Use the authenticated user's email, not the request body
    const email = workspace.email;

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
    const code = (err as Error & { code?: string })?.code;
    if (code === "stripe_not_configured") {
      return NextResponse.json(
        { error: "Payments are not configured. Contact support." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
