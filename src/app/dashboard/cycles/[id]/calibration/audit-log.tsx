"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface AuditRow {
  id: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
  note: string | null;
  created_at: string;
  calibrator: { slack_name: string | null } | null;
  assignment:
    | {
        employee: { slack_name: string | null } | null;
      }
    | null;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Props {
  cycleId: string;
  /** Bumping this prop forces a re-fetch (e.g. after a calibration move). */
  refreshKey?: number;
}

/**
 * Read-only chronological log of every grade/potential change for the cycle.
 * Reads from `calibration_notes` directly via RLS (workspace-scoped SELECT).
 * Capped at 50 rows; we render newest first.
 */
export function CalibrationAuditLog({ cycleId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Resetting loading/error before each fetch — standard fetch-on-mount/refresh pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    const supabase = createClient();
    supabase
      .from("calibration_notes")
      .select(
        `
        id, field, before_value, after_value, note, created_at,
        calibrator:users!calibration_notes_calibrator_id_fkey(slack_name),
        assignment:review_assignments!calibration_notes_assignment_id_fkey(
          employee:users!review_assignments_employee_id_fkey(slack_name)
        )
      `,
      )
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setRows([]);
        } else {
          // PostgREST returns embeds as arrays for to-many and as objects for
          // to-one, but the typescript types stay generic. Normalize to the
          // single-object shape we want.
          setRows(
            (data ?? []).map((r: Record<string, unknown>) => ({
              ...(r as object),
              calibrator: Array.isArray(r.calibrator)
                ? ((r.calibrator[0] as AuditRow["calibrator"]) ?? null)
                : (r.calibrator as AuditRow["calibrator"]) ?? null,
              assignment: Array.isArray(r.assignment)
                ? ((r.assignment[0] as AuditRow["assignment"]) ?? null)
                : (r.assignment as AuditRow["assignment"]) ?? null,
            })) as AuditRow[],
          );
        }
        setLoading(false);
      });
  }, [cycleId, refreshKey]);

  if (loading) {
    return <Skeleton className="h-32" />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No calibration changes yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        // Walk the joined assignment which may itself be array-shaped from
        // PostgREST. We already normalized at fetch time, but defend at render
        // time in case the inner `employee` came back as an array.
        const assignmentEmployee = Array.isArray(r.assignment?.employee)
          ? (r.assignment?.employee as Array<{ slack_name: string | null }>)[0]
              ?.slack_name ?? null
          : r.assignment?.employee?.slack_name ?? null;
        const empName = assignmentEmployee ?? "an employee";

        return (
          <div
            key={r.id}
            className="flex gap-3 border-b border-border/40 pb-3 last:border-0"
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-[10px]">
                {getInitials(r.calibrator?.slack_name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm flex-1 min-w-0">
              <span className="font-medium">
                {r.calibrator?.slack_name ?? "Someone"}
              </span>
              {" changed "}
              <strong>{empName}</strong>
              {"'s "}
              {r.field.replace(/_/g, " ")}
              {" from "}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                {r.before_value ?? "—"}
              </code>{" "}
              <span aria-hidden>&rarr;</span>{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                {r.after_value ?? "—"}
              </code>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {format(new Date(r.created_at), "MMM d, yyyy 'at' HH:mm")}
              </div>
              {r.note && (
                <p className="mt-1 italic text-muted-foreground">
                  &ldquo;{r.note}&rdquo;
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
