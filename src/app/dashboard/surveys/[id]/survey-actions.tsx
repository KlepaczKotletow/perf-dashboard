"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Bell, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function SurveyActions({ surveyId }: { surveyId: string }) {
  const [loading, setLoading] = useState<"remind" | "close" | null>(null);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function sendReminder() {
    setLoading("remind");
    try {
      const { error } = await supabase.functions.invoke("survey-notifications", {
        body: { survey_id: surveyId, mode: "remind" },
      });
      if (error) throw error;
      alert("Reminders sent to pending participants!");
    } catch (e: any) {
      alert(`Failed to send reminders: ${e.message}`);
    } finally {
      setLoading(null);
    }
  }

  async function closeSurvey() {
    if (!confirm("Close this survey? Participants will no longer be able to respond.")) return;
    setLoading("close");
    try {
      const { error } = await supabase
        .from("surveys")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", surveyId);
      if (error) throw error;
      router.refresh();
    } catch (e: any) {
      alert(`Failed to close survey: ${e.message}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={sendReminder} disabled={!!loading}>
        {loading === "remind"
          ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          : <Bell className="h-4 w-4 mr-1.5" />}
        Send Reminder
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={closeSurvey}
        disabled={!!loading}
        className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50"
      >
        {loading === "close"
          ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          : <XCircle className="h-4 w-4 mr-1.5" />}
        Close Survey
      </Button>
    </div>
  );
}
