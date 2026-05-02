"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BOX_COLS, BOX_ROWS, BoxCoord, gradeToBox } from "@/lib/nine-box";

interface Assignment {
  id: string;
  employee: { id: string; slack_name: string | null; department: string | null } | null;
  final_grade: string | null;
  potential_rating: number | null;
  overall_rating: number | null;
}

interface Props {
  assignments: Assignment[];
  onChipClick: (assignmentId: string) => void;
  onMove: (assignmentId: string, target: BoxCoord) => void;
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function ChipDraggable({ a, onClick }: { a: Assignment; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: a.id });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`flex items-center gap-1.5 bg-background rounded-full pl-0.5 pr-2 py-0.5 border border-border/80 hover:border-primary text-xs transition-colors ${isDragging ? "opacity-40" : ""}`}
    >
      <Avatar className="h-5 w-5">
        <AvatarFallback className="text-[9px]">{getInitials(a.employee?.slack_name)}</AvatarFallback>
      </Avatar>
      <span className="truncate max-w-[80px]">{a.employee?.slack_name ?? "?"}</span>
    </button>
  );
}

function BoxDroppable({
  row,
  col,
  tone,
  children,
}: {
  row: 0 | 1 | 2;
  col: 0 | 1 | 2;
  tone: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `box-${row}-${col}` });
  return (
    <div
      ref={setNodeRef}
      data-testid={`box-${row}-${col}`}
      className={`rounded-lg border p-2 flex flex-wrap gap-1.5 content-start min-h-[80px] ${tone} ${isOver ? "ring-2 ring-primary" : ""}`}
    >
      {children}
    </div>
  );
}

export function NineBoxGrid({ assignments, onChipClick, onMove }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Bucket each assignment into one of the 9 boxes (or parking lot).
  const buckets: Record<string, Assignment[]> = {};
  const parking: Assignment[] = [];
  for (const a of assignments) {
    const coord = gradeToBox(a.final_grade, a.potential_rating);
    if (!coord) {
      parking.push(a);
      continue;
    }
    const k = `${coord.row}-${coord.col}`;
    (buckets[k] ||= []).push(a);
  }

  function handleDragEnd(ev: DragEndEvent) {
    const assignmentId = String(ev.active.id);
    const overId = ev.over?.id ? String(ev.over.id) : null;
    if (!overId) return;
    const m = /^box-([012])-([012])$/.exec(overId);
    if (!m) return;
    const target: BoxCoord = {
      row: Number(m[1]) as 0 | 1 | 2,
      col: Number(m[2]) as 0 | 1 | 2,
    };
    onMove(assignmentId, target);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        <div className="flex gap-3">
          {/* Y-axis labels — visually top-to-bottom matches row 2 → 1 → 0. */}
          <div className="flex flex-col-reverse justify-around w-24 text-xs text-muted-foreground text-right pr-2">
            {BOX_ROWS.map((label) => (
              <div key={label} className="leading-tight">{label}</div>
            ))}
          </div>
          {/* 3×3 grid. Render row 2 first (top of grid is High Potential). */}
          <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-2 aspect-[3/2] min-h-[300px]">
            {([2, 1, 0] as const).flatMap((row) =>
              ([0, 1, 2] as const).map((col) => {
                const k = `${row}-${col}`;
                const list = buckets[k] || [];
                // Asymmetric coloring: keep positive reinforcement for top-right
                // (HiPo + Strong), use neutral muted styling everywhere else.
                // Gallup research finds red "LoPo" cells anchor calibrators on
                // a single salient cue and discourage further evidence review.
                // We deliberately do NOT color the bottom-left red.
                const tone =
                  row === 2 && col === 2
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-400/5 dark:border-emerald-400/20"
                    : "bg-muted/30 border-border/60";
                return (
                  <BoxDroppable key={k} row={row} col={col} tone={tone}>
                    {list.map((a) => (
                      <ChipDraggable key={a.id} a={a} onClick={() => onChipClick(a.id)} />
                    ))}
                  </BoxDroppable>
                );
              })
            )}
          </div>
        </div>
        {/* X-axis labels under the grid */}
        <div className="flex gap-3">
          <div className="w-24" />
          <div className="flex-1 grid grid-cols-3 text-xs text-muted-foreground text-center">
            {BOX_COLS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
        </div>

        {parking.length > 0 && (
          <div data-testid="box-parking" className="rounded-lg border border-dashed border-border/60 p-3 bg-muted/10">
            <p className="text-xs text-muted-foreground mb-2">
              Not yet calibrated ({parking.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {parking.map((a) => (
                <ChipDraggable key={a.id} a={a} onClick={() => onChipClick(a.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
