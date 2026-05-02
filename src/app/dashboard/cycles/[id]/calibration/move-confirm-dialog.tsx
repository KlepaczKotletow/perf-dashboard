"use client";

import { useEffect, useState } from "react";
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
import { CheckCircle2, Loader2 } from "lucide-react";

export interface PendingMove {
  assignmentId: string;
  employeeName: string | null;
  before: { final_grade: string | null; potential: number | null };
  after: { final_grade: string; potential: number };
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
  useEffect(() => {
    setNote("");
    setSaveState("idle");
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
        <div className="space-y-1.5">
          <Label
            htmlFor="calibration-note"
            className="text-xs text-muted-foreground"
          >
            Rationale (optional &mdash; visible to other calibrators and to the
            manager)
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
          />
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
          <Button onClick={handleConfirm} disabled={isSaving || isSaved}>
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            {isSaved && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            {isSaving ? "Saving…" : isSaved ? "Saved" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
