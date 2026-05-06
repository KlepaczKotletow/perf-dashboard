"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export function OnboardingClient({ workspaceId, workspaceName }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function finish() {
    setSaving(true);
    setSaveError(null);
    try {
      const { error: err } = await supabase.from("workspaces").update({
        use_departments: true,
        use_career_framework: true,
        onboarding_completed: true,
      }).eq("id", workspaceId);
      if (err) throw err;
      setStep(2);
    } catch {
      setSaveError("Failed to set up your workspace. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome to {workspaceName || "Nami"} 👋
              </h1>
              <p className="text-muted-foreground">
                Let&apos;s get your workspace set up.
              </p>
            </div>
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            <Button
              size="lg"
              className="gap-2"
              disabled={saving}
              onClick={finish}
            >
              {saving ? "Setting up…" : "Get started"}{" "}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">You&apos;re all set!</h2>
              <p className="text-sm text-muted-foreground">
                Your workspace is ready to go.
              </p>
            </div>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => router.push("/dashboard")}
            >
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
