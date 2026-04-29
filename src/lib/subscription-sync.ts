import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase-server";

// Pull the live Stripe subscription's status, cancel_at_period_end, and
// current_period_end and write them to the matching subscriptions row.
// One source of truth (Stripe) — used by the webhook (for events that touch
// either field) and by the daily reconcile cron (for state-drift recovery).
export async function syncSubscriptionState(subId: string): Promise<void> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subId);
  // current_period_end was relocated to subscription items in Stripe API
  // 2025-03-31 / SDK v18+. Read from the item; fall back to the legacy
  // top-level field for older payloads.
  const periodEnd =
    sub.items?.data[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq("stripe_subscription_id", subId);
  if (error) throw new Error(`subscriptions update: ${error.message}`);
}
