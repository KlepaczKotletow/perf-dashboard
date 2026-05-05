import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Lock, CreditCard, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { isAdmin } from "@/lib/roles";
import { UpgradeButton } from "./upgrade-button";
import { PageHeader } from "@/components/page-header";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

async function getSubscription(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) console.error("Failed to fetch subscription:", error.message);
  return data;
}

const planFeatures = [
  "Unlimited review cycles",
  "360° reviews via Slack",
  "9-box calibration",
  "Competency frameworks",
  "Goal & OKR tracking",
  "Pulse surveys & eNPS",
  "Smart Slack reminders",
  "Trend analytics",
];

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  past_due: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  canceled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  trialing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

function formatStatus(status: string): string {
  if (status === "past_due") return "Past Due";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type BillingState =
  | { kind: "free" }
  | { kind: "trialing_no_card"; daysLeft: number; trialEnd: Date }
  | { kind: "trialing_with_card"; trialEnd: Date; nextAmountCents: number }
  | { kind: "active"; nextChargeDate: Date; nextAmountCents: number }
  | { kind: "past_due" }
  | { kind: "canceled" };

async function getStripeBillingState(
  subRow: { stripe_subscription_id: string | null; stripe_customer_id: string | null; status: string } | null,
  billableSeats: number,
): Promise<BillingState> {
  if (!subRow?.stripe_subscription_id) return { kind: "free" };

  let stripeSub: Stripe.Subscription;
  try {
    const stripe = getStripe();
    stripeSub = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id, {
      expand: ["default_payment_method"],
    });
  } catch (e) {
    console.error("Failed to fetch Stripe subscription:", e);
    return { kind: "free" };
  }

  const nextAmountCents = billableSeats * 500;

  if (stripeSub.status === "canceled") return { kind: "canceled" };
  if (stripeSub.status === "past_due" || stripeSub.status === "unpaid") return { kind: "past_due" };

  if (stripeSub.status === "trialing" && stripeSub.trial_end) {
    const trialEnd = new Date(stripeSub.trial_end * 1000);
    const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000));
    if (stripeSub.default_payment_method) {
      return { kind: "trialing_with_card", trialEnd, nextAmountCents };
    }
    return { kind: "trialing_no_card", daysLeft, trialEnd };
  }

  // SDK 20.x relocated current_period_end onto the SubscriptionItem.
  // Fall back to the legacy top-level field for older webhook/API responses.
  const periodEnd =
    stripeSub.items?.data[0]?.current_period_end ??
    (stripeSub as unknown as { current_period_end?: number }).current_period_end;

  return {
    kind: "active",
    nextChargeDate: periodEnd ? new Date(periodEnd * 1000) : new Date(),
    nextAmountCents,
  };
}

async function getRecentInvoices(customerId: string) {
  try {
    const stripe = getStripe();
    const list = await stripe.invoices.list({ customer: customerId, limit: 5 });
    return list.data;
  } catch (e) {
    console.error("Failed to list invoices:", e);
    return [];
  }
}

export default async function BillingPage() {
  const workspace = await getUserWorkspace();

  // Only admins can manage billing
  if (!isAdmin(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
          Billing management is only available to workspace administrators.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const subscription = await getSubscription(workspace!.workspaceId);

  const supabaseRoot = await createServerSupabaseClient();
  const { count: billableSeatsCount } = await supabaseRoot
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace!.workspaceId)
    .neq("employee_status", "deactivated");
  const billableSeats = billableSeatsCount ?? 0;

  const billingState = await getStripeBillingState(subscription, billableSeats);
  const invoices = subscription?.stripe_customer_id
    ? await getRecentInvoices(subscription.stripe_customer_id)
    : [];

  const monthlyTotal = (billableSeats * 5).toFixed(2);
  const hasSubscription = !!subscription?.stripe_subscription_id;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        hat="manage"
        title="Billing"
        subtitle="Manage your workspace subscription and billing"
      />

      {/* Status block */}
      {billingState.kind === "trialing_no_card" && (
        <Card className="border-primary">
          <CardContent className="pt-6 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">14-day free trial — {billingState.daysLeft} days left</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add a payment method before {format(billingState.trialEnd, "MMM d")} to keep your team going.
              </p>
            </div>
            <UpgradeButton workspaceId={workspace?.workspaceId} customerId={subscription?.stripe_customer_id} isManage />
          </CardContent>
        </Card>
      )}

      {billingState.kind === "trialing_with_card" && (
        <Card>
          <CardContent className="pt-6 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Trial ends {format(billingState.trialEnd, "MMM d")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                First charge: ${(billingState.nextAmountCents / 100).toFixed(2)} ({billableSeats} billable users × $5).
              </p>
            </div>
            <UpgradeButton workspaceId={workspace?.workspaceId} customerId={subscription?.stripe_customer_id} isManage />
          </CardContent>
        </Card>
      )}

      {billingState.kind === "past_due" && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-red-800 dark:text-red-200">Payment failed</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Update your payment method to restore access.
              </p>
            </div>
            <UpgradeButton workspaceId={workspace?.workspaceId} customerId={subscription?.stripe_customer_id} isManage />
          </CardContent>
        </Card>
      )}

      {billingState.kind === "canceled" && (
        <Card>
          <CardContent className="pt-6 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Subscription canceled</p>
              <p className="text-sm text-muted-foreground mt-1">Resubscribe to continue using Nami.</p>
            </div>
            <UpgradeButton workspaceId={workspace?.workspaceId} />
          </CardContent>
        </Card>
      )}

      {billingState.kind === "active" && (
        <Card>
          <CardContent className="pt-6 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">
                ${(billingState.nextAmountCents / 100).toFixed(2)}/month
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Next charge {format(billingState.nextChargeDate, "MMM d, yyyy")} ({billableSeats} billable users × $5).
              </p>
            </div>
            <UpgradeButton workspaceId={workspace?.workspaceId} customerId={subscription?.stripe_customer_id} isManage />
          </CardContent>
        </Card>
      )}

      {/* Plan card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                Nami
              </CardTitle>
              <CardDescription className="mt-1">
                $5 per billable user / month
              </CardDescription>
            </div>
            {subscription && (
              <Badge className={statusColors[subscription.status] || statusColors.active}>
                {formatStatus(subscription.status)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-lg font-semibold">
              {billableSeats} billable users × $5 = ${monthlyTotal}/month
            </p>
          </div>

          {!hasSubscription && (
            <>
              <p className="text-sm font-medium mb-3 mt-6">What&apos;s included:</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {planFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex gap-3">
                <UpgradeButton workspaceId={workspace?.workspaceId} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent invoices */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {invoices.map((inv) => (
                <li key={inv.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {inv.created ? format(new Date(inv.created * 1000), "MMM d, yyyy") : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${((inv.amount_paid ?? inv.amount_due ?? 0) / 100).toFixed(2)} · {inv.status}
                    </p>
                  </div>
                  {inv.hosted_invoice_url && (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
