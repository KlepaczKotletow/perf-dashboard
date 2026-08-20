"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getClientIdentity } from "@/lib/client-auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { X, Loader2, Check, UserX, UserCheck } from "lucide-react";

interface BulkActionsProps {
  selectedIds: string[];
  users: { id: string; slack_name: string | null; department: string | null }[];
  currentUserId?: string;
  onDone: () => void;
}

export function BulkActions({ selectedIds, users, currentUserId, onDone }: BulkActionsProps) {
  const router = useRouter();
  const [action, setAction] = useState<string>("");
  const [value, setValue] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<{ id: string; slack_name: string }[]>([]);
  const [functions, setFunctions] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string; grade: string | null; job_family_id: string | null }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const identity = await getClientIdentity(supabase);
      if (!identity) return;
      const wsId = identity.workspaceId;
      const [
        { data: usersData },
        { data: functionsData },
        { data: levelsData },
        { data: deptsData },
      ] = await Promise.all([
        supabase.from("users").select("id, slack_name").eq("workspace_id", wsId).order("slack_name"),
        supabase.from("job_families").select("id, name").eq("workspace_id", wsId).is("archived_at", null).order("name"),
        supabase.from("levels").select("id, name, grade, job_family_id").eq("workspace_id", wsId).is("archived_at", null).order("sort_order"),
        supabase.from("departments").select("id, name").eq("workspace_id", wsId).is("archived_at", null).order("name"),
      ]);
      setAllUsers(usersData || []);
      setFunctions(functionsData || []);
      setLevels(levelsData || []);
      setDepartments(deptsData || []);
    }
    load();
  }, []);

  // How many rows a deactivate would actually touch. You are always excluded,
  // so the count in the button and the dialog must match what happens — not
  // the raw selection size.
  const deactivatableCount = currentUserId
    ? selectedIds.filter((id) => id !== currentUserId).length
    : selectedIds.length;

  // Levels filtered to the selected function
  const functionLevels = selectedFunctionId
    ? levels.filter((l) => l.job_family_id === selectedFunctionId)
    : [];

  async function applyStatusChange(newStatus: "deactivated" | "active") {
    setApplying(true);
    setApplyError(null);
    setStatusNotice(null);

    const identity = await getClientIdentity(supabase);
    const wsId = identity?.workspaceId;

    const idsToUpdate = (newStatus === "deactivated" && currentUserId)
      ? selectedIds.filter((id) => id !== currentUserId)
      : selectedIds;

    if (idsToUpdate.length === 0) {
      setApplyError("You cannot deactivate yourself.");
      setApplying(false);
      return;
    }

    // You are silently dropped from your own bulk deactivate. Left unsaid, an
    // admin offboarding a department including themselves sees the selection
    // clear, believes all N are done, and never re-checks the one row that
    // matters most — their own.
    const skippedSelf = idsToUpdate.length < selectedIds.length;

    const updateData = { employee_status: newStatus, updated_at: new Date().toISOString() };
    const results = await Promise.all(
      idsToUpdate.map((id) => supabase.from("users").update(updateData).eq("id", id).eq("workspace_id", wsId))
    );

    const failed = results.filter((r) => r.error).length;
    setApplying(false);

    if (failed > 0) {
      setApplyError(`${failed} update${failed !== 1 ? "s" : ""} failed. Please try again.`);
      return;
    }

    if (skippedSelf) {
      setStatusNotice(
        `${idsToUpdate.length} ${idsToUpdate.length === 1 ? "person" : "people"} deactivated. Your own account was left active — you cannot deactivate yourself.`
      );
    }

    onDone();
    router.refresh();
  }

  async function apply() {
    if (!action || !value) return;
    setApplying(true);
    setApplyError(null);

    const identity = await getClientIdentity(supabase);
    const wsId = identity?.workspaceId;

    // Guard: prevent removing all admins
    if (action === "role" && value !== "admin") {
      const { count: adminCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("workspace_id", wsId);

      const { data: selectedUserRoles } = await supabase
        .from("users")
        .select("id, role")
        .in("id", selectedIds)
        .eq("workspace_id", wsId);

      const selectedAdminCount = ((selectedUserRoles || []) as { id: string; role: string | null }[]).filter(
        (u) => u.role === "admin"
      ).length;

      if ((adminCount || 0) - selectedAdminCount < 1) {
        setApplyError("Cannot remove all admins. At least one admin must remain.");
        setApplying(false);
        return;
      }
    }

    // Guard: prevent circular manager references
    if (action === "manager" && value !== "none") {
      if (selectedIds.includes(value)) {
        setApplyError("Cannot set a person as their own manager.");
        setApplying(false);
        return;
      }

      // Walk up the manager chain from the proposed manager to detect cycles
      const selectedSet = new Set(selectedIds);
      let currentId: string | null = value;
      for (let depth = 0; depth < 20 && currentId; depth++) {
        const result = await supabase
          .from("users")
          .select("manager_id")
          .eq("id", currentId)
          .eq("workspace_id", wsId)
          .single();
        const mgrRow = result.data as { manager_id: string | null } | null;
        currentId = mgrRow?.manager_id || null;
        if (currentId && selectedSet.has(currentId)) {
          setApplyError("This would create a circular reporting chain.");
          setApplying(false);
          return;
        }
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (action === "department") updateData.department = value;
    if (action === "manager") updateData.manager_id = value === "none" ? null : value;
    if (action === "function_level") updateData.level_id = value === "none" ? null : value;
    if (action === "role") updateData.role = value;
    const results = await Promise.all(
      selectedIds.map((id) => supabase.from("users").update(updateData).eq("id", id).eq("workspace_id", wsId))
    );

    const failed = results.filter((r) => r.error).length;
    setApplying(false);

    if (failed > 0) {
      setApplyError(`${failed} of ${selectedIds.length} update${failed !== 1 ? "s" : ""} failed. Please try again.`);
      return;
    }

    setAction("");
    setValue("");
    setSelectedFunctionId("");
    onDone();
    router.refresh();
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {applyError && (
        <div className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg shadow">
          {applyError}
        </div>
      )}
      {statusNotice && (
        <div
          role="status"
          className="bg-card border border-amber-300 dark:border-amber-400/30 text-amber-700 dark:text-amber-300 text-xs px-3 py-1.5 rounded-lg shadow max-w-md text-center"
        >
          {statusNotice}
        </div>
      )}
    <div className="flex items-center gap-3 bg-card border border-border shadow-xl rounded-xl px-4 py-3 animate-in slide-in-from-bottom-4">
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        {selectedIds.length} selected
      </span>

      <div className="h-5 w-px bg-border" />

      <Select value={action} onValueChange={(v) => { setAction(v); setValue(""); setSelectedFunctionId(""); }}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue placeholder="Bulk action..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="department">Set Department</SelectItem>
          <SelectItem value="manager">Set Manager</SelectItem>
          <SelectItem value="function_level">Set Function & Level</SelectItem>
          <SelectItem value="role">Set Role</SelectItem>
        </SelectContent>
      </Select>

      {/* Set Department */}
      {action === "department" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Select department..." />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Set Manager */}
      {action === "manager" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Select manager..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Manager</SelectItem>
            {allUsers
              .filter((u) => !selectedIds.includes(u.id))
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.slack_name || "Unknown"}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}

      {/* Set Function & Level — optional function filter, then level */}
      {action === "function_level" && (
        <>
          <Select value={selectedFunctionId || "__all__"} onValueChange={(v) => { setSelectedFunctionId(v === "__all__" ? "" : v); setValue(""); }}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Filter by function..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All functions</SelectItem>
              {functions.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={value} onValueChange={(val) => {
            setValue(val);
            // Auto-set function filter from selected level
            if (val && val !== "none") {
              const picked = levels.find((l) => l.id === val);
              if (picked?.job_family_id) setSelectedFunctionId(picked.job_family_id);
            }
          }}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Select level..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No level</SelectItem>
              {selectedFunctionId
                ? functionLevels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.grade ? ` (${l.grade})` : ""}
                    </SelectItem>
                  ))
                : /* Show all levels grouped by function */
                  functions.map((f) => {
                    const fLevels = levels.filter((l) => l.job_family_id === f.id);
                    if (fLevels.length === 0) return null;
                    return (
                      <div key={f.id}>
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {f.name}
                        </div>
                        {fLevels.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}{l.grade ? ` (${l.grade})` : ""}
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })
              }
            </SelectContent>
          </Select>
        </>
      )}

      {/* Set Role */}
      {action === "role" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Select role..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Employee</SelectItem>
            <SelectItem value="hr">HR</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Button
        size="sm"
        className="h-8 text-xs"
        disabled={!action || !value || applying}
        onClick={apply}
      >
        {applying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <Check className="h-3.5 w-3.5 mr-1" />
            Apply
          </>
        )}
      </Button>

      <div className="h-5 w-px bg-border" />

      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-400/10 dark:border-red-400/20"
        disabled={applying}
        onClick={() => setShowDeactivateDialog(true)}
      >
        <UserX className="h-3.5 w-3.5 mr-1" />
        Deactivate {deactivatableCount}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-400/10 dark:border-emerald-400/20"
        disabled={applying}
        onClick={() => applyStatusChange("active")}
      >
        <UserCheck className="h-3.5 w-3.5 mr-1" />
        Reactivate
      </Button>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDone} aria-label="Clear selection">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>

    {/* Deactivating N people at once is the most destructive action in the
        Directory — it removes them from billing, from the default list view
        and from review eligibility. Select-all is a single click, so this
        confirmation names the blast radius before it happens. The
        single-person path (team/[id]/deactivate-button.tsx) already
        arms-then-confirms; this one used to fire on the first click. */}
    <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Deactivate {deactivatableCount} {deactivatableCount === 1 ? "person" : "people"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They stop receiving Nami DMs and are removed from active review cycles, and
            they no longer count towards your seat total. Their history is kept, and you
            can reactivate them from here.
            {selectedIds.length > deactivatableCount && (
              <> Your own account is not included — you cannot deactivate yourself.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => applyStatusChange("deactivated")}
            className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
          >
            Deactivate {deactivatableCount}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}
