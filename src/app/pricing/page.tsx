"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Slack,
  Users,
  BarChart3,
  Shield,
  Zap,
  Loader2,
} from "lucide-react";

const plans = [
  {
    id: "starter",
    name: "Starter",
    description: "For small teams getting started with structured reviews.",
    monthlyPrice: 1,
    annualPrice: 10,
    userLimit: "50 users",
    features: [
      "Up to 50 users",
      "Unlimited review cycles",
      "Slack integration",
      "Competency framework",
      "Basic analytics",
      "Email support",
    ],
    cta: "Get started",
    popular: false,
  },
  {
    id: "professional",
    name: "Professional",
    description: "For growing teams that need advanced insights.",
    monthlyPrice: 3,
    annualPrice: 30,
    userLimit: "500 users",
    features: [
      "Up to 500 users",
      "Everything in Starter",
      "Advanced analytics & 9-box",
      "Calibration tools",
      "Custom templates",
      "Priority support",
    ],
    cta: "Get started",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations with custom needs.",
    monthlyPrice: null,
    annualPrice: null,
    userLimit: "Unlimited",
    features: [
      "Unlimited users",
      "Everything in Professional",
      "SSO / SAML",
      "Custom integrations",
      "Dedicated CSM",
      "SLA guarantee",
    ],
    cta: "Contact sales",
    popular: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState<string | null>(null);

  async function handleCheckout(planId: string) {
    if (planId === "enterprise") {
      window.location.href = "mailto:sales@getperf.com?subject=Enterprise%20Plan%20Inquiry";
      return;
    }

    if (!showEmail || showEmail !== planId) {
      setShowEmail(planId);
      return;
    }

    if (!email || !email.includes("@")) {
      return;
    }

    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, email, annual }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch {
      alert("Failed to start checkout. Please try again.");
    } finally {
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

        {/* Annual toggle */}
        <div className="mt-8 inline-flex items-center gap-3 bg-muted rounded-full p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              !annual
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              annual
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Annual
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
              Save 17%
            </Badge>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.popular
                  ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                  : "border-border/60 bg-card/50"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs">
                  Most popular
                </Badge>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                {plan.monthlyPrice !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        ${annual ? plan.annualPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        /user/{annual ? "year" : "month"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.userLimit} included
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-4xl font-bold text-foreground">
                      Custom
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tailored to your organization
                    </p>
                  </>
                )}
              </div>

              {/* Email input - shown when user clicks CTA */}
              {showEmail === plan.id && plan.id !== "enterprise" && (
                <div className="mb-4">
                  <input
                    type="email"
                    placeholder="Work email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCheckout(plan.id);
                    }}
                  />
                </div>
              )}

              <Button
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan === plan.id}
                variant={plan.popular ? "default" : "outline"}
                className="w-full mb-6"
              >
                {loadingPlan === plan.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {showEmail === plan.id && plan.id !== "enterprise"
                  ? "Continue to payment"
                  : plan.cta}
                {!(showEmail === plan.id) && (
                  <ArrowRight className="h-4 w-4 ml-1" />
                )}
              </Button>

              <ul className="space-y-2.5 flex-1">
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
        </div>
      </section>

      {/* Trust indicators */}
      <section className="border-t border-border/50 bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid sm:grid-cols-4 gap-8 text-center">
            {[
              { icon: Slack, label: "Slack-native", detail: "No context switching" },
              { icon: Shield, label: "SOC 2 ready", detail: "Enterprise-grade security" },
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
