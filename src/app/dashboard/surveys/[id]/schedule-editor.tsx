"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarClock, Loader2, Repeat } from "lucide-react";

type Recurrence = "weekly" | "biweekly" | "monthly";
type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
type Mode = "now" | "schedule" | "recurring";

interface ScheduleEditorProps {
  surveyId: string;
  workspaceId: string;
  surveyType: string; // "360" | "pulse" | "enps"
  initialConfig: Record<string, unknown>;
  initialSendAt: string | null;
  onUpdated?: () => void;
}

export function ScheduleEditor({
  surveyId,
  workspaceId,
  surveyType,
  initialConfig,
  initialSendAt,
  onUpdated,
}: ScheduleEditorProps) {
  const router = useRouter();
  const supabase = createClient();

  const currentRecurrence = (initialConfig as { recurrence?: Recurrence })
    .recurrence;
  const currentDay = (initialConfig as { recurrence_day?: DayOfWeek })
    .recurrence_day;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(
    currentRecurrence ? "recurring" : initialSendAt ? "schedule" : "now",
  );
  const [scheduleDate, setScheduleDate] = useState<string>(
    initialSendAt
      ? new Date(initialSendAt).toISOString().slice(0, 16)
      : "",
  );
  const [recurrence, setRecurrence] = useState<Recurrence>(
    (currentRecurrence as Recurrence) || "biweekly",
  );
  const [recurrenceDay, setRecurrenceDay] = useState<DayOfWeek>(
    (currentDay as DayOfWeek) || "monday",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recurringAllowed = surveyType === "pulse" || surveyType === "enps";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Merge — keep whatever else is in config (targeting, etc.)
      const nextConfig: Record<string, unknown> = { ...initialConfig };
      let nextSendAt: string | null = null;

      if (mode === "recurring") {
        nextConfig.recurrence = recurrence;
        nextConfig.recurrence_day = recurrenceDay;
        // reset last_recurrence_at so the cron picks it up on next tick
        nextConfig.last_recurrence_at = null;
      } else {
        delete nextConfig.recurrence;
        delete nextConfig.recurrence_day;
        delete nextConfig.last_recurrence_at;
      }

      if (mode === "schedule") {
        if (!scheduleDate) {
          setError("Pick a date & time to schedule");
          setSaving(false);
          return;
        }
        nextSendAt = new Date(scheduleDate).toISOString();
      }

      const { error: updErr } = await supabase
        .from("surveys")
        .update({
          config: nextConfig,
          nami_send_at: nextSendAt,
        })
        .eq("id", surveyId)
        .eq("workspace_id", workspaceId);

      if (updErr) throw updErr;

      // If user picked "now" and there was no previous send, trigger launch.
      if (mode === "now") {
        await supabase.functions.invoke("nami-bot", {
          body: { action: "launch_survey", survey_id: surveyId },
        }).catch(() => {
          // Non-fatal — the update still landed, the cron will pick it up.
        });
      }

      setOpen(false);
      onUpdated?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update schedule");
    } finally {
      setSaving(false);
    }
  }

  async function stopRecurring() {
    setSaving(true);
    setError(null);
    try {
      const nextConfig: Record<string, unknown> = { ...initialConfig };
      delete nextConfig.recurrence;
      delete nextConfig.recurrence_day;
      delete nextConfig.last_recurrence_at;
      const { error: updErr } = await supabase
        .from("surveys")
        .update({ config: nextConfig })
        .eq("id", surveyId)
        .eq("workspace_id", workspaceId);
      if (updErr) throw updErr;
      setOpen(false);
      onUpdated?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stop recurring");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {currentRecurrence ? (
            <>
              <Repeat className="h-4 w-4 mr-1.5" /> Edit schedule
            </>
          ) : (
            <>
              <CalendarClock className="h-4 w-4 mr-1.5" /> Schedule
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule</DialogTitle>
          <DialogDescription>
            Control when Nami sends this survey in Slack.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode picker */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              When to send
            </Label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-muted/60">
              {[
                { value: "now" as const, label: "Now", available: true },
                { value: "schedule" as const, label: "Schedule", available: true },
                { value: "recurring" as const, label: "Recurring", available: recurringAllowed },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!opt.available}
                  onClick={() => setMode(opt.value)}
                  className={`h-8 rounded-md text-xs font-medium transition-colors ${
                    mode === opt.value
                      ? "bg-card text-foreground shadow-sm"
                      : opt.available
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-muted-foreground/30 cursor-not-allowed"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {!recurringAllowed && (
              <p className="text-[11px] text-muted-foreground">
                Recurring is only available for Pulse and eNPS surveys.
              </p>
            )}
          </div>

          {mode === "schedule" && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Send at
              </Label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          )}

          {mode === "recurring" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Frequency
                </Label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-muted/60">
                  {([
                    ["weekly", "Weekly"],
                    ["biweekly", "Every 2 weeks"],
                    ["monthly", "Monthly"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRecurrence(val)}
                      className={`h-8 rounded-md text-xs font-medium transition-colors ${
                        recurrence === val
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Day of the week
                </Label>
                <div className="grid grid-cols-5 gap-1.5 p-1 rounded-lg bg-muted/60">
                  {(["monday", "tuesday", "wednesday", "thursday", "friday"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRecurrenceDay(d)}
                      className={`h-8 rounded-md text-xs font-medium transition-colors capitalize ${
                        recurrenceDay === d
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {d.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Nami sends this survey every {recurrence === "weekly" ? "week" : recurrence === "biweekly" ? "2 weeks" : "month"} on{" "}
                <span className="font-semibold text-foreground capitalize">{recurrenceDay}</span>s.
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          {currentRecurrence ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={stopRecurring}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              Stop recurring
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving} className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="flex-1 sm:flex-initial">
              {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : "Save schedule"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
