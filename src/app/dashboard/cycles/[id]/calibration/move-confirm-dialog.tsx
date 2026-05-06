"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { gradeToBox } from "@/lib/nine-box";

export interface PendingMove {
  assignmentId: string;
  employeeName: string | null;
  before: { final_grade: string | null; potential: number | null };
  after: { final_grade: string; potential: number };
}

// Lerner & Tetlock (1999): pre-decisional process accountability — having
// to articulate REASONING before the decision lands — reliably reduces bias.
// Optional rationale fails because most calibrators skip it. We therefore
// REQUIRE a rationale for material moves: cross-quadrant in the 9-box, or
// downward in grade ordering. Initial calibration (no prior grade) and
// purely-upward lateral nudges within the same quadrant remain optional.
const MIN_RATIONALE_CHARS = 30;

const GRADE_RANK: Record<string, number> = {
  "Unsatisfactory": 0,
  "Needs Improvement": 0,
  "Below Expectations": 1,
  "Meets Expectations": 2,
  "Exceeds Expectations": 3,
  "Exceptional": 4,
};

/**
 * A move is "material" — and therefore requires a written rationale — when
 * any of the following holds:
 *   - The 9-box column changes (cross-quadrant in performance).
 *   - The proposed grade is lower than the previous grade in the standard
 *     ordering (downward step in performance).
 *   - The chip lands in the bottom-left box (Low Potential + Below).
 * Initial calibration (no prior grade) is not "material" — it's the first
 * decision, not a change to challenge.
 */
function isMaterialMove(
  before: { final_grade: string | null; potential: number | null },
  after: { final_grade: string; potential: number },
): boolean {
  if (!before.final_grade) return false;

  const beforeRank = GRADE_RANK[before.final_grade];
  const afterRank = GRADE_RANK[after.final_grade];
  if (beforeRank !== undefined && afterRank !== undefined && afterRank < beforeRank) {
    return true; // Downward step
  }

  const beforeBox = gradeToBox(before.final_grade, before.potential);
  const afterBox = gradeToBox(after.final_grade, after.potential);
  if (beforeBox && afterBox && beforeBox.col !== afterBox.col) {
    return true; // Cross-quadrant in performance axis
  }

  if (afterBox && afterBox.row === 0 && afterBox.col === 0) {
    return true; // Into Low Potential + Below — high-stakes, justify
  }

  return false;
}

interface Props {
  pending: PendingMove | null;
  /**
   * Called when the user clicks Confirm. Must perform the actual save (RPC)
   * and resolve only after the save returns. Throw or reject to surface an
   * error inside the dialog without dismissing it.
   */
  onConfirm: (note: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Confirmation dialog shown when a calibrator drags a chip on the 9-box grid.
 * The actual RPC call happens only after the user confirms.
 *
 * Save lifecycle (per NN/g guidance for high-stakes operations): Confirm
 * triggers the save, dialog stays open in a "Saving…" state, then briefly
 * shows "Saved" before auto-dismissing. On error the dialog stays open with
 * the error visible so the user knows the persisted state matches what they
 * see — no silent failure on a high-stakes audit-tracked decision.
 *
 * Note: DialogDescription renders a <p> by default, so we use `asChild` and
 * a <div> wrapper to embed <code> blocks without invalid HTML nesting.
 */
export function MoveConfirmDialog({ pending, onConfirm, onCancel }: Props) {
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset the textarea + save state when a new move arrives so they don't
  // bleed across moves (e.g. drag A, cancel, drag B — B starts fresh).
  // The rule flags state-resetting effects, but here the move identity
  // (assignmentId/grade/potential combo) is the natural reset key — using
  // <key={...}> on the parent would force a remount of the textarea every
  // time, losing focus styles. Keep behaviour identical, suppress.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote("");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveState("idle");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrorMessage(null);
  }, [
    pending?.assignmentId,
    pending?.after.final_grade,
    pending?.after.potential,
  ]);

  async function handleConfirm() {
    if (saveState === "saving") return;
    setSaveState("saving");
    setErrorMessage(null);
    try {
      await onConfirm(note.trim());
      setSaveState("saved");
      // Brief "Saved" flash, then dismiss. Parent should clear `pending`.
      setTimeout(() => onCancel(), 600);
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Save failed — try again");
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      // Block close-via-overlay/ESC while saving so the user can't lose track
      // of an in-flight RPC.
      if (saveState === "saving") return;
      onCancel();
    }
  }

  const isSaving = saveState === "saving";
  const isSaved = saveState === "saved";

  const material = useMemo(
    () => (pending ? isMaterialMove(pending.before, pending.after) : false),
    [pending],
  );
  const trimmedLength = note.trim().length;
  const rationaleSatisfied = !material || trimmedLength >= MIN_RATIONALE_CHARS;
  const confirmDisabled = isSaving || isSaved || !rationaleSatisfied;

  return (
    <Dialog open={pending != null} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why this change?</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm">
              {pending && (
                <>
                  <span>{pending.employeeName ?? "Employee"}:</span>{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    {pending.before.final_grade ?? "(uncalibrated)"}
                  </code>{" "}
                  <span aria-hidden>&rarr;</span>{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    {pending.after.final_grade}
                  </code>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        {material && (
          <div className="rounded-md border border-amber-300 bg-amber-50/50 dark:border-amber-400/30 dark:bg-amber-400/5 px-3 py-2 text-xs flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span className="text-amber-700 dark:text-amber-400">
              This is a material change (downward or cross-quadrant). A written
              rationale is required so the audit trail captures the evidence
              that supported the decision.
            </span>
          </div>
        )}
        <div className="space-y-1.5">
          <Label
            htmlFor="calibration-note"
            className="text-xs text-muted-foreground"
          >
            Rationale {material ? <span className="text-destructive">*</span> : "(optional)"}
            {" "}&mdash; visible to other calibrators and to the manager
          </Label>
          <Textarea
            id="calibration-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Strong delivery this half; mentored 2 juniors; led the X migration..."
            rows={3}
            maxLength={1000}
            autoFocus
            disabled={isSaving || isSaved}
            aria-invalid={material && !rationaleSatisfied}
            aria-describedby={material ? "calibration-note-counter" : undefined}
          />
          {material && (
            <p
              id="calibration-note-counter"
              className={`text-[11px] ${
                rationaleSatisfied
                  ? "text-muted-foreground"
                  : "text-amber-700 dark:text-amber-400"
              }`}
            >
              {rationaleSatisfied
                ? `${trimmedLength}/${MIN_RATIONALE_CHARS}+ characters`
                : `${trimmedLength}/${MIN_RATIONALE_CHARS} characters needed`}
            </p>
          )}
          {errorMessage && (
            <p role="alert" className="text-xs text-destructive">
              {errorMessage}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={confirmDisabled}>
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            {isSaved && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            {isSaving ? "Saving…" : isSaved ? "Saved" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
