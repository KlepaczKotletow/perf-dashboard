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

const employeeStatusColors: Record<string, string> = {
  pending: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
  in_progress: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
  completed: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
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
  const inProgressCount = employees.filter((e: any) => e.status === "in_progress").length;
  const pendingCount = employees.filter((e: any) => e.status === "pending").length;
  const completionRate = employees.length > 0 ? Math.round((completedCount / employees.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
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
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {cycle.description || "No description"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cycle.grades_released && (
            <Badge className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20">
              Grades Released
            </Badge>
          )}
          <Button variant="outline" asChild>
            <Link href={`/dashboard/cycles/${id}/calibration`}>Calibration View</Link>
          </Button>
          <CycleActions cycle={cycle} employeeCount={employees.length} userRole={workspace?.role || undefined} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{employees.length}</p>
                <p className="text-sm text-muted-foreground">Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount + inProgressCount}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completionRate}%</p>
                <p className="text-sm text-muted-foreground">Completion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {employees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              <div 
                className="bg-primary h-4 transition-all duration-500" 
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>{completedCount} of {employees.length} reviews completed</span>
              <span>{completionRate}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calibration Progress */}
      {assignments.filter((a: any) => a.assignment_type === "standard").length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Target className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Calibration Progress</p>
                  <p className="text-xs text-muted-foreground">
                    {assignments.filter((a: any) => a.assignment_type === "standard" && a.final_grade).length} of{" "}
                    {assignments.filter((a: any) => a.assignment_type === "standard").length} assignments calibrated
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        assignments.filter((a: any) => a.assignment_type === "standard").length > 0
                          ? (assignments.filter((a: any) => a.assignment_type === "standard" && a.final_grade).length /
                              assignments.filter((a: any) => a.assignment_type === "standard").length) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {assignments.filter((a: any) => a.assignment_type === "standard").length > 0
                    ? Math.round(
                        (assignments.filter((a: any) => a.assignment_type === "standard" && a.final_grade).length /
                          assignments.filter((a: any) => a.assignment_type === "standard").length) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phases Timeline */}
      {phases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Review Phases
            </CardTitle>
            <CardDescription>Structured review workflow with deadlines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {phases.map((phase: any, idx: number) => {
                const now = new Date();
                const phaseStart = new Date(phase.start_date);
                const phaseEnd = new Date(phase.end_date);
                const isActive = now >= phaseStart && now <= phaseEnd;
                const isCompleted = phase.status === "completed" || now > phaseEnd;
                const isPending = !isActive && !isCompleted;

                return (
                  <div key={phase.id} className="flex items-start gap-4 mb-4 last:mb-0">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      {idx < phases.length - 1 && (
                        <div className={`w-0.5 h-8 ${isCompleted ? "bg-green-500" : "bg-muted"}`} />
                      )}
                    </div>
                    {/* Phase content */}
                    <div className={`flex-1 pb-2 ${isActive ? "" : "opacity-70"}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{phase.name}</span>
                        {isActive && <Badge className="bg-primary/20 text-primary">Current</Badge>}
                        {isCompleted && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Done</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(phaseStart, "MMM d")} <ArrowRight className="inline h-3 w-3" /> {format(phaseEnd, "MMM d, yyyy")}
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
      {assignments.filter((a: any) => a.assignment_type !== "upward").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review Assignments</CardTitle>
            <CardDescription>Self-assessment and manager review progress per employee</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignments.filter((a: any) => a.assignment_type !== "upward").map((assignment: any) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{assignment.employee?.slack_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">
                      Manager: {assignment.manager?.slack_name || "Unassigned"}
                      {assignment.employee?.department && ` · ${assignment.employee.department}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {assignment.overall_rating && (
                      <span className="text-sm font-bold">{assignment.overall_rating}/5</span>
                    )}
                    {assignment.final_grade && (
                      <Badge variant="outline">{assignment.final_grade}</Badge>
                    )}
                    <Badge className={employeeStatusColors[assignment.status] || employeeStatusColors.pending}>
                      {assignment.status === "in_progress" ? "In Progress" : assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                    </Badge>
                    {assignment.status !== "completed" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/cycles/${id}/review/${assignment.id}`}>
                          Submit Review
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upward Feedback Assignments */}
      {assignments.filter((a: any) => a.assignment_type === "upward").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-primary" />
              Upward Feedback
            </CardTitle>
            <CardDescription>Direct reports reviewing their managers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignments.filter((a: any) => a.assignment_type === "upward").map((assignment: any) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">
                      {assignment.reviewer?.slack_name || "Unknown"} <span className="text-muted-foreground font-normal">&rarr;</span> {assignment.employee?.slack_name || "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {assignment.reviewer?.slack_name} provides feedback on {assignment.employee?.slack_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {assignment.overall_rating && (
                      <span className="text-sm font-bold">{assignment.overall_rating}/5</span>
                    )}
                    <Badge className={employeeStatusColors[assignment.status] || employeeStatusColors.pending}>
                      {assignment.status === "in_progress" ? "In Progress" : assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                    </Badge>
                    {assignment.status !== "completed" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/cycles/${id}/review/${assignment.id}`}>
                          Submit Upward Feedback
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">{format(new Date(cycle.start_date), "MMMM d, yyyy")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">End Date</p>
                <p className="font-medium">{format(new Date(cycle.end_date), "MMMM d, yyyy")}</p>
              </div>
            </div>
            {cycle.review_deadline && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Review Deadline</p>
                  <p className="font-medium">{format(new Date(cycle.review_deadline), "MMMM d, yyyy")}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Employees Form (only for draft cycles) */}
      {cycle.status === "draft" && (
        <AddEmployeesForm 
          cycleId={id} 
          allUsers={allUsers} 
          existingEmployeeIds={employees.map((e: any) => e.employee?.id)} 
        />
      )}

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Employees in Cycle</CardTitle>
          <CardDescription>
            {employees.length} employee{employees.length !== 1 ? "s" : ""} included in this review cycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No employees added to this cycle yet.</p>
              {cycle.status === "draft" && (
                <p className="text-sm mt-2">Use the form above to add employees.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((emp: any) => (
                <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{emp.employee?.slack_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{emp.employee?.slack_email}</p>
                  </div>
                  <Badge className={employeeStatusColors[emp.status]}>
                    {emp.status === "in_progress" ? "In Progress" : emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
