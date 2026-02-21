import { redirect } from "next/navigation";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { SetupClient } from "./setup-client";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

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

  // Build the Add to Slack URL with state parameter
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL!).replace(/\/+$/, '');
  const slackClientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID || "";
  const slackRedirectUri = `${supabaseUrl}/functions/v1/slack-oauth`;
  const scopes =
    "app_mentions:read,chat:write,commands,im:history,im:read,im:write,users:read,users:read.email";

  const addToSlackUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(
    slackRedirectUri
  )}&state=${setupToken}`;

  return (
    <SetupClient
      plan={plan}
      email={customerEmail}
      addToSlackUrl={addToSlackUrl}
    />
  );
}
