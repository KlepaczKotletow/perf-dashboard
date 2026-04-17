"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Play, CheckCircle, Archive, Trash2, Loader2, Medal, Bell, BellOff, AlertCircle } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

interface CycleActionsProps {
  cycle: {
    id: string;
    name: string;
    status: string;
    grades_released?: boolean;
    workspace_id: string;
  };
  employeeCount: number;
  submittedCount?: number;
  pendingManagerCount?: number;
  userRole?: string;
}

export function CycleActions({ cycle, employeeCount, submittedCount, pendingManagerCount, userRole }: CycleActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [notificationError, setNotificationError] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notifyOnRelease, setNotifyOnRelease] = useState(true);

  const isHR = userRole === "hr" || userRole === "admin";

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function updateStatus(newStatus: string) {
    setLoading(true);
    setActionError(null);
    try {
      const { error } = await supabase
        .from("performance_cycles")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", cycle.id)
        .eq("workspace_id", cycle.workspace_id);

      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error("Error updating cycle status:", err);
      setActionError("Failed to update cycle status. Please try again.");
    } finally {
      setLoading(false);
      setShowLaunchDialog(false);
    }
  }

  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  async function sendNotifications(mode: "all" | "missed" = "all") {
    setNotificationError(false);
    setNotificationSent(false);
    setNotificationMessage(null);
    try {
      const { data, error: notifError } = await supabase.functions.invoke("nami-bot", {
        body: { action: "launch_cycle", cycle_id: cycle.id, mode },
      });
      if (notifError) {
        console.error("Failed to send Slack notifications:", notifError);
        setNotificationError(true);
        return;
      }

      const result = data as { sent?: number; skipped?: number; failed?: number; failedUsers?: string[] } | null;
      const sent = result?.sent ?? 0;
      const skipped = result?.skipped ?? 0;
      const failed = result?.failed ?? 0;

      if (sent > 0) {
        const parts = [`Sent ${sent} notification${sent !== 1 ? "s" : ""}`];
        if (skipped > 0) parts.push(`${skipped} skipped`);
        if (failed > 0) parts.push(`${failed} failed`);
        setNotificationMessage(parts.join(", ") + ".");
        setNotificationSent(true);
        setTimeout(() => { setNotificationSent(false); setNotificationMessage(null); }, 5000);
      } else if (failed > 0) {
        setNotificationMessage(`All sends failed (${failed} error${failed !== 1 ? "s" : ""}). Check Slack bot configuration.`);
        setNotificationError(true);
      } else if (skipped > 0) {
        setNotificationMessage(`${skipped} notification${skipped !== 1 ? "s" : ""} skipped (already sent or no Slack account).`);
        setNotificationSent(true);
        setTimeout(() => { setNotificationSent(false); setNotificationMessage(null); }, 5000);
      } else {
        setNotificationMessage("All employees already notified.");
        setNotificationSent(true);
        setTimeout(() => { setNotificationSent(false); setNotificationMessage(null); }, 5000);
      }
    } catch (notifErr) {
      console.error("Failed to send Slack notifications:", notifErr);
      setNotificationError(true);
    }
  }

  async function launchCycle() {
    let failed = false;
    setLoading(true);
    setNotificationError(false);
    setNotificationSent(false);
    try {
      // 1. Fetch employees enrolled in this cycle
      // Safe: performance_cycle_employees scoped through cycle_id (workspace-verified cycle)
      const { data: cycleEmployees, error: empError } = await supabase
        .from("performance_cycle_employees")
        .select("employee_id")
        .eq("performance_cycle_id", cycle.id);

      if (empError) throw empError;

      // 2. Fetch manager_id + name for each employee
      const employeeIds = (cycleEmployees || []).map((e: any) => e.employee_id);
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, slack_name, manager_id")
        .in("id", employeeIds)
        .eq("workspace_id", cycle.workspace_id);

      if (usersError) throw usersError;

      // 2b. Validate all enrolled employees still exist
      const foundIds = new Set((users || []).map((u: any) => u.id));
      const missingIds = employeeIds.filter((id: string) => !foundIds.has(id));
      if (missingIds.length > 0) {
        await supabase
          .from("performance_cycle_employees")
          .delete()
          .in("employee_id", missingIds)
          .eq("performance_cycle_id", cycle.id);
        if (foundIds.size === 0) {
          throw new Error("No valid employees found. All enrolled employees may have been removed.");
        }
      }

      // 2c. Pre-check: manager_review phase needs every enrolled employee to
      //    have a manager_id. The launch_cycle RPC will enforce this at the DB
      //    level (23514) but catching it here lets us show a better message
      //    with specific names and avoids a round-trip.
      const missingMgr = (users || []).filter((u: any) => !u.manager_id);
      if (missingMgr.length > 0) {
        const names = missingMgr.slice(0, 5).map((u: any) => u.slack_name || "someone").join(", ");
        const tail = missingMgr.length > 5 ? ` and ${missingMgr.length - 5} more` : "";
        throw new Error(
          `Can't launch: ${missingMgr.length} employee(s) have no manager — ${names}${tail}. ` +
          `Set their managers in Team Settings first, or remove them from the cycle.`
        );
      }

      // 3. Build all assignments in memory first — so if anything is wrong with the
      //    data we catch it before touching the DB. Delete old rows only after we
      //    know the new set is ready to insert.
      const enrolledIds = new Set((users || []).map((u: any) => u.id));

      const standardAssignments = (users || []).map((u: any) => ({
        cycle_id: cycle.id,
        employee_id: u.id,
        manager_id: u.manager_id || null,
        assignment_type: "standard",
        status: "pending",
      }));

      const upwardAssignments = (users || [])
        .filter((u: any) => u.manager_id && enrolledIds.has(u.manager_id))
        .map((u: any) => ({
          cycle_id: cycle.id,
          employee_id: u.manager_id,  // manager being reviewed
          reviewer_id: u.id,           // direct report doing the review
          manager_id: null,
          assignment_type: "upward",
          status: "pending",
        }));

      const allAssignments = [...standardAssignments, ...upwardAssignments];

      // Launch atomically via RPC. The function serialises concurrent launches
      // with an advisory transaction lock and inserts assignments with ON
      // CONFLICT DO NOTHING against the uniq_review_assignment index — so two
      // admins clicking Launch at the same time can no longer produce duplicate
      // review_assignments. The RPC also activates the first phase, flips the
      // cycle status to active, and moves cycle employees to in_progress in
      // the same transaction.
      const { error: launchError } = await supabase.rpc("launch_cycle", {
        p_cycle_id: cycle.id,
        p_assignments: allAssignments,
      });

      if (launchError) {
        const code = (launchError as { code?: string }).code;
        if (code === "23514") {
          // Server-side "missing manager" guard. Extract the DB message so
          // the admin sees the same list of names we show in the pre-check.
          throw new Error(launchError.message);
        }
        throw launchError;
      }

      // 7. Send Slack notifications — check the returned error (functions.invoke never throws)
      await sendNotifications();

      router.refresh();
    } catch (err: any) {
      failed = true;
      console.error("Error launching cycle:", err);
      // Surface the validation message when the server or pre-check
      // produced a specific one — avoid swallowing it into "try again".
      setActionError(
        typeof err?.message === "string" && err.message.startsWith("Can't launch:")
          ? err.message
          : typeof err?.message === "string" && err.message.startsWith("Cannot launch:")
          ? err.message
          : "Failed to launch cycle. Please try again."
      );
    } finally {
      setLoading(false);
      if (!failed) setShowLaunchDialog(false);  // only close dialog on success
    }
  }

  async function handleDelete() {
    setLoading(true);
    setActionError(null);
    try {
      const { error } = await supabase
        .from("performance_cycles")
        .delete()
        .eq("id", cycle.id)
        .eq("workspace_id", cycle.workspace_id);

      if (error) throw error;
      router.push("/dashboard/cycles");
      router.refresh();
    } catch (err) {
      console.error("Error deleting cycle:", err);
      setActionError("Failed to delete cycle. Please try again.");
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  }

  async function releaseGrades() {
    setLoading(true);
    setActionError(null);
    try {
      const { error } = await supabase
        .from("performance_cycles")
        .update({ grades_released: true, status: "completed", updated_at: new Date().toISOString() })
        .eq("id", cycle.id)
        .eq("workspace_id", cycle.workspace_id);

      if (error) throw error;

      if (notifyOnRelease) {
        try {
          await supabase.functions.invoke("nami-bot", {
            body: { action: "release_grades", cycle_id: cycle.id },
          });
        } catch (notifErr) {
          console.error("Grade release notification failed:", notifErr);
        }
      }

      router.refresh();
    } catch (err) {
      console.error("Error releasing grades:", err);
      setActionError("Failed to release grades. Please try again.");
    } finally {
      setLoading(false);
      setShowReleaseDialog(false);
    }
  }

  return (
    <>
      {actionError && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 px-3 py-1.5 rounded-md">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {actionError}
        </div>
      )}
      {notificationError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-3 py-1.5 rounded-md">
          <BellOff className="h-3.5 w-3.5 shrink-0" />
          {notificationMessage || "Slack notifications failed \u2014 use \"Re-send Slack Notifications\" to retry."}
        </div>
      )}
      {notificationSent && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/20 px-3 py-1.5 rounded-md">
          <Bell className="h-3.5 w-3.5 shrink-0" />
          {notificationMessage || "Slack notifications sent successfully."}
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {cycle.status === "draft" && (
            <DropdownMenuItem
              onClick={() => setShowLaunchDialog(true)}
              disabled={loading || employeeCount === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              Launch Cycle
            </DropdownMenuItem>
          )}
          {cycle.status === "active" && (
            <DropdownMenuItem onClick={() => setShowCompleteDialog(true)} disabled={loading}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Completed
            </DropdownMenuItem>
          )}
          {cycle.status === "active" && (
            <DropdownMenuItem
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                await sendNotifications("missed");
                setLoading(false);
              }}
            >
              <Bell className="h-4 w-4 mr-2" />
              Re-send Slack Notifications
            </DropdownMenuItem>
          )}
          {(cycle.status === "completed" || cycle.status === "active") && (
            <DropdownMenuItem onClick={() => setShowCloseDialog(true)} disabled={loading}>
              <Archive className="h-4 w-4 mr-2" />
              Close Cycle
            </DropdownMenuItem>
          )}
          {isHR && !cycle.grades_released && (cycle.status === "active" || cycle.status === "completed" || cycle.status === "closed") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowReleaseDialog(true)} disabled={loading}>
                <Medal className="h-4 w-4 mr-2" />
                Release Grades
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            disabled={loading}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Cycle
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Launch Confirmation Dialog */}
      <AlertDialog open={showLaunchDialog} onOpenChange={setShowLaunchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Launch Performance Cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will activate the cycle and notify {employeeCount} employee{employeeCount !== 1 ? "s" : ""} via Slack that their review has started.
              You won&apos;t be able to add more employees after launching.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={launchCycle} disabled={loading}>
              {loading ? "Launching…" : "Launch Cycle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Performance Cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{cycle.name}&quot; and all associated data.
              {submittedCount && submittedCount > 0 ? (
                <> This includes <strong>{submittedCount} submitted review{submittedCount !== 1 ? "s" : ""}</strong> that will be permanently lost.</>
              ) : null}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Completed Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Cycle as Completed?</AlertDialogTitle>
            <AlertDialogDescription>
              This will end the active review period for &quot;{cycle.name}&quot;.
              {pendingManagerCount !== undefined && pendingManagerCount > 0 ? (
                <> <strong>{pendingManagerCount} manager review{pendingManagerCount !== 1 ? "s" : ""} are still pending</strong> and managers will no longer be prompted once closed.</>
              ) : (
                <> All manager reviews have been submitted.</>
              )}
              {" "}You can still release grades afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => updateStatus("completed")}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Completed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Cycle Confirmation Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close This Cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing &quot;{cycle.name}&quot; will archive it and remove it from active views.
              All data is preserved and the cycle can still be viewed, but no further changes will be expected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => updateStatus("closed")}>
              <Archive className="h-4 w-4 mr-2" />
              Close Cycle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Release Grades Confirmation Dialog */}
      <AlertDialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release Grades to Employees?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will make all ratings and final grades visible to employees in &quot;{cycle.name}&quot;.
                </p>
                {(submittedCount !== undefined || pendingManagerCount !== undefined) && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">Summary</p>
                    <p className="text-muted-foreground mt-1">
                      {employeeCount} participant{employeeCount !== 1 ? "s" : ""}
                      {submittedCount !== undefined && ` · ${submittedCount} completed`}
                      {pendingManagerCount !== undefined && pendingManagerCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400"> · {pendingManagerCount} missing</span>
                      )}
                    </p>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnRelease}
                    onChange={(e) => setNotifyOnRelease(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">Notify employees via Slack</span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={releaseGrades} disabled={loading}>
              {loading ? "Releasing…" : (
                <>
                  <Medal className="h-4 w-4 mr-2" />
                  Release Grades
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
