"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { CheckCircle2, Slack, ArrowRight } from "lucide-react";

interface SetupClientProps {
  plan: string;
  email: string;
  addToSlackUrl: string;
}

export function SetupClient({ plan, email, addToSlackUrl }: SetupClientProps) {
  const planLabel =
    plan === "professional"
      ? "Professional"
      : plan === "enterprise"
      ? "Enterprise"
      : "Starter";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-foreground">Payment</span>
          </div>
          <div className="w-12 h-px bg-primary" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              2
            </div>
            <span className="text-sm font-medium text-foreground">
              Connect Slack
            </span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span className="text-sm text-muted-foreground">Dashboard</span>
          </div>
        </div>

        <Card className="border-border/60">
          <CardContent className="pt-8 pb-8 px-8 text-center">
            <div className="h-14 w-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              Payment confirmed
            </h1>
            <p className="text-muted-foreground text-sm mb-1">
              {planLabel} plan activated for{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>

            <div className="my-8 border-t border-border/50" />

            <h2 className="text-lg font-semibold text-foreground mb-2">
              Connect your Slack workspace
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Install Nami in your Slack workspace so your team can run reviews
              and give feedback directly from Slack.
            </p>

            <Button size="lg" className="h-12 px-8 text-sm w-full" asChild>
              <a href={addToSlackUrl}>
                <Slack className="h-5 w-5 mr-2" />
                Add to Slack
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>

            <p className="text-xs text-muted-foreground mt-4">
              You&apos;ll be redirected to Slack to authorize the app, then
              straight to your dashboard.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Questions?{" "}
          <Link
            href="/support"
            className="underline hover:text-foreground transition-colors"
          >
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}
