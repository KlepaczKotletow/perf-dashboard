"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Layers,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunctionTemplateContent {
  function_name: string;
  function_description: string;
  levels: Array<{ name: string; sort_order: number }>;
  competencies: Array<{
    name: string;
    description: string;
    category: string;
    expected_scores: number[]; // index maps to levels by sort_order
    score_descriptors?: Record<string, string>; // "2" → "description for score 2"
  }>;
}

interface FunctionImportDialogProps {
  template: {
    id: string;
    name: string;
    description: string | null;
    content: any;
  };
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Score color helpers ───────────────────────────────────────────────────────

function getScoreBadgeClasses(score: number): string {
  switch (score) {
    case 1:
      return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";
    case 2:
      return "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400";
    case 3:
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400";
    case 4:
      return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400";
    case 5:
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// ── Main dialog ──────────────────────────────────────────────────────────────

export function FunctionImportDialog({
  template,
  workspaceId,
  open,
  onOpenChange,
}: FunctionImportDialogProps) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [useCopyName, setUseCopyName] = useState(false);

  const content = template.content as FunctionTemplateContent | undefined;
  const functionName = content?.function_name ?? "Untitled Function";
  const functionDescription = content?.function_description ?? "";
  const levels = content?.levels ?? [];
  const competencies = content?.competencies ?? [];

  const sortedLevels = [...levels].sort((a, b) => a.sort_order - b.sort_order);
  const resolvedName = useCopyName ? `${functionName} (Copy)` : functionName;

  // ── Duplicate check ─────────────────────────────────────────────────────

  async function checkDuplicates() {
    setChecking(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: existing, error: fetchError } = await supabase
        .from("job_families")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("name", functionName)
        .limit(1);

      if (fetchError) throw fetchError;

      const hasDuplicate = (existing?.length ?? 0) > 0;
      setIsDuplicate(hasDuplicate);
      setChecked(true);
    } catch (err: any) {
      console.error("Error checking duplicates:", err);
      setError("Failed to check for existing functions. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  // ── Import logic ────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!content) return;
    setImporting(true);
    setError(null);

    try {
      const supabase = createClient();

      // 1. Insert job_family
      const { data: jobFamily, error: jfError } = await supabase
        .from("job_families")
        .insert({
          name: resolvedName,
          description: functionDescription,
          workspace_id: workspaceId,
        })
        .select("id")
        .single();

      if (jfError) throw jfError;
      const jobFamilyId = jobFamily.id;

      // 2. Insert levels
      const levelRows = sortedLevels.map((l) => ({
        name: l.name,
        sort_order: l.sort_order,
        job_family_id: jobFamilyId,
        workspace_id: workspaceId,
      }));

      const { data: insertedLevels, error: levelsError } = await supabase
        .from("levels")
        .insert(levelRows)
        .select("id, sort_order")
        .order("sort_order");

      if (levelsError) throw levelsError;

      // Build a map: sort_order -> level_id
      const levelBySort = new Map<number, string>();
      for (const lvl of insertedLevels ?? []) {
        levelBySort.set(lvl.sort_order, lvl.id);
      }

      // 3. Insert competencies
      const compRows = competencies.map((c) => ({
        name: c.name,
        description: c.description || null,
        category: c.category || null,
        is_core: false,
        job_family_id: jobFamilyId,
        workspace_id: workspaceId,
      }));

      const { data: insertedComps, error: compsError } = await supabase
        .from("competencies")
        .insert(compRows)
        .select("id, name");

      if (compsError) throw compsError;

      // 4. Insert level_competencies
      const lcRows: Array<{
        level_id: string;
        competency_id: string;
        expected_level: number;
        workspace_id: string;
      }> = [];

      for (const comp of insertedComps ?? []) {
        // Find original template competency to get expected_scores
        const templateComp = competencies.find((c) => c.name === comp.name);
        if (!templateComp?.expected_scores) continue;

        for (let i = 0; i < sortedLevels.length; i++) {
          const sortOrder = sortedLevels[i].sort_order;
          const levelId = levelBySort.get(sortOrder);
          const score = templateComp.expected_scores[i];

          if (levelId && score != null) {
            lcRows.push({
              level_id: levelId,
              competency_id: comp.id,
              expected_level: score,
              workspace_id: workspaceId,
            });
          }
        }
      }

      if (lcRows.length > 0) {
        const { error: lcError } = await supabase
          .from("level_competencies")
          .insert(lcRows);

        if (lcError) throw lcError;
      }

      // 5. Insert score descriptors (if template provides them)
      const sdRows: Array<{
        competency_id: string;
        score: number;
        description: string;
        workspace_id: string;
      }> = [];

      // Build name→id map from inserted competencies (order not guaranteed)
      const compNameToId = new Map<string, string>();
      for (const ic of insertedComps ?? []) {
        compNameToId.set(ic.name, ic.id);
      }

      for (const comp of competencies) {
        const compId = compNameToId.get(comp.name);
        if (!compId || !comp.score_descriptors) continue;

        for (const [scoreStr, desc] of Object.entries(comp.score_descriptors)) {
          const score = parseInt(scoreStr, 10);
          if (score >= 1 && score <= 5 && desc) {
            sdRows.push({
              competency_id: compId,
              score,
              description: desc,
              workspace_id: workspaceId,
            });
          }
        }
      }

      if (sdRows.length > 0) {
        const { error: sdError } = await supabase
          .from("competency_score_descriptors")
          .insert(sdRows);

        if (sdError) throw sdError;
      }

      // Success
      alert(
        `Successfully created function "${resolvedName}" with ${sortedLevels.length} levels and ${competencies.length} competencies.`
      );

      onOpenChange(false);
      router.push("/dashboard/admin/functions");
      router.refresh();
    } catch (err: any) {
      console.error("Error creating function:", err);
      setError(
        err?.message || "Failed to create function. Please try again."
      );
    } finally {
      setImporting(false);
    }
  }

  // ── Reset state when dialog closes ──────────────────────────────────────

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setChecked(false);
      setIsDuplicate(false);
      setUseCopyName(false);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            {template.name}
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        {/* ── Function stats ── */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground py-1">
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            {functionName}
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {sortedLevels.length} level{sortedLevels.length !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            {competencies.length} competenc
            {competencies.length !== 1 ? "ies" : "y"}
          </div>
        </div>

        {/* ── Matrix preview ── */}
        <div className="flex-1 min-h-0 overflow-auto -mx-6 px-6">
          <div className="border border-border/60 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground border-b border-border/40 sticky left-0 bg-muted/40 min-w-[140px]">
                    Competency
                  </th>
                  {sortedLevels.map((level) => (
                    <th
                      key={level.sort_order}
                      className="text-center px-2 py-2 font-medium text-muted-foreground border-b border-border/40 min-w-[80px]"
                    >
                      {level.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competencies.map((comp, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2 sticky left-0 bg-background">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground truncate max-w-[120px]">
                          {comp.name}
                        </span>
                        {comp.category && (
                          <Badge
                            variant="outline"
                            className="text-[9px] shrink-0"
                          >
                            {comp.category}
                          </Badge>
                        )}
                      </div>
                    </td>
                    {sortedLevels.map((level, levelIdx) => {
                      const score = comp.expected_scores?.[levelIdx];
                      return (
                        <td
                          key={level.sort_order}
                          className="text-center px-2 py-2"
                        >
                          {score != null ? (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-semibold ${getScoreBadgeClasses(score)}`}
                            >
                              {score}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Duplicate warning ── */}
        {checked && isDuplicate && !useCopyName && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  A function named &ldquo;{functionName}&rdquo; already exists
                </p>
                <p className="text-amber-700 dark:text-amber-400/80 text-xs mt-0.5">
                  You can create it with a different name instead.
                </p>
              </div>
            </div>
            <div className="ml-6">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setUseCopyName(true)}
              >
                Create as &ldquo;{functionName} (Copy)&rdquo;
              </Button>
            </div>
          </div>
        )}

        {/* ── Ready state (no duplicate, or copy name selected) ── */}
        {checked && (!isDuplicate || useCopyName) && !error && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Ready to create &ldquo;{resolvedName}&rdquo; with{" "}
            {sortedLevels.length} levels and {competencies.length} competencies.
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Footer actions ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>

          {!checked ? (
            <Button
              onClick={checkDuplicates}
              disabled={checking || !content || competencies.length === 0}
            >
              {checking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {checking ? "Checking..." : "Use Template"}
            </Button>
          ) : (!isDuplicate || useCopyName) ? (
            <Button onClick={handleCreate} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importing ? "Creating..." : "Create Function"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
