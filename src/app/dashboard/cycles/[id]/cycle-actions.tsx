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
import { MoreHorizontal, Play, CheckCircle, Archive, Trash2, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

interface CycleActionsProps {
  cycle: {
    id: string;
    name: string;
    status: string;
  };
  employeeCount: number;
}

export function CycleActions({ cycle, employeeCount }: CycleActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("performance_cycles")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", cycle.id);

      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error("Error updating cycle status:", err);
    } finally {
      setLoading(false);
      setShowLaunchDialog(false);
    }
  }

  async function launchCycle() {
    setLoading(true);
    try {
      // 1. Fetch employees enrolled in this cycle
      const { data: cycleEmployees, error: empError } = await supabase
        .from("performance_cycle_employees")
        .select("employee_id")
        .eq("performance_cycle_id", cycle.id);

      if (empError) throw empError;

      // 2. Fetch manager_id for each employee
      const employeeIds = (cycleEmployees || []).map((e: any) => e.employee_id);
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, manager_id")
        .in("id", employeeIds);

      if (usersError) throw usersError;

      // 3. Create standard review_assignments for each employee (self + manager review)
      const assignments = (users || []).map((u: any) => ({
        cycle_id: cycle.id,
        employee_id: u.id,
        manager_id: u.manager_id || null,
        assignment_type: "standard",
        status: "pending",
      }));

      if (assignments.length > 0) {
        const { error: assignError } = await supabase
          .from("review_assignments")
          .insert(assignments);
        if (assignError) throw assignError;
      }

      // 3b. Create upward review assignments (direct reports review their managers)
      const enrolledIds = new Set(employeeIds);
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

      if (upwardAssignments.length > 0) {
        const { error: upwardError } = await supabase
          .from("review_assignments")
          .insert(upwardAssignments);
        if (upwardError) throw upwardError;
      }

      // 4. Activate the first phase if any exist
      const { data: phases } = await supabase
        .from("cycle_phases")
        .select("id")
        .eq("cycle_id", cycle.id)
        .order("sort_order")
        .limit(1);

      if (phases && phases.length > 0) {
        await supabase
          .from("cycle_phases")
          .update({ status: "active" })
          .eq("id", phases[0].id);
      }

      // 5. Set cycle status to active
      const { error: statusError } = await supabase
        .from("performance_cycles")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", cycle.id);

      if (statusError) throw statusError;

      // 6. Update performance_cycle_employees to in_progress
      await supabase
        .from("performance_cycle_employees")
        .update({ status: "in_progress" })
        .eq("performance_cycle_id", cycle.id);

      // 7. Send Slack notifications (fire and forget)
      try {
        await supabase.functions.invoke("cycle-notifications", {
          body: { action: "launch", cycle_id: cycle.id },
        });
      } catch (notifErr) {
        console.error("Failed to send launch notifications:", notifErr);
      }

      router.refresh();
    } catch (err) {
      console.error("Error launching cycle:", err);
    } finally {
      setLoading(false);
      setShowLaunchDialog(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("performance_cycles")
        .delete()
        .eq("id", cycle.id);

      if (error) throw error;
      router.push("/dashboard/cycles");
      router.refresh();
    } catch (err) {
      console.error("Error deleting cycle:", err);
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  }

  return (
    <>
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
              disabled={employeeCount === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              Launch Cycle
            </DropdownMenuItem>
          )}
          {cycle.status === "active" && (
            <DropdownMenuItem onClick={() => updateStatus("completed")}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Completed
            </DropdownMenuItem>
          )}
          {(cycle.status === "completed" || cycle.status === "active") && (
            <DropdownMenuItem onClick={() => updateStatus("closed")}>
              <Archive className="h-4 w-4 mr-2" />
              Close Cycle
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={launchCycle}>
              Launch Cycle
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
              This action cannot be undone.
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
    </>
  );
}
