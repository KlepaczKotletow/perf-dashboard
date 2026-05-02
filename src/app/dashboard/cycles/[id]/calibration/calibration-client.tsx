"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
  Save,
  TriangleAlert,
  Users,
  Star,
} from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { NineBoxGrid } from "./nine-box-grid";
import type { BoxCoord } from "@/lib/nine-box";

// ── Types ────────────────────────────────────────────────────────────────────

interface AssignmentRow {
  id: string;
  status: string;
  overall_rating: number | null;
  final_grade: string | null;
  potential_rating: number | null;
  employee: {
    id: string;
    slack_name: string;
    department: string | null;
    level?: { name: string; grade: string | null } | null;
  } | null;
  manager: { slack_name: string } | null;
  responses: Array<{
    rating: number;
    reviewer_role: string;
    competency: { name: string; category: string | null } | null;
  }>;
}

interface Cycle {
  id: string;
  name: string;
  status: string;
  grades_released: boolean;
}

interface CalibrationClientProps {
  cycle: Cycle;
  assignments: AssignmentRow[];
  cycleId: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const GRADE_OPTIONS = [
  { value: "Exceptional", label: "Exceptional", color: "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-400/10 dark:border-violet-400/20" },
  { value: "Exceeds Expectations", label: "Exceeds Expectations", color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20" },
  { value: "Meets Expectations", label: "Meets Expectations", color: "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-400/10 dark:border-sky-400/20" },
  { value: "Below Expectations", label: "Below Expectations", color: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20" },
  { value: "Unsatisfactory", label: "Unsatisfactory", color: "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-400/10 dark:border-red-400/20" },
] as const;

const COMPETENCY_COLORS = [
  "bg-violet-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-indigo-400",
  "bg-teal-400",
  "bg-orange-400",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAvgRating(responses: AssignmentRow["responses"], role?: string): number | null {
  const filtered = role
    ? responses.filter((r) => r.reviewer_role === role && r.rating != null && r.rating > 0)
    : responses.filter((r) => r.rating != null && r.rating > 0);
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, r) => sum + r.rating, 0) / filtered.length;
}

function getDisplayAvg(responses: AssignmentRow["responses"]): number | null {
  const mgrAvg = getAvgRating(responses, "manager");
  if (mgrAvg !== null) return mgrAvg;
  return getAvgRating(responses);
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

// ── Mini competency bar chart ────────────────────────────────────────────────

function CompetencyBars({ responses }: { responses: AssignmentRow["responses"] }) {
  // Average by competency (use manager responses if available, else all)
  const byCompetency = useMemo(() => {
    const map: Record<string, { name: string; ratings: number[] }> = {};
    const mgrResponses = responses.filter((r) => r.reviewer_role === "manager" && r.competency && r.rating > 0);
    const useResponses = mgrResponses.length > 0 ? mgrResponses : responses.filter((r) => r.competency && r.rating > 0);
    useResponses.forEach((r) => {
      const key = r.competency!.name;
      if (!map[key]) map[key] = { name: key, ratings: [] };
      map[key].ratings.push(r.rating);
    });
    return Object.values(map).map((c) => ({
      name: c.name,
      avg: c.ratings.reduce((s, v) => s + v, 0) / c.ratings.length,
    }));
  }, [responses]);

  if (byCompetency.length === 0) {
    return <span className="text-xs text-muted-foreground/40">No data</span>;
  }

  return (
    <div className="flex items-end gap-1 h-8" title="Competency scores (1–5)">
      {byCompetency.map((c, i) => {
        const heightPct = (c.avg / 5) * 100;
        const color = COMPETENCY_COLORS[i % COMPETENCY_COLORS.length];
        return (
          <div
            key={c.name}
            className="flex flex-col items-center justify-end gap-0.5"
            style={{ minWidth: 10 }}
            title={`${c.name}: ${c.avg.toFixed(1)}`}
          >
            <div
              className={`w-2.5 rounded-sm ${color} opacity-80`}
              style={{ height: `${Math.max(heightPct * 0.28, 3)}px` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Rating bar ───────────────────────────────────────────────────────────────

function RatingBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground/40">—</span>;
  const pct = (value / 5) * 100;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground tabular-nums w-6 shrink-0">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ── Distribution section ─────────────────────────────────────────────────────

function GradeDistribution({ grades }: { grades: Record<string, string> }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    GRADE_OPTIONS.forEach((g) => (map[g.value] = 0));
    Object.values(grades).forEach((g) => {
      if (g && map[g] !== undefined) map[g]++;
    });
    return map;
  }, [grades]);

  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const max = Math.max(...Object.values(counts), 1);

  if (total === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Grade Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {GRADE_OPTIONS.map((grade) => {
            const count = counts[grade.value];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={grade.value} className="flex items-center gap-3">
                <span className="text-xs font-medium w-36 shrink-0 truncate">{grade.label}</span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-all duration-500"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{count}</span>
                <span className="text-xs text-muted-foreground/50 w-10 text-right tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Per-row save state ────────────────────────────────────────────────────────

function useRowSave(
  assignmentId: string,
  supabase: ReturnType<typeof createBrowserClient>,
  onSuccess?: (grade: string) => void,
) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const showSaved = savedAt !== null && Date.now() - savedAt < 3000;

  async function save(grade: string) {
    setSaving(true);
    setSaveError(null);
    const normalized = !grade || grade === "__clear__" ? "" : grade;
    // Safe: assignment was loaded from a workspace-scoped cycle page; no direct workspace_id on review_assignments
    const { error } = await supabase
      .from("review_assignments")
      .update({ final_grade: normalized || null })
      .eq("id", assignmentId);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return { ok: false as const, error };
    }
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 3000);
    onSuccess?.(normalized);
    return { ok: true as const };
  }

  return { saving, showSaved, saveError, save };
}

// ── Assignment row ────────────────────────────────────────────────────────────

function AssignmentTableRow({
  assignment,
  supabase,
  onGradeSaved,
}: {
  assignment: AssignmentRow;
  supabase: ReturnType<typeof createBrowserClient>;
  onGradeSaved?: (assignmentId: string, grade: string) => void;
}) {
  const [grade, setGrade] = useState(assignment.final_grade || "");
  const { saving, showSaved, saveError, save } = useRowSave(
    assignment.id,
    supabase,
    (g) => onGradeSaved?.(assignment.id, g),
  );

  const displayAvg = getDisplayAvg(assignment.responses);
  const gradeOption = GRADE_OPTIONS.find((g) => g.value === grade);

  async function handleGradeChange(val: string) {
    setGrade(val);
    await save(val);
  }

  return (
    <div className="grid grid-cols-[minmax(160px,1fr)_80px_60px_180px_180px_80px] gap-x-4 items-center px-5 py-3 hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0 min-w-[760px]">
      {/* Employee */}
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-primary">
              {getInitials(assignment.employee?.slack_name)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {assignment.employee?.slack_name || "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {[
                assignment.manager?.slack_name ? `Mgr: ${assignment.manager.slack_name}` : null,
                assignment.employee?.level?.name,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </div>

      {/* Dept */}
      <div className="truncate">
        <span className="text-xs text-muted-foreground">
          {assignment.employee?.department || "—"}
        </span>
      </div>

      {/* Avg rating + bar */}
      <div>
        <RatingBar value={displayAvg} />
      </div>

      {/* Competency breakdown */}
      <div>
        <CompetencyBars responses={assignment.responses} />
      </div>

      {/* Final grade select */}
      <div>
        <Select value={grade} onValueChange={handleGradeChange}>
          <SelectTrigger
            className={`h-8 text-xs w-full ${gradeOption ? gradeOption.color : ""}`}
          >
            <SelectValue placeholder="— Not set —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">— Not set —</SelectItem>
            {GRADE_OPTIONS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save status */}
      <div className="flex items-center justify-end gap-1.5">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {showSaved && !saving && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
        {saveError && !saving && (
          <span className="text-[11px] text-destructive" title={saveError}>
            Error
          </span>
        )}
        {!saving && !showSaved && !saveError && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => save(grade)}
            disabled={!grade || grade === "__clear__"}
            title="Save grade"
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export default function CalibrationClient({
  cycle,
  assignments,
  cycleId,
}: CalibrationClientProps) {
  const [sortAsc, setSortAsc] = useState(false);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // Track current grades for the distribution section
  const [liveGrades, setLiveGrades] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    assignments.forEach((a) => {
      if (a.final_grade) map[a.id] = a.final_grade;
    });
    return map;
  });

  // Track current potential ratings for the 9-box grid.
  const [livePotentials, setLivePotentials] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    assignments.forEach((a) => {
      if (a.potential_rating != null) map[a.id] = a.potential_rating;
    });
    return map;
  });

  // ── View toggle: "table" (default, dropdown grid) | "grid" (9-box) ──────
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [moveError, setMoveError] = useState<string | null>(null);

  // Keep liveGrades in sync with saves so the distribution chart updates live.
  const handleGradeSaved = useCallback(
    (assignmentId: string, grade: string) => {
      setLiveGrades((prev) => {
        const next = { ...prev };
        if (!grade) {
          delete next[assignmentId];
        } else {
          next[assignmentId] = grade;
        }
        return next;
      });
    },
    [],
  );

  // ── 9-box drag handler ────────────────────────────────────────────────
  // Optimistic: update local state, fire the v2 RPC; revert on error/skip.
  async function handleGridMove(assignmentId: string, target: BoxCoord) {
    const { boxToGrade } = await import("@/lib/nine-box");
    const proposal = boxToGrade(target);
    const prevGrade = liveGrades[assignmentId];
    const prevPotential = livePotentials[assignmentId];
    setLiveGrades((p) => ({ ...p, [assignmentId]: proposal.final_grade }));
    setLivePotentials((p) => ({ ...p, [assignmentId]: proposal.potential }));
    setMoveError(null);

    const { data, error } = await supabase.rpc("update_calibration_grades", {
      p_changes: [
        {
          assignment_id: assignmentId,
          grade: proposal.final_grade,
          potential_rating: proposal.potential,
        },
      ],
    });
    const skipped = (data as { skipped?: number } | null)?.skipped ?? 0;
    if (error || skipped > 0) {
      // Revert
      setLiveGrades((p) => {
        const next = { ...p };
        if (prevGrade) next[assignmentId] = prevGrade;
        else delete next[assignmentId];
        return next;
      });
      setLivePotentials((p) => {
        const next = { ...p };
        if (prevPotential != null) next[assignmentId] = prevPotential;
        else delete next[assignmentId];
        return next;
      });
      setMoveError(error?.message ?? "Move was skipped — check permissions");
    }
  }

  // Enriched view of assignments with the live grade+potential overrides
  // applied. Memoized so the grid only re-buckets when something changes.
  const enrichedForGrid = useMemo(
    () =>
      assignments.map((a) => ({
        id: a.id,
        employee: a.employee
          ? { id: a.employee.id, slack_name: a.employee.slack_name, department: a.employee.department }
          : null,
        final_grade: liveGrades[a.id] ?? a.final_grade,
        potential_rating: livePotentials[a.id] ?? a.potential_rating,
        overall_rating: a.overall_rating,
      })),
    [assignments, liveGrades, livePotentials],
  );

  // ── Bulk apply: one RPC call instead of one UPDATE per unset row ────────
  const router = useRouter();
  const [bulkGrade, setBulkGrade] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const unsetAssignments = useMemo(
    () => assignments.filter((a) => !a.final_grade && a.overall_rating != null),
    [assignments],
  );

  async function handleBulkApply() {
    if (!bulkGrade || unsetAssignments.length === 0) return;
    setBulkSaving(true);
    setBulkError(null);
    try {
      const changes = unsetAssignments.map((a) => ({
        assignment_id: a.id,
        grade: bulkGrade,
      }));
      const { error } = await supabase.rpc("update_calibration_grades", {
        p_changes: changes,
      });
      if (error) throw error;
      // Optimistic: fill liveGrades so the distribution chart updates now.
      setLiveGrades((prev) => {
        const next = { ...prev };
        for (const a of unsetAssignments) next[a.id] = bulkGrade;
        return next;
      });
      setBulkGrade("");
      router.refresh();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Bulk apply failed");
    } finally {
      setBulkSaving(false);
    }
  }

  const sorted = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const ra = getDisplayAvg(a.responses) ?? a.overall_rating ?? 0;
      const rb = getDisplayAvg(b.responses) ?? b.overall_rating ?? 0;
      return sortAsc ? ra - rb : rb - ra;
    });
  }, [assignments, sortAsc]);

  // Stats
  const completedCount = assignments.filter((a) => a.overall_rating != null).length;
  const calibratedCount = assignments.filter((a) => a.final_grade != null && a.final_grade !== "").length;
  const allRatings = assignments
    .map((a) => getDisplayAvg(a.responses) ?? a.overall_rating)
    .filter((v): v is number => v != null);
  const avgRating = allRatings.length > 0
    ? allRatings.reduce((s, v) => s + v, 0) / allRatings.length
    : null;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" asChild>
          <Link href={`/dashboard/cycles/${cycleId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Calibration — {cycle.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set final grades for each employee before releasing results.
          </p>
        </div>
      </div>

      {/* ── View-mode toggle ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("table")}
        >
          Table
        </Button>
        <Button
          type="button"
          variant={viewMode === "grid" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("grid")}
        >
          9-box grid
        </Button>
      </div>

      {/* ── Grades-released warning ─────────────────────────────────────── */}
      {cycle.grades_released && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-400">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          Grades have already been released to employees.
        </div>
      )}

      {viewMode === "table" && (
        <>
      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{assignments.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-400/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{completedCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Reviews Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-400/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{calibratedCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Calibrated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-400/10 flex items-center justify-center shrink-0">
                <Star className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">
                  {avgRating != null ? avgRating.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bulk apply toolbar (only when there are unset rows to apply to) ── */}
      {!cycle.grades_released && unsetAssignments.length > 1 && (
        <Card className="border-border/60">
          <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-muted-foreground">
              {unsetAssignments.length} employees still need a grade.
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Set all unset to:</span>
              <Select value={bulkGrade} onValueChange={setBulkGrade}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Choose a grade…" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleBulkApply}
                disabled={!bulkGrade || bulkSaving}
                className="h-8 text-xs"
              >
                {bulkSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Apply to {unsetAssignments.length}
              </Button>
            </div>
            {bulkError && (
              <span className="w-full text-xs text-destructive">{bulkError}</span>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">Employee Ratings</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4 overflow-x-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[minmax(160px,1fr)_80px_60px_180px_180px_80px] gap-x-4 items-center px-5 pb-2.5 border-b border-border/60 min-w-[760px]">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Employee
            </p>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Dept
            </p>
            <button
              onClick={() => setSortAsc((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            >
              Rating
              <ArrowUpDown className="h-3 w-3" />
            </button>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Competencies
            </p>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Final Grade
            </p>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-right">
              Save
            </p>
          </div>

          {/* Rows */}
          {sorted.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No standard review assignments found for this cycle.
            </div>
          ) : (
            <div>
              {sorted.map((assignment) => (
                <AssignmentTableRow
                  key={assignment.id}
                  assignment={assignment}
                  supabase={supabase}
                  onGradeSaved={handleGradeSaved}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Grade distribution ─────────────────────────────────────────────── */}
      <GradeDistribution grades={liveGrades} />
        </>
      )}

      {/* ── 9-box grid view ─────────────────────────────────────────────── */}
      {viewMode === "grid" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">9-box calibration grid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {moveError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {moveError}
              </div>
            )}
            <NineBoxGrid
              assignments={enrichedForGrid}
              onChipClick={() => {
                /* Sprint 2 Task 7+8 wires the evidence sheet */
              }}
              onMove={handleGridMove}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
