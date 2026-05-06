"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Pencil, Check, Building2 } from "lucide-react";
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

interface Department { id: string; name: string; }

interface DepartmentsClientProps {
  departments: Department[];
  memberCounts: Record<string, number>;
  workspaceId: string;
}

export function DepartmentsClient({ departments: initialDepartments, memberCounts: initialCounts, workspaceId }: DepartmentsClientProps) {
  const router = useRouter();
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [error, setError] = useState<string | null>(null);

  // Add
  const [showAdd, setShowAdd] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Rename — escapingRef prevents blur from saving when Escape is pressed
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const escapingRename = useRef(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleAdd() {
    if (!addValue.trim()) return;
    setAddLoading(true);
    try {
      const { error: err } = await supabase.from("departments").insert({
        name: addValue.trim(),
        workspace_id: workspaceId,
      });
      if (err) throw err;
      setAddValue("");
      setShowAdd(false);
      router.refresh();
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : "") ?? "Failed to add department");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRename(dept: Department) {
    if (escapingRename.current) {
      escapingRename.current = false;
      return;
    }
    if (!renameValue.trim() || renameValue.trim() === dept.name) {
      setRenamingId(null);
      return;
    }
    const newName = renameValue.trim();
    try {
      const { error: err } = await supabase
        .from("departments")
        .update({ name: newName })
        .eq("id", dept.id)
        .eq("workspace_id", workspaceId);
      if (err) throw err;

      await supabase
        .from("users")
        .update({ department: newName })
        .eq("department", dept.name)
        .eq("workspace_id", workspaceId);

      setRenamingId(null);
      router.refresh();
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : "") ?? "Failed to rename department");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const dept = deleteTarget;
    setDeleteLoading(true);
    try {
      // Archive rather than hard-delete so existing users retain the historical
      // dept label on their profile. Archived depts drop out of the admin list
      // and out of assignment dropdowns, but past associations stay intact —
      // matches Lattice / Leapsome taxonomy semantics.
      const { error: err } = await supabase
        .from("departments")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", dept.id)
        .eq("workspace_id", workspaceId);
      if (err) throw err;
      router.refresh();
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : "") ?? "Failed to archive department");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }

  const deleteCount = deleteTarget ? (initialCounts[deleteTarget.name] || 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Departments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {initialDepartments.length} department{initialDepartments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Department
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {initialDepartments.length === 0 && !showAdd ? (
          <div className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No departments yet</p>
            <p className="text-sm text-muted-foreground">Add your first department to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {initialDepartments.map((dept) => (
              <li key={dept.id} className="group flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                {renamingId === dept.id ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(dept);
                      if (e.key === "Escape") {
                        escapingRename.current = true;
                        setRenamingId(null);
                      }
                    }}
                    onBlur={() => handleRename(dept)}
                    className="h-7 text-sm w-48"
                  />
                ) : (
                  <span className="text-sm font-medium text-foreground">{dept.name}</span>
                )}
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    {initialCounts[dept.name] || 0} {(initialCounts[dept.name] || 0) === 1 ? "member" : "members"}
                  </Badge>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setRenamingId(dept.id); setRenameValue(dept.name); }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(dept)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Archive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}

            {showAdd && (
              <li className="flex items-center gap-2 px-5 py-3">
                <Input
                  autoFocus
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") { setShowAdd(false); setAddValue(""); }
                  }}
                  placeholder="Department name…"
                  className="h-7 text-sm w-48"
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={addLoading || !addValue.trim()}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAdd(false); setAddValue(""); }}>
                  Cancel
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Archive confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCount > 0
                ? `${deleteCount} ${deleteCount === 1 ? "person is" : "people are"} in this department. Their profiles will keep the department label for historical context, but it will no longer appear in the admin list or assignment dropdowns.`
                : "This department will be hidden from the admin list and assignment dropdowns. Past associations are preserved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
