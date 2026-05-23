"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Slack,
  Users,
  Shield,
  Zap,
  Loader2,
} from "lucide-react";

const plans = [
  {
    id: "pro",
    name: "Nami",
    description: "Performance reviews, 360 feedback, and OKRs — in Slack.",
    monthlyPrice: 5,
    features: [
      "Unlimited review cycles",
      "360° reviews via Slack",
      "9-box calibration",
      "Competency frameworks",
      "Goal & OKR tracking",
      "Pulse surveys & eNPS",
      "Smart Slack reminders",
      "Trend analytics",
    ],
    cta: "Start 14-day free trial",
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);
    setLoadingPlan("pro");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        if (res.status === 403) {
          // Not signed in (or not an admin in any workspace) — start with Slack install,
          // then come back to /dashboard/settings/billing to start the trial.
          const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
          if (supabaseUrl) {
            window.location.href = `${supabaseUrl}/functions/v1/dashboard-auth`;
            return;
          }
          // NEXT_PUBLIC_SUPABASE_URL is baked at build time, so an empty value
          // means the build is misconfigured. Surface a clearer next step
          // instead of falling through to the generic error.
          setError("Sign in to start your trial");
          setLoadingPlan(null);
          return;
        }
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || `Request failed (${res.status})`);
        setLoadingPlan(null);
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Checkout failed");
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight">Nami</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Button size="sm" variant="outline" asChild>
              <a href={`${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()}/functions/v1/dashboard-auth`}>
                Sign in
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-lg mx-auto">
          Pay per user, cancel anytime. Start running better reviews in minutes.
        </p>
      </section>

      {/* Plan */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="max-w-md mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="relative rounded-2xl border border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20 p-8 flex flex-col"
            >
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    ${plan.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /user/month
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  No credit card required
                </p>
              </div>

              <Button
                onClick={() => handleCheckout()}
                disabled={loadingPlan === plan.id}
                className="w-full mb-2"
              >
                {loadingPlan === plan.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {plan.cta}
                {loadingPlan !== plan.id && (
                  <ArrowRight className="h-4 w-4 ml-1" />
                )}
              </Button>

              {error && (
                <p className="text-sm text-destructive mt-2 mb-2 text-center">
                  {error}
                </p>
              )}

              <ul className="space-y-2.5 flex-1 mt-6">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-muted-foreground"
                  >
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <p className="text-center text-sm text-muted-foreground mt-8">
            Need custom pricing or onboarding?{" "}
            <a href="mailto:hello@namihr.com" className="text-primary hover:underline">
              Talk to us
            </a>
          </p>
        </div>
      </section>

      {/* Trust indicators */}
      <section className="border-t border-border/50 bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid sm:grid-cols-4 gap-8 text-center">
            {[
              { icon: Slack, label: "Slack-native", detail: "No context switching" },
              { icon: Shield, label: "EU-hosted, encrypted", detail: "TLS in transit, AES-256 at rest" },
              { icon: Users, label: "Per-seat billing", detail: "Pay only for active users" },
              { icon: Zap, label: "5 min setup", detail: "Install and go" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <item.icon className="h-6 w-6 text-primary" />
                <p className="font-medium text-sm text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-lg font-bold text-foreground">Nami</span>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/security"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Security
              </Link>
              <Link
                href="/support"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
