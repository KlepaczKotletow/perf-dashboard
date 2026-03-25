"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Bell, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SurveyActions({ surveyId, workspaceId }: { surveyId: string; workspaceId: string }) {
  const [loading, setLoading] = useState<"remind" | "close" | null>(null);
  const [reminderSuccess, setReminderSuccess] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function sendReminder() {
    setLoading("remind");
    setReminderSuccess(false);
    setReminderError(null);
    try {
      const { error } = await supabase.functions.invoke("survey-notifications", {
        body: { survey_id: surveyId, mode: "remind" },
      });
      if (error) throw error;
      setReminderSuccess(true);
      setTimeout(() => setReminderSuccess(false), 4000);
    } catch (e: any) {
      setReminderError(e.message || "Failed to send reminders");
    } finally {
      setLoading(null);
    }
  }

  async function closeSurvey() {
    setLoading("close");
    setCloseError(null);
    try {
      const { error } = await supabase
        .from("surveys")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", surveyId)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      router.refresh();
    } catch (e: any) {
      setCloseError(e.message || "Failed to close survey");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={sendReminder}
          disabled={!!loading}
        >
          {loading === "remind"
            ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            : <Bell className="h-4 w-4 mr-1.5" />}
          {reminderSuccess ? "Reminders sent!" : "Send Reminder"}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!!loading}
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50"
            >
              {loading === "close"
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                : <XCircle className="h-4 w-4 mr-1.5" />}
              Close Survey
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Close this survey?</AlertDialogTitle>
              <AlertDialogDescription>
                Participants will no longer be able to submit responses. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={closeSurvey}
                disabled={loading === "close"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Close Survey
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {reminderError && (
        <p className="text-xs text-red-600 dark:text-red-400">{reminderError}</p>
      )}
      {closeError && (
        <p className="text-xs text-red-600 dark:text-red-400">{closeError}</p>
      )}
    </div>
  );
}
