"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { getClientIdentity } from "@/lib/client-auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Check } from "lucide-react";

interface BulkActionsProps {
  selectedIds: string[];
  users: { id: string; slack_name: string | null; department: string | null }[];
  onDone: () => void;
}

export function BulkActions({ selectedIds, users, onDone }: BulkActionsProps) {
  const router = useRouter();
  const [action, setAction] = useState<string>("");
  const [value, setValue] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<{ id: string; slack_name: string }[]>([]);
  const [functions, setFunctions] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string; grade: string | null; job_family_id: string | null }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>("");

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

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
        supabase.from("job_families").select("id, name").eq("workspace_id", wsId).order("name"),
        supabase.from("levels").select("id, name, grade, job_family_id").eq("workspace_id", wsId).order("sort_order"),
        supabase.from("departments").select("id, name").eq("workspace_id", wsId).order("name"),
      ]);
      setAllUsers(usersData || []);
      setFunctions(functionsData || []);
      setLevels(levelsData || []);
      setDepartments(deptsData || []);
    }
    load();
  }, []);

  // Levels filtered to the selected function
  const functionLevels = selectedFunctionId
    ? levels.filter((l) => l.job_family_id === selectedFunctionId)
    : [];

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

      const selectedAdminCount = (selectedUserRoles || []).filter(
        (u: any) => u.role === "admin"
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

    const updateData: any = { updated_at: new Date().toISOString() };

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

      {/* Set Function & Level — two-step */}
      {action === "function_level" && (
        <>
          <Select value={selectedFunctionId} onValueChange={(v) => { setSelectedFunctionId(v); setValue(""); }}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Function..." />
            </SelectTrigger>
            <SelectContent>
              {functions.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedFunctionId && (
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Level..." />
              </SelectTrigger>
              <SelectContent>
                {functionLevels.length === 0 ? (
                  <SelectItem value="_none" disabled>No levels configured</SelectItem>
                ) : (
                  functionLevels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.grade ? ` (${l.grade})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
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
        disabled={!action || !value || applying || (action === "function_level" && !selectedFunctionId)}
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

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDone}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
    </div>
  );
}
