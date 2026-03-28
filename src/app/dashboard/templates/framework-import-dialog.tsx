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
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Target,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FrameworkCompetency {
  name: string;
  description?: string;
  category?: string;
  is_core?: boolean;
  levels?: Record<
    string,
    { title: string; indicators: string[] }
  >;
}

interface FrameworkContent {
  competencies: FrameworkCompetency[];
}

interface FrameworkImportDialogProps {
  template: {
    id: string;
    name: string;
    description: string;
    content: any;
  };
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Collapsible competency card ───────────────────────────────────────────────

function CompetencyPreview({
  competency,
  defaultOpen,
}: {
  competency: FrameworkCompetency;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const levelEntries = competency.levels
    ? Object.entries(competency.levels).sort(
        ([a], [b]) => Number(a) - Number(b)
      )
    : [];

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {competency.name}
            </span>
            {competency.category && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {competency.category}
              </Badge>
            )}
            {competency.is_core && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                Core
              </Badge>
            )}
          </div>
          {competency.description && !open && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {competency.description}
            </p>
          )}
        </div>
        {levelEntries.length > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            {levelEntries.length} level{levelEntries.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/40">
          {competency.description && (
            <p className="text-sm text-muted-foreground">
              {competency.description}
            </p>
          )}

          {levelEntries.length > 0 && (
            <div className="space-y-2.5">
              {levelEntries.map(([level, data]) => (
                <div key={level} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                      L{level}
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {data.title}
                    </span>
                  </div>
                  {data.indicators && data.indicators.length > 0 && (
                    <ul className="space-y-0.5 ml-1">
                      {data.indicators.map((indicator, i) => (
                        <li
                          key={i}
                          className="text-xs text-muted-foreground flex items-start gap-1.5"
                        >
                          <span className="text-muted-foreground/60 mt-0.5 shrink-0">
                            &bull;
                          </span>
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export function FrameworkImportDialog({
  template,
  workspaceId,
  open,
  onOpenChange,
}: FrameworkImportDialogProps) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<string[] | null>(null);
  const [checked, setChecked] = useState(false);
  const [importAll, setImportAll] = useState(false);

  const content = template.content as FrameworkContent | undefined;
  const competencies = content?.competencies ?? [];

  // ── Duplicate check ───────────────────────────────────────────────────────

  async function checkDuplicates() {
    if (competencies.length === 0) return;
    setError(null);

    try {
      const supabase = createClient();
      const names = competencies.map((c) => c.name);

      const { data: existing, error: fetchError } = await supabase
        .from("competencies")
        .select("name")
        .eq("workspace_id", workspaceId)
        .in("name", names);

      if (fetchError) throw fetchError;

      const existingNames = (existing || []).map((c: any) => c.name);
      setDuplicates(existingNames);
      setChecked(true);
    } catch (err: any) {
      console.error("Error checking duplicates:", err);
      setError("Failed to check for existing competencies. Please try again.");
    }
  }

  // ── Import logic ──────────────────────────────────────────────────────────

  async function handleImport() {
    if (competencies.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Determine which competencies to import
      let toImport = competencies;
      if (duplicates && duplicates.length > 0 && !importAll) {
        toImport = competencies.filter(
          (c) => !duplicates.includes(c.name)
        );
      }

      if (toImport.length === 0) {
        setError("All competencies already exist in your workspace. Nothing to import.");
        setImporting(false);
        return;
      }

      // Insert competencies
      const rows = toImport.map((c) => ({
        workspace_id: workspaceId,
        name: c.name,
        description: c.description || null,
        category: c.category || null,
        is_core: c.is_core ?? false,
      }));

      const { data: importedCompetencies, error: insertError } = await supabase
        .from("competencies")
        .insert(rows)
        .select("id, name");

      if (insertError) throw insertError;

      // ── Import level definitions ─────────────────────────────────────
      let levelWarning = "";

      if (importedCompetencies && importedCompetencies.length > 0) {
        const wsId = workspaceId;
        const allComps = competencies; // original template competencies

        const { data: wsLevels } = await supabase
          .from("levels")
          .select("id, sort_order")
          .eq("workspace_id", wsId)
          .order("sort_order");

        if (wsLevels && wsLevels.length > 0) {
          const levelCompInserts: any[] = [];

          for (const comp of importedCompetencies) {
            // Find the original template competency data to get levels
            const templateComp = allComps.find((c: any) => c.name === comp.name);
            if (!templateComp?.levels) continue;

            for (const [levelNum, levelData] of Object.entries(templateComp.levels)) {
              const levelIdx = parseInt(levelNum) - 1; // 0-based index
              if (levelIdx < wsLevels.length) {
                const wsLevel = wsLevels[levelIdx];
                levelCompInserts.push({
                  level_id: wsLevel.id,
                  competency_id: comp.id,
                  expected_level: parseInt(levelNum),
                  workspace_id: wsId,
                  behavioral_indicators: (levelData as any).indicators || [],
                });
              }
            }
          }

          if (levelCompInserts.length > 0) {
            await supabase.from("level_competencies").insert(levelCompInserts);
          }
        } else {
          levelWarning = "\n\nNote: Competencies imported but level expectations were skipped — set up your career levels first in Functions.";
        }
      }

      alert(
        `Successfully imported ${toImport.length} competenc${toImport.length === 1 ? "y" : "ies"} into your workspace.${levelWarning}`
      );

      onOpenChange(false);
      router.push("/dashboard/competencies");
      router.refresh();
    } catch (err: any) {
      console.error("Error importing competencies:", err);
      setError(err?.message || "Failed to import competencies. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  // ── Reset state when dialog closes ────────────────────────────────────────

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDuplicates(null);
      setChecked(false);
      setImportAll(false);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const duplicateCount = duplicates?.length ?? 0;
  const newCount = competencies.length - duplicateCount;
  const willImportCount = importAll ? competencies.length : newCount;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {template.name}
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        {/* ── Framework stats ── */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground py-1">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {competencies.length} competenc{competencies.length !== 1 ? "ies" : "y"}
          </div>
          {competencies.some((c) => c.levels && Object.keys(c.levels).length > 0) && (
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              With level definitions
            </div>
          )}
        </div>

        {/* ── Competency list ── */}
        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="space-y-2 pb-2">
            {competencies.map((competency, index) => (
              <CompetencyPreview
                key={index}
                competency={competency}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        </div>

        {/* ── Duplicate warning ── */}
        {checked && duplicateCount > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {duplicateCount} competenc{duplicateCount !== 1 ? "ies" : "y"} already exist{duplicateCount === 1 ? "s" : ""} and will be skipped
                </p>
                <p className="text-amber-700 dark:text-amber-400/80 text-xs mt-0.5">
                  {duplicates!.join(", ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-6">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setImportAll(false);
                  handleImport();
                }}
                disabled={importing || newCount === 0}
              >
                Import {newCount} new only
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setImportAll(true);
                  handleImport();
                }}
                disabled={importing}
              >
                Import all (create duplicates)
              </Button>
            </div>
          </div>
        )}

        {/* ── Success state after check with no duplicates ── */}
        {checked && duplicateCount === 0 && !error && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            No duplicates found. Ready to import all {competencies.length} competencies.
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
            <Button onClick={checkDuplicates} disabled={competencies.length === 0}>
              Import Framework
            </Button>
          ) : duplicateCount === 0 ? (
            <Button onClick={handleImport} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importing
                ? "Importing..."
                : `Import ${willImportCount} Competenc${willImportCount !== 1 ? "ies" : "y"}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
