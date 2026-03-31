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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CalendarClock, Layers, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { getClientIdentity } from "@/lib/client-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CycleProfileContent {
  cycle_type?: string;
  suggested_description?: string;
  suggested_competency_categories?: string[];
  review_template_name?: string;
}

interface CycleImportDialogProps {
  template: {
    id: string;
    name: string;
    description: string | null;
    content: any;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CYCLE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  mid_year: "Mid-Year",
  quarterly: "Quarterly",
  probation: "Probation",
  custom: "Custom",
};

const CYCLE_TYPE_COLORS: Record<string, string> = {
  annual: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  mid_year: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800",
  quarterly: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
  probation: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
  custom: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
};

// ── Main dialog ──────────────────────────────────────────────────────────────

export function CycleImportDialog({
  template,
  open,
  onOpenChange,
}: CycleImportDialogProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cycleName, setCycleName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const content = template.content as CycleProfileContent | undefined;
  const cycleType = content?.cycle_type || "custom";
  const categories = content?.suggested_competency_categories ?? [];

  // ── Create draft cycle ──────────────────────────────────────────────────

  async function handleCreate() {
    const trimmedName = cycleName.trim();
    if (!trimmedName) { setError("Cycle name is required."); return; }
    if (!startDate) { setError("Start date is required."); return; }
    if (!endDate) { setError("End date is required."); return; }
    if (new Date(endDate) <= new Date(startDate)) {
      setError("End date must be after start date.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const supabase = createClient();
      const identity = await getClientIdentity(supabase);
      if (!identity) throw new Error("Not authenticated");

      const { data: cycle, error: insertError } = await supabase
        .from("performance_cycles")
        .insert({
          name: trimmedName,
          description: content?.suggested_description || null,
          type: cycleType,
          status: "draft",
          start_date: startDate,
          end_date: endDate,
          workspace_id: identity.workspaceId,
          created_by: identity.userId,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      onOpenChange(false);
      router.push(`/dashboard/cycles/${cycle.id}`);
      router.refresh();
    } catch (err: any) {
      console.error("Error creating cycle:", err);
      setError(err?.message || "Failed to create cycle. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // ── Reset on close ──────────────────────────────────────────────────────

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !cycleName) {
      setCycleName(template.name);
    }
    if (!nextOpen) {
      setCycleName("");
      setStartDate("");
      setEndDate("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            {template.name}
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        {/* ── Profile preview ── */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] capitalize ${CYCLE_TYPE_COLORS[cycleType] || CYCLE_TYPE_COLORS.custom}`}
            >
              {CYCLE_TYPE_LABELS[cycleType] || cycleType}
            </Badge>
          </div>
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span>
                Competency focus:{" "}
                <span className="text-foreground font-medium">
                  {categories.join(", ")}
                </span>
              </span>
            </div>
          )}
          {content?.review_template_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>
                Review template:{" "}
                <span className="text-foreground font-medium">
                  {content.review_template_name}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ── Form ── */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cycle-name">Cycle Name</Label>
            <Input
              id="cycle-name"
              value={cycleName}
              onChange={(e) => setCycleName(e.target.value)}
              placeholder="e.g. Q2 2026 Performance Review"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !cycleName.trim() || !startDate || !endDate}>
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {creating ? "Creating..." : "Create Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
