import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Users, Calendar, Clock, CheckCircle2, AlertCircle, Target, ArrowRight, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { isManagerOrAbove, isHROrAbove, canAccessCalibration } from "@/lib/roles";
import { CycleActions } from "./cycle-actions";
import { AddEmployeesForm } from "./add-employees-form";
import { CycleQuestions } from "./cycle-questions";

async function getCycle(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("performance_cycles")
    .select(`
      *,
      creator:users!performance_cycles_created_by_fkey(slack_name)
    `)
    .eq("id", id)
    .single();
  return data;
}

async function getCyclePhases(cycleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("cycle_phases")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("sort_order");
  return data || [];
}

async function getReviewAssignments(cycleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("review_assignments")
    .select(`
      *,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, department),
      manager:users!review_assignments_manager_id_fkey(slack_name),
      reviewer:users!review_assignments_reviewer_id_fkey(slack_name)
    `)
    .eq("cycle_id", cycleId);
  return data || [];
}

async function getCycleEmployees(cycleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("performance_cycle_employees")
    .select(`
      *,
      employee:users!performance_cycle_employees_employee_id_fkey(id, slack_name, slack_email)
    `)
    .eq("performance_cycle_id", cycleId);
  return data || [];
}

async function getWorkspaceUsers() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("users")
    .select("id, slack_name, slack_email")
    .order("slack_name");
  return data || [];
}

async function getCycleQuestions(cycleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("cycle_questions")
    .select(`
      id, question_type, competency_id, prompt, sort_order, required,
      competency:competencies(id, name, category)
    `)
    .eq("cycle_id", cycleId)
    .order("sort_order");
  return (data || []).map((q: any) => ({
    ...q,
    competency: Array.isArray(q.competency) ? q.competency[0] || null : q.competency,
  }));
}

async function getAllCompetencies() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("competencies")
    .select("id, name, category, description")
    .order("category")
    .order("name");
  return data || [];
}

const statusColors: Record<string, string> = {
  draft: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10",
  active: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
  completed: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
  closed: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10",
};

const assignmentStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" },
  in_progress: { label: "In Progress", className: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" },
  completed: { label: "Completed", className: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" },
};

export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getUserWorkspace();

  if (!isManagerOrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to view this page.</p>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const cycle = await getCycle(id);

  if (!cycle) {
    notFound();
  }

  // Auto-progress phases based on current date
  if (cycle.status === "active") {
    const supabase2 = await createServerSupabaseClient();
    await supabase2.rpc("progress_cycle_phases", { p_cycle_id: id });
  }

  const [employees, allUsers, phases, assignments, cycleQuestions, allCompetencies] = await Promise.all([
    getCycleEmployees(id),
    getWorkspaceUsers(),
    getCyclePhases(id),
    getReviewAssignments(id),
    getCycleQuestions(id),
    getAllCompetencies(),
  ]);

  const completedCount = employees.filter((e: any) => e.status === "completed").length;
  const completionRate = employees.length > 0 ? Math.round((completedCount / employees.length) * 100) : 0;
  const standardAssignments = assignments.filter((a: any) => a.assignment_type !== "upward");
  const upwardAssignments = assignments.filter((a: any) => a.assignment_type === "upward");
  const calibratedCount = standardAssignments.filter((a: any) => a.final_grade).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5" asChild>
            <Link href="/dashboard/cycles">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{cycle.name}</h1>
              <Badge className={`text-[11px] font-medium ${statusColors[cycle.status]}`}>
                {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
              </Badge>
              {cycle.grades_released && (
                <Badge className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20">
                  Grades Released
                </Badge>
              )}
            </div>
            {cycle.description && (
              <p className="text-sm text-muted-foreground mt-1">{cycle.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/cycles/${id}/calibration`}>Calibration View</Link>
          </Button>
          <CycleActions cycle={cycle} employeeCount={employees.length} userRole={workspace?.role || undefined} />
        </div>
      </div>

      {/* Overview Card — stats + progress + timeline combined */}
      <Card className="border-border/60">
        <CardContent className="pt-5 pb-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{employees.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Employees</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{completedCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-400/10 flex items-center justify-center shrink-0">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{employees.length - completedCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Remaining</p>
              </div>
            </div>
            {standardAssignments.length > 0 && (
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-violet-50 dark:bg-violet-400/10 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground leading-none">
                    {calibratedCount}/{standardAssignments.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Calibrated</p>
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {employees.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>Review progress</span>
                <span className="font-medium text-foreground">{completionRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          )}

          {/* Timeline dates */}
          <div className="flex items-center gap-6 text-sm border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Start:</span>
              <span className="font-medium text-foreground">{format(new Date(cycle.start_date), "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">End:</span>
              <span className="font-medium text-foreground">{format(new Date(cycle.end_date), "MMM d, yyyy")}</span>
            </div>
            {cycle.review_deadline && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Deadline:</span>
                <span className="font-medium text-foreground">{format(new Date(cycle.review_deadline), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phases Timeline */}
      {phases.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              Review Phases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {phases.map((phase: any, idx: number) => {
                const now = new Date();
                const phaseStart = new Date(phase.start_date);
                const phaseEnd = new Date(phase.end_date);
                const isActive = now >= phaseStart && now <= phaseEnd;
                const isCompleted = phase.status === "completed" || now > phaseEnd;

                return (
                  <div key={phase.id} className="flex items-start gap-3 mb-3 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        isActive
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      {idx < phases.length - 1 && (
                        <div className={`w-0.5 h-6 ${isCompleted ? "bg-emerald-500" : "bg-muted"}`} />
                      )}
                    </div>
                    <div className={`flex-1 ${isActive ? "" : "opacity-60"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{phase.name}</span>
                        {isActive && <Badge className="text-[10px] bg-primary/10 text-primary">Current</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(phaseStart, "MMM d")} — {format(phaseEnd, "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Questions Configuration */}
      <CycleQuestions
        cycleId={id}
        isDraft={cycle.status === "draft"}
        questions={cycleQuestions}
        allCompetencies={allCompetencies}
      />

      {/* Review Assignments (Standard: self + manager) */}
      {standardAssignments.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Review Assignments</CardTitle>
            <CardDescription className="text-xs">
              Self-assessment and manager review progress per employee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {standardAssignments.map((assignment: any) => {
                const config = assignmentStatusConfig[assignment.status] || assignmentStatusConfig.pending;
                return (
                  <div key={assignment.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {assignment.employee?.slack_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Manager: {assignment.manager?.slack_name || "Unassigned"}
                        {assignment.employee?.department && ` · ${assignment.employee.department}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {assignment.overall_rating && (
                        <span className="text-xs font-bold text-foreground">{assignment.overall_rating}/5</span>
                      )}
                      {assignment.final_grade && (
                        <Badge variant="outline" className="text-[10px]">{assignment.final_grade}</Badge>
                      )}
                      <Badge className={`text-[10px] font-medium ${config.className}`}>
                        {config.label}
                      </Badge>
                      {assignment.status !== "completed" && (
                        <Button variant="outline" size="xs" asChild>
                          <Link href={`/dashboard/cycles/${id}/review/${assignment.id}`}>
                            Submit Review
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upward Feedback Assignments */}
      {upwardAssignments.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-primary" />
              Upward Feedback
            </CardTitle>
            <CardDescription className="text-xs">Direct reports reviewing their managers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {upwardAssignments.map((assignment: any) => {
                const config = assignmentStatusConfig[assignment.status] || assignmentStatusConfig.pending;
                return (
                  <div key={assignment.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {assignment.reviewer?.slack_name || "Unknown"}
                        <span className="text-muted-foreground font-normal mx-1.5">&rarr;</span>
                        {assignment.employee?.slack_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.reviewer?.slack_name} provides feedback on {assignment.employee?.slack_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {assignment.overall_rating && (
                        <span className="text-xs font-bold text-foreground">{assignment.overall_rating}/5</span>
                      )}
                      <Badge className={`text-[10px] font-medium ${config.className}`}>
                        {config.label}
                      </Badge>
                      {assignment.status !== "completed" && (
                        <Button variant="outline" size="xs" asChild>
                          <Link href={`/dashboard/cycles/${id}/review/${assignment.id}`}>
                            Submit Feedback
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Employees Form (only for draft cycles) */}
      {cycle.status === "draft" && (
        <AddEmployeesForm
          cycleId={id}
          allUsers={allUsers}
          existingEmployeeIds={employees.map((e: any) => e.employee?.id)}
        />
      )}

      {/* Employees List */}
      {employees.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Employees in Cycle</CardTitle>
            <CardDescription className="text-xs">
              {employees.length} employee{employees.length !== 1 ? "s" : ""} included
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {employees.map((emp: any) => {
                const config = assignmentStatusConfig[emp.status] || assignmentStatusConfig.pending;
                return (
                  <div key={emp.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{emp.employee?.slack_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{emp.employee?.slack_email}</p>
                    </div>
                    <Badge className={`text-[10px] font-medium ${config.className}`}>
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {employees.length === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No employees yet</p>
            <p className="text-sm text-muted-foreground">
              {cycle.status === "draft" ? "Use the form above to add employees to this cycle." : "No employees were added to this cycle."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
