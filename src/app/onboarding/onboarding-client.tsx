"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Building2, Briefcase, LayoutGrid, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

type Choice = "departments" | "career_framework" | "both";

export function OnboardingClient({ workspaceId, workspaceName }: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [saving, setSaving] = useState(false);

  const options: { id: Choice; icon: React.ReactNode; title: string; description: string }[] = [
    {
      id: "departments",
      icon: <Building2 className="h-6 w-6" />,
      title: "Departments only",
      description: "Organise your team by department — Finance, Operations, Marketing. Great for directory and org structure.",
    },
    {
      id: "career_framework",
      icon: <Briefcase className="h-6 w-6" />,
      title: "Career Framework only",
      description: "Set up job functions with levels and competency scorecards. Focus on growth and performance management.",
    },
    {
      id: "both",
      icon: <LayoutGrid className="h-6 w-6" />,
      title: "Both",
      description: "Use departments for org structure AND a career framework for performance. Ideal for growing teams.",
    },
  ];

  async function finish(c: Choice) {
    setSaving(true);
    const useDepartments = c === "departments" || c === "both";
    const useCareerFramework = c === "career_framework" || c === "both";

    await supabase.from("workspaces").update({
      use_departments: useDepartments,
      use_career_framework: useCareerFramework,
      onboarding_completed: true,
    }).eq("id", workspaceId);

    setSaving(false);
    setStep(3);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Welcome to {workspaceName || "Nami"} 👋</h1>
              <p className="text-muted-foreground">Let's get your workspace set up in 2 steps.</p>
            </div>
            <Button size="lg" className="gap-2" onClick={() => setStep(2)}>
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">How do you organise your team?</h2>
              <p className="text-sm text-muted-foreground">You can change this at any time in Settings → General.</p>
            </div>

            <div className="space-y-3">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setChoice(opt.id)}
                  className={cn(
                    "w-full text-left flex items-start gap-4 px-5 py-4 rounded-xl border-2 transition-all",
                    choice === opt.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-border/80 hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                    choice === opt.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{opt.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                  {choice === opt.id && (
                    <CheckCircle2 className="h-5 w-5 text-primary ml-auto shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>

            <Button
              size="lg"
              className="w-full gap-2"
              disabled={!choice || saving}
              onClick={() => choice && finish(choice)}
            >
              {saving ? "Setting up…" : "Continue"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">You're all set!</h2>
              <p className="text-sm text-muted-foreground">
                You can change your structure settings at any time in{" "}
                <span className="font-medium">Settings → General</span>.
              </p>
            </div>
            <Button size="lg" className="gap-2" onClick={() => router.push("/dashboard")}>
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
