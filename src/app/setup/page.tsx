import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { SetupClient } from "./setup-client";
import { getStripe } from "@/lib/stripe";
import { signOAuthState } from "@/lib/oauth-state";

// signOAuthState produces a per-request token; never cache this page.
export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface SetupPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    redirect("/pricing");
  }

  const stripe = getStripe();
  const supabase = getSupabase();

  // Retrieve the Stripe checkout session
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
  } catch {
    redirect("/pricing?error=invalid_session");
  }

  // Verify payment was successful
  if (session.payment_status !== "paid") {
    redirect("/pricing?error=payment_incomplete");
  }

  const plan = (session.metadata?.plan as string) || "starter";
  const customerEmail = session.customer_email || "";
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || "";
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription)?.id || "";

  // Check if we already have a subscription for this checkout (idempotent)
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, setup_token")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  let setupToken: string;

  if (existing) {
    // Already created, reuse the setup token
    setupToken = existing.setup_token || crypto.randomUUID();
    if (!existing.setup_token) {
      await supabase
        .from("subscriptions")
        .update({ setup_token: setupToken })
        .eq("id", existing.id);
    }
  } else {
    // Create a new subscription record (workspace_id is NULL until Slack install)
    setupToken = crypto.randomUUID();

    const userLimit =
      plan === "enterprise" ? 10000 : plan === "professional" ? 500 : 50;

    await supabase.from("subscriptions").insert({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_email: customerEmail,
      plan,
      status: "active",
      user_limit: userLimit,
      setup_token: setupToken,
    });
  }

  // Build the Add to Slack URL with HMAC-signed state. We embed the
  // setup_token inside the signed payload so the slack-oauth callback can
  // still link the new install to the pre-paid Stripe subscription.
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL!).trim().replace(/\/+$/, '');
  const slackClientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID || "";
  const slackRedirectUri = `${supabaseUrl}/functions/v1/slack-oauth`;
  const scopes =
    "app_mentions:read,chat:write,commands,im:history,im:read,im:write,users:read,users:read.email";

  const oauthState = await signOAuthState({ purpose: "setup", setup_token: setupToken });
  const addToSlackUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=${scopes}&user_scope=identity.basic,identity.email&redirect_uri=${encodeURIComponent(
    slackRedirectUri
  )}&state=${encodeURIComponent(oauthState)}`;

  return (
    <SetupClient
      plan={plan}
      email={customerEmail}
      addToSlackUrl={addToSlackUrl}
    />
  );
}
