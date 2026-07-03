"use client";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, Slack } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

// Codes emitted by supabase/functions/slack-oauth plus Slack's own OAuth errors.
const FRIENDLY_ERRORS: Record<string, string> = {
  access_denied: "The Slack sign-in was cancelled before it finished.",
  invalid_request: "The sign-in request was malformed. Please start again from the home page.",
  invalid_state: "This sign-in link has expired. Please try again.",
  invalid_code: "The Slack sign-in code expired. Please try again.",
  code_already_used: "That sign-in link was already used. Please try again.",
  supabase_init_failed: "We couldn't reach our servers. Please try again in a moment.",
  database_error: "We hit a temporary storage problem. Please try again in a moment.",
  token_storage: "We hit a temporary storage problem. Please try again in a moment.",
  app_metadata_failed: "We couldn't finish setting up your account. Please try again.",
  server_error: "Something went wrong on our side. Please try again in a moment.",
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  // `message` arrives as human-readable prose from dashboard-auth;
  // `error` is a machine code — translate the known ones.
  const friendly =
    (message && decodeURIComponent(message)) ||
    (error && FRIENDLY_ERRORS[error]) ||
    "Something went wrong during authentication.";

  const signInWithSlackUrl = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()}/functions/v1/dashboard-auth`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Authentication Failed</CardTitle>
          <CardDescription>{friendly}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Please try signing in again. Make sure your workspace has the Nami app installed.
          </p>
          <div className="pt-4 space-y-2">
            <Button asChild className="w-full">
              <a href={signInWithSlackUrl}>
                <Slack className="mr-2 h-4 w-4" />
                Try Again with Slack
              </a>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/">Go Home</Link>
            </Button>
          </div>
          {error && !FRIENDLY_ERRORS[error] && (
            <p className="text-[11px] text-muted-foreground/60 text-center font-mono">
              Error code: {decodeURIComponent(error)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
