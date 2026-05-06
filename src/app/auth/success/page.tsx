"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Users, Settings, BarChart3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const team = searchParams.get("team");
  const returning = searchParams.get("returning") === "true";
  const needsSignin = searchParams.get("needs_signin") === "true";

  // SECURITY: If we landed here from OAuth install without a proper magic link,
  // sign out any stale session to prevent cross-workspace data leakage.
  useEffect(() => {
    if (needsSignin) {
      const supabase = createClient();
      supabase.auth.signOut();
    }
  }, [needsSignin]);

  if (returning) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-400/10 flex items-center justify-center">
              <RefreshCw className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              App Re-installed
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              {team ? `${team} has been reconnected.` : "Your workspace has been reconnected."}{" "}
              All your existing data — reviews, cycles, and competencies — is intact.
            </p>
          </div>

          <Button size="sm" asChild className="gap-1.5">
            <Link href="/dashboard">
              Go to Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg text-center space-y-8">
        {/* Hero */}
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-400/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            You&apos;re all set!
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {team ? `${team} is now connected to Nami.` : "Your workspace is now connected to Nami."}{" "}
            Here&apos;s what to do next:
          </p>
        </div>

        {/* Onboarding steps */}
        <div className="grid gap-3 text-left max-w-md mx-auto">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card">
            <div className="h-8 w-8 rounded-lg bg-sky-100 dark:bg-sky-400/10 flex items-center justify-center shrink-0 mt-0.5">
              <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">1. Sync your team</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Import your Slack workspace members with one click
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card">
            <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-400/10 flex items-center justify-center shrink-0 mt-0.5">
              <Settings className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">2. Set up org structure</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign managers, departments, and define competencies
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card">
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-400/10 flex items-center justify-center shrink-0 mt-0.5">
              <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">3. Launch your first review cycle</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Start collecting 360° feedback from your team
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button size="sm" asChild className="gap-1.5">
          {needsSignin ? (
            <a href={`${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()}/functions/v1/dashboard-auth`}>
              Sign in with Slack
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Link href="/dashboard">
              Go to Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function AuthSuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <AuthSuccessContent />
    </Suspense>
  );
}
