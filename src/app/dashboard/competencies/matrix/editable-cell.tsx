"use client";

import { memo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ListChecks, CheckCircle2 } from "lucide-react";

const proficiencyColors: Record<number, string> = {
  1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  2: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  3: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  4: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  5: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

interface EditableCellProps {
  levelId: string;
  competencyId: string;
  workspaceId: string;
  initialValue: number | null;
  existingId: string | null;
  initialBehaviors: string[];
  competencyName: string;
  levelLabel: string;
  canEdit: boolean;
}

function EditableCellInner({
  levelId,
  competencyId,
  workspaceId,
  initialValue,
  existingId,
  initialBehaviors,
  competencyName,
  levelLabel,
  canEdit,
}: EditableCellProps) {
  const [value, setValue] = useState<number | null>(initialValue);
  const [rowId, setRowId] = useState<string | null>(existingId);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cellError, setCellError] = useState(false);

  // Behaviors state
  const [behaviors, setBehaviors] = useState<string[]>(initialBehaviors);
  const [showBehaviorsDialog, setShowBehaviorsDialog] = useState(false);
  const [newBehavior, setNewBehavior] = useState("");
  const [savingBehaviors, setSavingBehaviors] = useState(false);
  const [behaviorSaveError, setBehaviorSaveError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSelect(newValue: number | null) {
    if (!canEdit) return;
    setSaving(true);
    setShowPicker(false);

    try {
      if (newValue === null) {
        // Remove the entry
        if (rowId) {
          await supabase.from("level_competencies").delete().eq("id", rowId).eq("workspace_id", workspaceId);
          setRowId(null);
          setBehaviors([]);
        }
        setValue(null);
      } else if (rowId && value !== null) {
        // Update existing
        await supabase
          .from("level_competencies")
          .update({ expected_level: newValue })
          .eq("id", rowId)
          .eq("workspace_id", workspaceId);
        setValue(newValue);
      } else {
        // Insert new
        await supabase.from("level_competencies").insert({
          level_id: levelId,
          competency_id: competencyId,
          workspace_id: workspaceId,
          expected_level: newValue,
        });
        // Capture the new row ID for subsequent edits
        const { data: newRow } = await supabase
          .from("level_competencies")
          .select("id")
          .eq("level_id", levelId)
          .eq("competency_id", competencyId)
          .eq("workspace_id", workspaceId)
          .single();
        if (newRow) setRowId(newRow.id);
        setValue(newValue);
      }
    } catch (err) {
      console.error("Error saving level competency:", err);
      setCellError(true);
      setTimeout(() => setCellError(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBehaviors() {
    if (!rowId) return;
    setSavingBehaviors(true);
    setBehaviorSaveError(null);
    try {
      await supabase
        .from("level_competencies")
        .update({ behavioral_indicators: behaviors })
        .eq("id", rowId)
        .eq("workspace_id", workspaceId);
      setShowBehaviorsDialog(false);
    } catch (err) {
      console.error("Error saving behaviors:", err);
      setBehaviorSaveError("Failed to save. Please check your connection and try again.");
    } finally {
      setSavingBehaviors(false);
    }
  }

  function addBehavior() {
    const trimmed = newBehavior.trim();
    if (!trimmed) return;
    setBehaviors((prev) => [...prev, trimmed]);
    setNewBehavior("");
  }

  function removeBehavior(index: number) {
    setBehaviors((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Read-only view ──────────────────────────────────────────────────────────
  if (!canEdit) {
    return value ? (
      <div className="relative inline-block">
        <Badge className={proficiencyColors[value]}>{value}</Badge>
        {behaviors.length > 0 && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary border-2 border-background" />
        )}
      </div>
    ) : (
      <span className="text-muted-foreground">-</span>
    );
  }

  // ── Editable view ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setShowPicker(!showPicker)}
          disabled={saving}
          className={`cursor-pointer transition-all rounded px-2 py-1 hover:ring-2 hover:ring-primary/40 ${
            saving ? "opacity-50" : ""
          } ${cellError ? "ring-2 ring-red-500/60" : ""}`}
          title={cellError ? "Failed to save — click to try again" : undefined}
        >
          {value ? (
            <div className="relative inline-block">
              <Badge className={proficiencyColors[value]}>{value}</Badge>
              {behaviors.length > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary border-2 border-background" />
              )}
            </div>
          ) : (
            <span className="text-muted-foreground hover:text-foreground">-</span>
          )}
        </button>

        {showPicker && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            {/* Picker */}
            <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-popover border rounded-lg shadow-lg p-2 min-w-[160px]">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleSelect(n)}
                    className={`w-8 h-8 rounded-md text-xs font-bold transition-all hover:scale-110 ${
                      proficiencyColors[n]
                    } ${value === n ? "ring-2 ring-primary" : ""}`}
                  >
                    {n}
                  </button>
                ))}
                {value && (
                  <button
                    onClick={() => handleSelect(null)}
                    className="w-8 h-8 rounded-md text-xs font-bold bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
                    title="Clear"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Behaviors link — only shown when a level is set */}
              {value && rowId && (
                <div className="border-t border-border/60 mt-2 pt-1.5">
                  <button
                    onClick={() => {
                      setShowPicker(false);
                      setShowBehaviorsDialog(true);
                    }}
                    className="w-full text-left px-1 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded hover:bg-muted transition-colors"
                  >
                    <ListChecks className="h-3 w-3 shrink-0" />
                    {behaviors.length > 0
                      ? `${behaviors.length} behavior${behaviors.length !== 1 ? "s" : ""}`
                      : "Add behaviors…"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Behaviors Dialog */}
      <Dialog open={showBehaviorsDialog} onOpenChange={(open) => !open && setShowBehaviorsDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{competencyName}</DialogTitle>
            <p className="text-xs text-muted-foreground">{levelLabel} · Observable behaviors</p>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Behaviors list */}
            {behaviors.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-3">
                No behaviors yet — describe what &lsquo;good&rsquo; looks like at this level
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {behaviors.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 group">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm flex-1 leading-snug">{b}</span>
                    <button
                      onClick={() => removeBehavior(i)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 text-sm font-medium"
                      title="Remove"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add new behavior */}
            <div className="flex gap-2 pt-1 border-t border-border/60">
              <Input
                value={newBehavior}
                onChange={(e) => setNewBehavior(e.target.value)}
                placeholder="e.g. Delivers features independently…"
                className="text-xs h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBehavior();
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 shrink-0"
                disabled={!newBehavior.trim()}
                onClick={addBehavior}
              >
                Add
              </Button>
            </div>
          </div>

          {behaviorSaveError && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded px-2.5 py-1.5">
              {behaviorSaveError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBehaviors(initialBehaviors); // reset on cancel
                setBehaviorSaveError(null);
                setShowBehaviorsDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveBehaviors} disabled={savingBehaviors}>
              {savingBehaviors && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save behaviors
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function arraysShallowEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * React.memo wrapper: a competency matrix can render 50 × 8 = 400+ EditableCell
 * instances. Without memoization, typing into any one cell re-renders every
 * cell in the grid (each one does its own state machine + effects). Custom
 * comparator handles `initialBehaviors`'s array identity explicitly so a new
 * array reference with the same contents doesn't force a re-render.
 */
export const EditableCell = memo(EditableCellInner, (prev, next) => {
  return (
    prev.levelId === next.levelId &&
    prev.competencyId === next.competencyId &&
    prev.workspaceId === next.workspaceId &&
    prev.initialValue === next.initialValue &&
    prev.existingId === next.existingId &&
    prev.competencyName === next.competencyName &&
    prev.levelLabel === next.levelLabel &&
    prev.canEdit === next.canEdit &&
    arraysShallowEqual(prev.initialBehaviors, next.initialBehaviors)
  );
});
EditableCell.displayName = "EditableCell";
