"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  TriangleAlert,
  Bell,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

export type NamiRow = {
  assignmentId: string;
  userId: string;
  name: string;
  role: string;
  roleKind: "self" | "manager" | "upward";
  completed: boolean;
  reminderCount: number;
  escalated: boolean;
  sentAt: string | null;
  slackUserId: string | null;
};

interface NamiStatusTableProps {
  cycleId: string;
  rows: NamiRow[];
  canSendManualReminder: boolean;
}

type RowState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; at: number }
  | { kind: "error"; message: string };

export function NamiStatusTable({ cycleId, rows, canSendManualReminder }: NamiStatusTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const supabase = createClient();

  const completedCount = rows.filter((r) => r.completed).length;
  const remindedCount = rows.filter((r) => !r.completed && r.reminderCount > 0 && !r.escalated).length;
  const escalatedCount = rows.filter((r) => r.escalated && !r.completed).length;

  function rowKey(row: NamiRow) {
    return `${row.assignmentId}:${row.roleKind}:${row.userId}`;
  }

  async function sendReminder(row: NamiRow) {
    const key = rowKey(row);
    setRowStates((s) => ({ ...s, [key]: { kind: "sending" } }));
    try {
      const { data, error } = await supabase.functions.invoke("nami-bot", {
        body: {
          action: "send_manual_reminder",
          cycle_id: cycleId,
          assignment_id: row.assignmentId,
          user_id: row.userId,
          role: row.roleKind,
        },
      });

      const result = data as { ok?: boolean; error?: string } | null;
      if (error || !result?.ok) {
        const message = result?.error || (error?.message ?? "Couldn't send reminder");
        setRowStates((s) => ({ ...s, [key]: { kind: "error", message } }));
        return;
      }

      setRowStates((s) => ({ ...s, [key]: { kind: "sent", at: Date.now() } }));
      // Refresh the page data so the Sent / Reminder count picks up the new log row.
      startTransition(() => router.refresh());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send reminder";
      setRowStates((s) => ({ ...s, [key]: { kind: "error", message } }));
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Nami Status
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {completedCount}/{rows.length} completed
              {remindedCount > 0 && <> &middot; {remindedCount} reminded</>}
              {escalatedCount > 0 && <> &middot; {escalatedCount} escalated</>}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {/* Column headers */}
        <div
          className={`grid ${
            canSendManualReminder
              ? "grid-cols-[1fr_120px_80px_80px_80px_110px]"
              : "grid-cols-[1fr_120px_80px_80px_80px]"
          } items-center px-6 pb-2 border-b border-border/60 ${
            canSendManualReminder ? "min-w-[690px]" : "min-w-[580px]"
          }`}
        >
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Participant</p>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Role</p>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Status</p>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Delivery</p>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Reminders</p>
          {canSendManualReminder && (
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Action</p>
          )}
        </div>

        {/* Rows */}
        <div
          className={`divide-y divide-border/50 ${
            canSendManualReminder ? "min-w-[690px]" : "min-w-[580px]"
          }`}
        >
          {rows.map((row) => {
            const key = rowKey(row);
            const state = rowStates[key] ?? { kind: "idle" as const };
            const isSending = state.kind === "sending";
            const justSent = state.kind === "sent";
            const hasError = state.kind === "error";
            const disabled = isSending || !row.slackUserId || row.completed;

            return (
              <div
                key={key}
                className={`grid ${
                  canSendManualReminder
                    ? "grid-cols-[1fr_120px_80px_80px_80px_110px]"
                    : "grid-cols-[1fr_120px_80px_80px_80px]"
                } items-center px-6 py-3 hover:bg-muted/30 transition-colors`}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                  {hasError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 truncate mt-0.5">
                      {state.message}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{row.role}</p>
                <div className="flex justify-center">
                  {row.completed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Done
                    </span>
                  ) : row.escalated ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                      <TriangleAlert className="h-3.5 w-3.5" />
                      Escalated
                    </span>
                  ) : row.reminderCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" />
                      Reminded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
                      <Circle className="h-3.5 w-3.5" />
                      Pending
                    </span>
                  )}
                </div>
                <div className="flex justify-center">
                  {!row.slackUserId ? (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                      Skipped
                    </Badge>
                  ) : row.sentAt ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                      Sent
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60">
                      Pending
                    </Badge>
                  )}
                </div>
                <div className="flex justify-center">
                  <span
                    className={`text-xs font-medium ${
                      row.escalated
                        ? "text-red-600 dark:text-red-400"
                        : row.reminderCount > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {row.reminderCount}
                  </span>
                </div>
                {canSendManualReminder && (
                  <div className="flex justify-center">
                    <Button
                      size="sm"
                      variant={justSent ? "outline" : "ghost"}
                      className="h-7 px-2 text-[11px]"
                      disabled={disabled}
                      onClick={() => sendReminder(row)}
                      title={
                        row.completed
                          ? "Already completed"
                          : !row.slackUserId
                            ? "User hasn't connected Slack"
                            : "Send a Slack reminder now"
                      }
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Sending
                        </>
                      ) : justSent ? (
                        <>
                          <CheckCheck className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                          Sent
                        </>
                      ) : (
                        <>
                          <Bell className="h-3 w-3 mr-1" />
                          Remind
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
