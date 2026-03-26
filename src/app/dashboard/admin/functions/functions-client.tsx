// src/app/dashboard/admin/functions/functions-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { getClientIdentity } from "@/lib/client-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  X,
  Check,
  Loader2,
  Pencil,
  Trash2,
  ChevronRight,
  Users,
  MoreHorizontal,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ──────────────────────────────────────────────────────────────────

interface JobFamily { id: string; name: string; description: string | null; }
interface Level { id: string; name: string; grade: string | null; sort_order: number; job_family_id: string | null; }
interface Competency { id: string; name: string; description: string | null; category: string | null; is_core: boolean; job_family_id: string | null; workspace_id: string; }
interface LevelCompetency { id: string; level_id: string; competency_id: string; expected_level: number; workspace_id: string; }
interface User { id: string; level_id: string | null; }

interface FunctionsClientProps {
  functions: JobFamily[];
  levels: Level[];
  competencies: Competency[];
  levelCompetencies: LevelCompetency[];
  users: User[];
  canEdit: boolean;
  workspaceId: string;
}

// ── Score Picker ───────────────────────────────────────────────────────────

const proficiencyColors: Record<number, string> = {
  1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/40",
  2: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/40",
  3: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/40",
  4: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/40",
  5: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
};

function ScorePicker({
  onSelect,
  onClose,
}: {
  onSelect: (v: number | null) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-popover border rounded-lg shadow-lg p-1.5 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className={`w-7 h-7 rounded-md text-[11px] font-bold transition-all hover:scale-110 border ${proficiencyColors[n]}`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onSelect(null)}
          className="w-7 h-7 rounded-md text-[11px] font-bold bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all border border-border"
          title="Clear"
        >
          ×
        </button>
      </div>
    </>
  );
}

// ── Sortable Level Pill ────────────────────────────────────────────────────

interface SortableLevelProps {
  level: Level;
  canEdit: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
  onRenameBlur: () => void;
  onStartRename: () => void;
  onDelete: () => void;
}

function SortableLevel({
  level,
  canEdit,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameKeyDown,
  onRenameBlur,
  onStartRename,
  onDelete,
}: SortableLevelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  if (isRenaming) {
    return (
      <div ref={setNodeRef} style={style}>
        <Input
          autoFocus
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={onRenameKeyDown}
          onBlur={onRenameBlur}
          className="h-7 text-xs w-28"
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/level relative"
    >
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-full border text-xs font-medium transition-colors ${
          canEdit
            ? "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
            : "border-border bg-muted/30"
        } ${isDragging ? "shadow-md" : ""}`}
      >
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <span
          className={canEdit ? "cursor-pointer" : ""}
          onClick={canEdit ? onStartRename : undefined}
        >
          {level.name}
        </span>
        {level.grade && (
          <span className="text-muted-foreground text-[10px]">{level.grade}</span>
        )}
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover/level:opacity-100 transition-opacity ml-0.5 hover:text-destructive"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function FunctionsClient({
  functions: initialFunctions,
  levels: initialLevels,
  competencies: initialCompetencies,
  levelCompetencies: initialLevelCompetencies,
  users,
  canEdit,
  workspaceId,
}: FunctionsClientProps) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );

  // ── State ──────────────────────────────────────────────────────────────

  const [selectedId, setSelectedId] = useState<string | null>(initialFunctions[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  // Sidebar: add function
  const [showAddFunction, setShowAddFunction] = useState(false);
  const [newFunctionName, setNewFunctionName] = useState("");
  const [addFunctionLoading, setAddFunctionLoading] = useState(false);

  // Function rename
  const [renamingFunctionId, setRenamingFunctionId] = useState<string | null>(null);
  const [renameFunctionValue, setRenameFunctionValue] = useState("");

  // Levels
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [newLevelName, setNewLevelName] = useState("");
  const [renamingLevelId, setRenamingLevelId] = useState<string | null>(null);
  const [renameLevelValue, setRenameLevelValue] = useState("");
  const [levels, setLevels] = useState<Level[]>(initialLevels);

  // Skills
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  const [addSkillLoading, setAddSkillLoading] = useState(false);

  // Score picker — key is `${level_id}-${competency_id}`
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  // Function header inline editing
  const [editingFunctionName, setEditingFunctionName] = useState(false);
  const [editFunctionNameValue, setEditFunctionNameValue] = useState("");
  const [editingFunctionDesc, setEditingFunctionDesc] = useState(false);
  const [editFunctionDescValue, setEditFunctionDescValue] = useState("");

  // Core skills collapsible
  const [coreSkillsOpen, setCoreSkillsOpen] = useState(true);

  // Skill description expand/collapse
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────

  const matrixLookup = useMemo(() => {
    const lookup: Record<string, { id: string; expected_level: number }> = {};
    initialLevelCompetencies.forEach((lc) => {
      lookup[`${lc.level_id}-${lc.competency_id}`] = { id: lc.id, expected_level: lc.expected_level };
    });
    return lookup;
  }, [initialLevelCompetencies]);

  // Keep local levels state in sync after router.refresh()
  useEffect(() => {
    setLevels(initialLevels);
  }, [initialLevels]);

  const memberCountByFunction = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      if (!u.level_id) return;
      const level = levels.find((l) => l.id === u.level_id);
      if (level?.job_family_id) {
        counts[level.job_family_id] = (counts[level.job_family_id] || 0) + 1;
      }
    });
    return counts;
  }, [users, levels]);

  const selectedFunction = initialFunctions.find((f) => f.id === selectedId);
  const functionLevels = levels
    .filter((l) => l.job_family_id === selectedId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const functionSkills = initialCompetencies.filter((c) => c.job_family_id === selectedId);
  const coreSkills = initialCompetencies.filter((c) => !c.job_family_id);

  // ── Helpers ────────────────────────────────────────────────────────────

  async function getAuthUser() {
    const identity = await getClientIdentity(supabase);
    if (!identity) throw new Error("Not authenticated");
    return { user: identity, wsId: identity.workspaceId };
  }

  // ── Handlers: Functions ────────────────────────────────────────────────

  async function handleAddFunction() {
    if (!newFunctionName.trim()) return;
    setAddFunctionLoading(true);
    setError(null);
    try {
      const { wsId } = await getAuthUser();
      const { data, error: err } = await supabase
        .from("job_families")
        .insert({ name: newFunctionName.trim(), workspace_id: wsId })
        .select("id")
        .single();
      if (err) throw err;
      setNewFunctionName("");
      setShowAddFunction(false);
      setSelectedId(data.id);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to create function");
    } finally {
      setAddFunctionLoading(false);
    }
  }

  async function handleRenameFunction(id: string, newName: string, onDone: () => void) {
    if (!newName.trim()) { onDone(); return; }
    try {
      const { error: err } = await supabase
        .from("job_families")
        .update({ name: newName.trim() })
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (err) throw err;
      onDone();
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to rename");
      onDone();
    }
  }

  async function handleUpdateFunctionDescription(id: string, desc: string) {
    try {
      const { error: err } = await supabase
        .from("job_families")
        .update({ description: desc.trim() || null })
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (err) throw err;
      setEditingFunctionDesc(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to update description");
    }
  }

  async function handleDeleteFunction(id: string) {
    const memberCount = memberCountByFunction[id] ?? 0;
    const msg = memberCount > 0
      ? `This function has ${memberCount} member${memberCount !== 1 ? "s" : ""}. Deleting it will unassign them. Continue?`
      : "Delete this function and all its levels and skills?";
    if (!confirm(msg)) return;
    try {
      const { error: err } = await supabase.from("job_families").delete().eq("id", id).eq("workspace_id", workspaceId);
      if (err) throw err;
      if (selectedId === id) setSelectedId(initialFunctions.find(f => f.id !== id)?.id ?? null);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to delete function");
    }
  }

  // ── Handlers: Levels ───────────────────────────────────────────────────

  async function handleAddLevel() {
    if (!newLevelName.trim() || !selectedId) return;
    try {
      const { wsId } = await getAuthUser();
      const nextOrder = functionLevels.length > 0
        ? Math.max(...functionLevels.map((l) => l.sort_order)) + 1
        : 1;
      const { error: err } = await supabase.from("levels").insert({
        name: newLevelName.trim(),
        job_family_id: selectedId,
        sort_order: nextOrder,
        workspace_id: wsId,
      });
      if (err) throw err;
      setNewLevelName("");
      setShowAddLevel(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to add level");
    }
  }

  async function handleRenameLevel(id: string) {
    if (!renameLevelValue.trim()) { setRenamingLevelId(null); return; }
    try {
      const { error: err } = await supabase
        .from("levels")
        .update({ name: renameLevelValue.trim() })
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (err) throw err;
      setRenamingLevelId(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to rename level");
    }
  }

  async function handleDeleteLevel(id: string) {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("level_id", id)
      .eq("workspace_id", workspaceId);
    if ((count ?? 0) > 0) {
      if (!confirm(`${count} ${count !== 1 ? "people are" : "person is"} at this level. Deleting it will unassign them. Continue?`)) return;
    }
    try {
      const { error: err } = await supabase.from("levels").delete().eq("id", id).eq("workspace_id", workspaceId);
      if (err) throw err;
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to delete level");
    }
  }

  // ── Handlers: Level Reorder ────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // prevent accidental drags on click
    })
  );

  async function handleReorderLevels(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = functionLevels.findIndex((l) => l.id === active.id);
    const newIndex = functionLevels.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Compute new sorted array for this function only
    const reordered = arrayMove(functionLevels, oldIndex, newIndex);

    // Optimistically update local state — splice the reordered items back in
    const originalLevels = levels;
    setLevels((prev) => {
      const otherLevels = prev.filter((l) => l.job_family_id !== selectedId);
      const updatedLevels = reordered.map((l, i) => ({ ...l, sort_order: i }));
      return [...otherLevels, ...updatedLevels];
    });

    try {
      // Batch update only levels whose sort_order actually changed
      await Promise.all(
        reordered.map((level, i) => {
          if (level.sort_order === i) return Promise.resolve(); // unchanged
          return supabase
            .from("levels")
            .update({ sort_order: i })
            .eq("id", level.id)
            .eq("workspace_id", workspaceId)
            .then(({ error: err }) => {
              if (err) throw err;
            });
        })
      );
      router.refresh();
    } catch (e: any) {
      // Roll back optimistic update on error
      setLevels(originalLevels);
      setError(e.message ?? "Failed to reorder levels");
    }
  }

  // ── Handlers: Skills ───────────────────────────────────────────────────

  async function handleAddSkill() {
    if (!newSkillName.trim() || !selectedId) return;
    setAddSkillLoading(true);
    try {
      const { wsId } = await getAuthUser();
      const { error: err } = await supabase.from("competencies").insert({
        name: newSkillName.trim(),
        description: newSkillDesc.trim() || null,
        job_family_id: selectedId,
        workspace_id: wsId,
        is_core: false,
      });
      if (err) throw err;
      setNewSkillName("");
      setNewSkillDesc("");
      setShowAddSkill(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to add skill");
    } finally {
      setAddSkillLoading(false);
    }
  }

  async function handleRemoveSkill(competencyId: string) {
    // Count how many level_competencies exist for this skill in this function
    const linkedCount = functionLevels.filter(l => matrixLookup[`${l.id}-${competencyId}`]).length;
    if (linkedCount > 0) {
      if (!confirm(`This will also remove ${linkedCount} expected score${linkedCount !== 1 ? "s" : ""} for this skill. Continue?`)) return;
    }
    try {
      const { error: err } = await supabase.from("competencies").delete().eq("id", competencyId).eq("workspace_id", workspaceId);
      if (err) throw err;
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to remove skill");
    }
  }

  // ── Handlers: Expected Scores ──────────────────────────────────────────

  async function handleSetScore(levelId: string, competencyId: string, value: number | null) {
    setPickerKey(null);
    const key = `${levelId}-${competencyId}`;
    const existing = matrixLookup[key];
    try {
      if (value === null) {
        if (existing) {
          const { error: err } = await supabase.from("level_competencies").delete().eq("id", existing.id).eq("workspace_id", workspaceId);
          if (err) throw err;
        }
      } else if (existing) {
        const { error: err } = await supabase
          .from("level_competencies")
          .update({ expected_level: value })
          .eq("id", existing.id)
          .eq("workspace_id", workspaceId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("level_competencies").insert({
          level_id: levelId,
          competency_id: competencyId,
          expected_level: value,
          workspace_id: workspaceId,
        });
        if (err) throw err;
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to update score");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] -m-6">
      {/* ── Left Sidebar ──────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-border/60 bg-muted/20 flex flex-col">
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-border/40">
          <h1 className="text-sm font-semibold text-foreground">Functions</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">{initialFunctions.length} function{initialFunctions.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-3 mt-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs px-3 py-2 rounded-lg flex items-start gap-2">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
          </div>
        )}

        {/* Function list */}
        <div className="flex-1 overflow-y-auto py-2">
          {initialFunctions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center px-4 py-6 leading-relaxed">
              No functions yet. Create your first one below.
            </p>
          )}
          {initialFunctions.map((fn) => (
            <div
              key={fn.id}
              className={`group relative flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors ${
                selectedId === fn.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/60 text-foreground"
              }`}
              onClick={() => { if (renamingFunctionId !== fn.id) setSelectedId(fn.id); }}
            >
              {renamingFunctionId === fn.id ? (
                <Input
                  autoFocus
                  value={renameFunctionValue}
                  onChange={(e) => setRenameFunctionValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameFunction(fn.id, renameFunctionValue, () => setRenamingFunctionId(null));
                    if (e.key === "Escape") setRenamingFunctionId(null);
                  }}
                  onBlur={() => handleRenameFunction(fn.id, renameFunctionValue, () => setRenamingFunctionId(null))}
                  className="h-6 text-xs px-1.5 py-0"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium truncate">{fn.name}</span>
                  <span className={`text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full ${
                    (memberCountByFunction[fn.id] ?? 0) > 0
                      ? selectedId === fn.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      : "text-muted-foreground/40"
                  }`}>
                    {memberCountByFunction[fn.id] ?? 0}
                  </span>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-muted">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setRenamingFunctionId(fn.id);
                          setRenameFunctionValue(fn.name);
                        }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteFunction(fn.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add function */}
        {canEdit && (
          <div className="border-t border-border/40 p-3">
            {showAddFunction ? (
              <div className="flex gap-1.5">
                <Input
                  autoFocus
                  value={newFunctionName}
                  onChange={(e) => setNewFunctionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddFunction();
                    if (e.key === "Escape") { setShowAddFunction(false); setNewFunctionName(""); }
                  }}
                  placeholder="Function name…"
                  className="h-7 text-xs flex-1"
                  disabled={addFunctionLoading}
                />
                <Button size="sm" className="h-7 w-7 p-0 shrink-0" onClick={handleAddFunction} disabled={addFunctionLoading || !newFunctionName.trim()}>
                  {addFunctionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => { setShowAddFunction(false); setNewFunctionName(""); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddFunction(true)}
                className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add function
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Right Panel ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!selectedFunction ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">No function selected</p>
              <p className="text-xs text-muted-foreground">
                {initialFunctions.length === 0
                  ? "Create your first function using the sidebar →"
                  : "Select a function from the sidebar to configure it"}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-w-4xl">
            {/* Function header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {editingFunctionName ? (
                  <Input
                    autoFocus
                    value={editFunctionNameValue}
                    onChange={(e) => setEditFunctionNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameFunction(selectedId!, editFunctionNameValue, () => setEditingFunctionName(false));
                      if (e.key === "Escape") setEditingFunctionName(false);
                    }}
                    onBlur={() => handleRenameFunction(selectedId!, editFunctionNameValue, () => setEditingFunctionName(false))}
                    className="text-xl font-semibold h-9 max-w-sm"
                  />
                ) : (
                  <h2
                    className={`text-xl font-semibold text-foreground ${canEdit ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
                    onClick={() => {
                      if (!canEdit) return;
                      setEditingFunctionName(true);
                      setEditFunctionNameValue(selectedFunction.name);
                    }}
                  >
                    {selectedFunction.name}
                  </h2>
                )}

                {editingFunctionDesc ? (
                  <Input
                    autoFocus
                    value={editFunctionDescValue}
                    onChange={(e) => setEditFunctionDescValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdateFunctionDescription(selectedId!, editFunctionDescValue);
                      if (e.key === "Escape") setEditingFunctionDesc(false);
                    }}
                    onBlur={() => handleUpdateFunctionDescription(selectedId!, editFunctionDescValue)}
                    placeholder="Add a description…"
                    className="text-sm mt-1 max-w-sm"
                  />
                ) : (
                  <p
                    className={`text-sm mt-1 ${selectedFunction.description ? "text-muted-foreground" : "text-muted-foreground/40 italic"} ${canEdit ? "cursor-pointer hover:text-foreground transition-colors" : ""}`}
                    onClick={() => {
                      if (!canEdit) return;
                      setEditingFunctionDesc(true);
                      setEditFunctionDescValue(selectedFunction.description ?? "");
                    }}
                  >
                    {selectedFunction.description ?? (canEdit ? "Add a description…" : "")}
                  </p>
                )}

                {(memberCountByFunction[selectedId!] ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {memberCountByFunction[selectedId!]} member{memberCountByFunction[selectedId!] !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>

            {/* Levels */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">Levels</p>
              <div className="flex flex-wrap items-center gap-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleReorderLevels}
                >
                  <SortableContext
                    items={functionLevels.map((l) => l.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {functionLevels.map((level) => (
                      <SortableLevel
                        key={level.id}
                        level={level}
                        canEdit={canEdit}
                        isRenaming={renamingLevelId === level.id}
                        renameValue={renameLevelValue}
                        onRenameChange={setRenameLevelValue}
                        onRenameKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameLevel(level.id);
                          if (e.key === "Escape") setRenamingLevelId(null);
                        }}
                        onRenameBlur={() => handleRenameLevel(level.id)}
                        onStartRename={() => {
                          setRenamingLevelId(level.id);
                          setRenameLevelValue(level.name);
                        }}
                        onDelete={() => handleDeleteLevel(level.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Add level */}
                {canEdit && (
                  showAddLevel ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={newLevelName}
                        onChange={(e) => setNewLevelName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddLevel();
                          if (e.key === "Escape") { setShowAddLevel(false); setNewLevelName(""); }
                        }}
                        placeholder="Level name…"
                        className="h-7 text-xs w-28"
                      />
                      <Button size="sm" className="h-7 w-7 p-0" onClick={handleAddLevel} disabled={!newLevelName.trim()}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setShowAddLevel(false); setNewLevelName(""); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddLevel(true)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add level
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Scorecard */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Skills & Expected Scores</p>
              </div>

              {functionLevels.length === 0 && functionSkills.length === 0 && coreSkills.length === 0 ? (
                <div className="border border-dashed rounded-xl py-12 text-center">
                  <p className="text-sm font-medium text-foreground mb-1">Nothing configured yet</p>
                  <p className="text-xs text-muted-foreground">Add levels and skills to build this function's scorecard</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/20 border-b border-border/40">
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground min-w-[200px]">
                          Skill
                        </th>
                        {functionLevels.map((level) => (
                          <th key={level.id} className="text-center py-2.5 px-3 text-xs font-medium text-foreground min-w-[72px]">
                            {level.name}
                          </th>
                        ))}
                        {canEdit && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Function-specific skills */}
                      {functionSkills.map((skill) => (
                        <tr key={skill.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors group/row">
                          <td className="py-3 px-4">
                            <button
                              className="text-xs font-medium text-foreground hover:text-primary transition-colors text-left"
                              onClick={() => setExpandedSkillId(expandedSkillId === skill.id ? null : skill.id)}
                            >
                              {skill.name}
                              {skill.description && <ChevronRight className={`inline h-3 w-3 ml-1 transition-transform ${expandedSkillId === skill.id ? "rotate-90" : ""}`} />}
                            </button>
                            {expandedSkillId === skill.id && skill.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed max-w-xs">{skill.description}</p>
                            )}
                          </td>
                          {functionLevels.map((level) => {
                            const cellKey = `${level.id}-${skill.id}`;
                            const entry = matrixLookup[cellKey];
                            return (
                              <td key={level.id} className="text-center py-2 px-2 relative">
                                {canEdit ? (
                                  <div className="relative inline-block">
                                    <button
                                      onClick={() => setPickerKey(pickerKey === cellKey ? null : cellKey)}
                                      className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all hover:scale-105 ${
                                        entry
                                          ? proficiencyColors[entry.expected_level]
                                          : "border-dashed border-border/50 text-muted-foreground/40 hover:border-border hover:text-muted-foreground"
                                      }`}
                                    >
                                      {entry ? entry.expected_level : "–"}
                                    </button>
                                    {pickerKey === cellKey && (
                                      <ScorePicker
                                        onSelect={(v) => handleSetScore(level.id, skill.id, v)}
                                        onClose={() => setPickerKey(null)}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold border ${
                                    entry ? proficiencyColors[entry.expected_level] : "text-muted-foreground/30 border-transparent"
                                  }`}>
                                    {entry ? entry.expected_level : "–"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          {canEdit && (
                            <td className="pr-2">
                              <button
                                onClick={() => handleRemoveSkill(skill.id)}
                                className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}

                      {/* Add skill inline form */}
                      {showAddSkill && canEdit && (
                        <tr className="border-b border-border/30 bg-muted/10">
                          <td className="py-2.5 px-4" colSpan={functionLevels.length + (canEdit ? 2 : 1)}>
                            <div className="flex items-center gap-2">
                              <Input
                                autoFocus
                                value={newSkillName}
                                onChange={(e) => setNewSkillName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newSkillName.trim()) handleAddSkill();
                                  if (e.key === "Escape") { setShowAddSkill(false); setNewSkillName(""); setNewSkillDesc(""); }
                                }}
                                placeholder="Skill name…"
                                className="h-7 text-xs w-44"
                                disabled={addSkillLoading}
                              />
                              <Input
                                value={newSkillDesc}
                                onChange={(e) => setNewSkillDesc(e.target.value)}
                                placeholder="Description (optional)"
                                className="h-7 text-xs flex-1"
                                disabled={addSkillLoading}
                              />
                              <Button size="sm" className="h-7 px-3 text-xs gap-1" onClick={handleAddSkill} disabled={addSkillLoading || !newSkillName.trim()}>
                                {addSkillLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setShowAddSkill(false); setNewSkillName(""); setNewSkillDesc(""); }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Core skills divider */}
                      {coreSkills.length > 0 && (
                        <>
                          <tr className="bg-muted/10 border-y border-border/40 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setCoreSkillsOpen(!coreSkillsOpen)}>
                            <td colSpan={functionLevels.length + (canEdit ? 2 : 1)} className="py-1.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${coreSkillsOpen ? "rotate-90" : ""}`} />
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                  Core skills ({coreSkills.length}) — apply to all functions
                                </span>
                              </div>
                            </td>
                          </tr>
                          {coreSkillsOpen && coreSkills.map((skill) => (
                            <tr key={skill.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    className="text-xs font-medium text-foreground hover:text-primary transition-colors text-left"
                                    onClick={() => setExpandedSkillId(expandedSkillId === skill.id ? null : skill.id)}
                                  >
                                    {skill.name}
                                    {skill.description && <ChevronRight className={`inline h-3 w-3 ml-1 transition-transform ${expandedSkillId === skill.id ? "rotate-90" : ""}`} />}
                                  </button>
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/30 text-primary">Core</Badge>
                                </div>
                                {expandedSkillId === skill.id && skill.description && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed max-w-xs">{skill.description}</p>
                                )}
                              </td>
                              {functionLevels.map((level) => {
                                const cellKey = `${level.id}-${skill.id}`;
                                const entry = matrixLookup[cellKey];
                                return (
                                  <td key={level.id} className="text-center py-2 px-2 relative">
                                    {canEdit ? (
                                      <div className="relative inline-block">
                                        <button
                                          onClick={() => setPickerKey(pickerKey === cellKey ? null : cellKey)}
                                          className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all hover:scale-105 ${
                                            entry
                                              ? proficiencyColors[entry.expected_level]
                                              : "border-dashed border-border/50 text-muted-foreground/40 hover:border-border hover:text-muted-foreground"
                                          }`}
                                        >
                                          {entry ? entry.expected_level : "–"}
                                        </button>
                                        {pickerKey === cellKey && (
                                          <ScorePicker
                                            onSelect={(v) => handleSetScore(level.id, skill.id, v)}
                                            onClose={() => setPickerKey(null)}
                                          />
                                        )}
                                      </div>
                                    ) : (
                                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold border ${
                                        entry ? proficiencyColors[entry.expected_level] : "text-muted-foreground/30 border-transparent"
                                      }`}>
                                        {entry ? entry.expected_level : "–"}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              {canEdit && <td />}
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                  {canEdit && !showAddSkill && (
                    <div className="px-4 py-2.5 border-t border-border/30">
                      <button
                        onClick={() => setShowAddSkill(true)}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add skill to {selectedFunction.name}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
