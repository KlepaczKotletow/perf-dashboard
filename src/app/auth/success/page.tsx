"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const team = searchParams.get("team");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Installation Successful!</CardTitle>
          <CardDescription>
            {team ? `${team} has been successfully connected.` : "Your workspace has been successfully connected."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            You can now use the 360 Feedback app in Slack. Try the following commands:
          </p>
          <ul className="text-sm space-y-2 text-slate-600 dark:text-slate-400">
            <li>• <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">/feedback @user message</code> - Give quick feedback</li>
            <li>• <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">/review start</code> - Start a 360 review</li>
            <li>• <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">/review status</code> - Check pending reviews</li>
          </ul>
          <div className="pt-4">
            <Button asChild className="w-full">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthSuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <AuthSuccessContent />
    </Suspense>
  );
}
