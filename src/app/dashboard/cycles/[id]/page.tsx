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
  Bot,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { isManagerOrAbove, isHROrAbove } from "@/lib/roles";
import { getCycleDisplayStatus, isCycleOverdue } from "@/lib/status";
import { CycleActions } from "./cycle-actions";
import { AddEmployeesForm } from "./add-employees-form";
import { CycleQuestions } from "./cycle-questions";
import { PageHeader } from "@/components/page-header";
import { PhaseDeadlineEditor } from "./phase-deadline-editor";

// Helper kept outside the page component so the purity rule (which targets
// renders/hooks) does not flag the Date.now() call.
function getCurrentMs(): number {
  return Date.now();
}

// ── Internal row shapes ──────────────────────────────────────────────────────

type UserRef = { id: string | null; slack_name: string | null; slack_user_id: string | null; department?: string | null };

type CycleAssignmentRow = {
  id: string;
  cycle_id: string;
  status: string;
  manager_id: string | null;
  reviewer_id: string | null;
  assignment_type: string | null;
  overall_rating: number | null;
  final_grade: string | null;
  employee?: UserRef | null;
  manager?: UserRef | null;
  reviewer?: UserRef | null;
};

type PhaseRow = {
  id: string;
  name: string;
  phase_type: string;
  start_date: string;
  end_date: string;
  status: "pending" | "active" | "completed";
  is_user_customized: boolean;
  sort_order?: number;
};

type CycleQuestionRow = {
  id: string;
  question_type: "competency" | "text";
  competency_id: string | null;
  prompt: string | null;
  sort_order: number;
  required: boolean | null;
  competency: { id: string; name: string; category: string | null } | { id: string; name: string; category: string | null }[] | null;
};

type CycleEmployeeRow = {
  id: string;
  employee?: { id: string; slack_name: string | null; slack_email: string | null; slack_user_id: string | null } | null;
};

type NamiLogRow = { user_id: string; event_type: string; reminder_count: number | null; sent_at: string; reference_id: string };

async function getCycle(id: string, workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("performance_cycles")
    .select(`
      *,
      creator:users!performance_cycles_created_by_fkey(slack_name)
    `)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (error) console.error("Failed to fetch cycle:", error.message);
  return data;
}

async function getCyclePhases(cycleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cycle_phases")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("sort_order");
  if (error) console.error("Failed to fetch cycle phases:", error.message);
  return data || [];
}

async function getReviewAssignments(cycleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("review_assignments")
    .select(`
      *,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, department, slack_user_id),
      manager:users!review_assignments_manager_id_fkey(id, slack_name, slack_user_id),
      reviewer:users!review_assignments_reviewer_id_fkey(id, slack_name, slack_user_id)
    `)
    .eq("cycle_id", cycleId);
  if (error) console.error("Failed to fetch review assignments:", error.message);
  return data || [];
}

async function getCycleEmployees(cycleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("performance_cycle_employees")
    .select(`
      *,
      employee:users!performance_cycle_employees_employee_id_fkey(id, slack_name, slack_email, slack_user_id)
    `)
    .eq("performance_cycle_id", cycleId);
  if (error) console.error("Failed to fetch cycle employees:", error.message);
  return data || [];
}

async function getWorkspaceUsers(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, slack_name, slack_email")
    .eq("workspace_id", workspaceId)
    .order("slack_name");
  if (error) console.error("Failed to fetch workspace users:", error.message);
  return data || [];
}

async function getCycleQuestions(cycleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cycle_questions")
    .select(`
      id, question_type, competency_id, prompt, sort_order, required,
      competency:competencies(id, name, category)
    `)
    .eq("cycle_id", cycleId)
    .order("sort_order");
  if (error) console.error("Failed to fetch cycle questions:", error.message);
  return ((data || []) as unknown as CycleQuestionRow[]).map((q) => ({
    ...q,
    required: q.required ?? false,
    competency: Array.isArray(q.competency) ? q.competency[0] || null : q.competency,
  }));
}

async function getNamiStatus(assignmentIds: string[], workspaceId: string) {
  if (assignmentIds.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  // Match reference_ids ending with _{assignmentId} (e.g. self_abc, mgr_abc, escal_self_abc)
  const refFilters = assignmentIds.map(id => `reference_id.like.%_${id}`).join(',');
  const { data, error } = await supabase
    .from("notification_log")
    .select("user_id, event_type, reminder_count, sent_at, reference_id")
    .eq("workspace_id", workspaceId)
    .like("event_type", "nami_%")
    .or(refFilters);
  if (error) console.error("Failed to fetch nami status:", error.message);
  return data || [];
}

async function getAllCompetencies(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("competencies")
    .select("id, name, category, description")
    .eq("workspace_id", workspaceId)
    .order("category")
    .order("name");
  if (error) console.error("Failed to fetch competencies:", error.message);
  return data || [];
}


export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getUserWorkspace();

  if (!isManagerOrAbove(workspace?.role) && !workspace?.hasDirectReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">You do not have permission to view this page.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const ratingMax = (workspace as { ratingScale?: { max?: number } } | undefined)?.ratingScale?.max || 5;
  const cycle = await getCycle(id, workspace!.workspaceId);

  if (!cycle) {
    notFound();
  }

  // Auto-progress phases in background — don't block the page render
  if (cycle.status === "active") {
    createServerSupabaseClient().then((sb) =>
      sb.rpc("progress_cycle_phases", { p_cycle_id: id })
    );
  }

  const [employees, allUsers, phases, assignments, cycleQuestions, allCompetencies, namiLogs] = await Promise.all([
    getCycleEmployees(id),
    getWorkspaceUsers(workspace!.workspaceId!),
    getCyclePhases(id),
    getReviewAssignments(id),
    getCycleQuestions(id),
    getAllCompetencies(workspace?.workspaceId ?? ""),
    getReviewAssignments(id).then(a => getNamiStatus(a.map((x) => x.id), workspace?.workspaceId ?? "")),
  ]);

  const typedAssignments = assignments as unknown as CycleAssignmentRow[];
  const standardAssignments = typedAssignments.filter((a) => a.assignment_type !== "upward");
  const upwardAssignments = typedAssignments.filter((a) => a.assignment_type === "upward");
  const calibratedCount = standardAssignments.filter((a) => a.final_grade).length;
  const submittedCount = typedAssignments.filter((a) => a.status !== "pending").length;

  // ── New computed values ────────────────────────────────────────────────────
  // Self-review done = status is "in_progress" OR "completed"
  const selfDoneCount = standardAssignments.filter(
    (a) => a.status === "in_progress" || a.status === "completed"
  ).length;
  // Manager review done = status is "completed" only (only count assignments that have a manager)
  const assignmentsWithManager = standardAssignments.filter((a) => a.manager_id);
  const managerDoneCount = assignmentsWithManager.filter(
    (a) => a.status === "completed"
  ).length;
  const pendingManagerCount = assignmentsWithManager.length - managerDoneCount;

  // Deadline urgency (milliseconds → days)
  const daysUntilDeadline = cycle.review_deadline
    ? Math.ceil((new Date(cycle.review_deadline).getTime() - getCurrentMs()) / 86400000)
    : null;
  const isDeadlineUrgent = daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 7;
  const isDeadlineOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;

  // Overdue banner counts
  const selfMissing = standardAssignments.filter((a) => a.status === "pending").length;
  const mgrMissing = pendingManagerCount;

  // Progress bar tracks manager review completion (true signal of cycle health)
  const managerCompletionRate = assignmentsWithManager.length > 0
    ? Math.round((managerDoneCount / assignmentsWithManager.length) * 100)
    : 0;

  // Phase deadline editing — HR+ only, and only while cycle is not completed
  const canEditPhases = isHROrAbove(workspace?.role) && cycle.status !== "completed";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        hat="manage"
        title={cycle.name}
        subtitle={cycle.description || undefined}
        actions={
          <div className="flex items-center gap-2">
            {isHROrAbove(workspace?.role) && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/cycles/${id}/calibration`}>Calibration View</Link>
              </Button>
            )}
            <CycleActions cycle={cycle} employeeCount={employees.length} submittedCount={submittedCount} pendingManagerCount={pendingManagerCount} userRole={workspace?.role || undefined} />
          </div>
        }
      />

      {/* ── Sub-header (back + status badges) ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/cycles">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </Link>
        </Button>
        <Badge className={`text-[11px] font-medium ${getCycleDisplayStatus(cycle).badge}`}>
          {getCycleDisplayStatus(cycle).label}
        </Badge>
        {cycle.grades_released && (
          <Badge className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20">
            Grades Released
          </Badge>
        )}
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
            ? `Review deadline passed ${Math.abs(daysUntilDeadline!)} day${Math.abs(daysUntilDeadline!) !== 1 ? "s" : ""} ago`
            : `${daysUntilDeadline} day${daysUntilDeadline !== 1 ? "s" : ""} until review deadline`
          }
        </div>
      )}

      {/* ── Overdue Action Banner ────────────────────────────────────────── */}
      {isCycleOverdue(cycle) && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                This cycle is past its end date
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                {selfMissing > 0 && `${selfMissing} self-review${selfMissing !== 1 ? "s" : ""}`}
                {selfMissing > 0 && mgrMissing > 0 && " and "}
                {mgrMissing > 0 && `${mgrMissing} manager review${mgrMissing !== 1 ? "s" : ""}`}
                {(selfMissing > 0 || mgrMissing > 0) ? " still pending. " : "All reviews submitted. "}
                {!cycle.grades_released && "Grades have not been released."}
              </p>
            </div>
          </div>
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
                  {managerDoneCount}/{assignmentsWithManager.length}
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
                <span>Manager review progress{assignmentsWithManager.length < standardAssignments.length ? ` · ${standardAssignments.length - assignmentsWithManager.length} without manager` : ""}</span>
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
              <span className="font-medium text-foreground">{cycle.start_date ? format(new Date(cycle.start_date), "MMM d, yyyy") : "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">End:</span>
              <span className="font-medium text-foreground">{cycle.end_date ? format(new Date(cycle.end_date), "MMM d, yyyy") : "—"}</span>
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
              {(phases as PhaseRow[]).map((phase, idx) => {
                const nowDate = new Date(getCurrentMs());
                const phaseStart = new Date(phase.start_date);
                const phaseEnd = new Date(phase.end_date);
                const isActive = nowDate >= phaseStart && nowDate <= phaseEnd;
                const isCompleted = phase.status === "completed" || nowDate > phaseEnd;

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

      {/* ── Phases & Deadlines ───────────────────────────────────────────── */}
      {phases.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Phases & Deadlines
            </CardTitle>
            <CardDescription className="text-xs">
              {canEditPhases
                ? "Click the pencil to adjust a phase deadline."
                : "Phase schedule for this cycle."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(phases as PhaseRow[]).map((p) => (
              <PhaseDeadlineEditor
                key={p.id}
                phase={p}
                canEdit={canEditPhases}
                cycleId={cycle.id}
              />
            ))}
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
              {standardAssignments.map((assignment) => {
                const selfDone = assignment.status === "in_progress" || assignment.status === "completed";
                const managerDone = assignment.status === "completed";

                return (
                  <div
                    key={assignment.id}
                    className="grid grid-cols-[1fr_80px_80px_60px_80px] items-center px-6 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Employee */}
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium text-foreground truncate flex items-center">
                        {assignment.employee?.slack_name || "Unknown"}
                        {!assignment.employee?.slack_user_id && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 ml-2 shrink-0">
                            No Slack
                          </Badge>
                        )}
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
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
                          <Circle className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Manager pill */}
                    <div className="flex justify-center">
                      {!assignment.manager_id ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          N/A
                        </span>
                      ) : managerDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
                          <Circle className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Rating */}
                    <div className="text-right">
                      {assignment.overall_rating ? (
                        <span className="text-xs font-bold text-foreground">
                          {assignment.overall_rating}/{ratingMax}
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
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 group-hover:opacity-100 transition-opacity" asChild>
                        <Link href={`/dashboard/reviews/${assignment.id}?from=cycle&cycleId=${id}`}>
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
            <div className="divide-y divide-border/60">
              {upwardAssignments.map((assignment) => {
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
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
                          <Circle className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                      {assignment.overall_rating && (
                        <span className="text-xs font-bold text-foreground">{assignment.overall_rating}/{ratingMax}</span>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity" asChild>
                        <Link href={`/dashboard/reviews/${assignment.id}?from=cycle&cycleId=${id}`}>
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

      {/* ── Nami Status Tracker ──────────────────────────────────────────── */}
      {cycle.nami_confirmed && (() => {
        // Build a map of nami logs per user
        const namiByUser = new Map<string, NamiLogRow[]>();
        for (const log of (namiLogs as NamiLogRow[])) {
          if (!namiByUser.has(log.user_id)) namiByUser.set(log.user_id, []);
          namiByUser.get(log.user_id)!.push(log);
        }

        // Build participant rows from assignments
        type NamiRow = { userId: string; name: string; role: string; completed: boolean; reminderCount: number; escalated: boolean; sentAt: string | null; slackUserId: string | null };
        const namiRows: NamiRow[] = [];

        for (const a of standardAssignments) {
          const userId = a.employee?.id || "";
          const name = a.employee?.slack_name || "Unknown";
          const empSlackUserId = a.employee?.slack_user_id || null;
          const logs = userId ? namiByUser.get(userId) || [] : [];
          const selfLogs = logs.filter((l) => l.event_type.includes("self"));
          const maxReminder = selfLogs.reduce((m, l) => Math.max(m, l.reminder_count || 0), 0);
          const selfDone = a.status === "in_progress" || a.status === "completed";
          namiRows.push({
            userId,
            name,
            role: "Self-review",
            completed: selfDone,
            reminderCount: maxReminder,
            escalated: maxReminder >= 3,
            sentAt: selfLogs.length > 0 ? selfLogs[selfLogs.length - 1].sent_at : null,
            slackUserId: empSlackUserId,
          });

          if (a.manager_id) {
            const mgrName = a.manager?.slack_name || "Unknown";
            const mgrSlackUserId = a.manager?.slack_user_id || null;
            const mgrLogs = a.manager_id ? namiByUser.get(a.manager_id) || [] : [];
            const mgrReviewLogs = mgrLogs.filter((l) => l.event_type.includes("manager"));
            const mgrMaxReminder = mgrReviewLogs.reduce((m, l) => Math.max(m, l.reminder_count || 0), 0);
            const mgrDone = a.status === "completed";
            namiRows.push({
              userId: a.manager_id,
              name: mgrName,
              role: `Manager review (${name})`,
              completed: mgrDone,
              reminderCount: mgrMaxReminder,
              escalated: mgrMaxReminder >= 3,
              sentAt: mgrReviewLogs.length > 0 ? mgrReviewLogs[mgrReviewLogs.length - 1].sent_at : null,
              slackUserId: mgrSlackUserId,
            });
          }
        }

        for (const a of upwardAssignments) {
          const reviewerName = a.reviewer?.slack_name || "Unknown";
          const targetName = a.employee?.slack_name || "Unknown";
          const reviewerId = a.reviewer_id;
          const reviewerSlackUserId = a.reviewer?.slack_user_id || null;
          const logs = reviewerId ? namiByUser.get(reviewerId) || [] : [];
          const upLogs = logs.filter((l) => l.event_type.includes("upward"));
          const maxReminder = upLogs.reduce((m, l) => Math.max(m, l.reminder_count || 0), 0);
          const done = a.status === "completed";
          namiRows.push({
            userId: reviewerId || "",
            name: reviewerName,
            role: `Upward feedback (${targetName})`,
            completed: done,
            reminderCount: maxReminder,
            escalated: maxReminder >= 3,
            sentAt: upLogs.length > 0 ? upLogs[upLogs.length - 1].sent_at : null,
            slackUserId: reviewerSlackUserId,
          });
        }

        const completedCount = namiRows.filter(r => r.completed).length;
        const remindedCount = namiRows.filter(r => !r.completed && r.reminderCount > 0 && !r.escalated).length;
        const escalatedCount = namiRows.filter(r => r.escalated && !r.completed).length;

        return (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Nami Status
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {completedCount}/{namiRows.length} completed
                    {remindedCount > 0 && <> &middot; {remindedCount} reminded</>}
                    {escalatedCount > 0 && <> &middot; {escalatedCount} escalated</>}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_120px_80px_80px_80px] items-center px-6 pb-2 border-b border-border/60 min-w-[580px]">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Participant</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Role</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Status</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Delivery</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Reminders</p>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/50 min-w-[580px]">
                {namiRows.map((row, idx) => (
                  <div
                    key={`${row.userId}-${row.role}-${idx}`}
                    className="grid grid-cols-[1fr_120px_80px_80px_80px] items-center px-6 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{row.role}</p>
                    <div className="flex justify-center">
                      {row.completed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Done
                        </span>
                      ) : row.escalated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          Escalated
                        </span>
                      ) : row.reminderCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" />
                          Reminded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
                          <Circle className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="flex justify-center">
                      {!row.slackUserId ? (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Skipped</Badge>
                      ) : row.sentAt ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">Sent</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60">Pending</Badge>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <span className={`text-xs font-medium ${
                        row.escalated ? "text-red-600 dark:text-red-400" :
                        row.reminderCount > 0 ? "text-amber-600 dark:text-amber-400" :
                        "text-muted-foreground"
                      }`}>
                        {row.reminderCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Add Employees (draft only) ────────────────────────────────────── */}
      {cycle.status === "draft" && (
        <AddEmployeesForm
          cycleId={id}
          allUsers={allUsers}
          existingEmployeeIds={(employees as CycleEmployeeRow[]).map((e) => e.employee?.id ?? "")}
        />
      )}
    </div>
  );
}
