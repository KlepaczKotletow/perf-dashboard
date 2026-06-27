"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Slack, Users, Shield, Zap, Loader2, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { CtaBand } from "@/components/marketing/cta-band";
import { Kicker } from "@/components/marketing/kicker";
import { GlowCard } from "@/components/marketing/glow-card";
import { SlackCtaButton } from "@/components/marketing/slack-cta-button";
import { getAddToSlackUrl, getSignInUrl } from "@/lib/slack-cta";

const PRO_FEATURES = [
  "Unlimited review cycles",
  "360° reviews via Slack",
  "9-box calibration",
  "Competency frameworks",
  "Goal & OKR tracking",
  "Pulse surveys & eNPS",
  "Smart Slack reminders",
  "Trend analytics",
];

const FREE_FEATURES = [
  "Every Pro feature",
  "Up to 10 people",
  "360° reviews & goals in Slack",
  "Pulse surveys & analytics",
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addToSlackUrl = getAddToSlackUrl("pricing");

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader ctaPurpose="pricing" />

      <Masthead
        kicker="Pricing"
        title={
          <>
            One price.{" "}
            <span className="font-serif-accent text-[hsl(var(--spotlight))]">Free under ten.</span>
          </>
        }
        lead="Everything in a single $5/user plan — 14-day trial, no credit card, cancel anytime. And free forever for teams of 10 or fewer. No four-figure minimums, no sales-led gauntlet."
      />

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-8 lg:px-10">
          <div className="grid items-stretch gap-6 md:grid-cols-2">
            {/* Free tier — surfaced prominently */}
            <GlowCard className="flex h-full flex-col bg-gradient-to-br from-[#faf8f2] to-white p-8">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-foreground">Free</h2>
                <p className="mt-1 text-sm text-muted-foreground">For small teams, indefinitely.</p>
                <p className="mt-4 text-5xl font-black tracking-tight text-foreground">
                  $0
                  <span className="text-lg font-normal text-muted-foreground">/forever</span>
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">Teams of 10 or fewer · no card</p>
              </div>
              <ul className="mb-8 flex-1 space-y-2.5">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <SlackCtaButton href={addToSlackUrl} animated={false} className="w-full">
                Add to Slack — free
              </SlackCtaButton>
            </GlowCard>

            {/* Pro — elevated with animated border; keeps direct checkout */}
            <div className="animated-border h-full rounded-2xl">
              <div className="relative flex h-full flex-col rounded-2xl border border-primary/20 bg-white p-8 shadow-xl shadow-primary/[0.12]">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-white">
                  Most popular
                </div>
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-foreground">Pro</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Performance reviews, 360° feedback, and OKRs — in Slack.
                  </p>
                  <p className="mt-4 text-5xl font-black tracking-tight text-foreground">
                    $5
                    <span className="text-lg font-normal text-muted-foreground">/user/mo</span>
                  </p>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    14-day free trial · no credit card · cancel anytime
                  </p>
                </div>

                <ul className="mb-8 flex-1 space-y-2.5">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleCheckout()}
                  disabled={loadingPlan === "pro"}
                  size="lg"
                  className="w-full rounded-full"
                >
                  {loadingPlan === "pro" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Start 14-day free trial
                  {loadingPlan !== "pro" && <ArrowRight className="ml-1 h-4 w-4" />}
                </Button>
                <a
                  href={getSignInUrl()}
                  className="mt-3 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Already installed? Sign in to start your trial
                </a>

                {error && (
                  <p className="mt-3 text-center text-sm text-destructive">{error}</p>
                )}
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Need custom pricing, onboarding, or hands-on migration?{" "}
            <a href="mailto:hello@namihr.com" className="text-primary hover:underline">
              Talk to us about the Partners Programme
            </a>
            .
          </p>
        </section>

        {/* Trust indicators */}
        <section className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          <Kicker className="mb-8 justify-center">Why it&apos;s a safe yes</Kicker>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { icon: Slack, label: "Slack-native", detail: "No context switching" },
              { icon: Shield, label: "EU-hosted, encrypted", detail: "TLS in transit, AES-256 at rest" },
              { icon: Users, label: "Per-seat billing", detail: "Pay only for active users" },
              { icon: Zap, label: "5-min setup", detail: "Install and go" },
            ].map((item) => (
              <GlowCard key={item.label} className="p-5 text-center">
                <item.icon className="mx-auto mb-3 h-6 w-6 text-primary" />
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </GlowCard>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
          <CtaBand
            href={addToSlackUrl}
            title="Start free. Stay free under ten."
            subtitle="Add Nami to your Slack workspace in about a minute. No credit card, cancel anytime."
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
