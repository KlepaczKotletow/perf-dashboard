import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Lock, CreditCard, Users, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { isAdmin } from "@/lib/roles";
import { UpgradeButton } from "./upgrade-button";
import { PageHeader } from "@/components/page-header";

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

async function getUserCount(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) console.error("Failed to fetch user count:", error.message);
  return count || 0;
}

const planDetails: Record<string, { name: string; price: string; features: string[] }> = {
  free: {
    name: "Free",
    price: "$0",
    features: ["Up to 5 users", "Basic reviews", "Slack integration", "1 template"],
  },
  starter: {
    name: "Starter",
    price: "$5/user/mo",
    features: ["Up to 50 users", "All review features", "Unlimited templates", "Email support"],
  },
  professional: {
    name: "Professional",
    price: "$10/user/mo",
    features: ["Up to 500 users", "Advanced analytics", "Priority support", "API access"],
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    features: ["Unlimited users", "Custom integrations", "Dedicated support", "SSO/SAML"],
  },
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  past_due: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  canceled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  trialing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export default async function BillingPage() {
  const workspace = await getUserWorkspace();
  
  // Only admins can manage billing
  if (!isAdmin(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Access Restricted
        </h1>
        <p className="text-muted-foreground mb-6">
          Billing management is only available to workspace administrators.
        </p>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const subscription = await getSubscription(workspace!.workspaceId);
  const userCount = await getUserCount(workspace!.workspaceId);
  const plan = subscription?.plan || "free";
  const planInfo = planDetails[plan] || planDetails.free;

  return (
    <div className="space-y-8">
      <PageHeader
        hat="manage"
        title="Billing"
        subtitle="Manage your workspace subscription and billing"
      />

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                Current Plan: {planInfo.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {planInfo.price} {plan !== "free" && plan !== "enterprise" && "per user"}
              </CardDescription>
            </div>
            {subscription && (
              <Badge className={statusColors[subscription.status] || statusColors.active}>
                {subscription.status === "past_due" ? "Past Due" : 
                 subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{userCount} / {subscription?.user_limit || 5} Users</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription?.user_limit && userCount >= subscription.user_limit
                      ? "User limit reached - upgrade to add more"
                      : `${(subscription?.user_limit || 5) - userCount} seats available`}
                  </p>
                </div>
              </div>

              {subscription?.current_period_end && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {subscription.cancel_at_period_end ? "Cancels" : "Renews"} on{" "}
                      {format(new Date(subscription.current_period_end), "MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.cancel_at_period_end
                        ? "Your subscription will end after this period"
                        : "Your subscription will auto-renew"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Plan Features:</p>
              <ul className="space-y-2">
                {planInfo.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {subscription?.status === "past_due" && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Payment Failed</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Your last payment failed. Please update your payment method to continue using premium features.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            {plan === "free" ? (
              <UpgradeButton workspaceId={workspace?.workspaceId} />
            ) : (
              <UpgradeButton 
                workspaceId={workspace?.workspaceId} 
                customerId={subscription?.stripe_customer_id}
                isManage={true}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Compare Plans</CardTitle>
          <CardDescription>Choose the right plan for your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {Object.entries(planDetails).map(([key, info]) => (
              <div 
                key={key}
                className={`p-4 rounded-lg border-2 ${
                  key === plan ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <h3 className="font-bold">{info.name}</h3>
                <p className="text-2xl font-bold text-primary mt-1">{info.price}</p>
                {key !== "free" && key !== "enterprise" && (
                  <p className="text-xs text-muted-foreground">per user/month</p>
                )}
                <ul className="mt-4 space-y-2">
                  {info.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {key === plan && (
                  <Badge className="mt-4 w-full justify-center">Current Plan</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Period</CardTitle>
          <CardDescription>Track your workspace activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-3xl font-bold text-primary">{userCount}</p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-3xl font-bold text-primary">
                {Math.round((userCount / (subscription?.user_limit || 5)) * 100)}%
              </p>
              <p className="text-sm text-muted-foreground">Seat Utilization</p>
            </div>
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-3xl font-bold text-primary">
                {(subscription?.user_limit || 5) - userCount}
              </p>
              <p className="text-sm text-muted-foreground">Available Seats</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
