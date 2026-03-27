"use client";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, Slack } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");
  const displayError = message || error;

  const signInWithSlackUrl = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()}/functions/v1/dashboard-auth`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Authentication Failed</CardTitle>
          <CardDescription>
            {displayError ? decodeURIComponent(displayError) : "Something went wrong during authentication."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            Please try signing in again. Make sure your workspace has the 360 Feedback app installed.
          </p>
          <div className="pt-4 space-y-2">
            <Button asChild className="w-full bg-[#4A154B] hover:bg-[#5A1F5C]">
              <a href={signInWithSlackUrl}>
                <Slack className="mr-2 h-4 w-4" />
                Try Again with Slack
              </a>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/">Go Home</Link>
            </Button>
          </div>
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
