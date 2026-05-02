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

export interface PendingMove {
  assignmentId: string;
  employeeName: string | null;
  before: { final_grade: string | null; potential: number | null };
  after: { final_grade: string; potential: number };
}

interface Props {
  pending: PendingMove | null;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog shown when a calibrator drags a chip on the 9-box grid.
 * The actual RPC call happens only after the user confirms — the parent gets
 * the (optionally trimmed) rationale via onConfirm.
 *
 * Note: DialogDescription renders a <p> by default, so we use `asChild` and
 * a <div> wrapper to embed <code> blocks without invalid HTML nesting.
 */
export function MoveConfirmDialog({ pending, onConfirm, onCancel }: Props) {
  const [note, setNote] = useState("");

  // Reset the textarea when a new move arrives so notes don't bleed across
  // moves (e.g. drag A, cancel, drag B — B should start with an empty box).
  useEffect(() => {
    setNote("");
  }, [
    pending?.assignmentId,
    pending?.after.final_grade,
    pending?.after.potential,
  ]);

  return (
    <Dialog open={pending != null} onOpenChange={(v) => !v && onCancel()}>
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
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(note.trim())}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
