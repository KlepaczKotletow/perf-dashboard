"use client";

import { useMemo, useRef, useCallback, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  computePhaseRanges,
  PhaseOverride,
  PhaseRange,
} from "@/lib/cycle-phases";

const COLORS = [
  "bg-blue-400", "bg-indigo-400", "bg-purple-400",
  "bg-pink-400", "bg-amber-400", "bg-emerald-400",
];

interface Props {
  startDate?: Date;
  endDate?: Date;
  overrides: PhaseOverride[];
  onChange: (overrides: PhaseOverride[]) => void;
}

export function EditablePhaseTimeline({ startDate, endDate, overrides, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    dragAbortRef.current?.abort();
  }, []);

  const phases: PhaseRange[] = useMemo(() => {
    if (!startDate || !endDate) return [];
    return computePhaseRanges(startDate, endDate, overrides);
  }, [startDate, endDate, overrides]);

  const totalMs = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return endDate.getTime() - startDate.getTime();
  }, [startDate, endDate]);

  const xToDate = useCallback((xPx: number, widthPx: number): Date => {
    if (!startDate || totalMs <= 0) return startDate ?? new Date();
    const ratio = Math.max(0, Math.min(1, xPx / widthPx));
    return new Date(startDate.getTime() + ratio * totalMs);
  }, [startDate, totalMs]);

  function startDrag(boundaryIdx: number, ev: React.PointerEvent) {
    if (!containerRef.current) return;
    ev.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();

    dragAbortRef.current?.abort();
    const controller = new AbortController();
    dragAbortRef.current = controller;

    function onMove(e: PointerEvent) {
      const xPx = e.clientX - rect.left;
      const newDate = xToDate(xPx, rect.width);
      const phase = phases[boundaryIdx];
      const next = phases[boundaryIdx + 1];
      if (!phase || !next) return;
      const minMs = phase.start_date.getTime() + 60_000;
      const maxMs = next.end_date.getTime() - 60_000;
      const clamped = new Date(Math.max(minMs, Math.min(maxMs, newDate.getTime())));
      const updated = overrides.filter((o) => o.phase_type !== phase.phase_type);
      updated.push({ phase_type: phase.phase_type, end_date: clamped });
      onChange(updated);
    }
    function onUp() {
      controller.abort();
      dragAbortRef.current = null;
    }
    window.addEventListener("pointermove", onMove, { signal: controller.signal });
    window.addEventListener("pointerup", onUp, { signal: controller.signal });
  }

  if (!startDate || !endDate || endDate <= startDate || phases.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Phase Timeline</Label>
        <div className="flex h-10 rounded-lg items-center justify-center border border-dashed border-amber-300 bg-amber-50/50">
          <span className="text-xs text-amber-600">Set valid start and end dates</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium">Phase Timeline</Label>
        <span className="text-[11px] text-muted-foreground">Drag handles to adjust phase deadlines</span>
      </div>
      <div ref={containerRef} className="relative flex h-10 rounded-lg overflow-hidden border border-border/60 select-none">
        {phases.map((phase, idx) => {
          const widthPct = ((phase.end_date.getTime() - phase.start_date.getTime()) / totalMs) * 100;
          const isCustom = phase.is_user_customized;
          return (
            <div
              key={phase.phase_type}
              className={`${COLORS[idx]} flex items-center justify-center relative ${isCustom ? "ring-2 ring-inset ring-white/40" : ""}`}
              style={{ width: `${widthPct}%` }}
              title={`${phase.name}: ${format(phase.start_date, "MMM d")} → ${format(phase.end_date, "MMM d")}`}
            >
              <span className="text-[11px] text-white font-semibold truncate px-1 pointer-events-none">
                {phase.name.split(" ")[0]}
              </span>
            </div>
          );
        })}
        {phases.slice(0, -1).map((phase, idx) => {
          const leftPct = ((phase.end_date.getTime() - startDate.getTime()) / totalMs) * 100;
          return (
            <div
              key={`handle-${phase.phase_type}`}
              role="slider"
              aria-label={`Boundary after ${phase.name}`}
              aria-valuemin={startDate.getTime()}
              aria-valuemax={endDate.getTime()}
              aria-valuenow={phase.end_date.getTime()}
              tabIndex={0}
              className="absolute top-0 h-full w-2 -translate-x-1/2 cursor-ew-resize bg-white/0 hover:bg-white/30 active:bg-white/50 transition-colors"
              style={{ left: `${leftPct}%` }}
              onPointerDown={(e) => startDrag(idx, e)}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{format(startDate, "MMM d")}</span>
        <span>{format(endDate, "MMM d, yyyy")}</span>
      </div>
    </div>
  );
}
