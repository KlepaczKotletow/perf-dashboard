"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Pencil, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { createBrowserClient } from "@supabase/ssr";

interface Phase {
  id: string;
  name: string;
  phase_type: string;
  status: "pending" | "active" | "completed";
  start_date: string;
  end_date: string;
  is_user_customized: boolean;
}

interface Props {
  phase: Phase;
  canEdit: boolean;
  cycleId: string;
  onUpdated?: (newEndDate: Date) => void;
}

function toUtcNoonIso(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)).toISOString();
}

export function PhaseDeadlineEditor({ phase, canEdit, cycleId, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(new Date(phase.end_date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftDate(new Date(phase.end_date));
  }, [phase.end_date]);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data, error: rpcErr } = await supabase.rpc("update_cycle_phase_dates", {
      p_cycle_id: cycleId,
      p_phase_dates: [{
        phase_id: phase.id,
        start_date: phase.start_date,
        end_date: toUtcNoonIso(draftDate),
      }],
    });
    setSaving(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    if (data?.errors?.length) {
      setError(data.errors[0]);
      return;
    }
    setEditing(false);
    onUpdated?.(draftDate);
  }

  const statusColor =
    phase.status === "active" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
    phase.status === "completed" ? "text-muted-foreground bg-muted border-border" :
    "text-sky-700 bg-sky-50 border-sky-200";

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{phase.name}</span>
        <Badge variant="outline" className={statusColor}>{phase.status}</Badge>
        {phase.is_user_customized && (
          <span className="text-[10px] text-muted-foreground italic">(customized)</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {format(new Date(phase.start_date), "MMM d")} → {format(new Date(phase.end_date), "MMM d, yyyy")}
        </span>
        {canEdit && phase.status !== "completed" && (
          <Popover
            open={editing}
            onOpenChange={(open) => {
              setEditing(open);
              if (!open) {
                setError(null);
                setDraftDate(new Date(phase.end_date));
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Edit deadline">
                <Pencil className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={draftDate}
                onSelect={(d) => d && setDraftDate(d)}
                fromDate={new Date(phase.start_date)}
              />
              {error && <p className="px-3 pb-2 text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 p-2 border-t">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
