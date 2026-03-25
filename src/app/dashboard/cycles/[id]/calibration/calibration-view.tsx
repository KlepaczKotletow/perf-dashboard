"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, Loader2, Save, Star, Filter, ChevronDown, ChevronRight } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { canCalibrateDepartment, isHROrAbove } from "@/lib/roles";

const GRADE_OPTIONS = [
  { value: "Exceptional", label: "Exceptional", color: "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-400/10 dark:border-violet-400/20" },
  { value: "Exceeds Expectations", label: "Exceeds", color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20" },
  { value: "Meets Expectations", label: "Meets", color: "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-400/10 dark:border-sky-400/20" },
  { value: "Below Expectations", label: "Below", color: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20" },
  { value: "Needs Improvement", label: "Needs Improvement", color: "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-400/10 dark:border-red-400/20" },
];

interface Assignment {
  id: string;
  status: string;
  overall_rating: number | null;
  final_grade: string | null;
  calibrated_by: string | null;
  calibrated_at: string | null;
  assignment_type: string;
  employee: {
    id: string;
    slack_name: string | null;
    department: string | null;
    job_title: string | null;
    level: { name: string; grade: string | null } | null;
  } | null;
  manager: { slack_name: string | null } | null;
  responses: {
    id: string;
    assignment_id: string;
    reviewer_role: string;
    rating: number | null;
    comment: string | null;
    competency: { name: string } | null;
  }[];
}

interface CalibrationViewProps {
  cycle: {
    id: string;
    name: string;
    status: string;
    grades_released: boolean;
  };
  assignments: Assignment[];
  userRole: string;
  userDepartment: string | null;
  isDeptHead: boolean;
  currentUserId: string;
}

export function CalibrationView({
  cycle,
  assignments,
  userRole,
  userDepartment,
  isDeptHead,
  currentUserId,
}: CalibrationViewProps) {
  const [grades, setGrades] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    assignments.forEach((a) => {
      if (a.final_grade) initial[a.id] = a.final_grade;
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set(["all"]));

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Get all departments from assignments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    assignments.forEach((a) => {
      if (a.employee?.department) depts.add(a.employee.department);
    });
    return Array.from(depts).sort();
  }, [assignments]);

  // Filter assignments based on user permissions
  const visibleAssignments = useMemo(() => {
    let filtered = assignments;

    // Dept heads can only see their own department
    if (!isHROrAbove(userRole) && isDeptHead) {
      filtered = filtered.filter(
        (a) => a.employee?.department === userDepartment
      );
    }

    // Apply department filter
    if (filterDept !== "all") {
      filtered = filtered.filter(
        (a) => a.employee?.department === filterDept
      );
    }

    return filtered;
  }, [assignments, userRole, isDeptHead, userDepartment, filterDept]);

  // Group assignments by department
  const byDepartment = useMemo(() => {
    const groups: Record<string, Assignment[]> = {};
    visibleAssignments.forEach((a) => {
      const dept = a.employee?.department || "Unassigned";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(a);
    });
    // Sort each department group by rating descending
    Object.values(groups).forEach((group) =>
      group.sort((a, b) => (b.overall_rating || 0) - (a.overall_rating || 0))
    );
    return groups;
  }, [visibleAssignments]);

  // Rating distribution
  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]; // indices 0-4 for ratings 1-5
    visibleAssignments.forEach((a) => {
      if (a.overall_rating) {
        const idx = Math.round(a.overall_rating) - 1;
        if (idx >= 0 && idx < 5) dist[idx]++;
      }
    });
    return dist;
  }, [visibleAssignments]);

  // Grade distribution
  const gradeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    GRADE_OPTIONS.forEach((g) => (dist[g.value] = 0));
    visibleAssignments.forEach((a) => {
      const grade = grades[a.id] || a.final_grade;
      if (grade && dist[grade] !== undefined) dist[grade]++;
    });
    return dist;
  }, [visibleAssignments, grades]);

  // Calibration stats
  const calibratedCount = visibleAssignments.filter(
    (a) => grades[a.id] || a.final_grade
  ).length;
  const totalCount = visibleAssignments.length;

  // Compute average ratings by reviewer role for an assignment
  function getRoleAvg(responses: Assignment["responses"], role: string): string | null {
    const roleResponses = responses.filter(
      (r) => r.reviewer_role === role && r.rating
    );
    if (roleResponses.length === 0) return null;
    const avg =
      roleResponses.reduce((sum, r) => sum + (r.rating || 0), 0) /
      roleResponses.length;
    return avg.toFixed(1);
  }

  function toggleDept(dept: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  }

  function canEditDept(dept: string | null): boolean {
    return canCalibrateDepartment(userRole, isDeptHead, userDepartment, dept);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      // Build updates — only for assignments that have a grade set
      const updates = Object.entries(grades)
        .filter(([, grade]) => grade && grade !== "")
        .map(([assignmentId, grade]) => ({
          id: assignmentId,
          final_grade: grade,
          calibrated_by: currentUserId,
          calibrated_at: new Date().toISOString(),
        }));

      if (updates.length === 0) {
        setError("No grades to save. Select grades for at least one employee.");
        return;
      }

      // Update each assignment
      // Safe: assignments were loaded from a workspace-scoped cycle page; no direct workspace_id on review_assignments
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("review_assignments")
          .update({
            final_grade: update.final_grade,
            calibrated_by: update.calibrated_by,
            calibrated_at: update.calibrated_at,
          })
          .eq("id", update.id);

        if (updateError) {
          setError(`Failed to save grade: ${updateError.message}`);
          return;
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Failed to save calibration data");
    } finally {
      setSaving(false);
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const maxRatingCount = Math.max(...ratingDistribution, 1);

  const availableDepts = isHROrAbove(userRole) ? departments : isDeptHead ? (userDepartment ? [userDepartment] : []) : [];

  return (
    <div className="space-y-6">
      {/* Top bar: stats + filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-sm text-muted-foreground">Calibrated</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {calibratedCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {totalCount}
              </span>
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalCount - calibratedCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {cycle.grades_released && (
            <Badge className="text-xs font-medium text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10">
              Grades Released
            </Badge>
          )}

          {availableDepts.length > 1 && (
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {availableDepts.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button onClick={handleSave} disabled={saving || calibratedCount === 0}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saved ? "Saved!" : "Save Calibration"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {/* Distributions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Rating Distribution */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rating Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = ratingDistribution[rating - 1];
                const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-12 shrink-0">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-medium">{rating}</span>
                    </div>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400/80 rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxRatingCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {count}
                    </span>
                    <span className="text-xs text-muted-foreground/60 w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Grade Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {GRADE_OPTIONS.map((grade) => {
                const count = gradeDistribution[grade.value];
                const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                return (
                  <div key={grade.value} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-20 shrink-0 truncate">
                      {grade.label}
                    </span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all duration-500"
                        style={{
                          width: `${totalCount > 0 ? (count / totalCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {count}
                    </span>
                    <span className="text-xs text-muted-foreground/60 w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department-grouped assignments */}
      {Object.keys(byDepartment).length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No review assignments found for this cycle.
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(byDepartment)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dept, deptAssignments]) => {
            const isExpanded = expandedDepts.has("all") || expandedDepts.has(dept);
            const deptCalibratedCount = deptAssignments.filter(
              (a) => grades[a.id] || a.final_grade
            ).length;
            const canEdit = canEditDept(dept === "Unassigned" ? null : dept);

            return (
              <Card key={dept} className="border-border/60">
                <CardHeader className="pb-2">
                  <button
                    onClick={() => toggleDept(dept)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <CardTitle className="text-base flex-1">{dept}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {deptAssignments.length} employee{deptAssignments.length !== 1 ? "s" : ""}
                      </Badge>
                      <Badge
                        className={`text-[10px] ${
                          deptCalibratedCount === deptAssignments.length
                            ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10"
                            : "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10"
                        }`}
                      >
                        {deptCalibratedCount}/{deptAssignments.length} calibrated
                      </Badge>
                    </div>
                  </button>
                </CardHeader>

                {isExpanded && (
                  <CardContent>
                    {/* Table header */}
                    <div className="hidden md:grid grid-cols-[auto_1fr_80px_60px_60px_60px_60px_160px] gap-3 px-3 pb-2 border-b border-border/40 mb-2">
                      <div className="w-8" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Employee
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">
                        Avg Rating
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">
                        Self
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">
                        Mgr
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">
                        Peer
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">
                        Up
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Final Grade
                      </span>
                    </div>

                    <div className="space-y-1">
                      {deptAssignments.map((a) => {
                        const selfAvg = getRoleAvg(a.responses, "self");
                        const mgrAvg = getRoleAvg(a.responses, "manager");
                        const peerAvg = getRoleAvg(a.responses, "peer");
                        const upAvg = getRoleAvg(a.responses, "upward");
                        const currentGrade = grades[a.id] || a.final_grade || "";
                        const isCalibrated = !!currentGrade;
                        const gradeOption = GRADE_OPTIONS.find(
                          (g) => g.value === currentGrade
                        );

                        return (
                          <div
                            key={a.id}
                            className={`grid grid-cols-1 md:grid-cols-[auto_1fr_80px_60px_60px_60px_60px_160px] gap-3 items-center p-3 rounded-lg border transition-all ${
                              isCalibrated
                                ? "border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-400/10 dark:bg-emerald-400/[0.02]"
                                : "border-border/60 bg-card"
                            }`}
                          >
                            {/* Avatar */}
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="text-[10px] bg-primary/[0.08] text-primary font-medium">
                                {getInitials(a.employee?.slack_name || null)}
                              </AvatarFallback>
                            </Avatar>

                            {/* Name / title / level */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {a.employee?.slack_name || "Unknown"}
                                </p>
                                {isCalibrated && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {a.employee?.job_title || "No title"}
                                {a.employee?.level && ` · ${a.employee.level.name}`}
                                {a.employee?.level?.grade &&
                                  ` (${a.employee.level.grade})`}
                                {a.manager?.slack_name &&
                                  ` · Mgr: ${a.manager.slack_name}`}
                              </p>
                            </div>

                            {/* Overall avg rating */}
                            <div className="text-center">
                              {a.overall_rating ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                  <span className="text-sm font-bold text-foreground">
                                    {typeof a.overall_rating === "number"
                                      ? a.overall_rating.toFixed(1)
                                      : a.overall_rating}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">
                                  —
                                </span>
                              )}
                            </div>

                            {/* Self */}
                            <div className="text-center">
                              <span
                                className={`text-xs font-medium ${
                                  selfAvg
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                                }`}
                              >
                                {selfAvg || "—"}
                              </span>
                            </div>

                            {/* Manager */}
                            <div className="text-center">
                              <span
                                className={`text-xs font-medium ${
                                  mgrAvg
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                                }`}
                              >
                                {mgrAvg || "—"}
                              </span>
                            </div>

                            {/* Peer */}
                            <div className="text-center">
                              <span
                                className={`text-xs font-medium ${
                                  peerAvg
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                                }`}
                              >
                                {peerAvg || "—"}
                              </span>
                            </div>

                            {/* Upward */}
                            <div className="text-center">
                              <span
                                className={`text-xs font-medium ${
                                  upAvg
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                                }`}
                              >
                                {upAvg || "—"}
                              </span>
                            </div>

                            {/* Final Grade */}
                            <div>
                              {canEdit ? (
                                <Select
                                  value={currentGrade}
                                  onValueChange={(val) =>
                                    setGrades((prev) => ({
                                      ...prev,
                                      [a.id]: val,
                                    }))
                                  }
                                >
                                  <SelectTrigger
                                    className={`h-8 text-xs ${
                                      gradeOption
                                        ? gradeOption.color
                                        : ""
                                    }`}
                                  >
                                    <SelectValue placeholder="Select grade" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {GRADE_OPTIONS.map((g) => (
                                      <SelectItem
                                        key={g.value}
                                        value={g.value}
                                      >
                                        {g.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : currentGrade ? (
                                <Badge
                                  className={`text-[10px] ${
                                    gradeOption?.color || ""
                                  }`}
                                >
                                  {gradeOption?.label || currentGrade}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">
                                  Not graded
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
      )}
    </div>
  );
}
