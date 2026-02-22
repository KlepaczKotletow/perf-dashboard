"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X, Loader2, Check } from "lucide-react";

interface BulkActionsProps {
  selectedIds: string[];
  users: { id: string; slack_name: string | null; department: string | null }[];
  onDone: () => void;
}

export function BulkActions({ selectedIds, users, onDone }: BulkActionsProps) {
  const [action, setAction] = useState<string>("");
  const [value, setValue] = useState("");
  const [applying, setApplying] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; slack_name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string; grade: string | null; family: string }[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const [{ data: usersData }, { data: levelsData }] = await Promise.all([
        supabase.from("users").select("id, slack_name").order("slack_name"),
        supabase.from("levels").select("id, name, grade, job_family:job_families(name)").order("name"),
      ]);
      setAllUsers(usersData || []);
      setLevels(
        (levelsData || []).map((l: any) => ({
          id: l.id,
          name: l.name,
          grade: l.grade,
          family: l.job_family?.name || "",
        }))
      );
      // Collect unique departments from all users
      const depts = [...new Set((usersData || []).map((u: any) => u.department).filter(Boolean))] as string[];
      // Also include from the parent users prop
      const parentDepts = [...new Set(users.map((u) => u.department).filter(Boolean))] as string[];
      setDepartments([...new Set([...depts, ...parentDepts])].sort());
    }
    load();
  }, []);

  async function apply() {
    if (!action || !value) return;
    setApplying(true);

    const updateData: any = { updated_at: new Date().toISOString() };

    if (action === "department") updateData.department = value;
    if (action === "manager") updateData.manager_id = value === "none" ? null : value;
    if (action === "level") updateData.level_id = value === "none" ? null : value;
    if (action === "role") updateData.role = value;

    for (const id of selectedIds) {
      await supabase.from("users").update(updateData).eq("id", id);
    }

    setApplying(false);
    setAction("");
    setValue("");
    onDone();
    window.location.reload();
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border shadow-xl rounded-xl px-4 py-3 animate-in slide-in-from-bottom-4">
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        {selectedIds.length} selected
      </span>

      <div className="h-5 w-px bg-border" />

      <Select value={action} onValueChange={(v) => { setAction(v); setValue(""); }}>
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue placeholder="Bulk action..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="department">Set Department</SelectItem>
          <SelectItem value="manager">Set Manager</SelectItem>
          <SelectItem value="level">Set Level</SelectItem>
          <SelectItem value="role">Set Role</SelectItem>
        </SelectContent>
      </Select>

      {action === "department" && (
        <div className="flex items-center gap-1.5">
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Select dept..." />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">or</span>
          <Input
            className="w-32 h-8 text-xs"
            placeholder="New dept..."
            value={departments.includes(value) ? "" : value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      )}

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

      {action === "level" && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-56 h-8 text-xs">
            <SelectValue placeholder="Select level..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Level</SelectItem>
            {levels.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.family ? `${l.family} — ` : ""}{l.name}{l.grade ? ` (${l.grade})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDone}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
