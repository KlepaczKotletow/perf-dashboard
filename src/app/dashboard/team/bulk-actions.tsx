"use client";

import { useState, useEffect, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Check } from "lucide-react";

interface BulkActionsProps {
  selectedIds: string[];
  users: { id: string; slack_name: string | null; department: string | null }[];
  onDone: () => void;
  useDepartments?: boolean;
  useCareerFramework?: boolean;
}

export function BulkActions({ selectedIds, users, onDone, useDepartments = false, useCareerFramework = false }: BulkActionsProps) {
  const [action, setAction] = useState<string>("");
  const [value, setValue] = useState("");
  const [applying, setApplying] = useState(false);

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
      const [
        { data: usersData },
        { data: functionsData },
        { data: levelsData },
        { data: deptsData },
      ] = await Promise.all([
        supabase.from("users").select("id, slack_name").order("slack_name"),
        supabase.from("job_families").select("id, name").order("name"),
        supabase.from("levels").select("id, name, grade, job_family_id").order("sort_order"),
        supabase.from("departments").select("id, name").order("name"),
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

    const updateData: any = { updated_at: new Date().toISOString() };

    if (action === "department") updateData.department = value;
    if (action === "manager") updateData.manager_id = value === "none" ? null : value;
    if (action === "function_level") updateData.level_id = value === "none" ? null : value;
    if (action === "role") updateData.role = value;

    for (const id of selectedIds) {
      await supabase.from("users").update(updateData).eq("id", id);
    }

    setApplying(false);
    setAction("");
    setValue("");
    setSelectedFunctionId("");
    onDone();
    window.location.reload();
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border shadow-xl rounded-xl px-4 py-3 animate-in slide-in-from-bottom-4">
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        {selectedIds.length} selected
      </span>

      <div className="h-5 w-px bg-border" />

      <Select value={action} onValueChange={(v) => { setAction(v); setValue(""); setSelectedFunctionId(""); }}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue placeholder="Bulk action..." />
        </SelectTrigger>
        <SelectContent>
          {useDepartments && <SelectItem value="department">Set Department</SelectItem>}
          <SelectItem value="manager">Set Manager</SelectItem>
          {useCareerFramework && <SelectItem value="function_level">Set Function & Level</SelectItem>}
          <SelectItem value="role">Set Role</SelectItem>
        </SelectContent>
      </Select>

      {/* Set Department */}
      {action === "department" && useDepartments && (
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
      {action === "function_level" && useCareerFramework && (
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
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
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
  );
}
