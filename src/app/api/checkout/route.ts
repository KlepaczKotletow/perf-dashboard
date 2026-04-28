import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getUserWorkspace } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/roles";

const PRO_LOOKUP_KEY = "pro_monthly";

export async function POST(_request: NextRequest) {
  try {
    const workspace = await getUserWorkspace();
    if (!workspace || !isAdmin(workspace.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const stripe = getStripe();

    const prices = await stripe.prices.list({
      lookup_keys: [PRO_LOOKUP_KEY],
      active: true,
      limit: 1,
    });
    if (prices.data.length === 0) {
      return NextResponse.json(
        { error: "Price not found. Please configure Stripe prices." },
        { status: 500 },
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: workspace.email,
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      payment_method_collection: "if_required",
      subscription_data: {
        trial_period_days: 14,
        metadata: { plan: "pro" },
      },
      metadata: { plan: "pro" },
      success_url: `${siteUrl}/setup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing`,
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
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
