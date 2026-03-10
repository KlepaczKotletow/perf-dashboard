import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  Target,
  ArrowUpCircle,
  TriangleAlert,
  Circle,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { isManagerOrAbove, isHROrAbove, canAccessCalibration } from "@/lib/roles";
import { getCycleStatus } from "@/lib/status";
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

  const standardAssignments = assignments.filter((a: any) => a.assignment_type !== "upward");
  const upwardAssignments = assignments.filter((a: any) => a.assignment_type === "upward");
  const calibratedCount = standardAssignments.filter((a: any) => a.final_grade).length;

  // ── New computed values ────────────────────────────────────────────────────
  // Self-review done = status is "in_progress" OR "completed"
  const selfDoneCount = standardAssignments.filter(
    (a: any) => a.status === "in_progress" || a.status === "completed"
  ).length;
  // Manager review done = status is "completed" only
  const managerDoneCount = standardAssignments.filter(
    (a: any) => a.status === "completed"
  ).length;

  // Deadline urgency (milliseconds → days)
  const daysUntilDeadline = cycle.review_deadline
    ? Math.ceil((new Date(cycle.review_deadline).getTime() - Date.now()) / 86400000)
    : null;
  const isDeadlineUrgent = daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 7;
  const isDeadlineOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;

  // Progress bar tracks manager review completion (true signal of cycle health)
  const managerCompletionRate = standardAssignments.length > 0
    ? Math.round((managerDoneCount / standardAssignments.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
              <Badge className={`text-[11px] font-medium ${getCycleStatus(cycle.status).badge}`}>
                {getCycleStatus(cycle.status).label}
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

      {/* ── Urgency Banner (active cycles only) ───────────────────────────── */}
      {cycle.status === "active" && (isDeadlineUrgent || isDeadlineOverdue) && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium ${
          isDeadlineOverdue
            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-400/10 dark:border-red-400/20 dark:text-red-400"
            : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-400"
        }`}>
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {isDeadlineOverdue
            ? `Review deadline passed — ${Math.abs(daysUntilDeadline!)} day${Math.abs(daysUntilDeadline!) !== 1 ? "s" : ""} overdue. ${managerDoneCount} of ${standardAssignments.length} manager review${standardAssignments.length !== 1 ? "s" : ""} submitted.`
            : `${daysUntilDeadline} day${daysUntilDeadline !== 1 ? "s" : ""} until review deadline — ${standardAssignments.length - managerDoneCount} manager review${(standardAssignments.length - managerDoneCount) !== 1 ? "s" : ""} still pending.`
          }
        </div>
      )}

      {/* ── Overview Card ──────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="pt-5 pb-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">

            {/* Employees */}
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{employees.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Employees</p>
              </div>
            </div>

            {/* Self-Reviews Done */}
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-sky-50 dark:bg-sky-400/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">
                  {selfDoneCount}/{standardAssignments.length}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Self-Reviews</p>
              </div>
            </div>

            {/* Manager Reviews Done */}
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">
                  {managerDoneCount}/{standardAssignments.length}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Mgr Reviews</p>
              </div>
            </div>

            {/* Calibrated */}
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

          {/* Progress bar — based on manager review completion */}
          {standardAssignments.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>Manager review progress</span>
                <span className="font-medium text-foreground">{managerCompletionRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${managerCompletionRate}%` }}
                />
              </div>
            </div>
          )}

          {/* Timeline dates */}
          <div className="flex items-center gap-6 text-sm border-t border-border pt-4 flex-wrap">
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
                <Clock className={`h-3.5 w-3.5 ${
                  isDeadlineOverdue ? "text-red-500" : isDeadlineUrgent ? "text-amber-500" : "text-muted-foreground"
                }`} />
                <span className="text-muted-foreground">Deadline:</span>
                <span className={`font-medium ${
                  isDeadlineOverdue
                    ? "text-red-600 dark:text-red-400"
                    : isDeadlineUrgent
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
                }`}>
                  {format(new Date(cycle.review_deadline), "MMM d, yyyy")}
                  {isDeadlineUrgent && !isDeadlineOverdue && (
                    <span className="ml-1 text-[11px] font-normal opacity-80">({daysUntilDeadline}d left)</span>
                  )}
                  {isDeadlineOverdue && (
                    <span className="ml-1 text-[11px] font-normal opacity-80">(overdue)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Review Phases Timeline ─────────────────────────────────────────── */}
      {phases.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Review Phases</CardTitle>
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

      {/* ── Review Questions Configuration ────────────────────────────────── */}
      <CycleQuestions
        cycleId={id}
        isDraft={cycle.status === "draft"}
        questions={cycleQuestions}
        allCompetencies={allCompetencies}
      />

      {/* ── Participants (unified — replaces Review Assignments + Employees) ─ */}
      {standardAssignments.length > 0 ? (
        <Card className="border-border/60">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Participants</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {standardAssignments.length} participant{standardAssignments.length !== 1 ? "s" : ""} · self and manager review status
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-4 overflow-x-auto">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_80px_60px_80px] items-center px-6 pb-2 border-b border-border/60 min-w-[500px]">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Employee</p>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Self</p>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Manager</p>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-right">Rating</p>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-right">Grade</p>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/50 min-w-[500px]">
              {standardAssignments.map((assignment: any) => {
                const selfDone = assignment.status === "in_progress" || assignment.status === "completed";
                const managerDone = assignment.status === "completed";

                return (
                  <div
                    key={assignment.id}
                    className="grid grid-cols-[1fr_80px_80px_60px_80px] items-center px-6 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Employee */}
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium text-foreground truncate">
                        {assignment.employee?.slack_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[
                          assignment.employee?.department,
                          assignment.manager?.slack_name ? `Manager: ${assignment.manager.slack_name}` : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>

                    {/* Self pill */}
                    <div className="flex justify-center">
                      {selfDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                          <Circle className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Manager pill */}
                    <div className="flex justify-center">
                      {managerDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                          <Circle className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Rating */}
                    <div className="text-right">
                      {assignment.overall_rating ? (
                        <span className="text-xs font-bold text-foreground">
                          {assignment.overall_rating}/5
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Grade + View link */}
                    <div className="flex items-center justify-end gap-1.5">
                      {assignment.final_grade ? (
                        <Badge variant="outline" className="text-[10px]">{assignment.final_grade}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                        <Link href={`/dashboard/reviews/${assignment.id}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="sr-only">View review for {assignment.employee?.slack_name}</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Empty state — no assignments yet */
        <Card className="border-border/60">
          <CardContent className="py-12 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No participants yet</p>
            <p className="text-sm text-muted-foreground">
              {cycle.status === "draft"
                ? "Add employees using the form below, then launch the cycle to generate review assignments."
                : "No review assignments were created for this cycle."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Upward Feedback ───────────────────────────────────────────────── */}
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
                const done = assignment.status === "completed";
                return (
                  <div key={assignment.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 group">
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
                    <div className="flex items-center gap-3 shrink-0">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                          <Circle className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                      {assignment.overall_rating && (
                        <span className="text-xs font-bold text-foreground">{assignment.overall_rating}/5</span>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                        <Link href={`/dashboard/reviews/${assignment.id}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="sr-only">View upward feedback</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Add Employees (draft only) ────────────────────────────────────── */}
      {cycle.status === "draft" && (
        <AddEmployeesForm
          cycleId={id}
          allUsers={allUsers}
          existingEmployeeIds={employees.map((e: any) => e.employee?.id)}
        />
      )}
    </div>
  );
}
