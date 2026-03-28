import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/badge";
import { isPast, format } from "date-fns";
import { Check, Star } from "lucide-react";
import { isHROrAbove, isManagerOrAbove } from "@/lib/roles";
import { gradeColor } from "@/lib/status";

import { CycleCard } from "./cycle-card";
import { PerformanceSummaryHero } from "./summary-hero";
import { ProgressStepper } from "./progress-stepper";
import { ActionRequiredSection } from "./action-required-section";
import { CompletedSection } from "./completed-section";
import { ResultsSection } from "./results-section";

/* ------------------------------------------------------------------ */
/*  Types for the per-cycle grouped data                              */
/* ------------------------------------------------------------------ */

interface ActionTask {
  id: string;
  type: "self-review" | "manager-review" | "upward-feedback";
  label: string;
  cycleName: string;
  cycleId: string;
  dueDate: string | null;
  assignmentId: string;
}

interface SubmittedResponse {
  competencyName: string;
  category: string | null;
  rating: number | null;
  comment: string | null;
}

interface CompletedItem {
  id: string;
  type: "self" | "manager-review" | "upward";
  label: string;
  assignmentId: string;
  completedAt: string | null;
}

interface CompetencyRating {
  name: string;
  rating: number;
}

interface FeedbackPreview {
  reviewerName: string;
  reviewerRole: string;
  comment: string;
  rating: number | null;
}

interface ProgressStep {
  label: string;
  done: boolean;
  active?: boolean;
  deadline: string | null;
}

interface CycleData {
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  startDate: string | null;
  endDate: string | null;
  gradesReleased: boolean;
  isCurrent: boolean;
  grade: string | null;
  rating: number | null;
  pendingTasks: ActionTask[];
  completedItems: CompletedItem[];
  competencyRatings: CompetencyRating[];
  feedbackPreviews: FeedbackPreview[];
  progressSteps: ProgressStep[];
}

/* ------------------------------------------------------------------ */
/*  CycleCardHeader — rendered in the collapsed summary row           */
/* ------------------------------------------------------------------ */

function CycleCardHeader({
  cycle,
  ratingMax,
}: {
  cycle: CycleData;
  ratingMax: number;
}) {
  const statusLabel =
    cycle.cycleStatus === "active"
      ? "Active"
      : cycle.cycleStatus === "in_review"
      ? "In Review"
      : "Completed";

  const statusBadgeClass =
    cycle.isCurrent
      ? "bg-primary/10 text-primary"
      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400";

  // Format date range
  const dateRange =
    cycle.startDate && cycle.endDate
      ? `${format(new Date(cycle.startDate), "MMM d")} – ${format(new Date(cycle.endDate), "MMM d, yyyy")}`
      : cycle.startDate
      ? `Started ${format(new Date(cycle.startDate), "MMM d, yyyy")}`
      : null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Pulse dot or check icon */}
      {cycle.isCurrent ? (
        <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" />
      ) : (
        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
      )}

      {/* Cycle name + date range */}
      <div className="min-w-0">
        <span className="text-base font-semibold text-foreground">
          {cycle.cycleName}
        </span>
        {dateRange && (
          <span className="text-xs text-muted-foreground ml-2">
            {dateRange}
          </span>
        )}
      </div>

      {/* Status badge */}
      <Badge className={`text-[10px] font-medium ${statusBadgeClass}`}>
        {statusLabel}
      </Badge>

      {/* Pending task count badge */}
      {cycle.pendingTasks.length > 0 && (
        <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400 font-medium">
          {cycle.pendingTasks.length} pending
        </Badge>
      )}

      {/* Right-aligned rating + grade OR "Pending results" */}
      <span className="ml-auto flex items-center gap-2 shrink-0">
        {cycle.gradesReleased && (cycle.rating != null || cycle.grade) ? (
          <>
            {cycle.rating != null && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {Number(cycle.rating).toFixed(1)}/{ratingMax}
                </span>
              </span>
            )}
            {cycle.grade && (
              <span className={`text-sm font-semibold ${gradeColor(cycle.grade)}`}>
                {cycle.grade}
              </span>
            )}
          </>
        ) : !cycle.isCurrent && !cycle.gradesReleased ? (
          <span className="text-xs italic text-muted-foreground">
            Pending results
          </span>
        ) : null}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const params = await searchParams;
  void params; // searchParams no longer used for cycle filtering

  const workspace = await getUserWorkspace();
  if (!workspace?.appUserId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please sign in to view your performance.
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const userId = workspace.appUserId;
  const workspaceId = workspace.workspaceId;

  const role = workspace.role;

  /* ── All Supabase queries (unchanged) ── */

  const [
    { data: myAssignments },
    { data: managerReviews },
    { data: upwardReviews },
    { data: _activeCycles },
  ] = await Promise.all([
    supabase
      .from("review_assignments")
      .select(`
        *,
        cycle:performance_cycles!inner(id, name, status, start_date, end_date, review_deadline, grades_released),
        manager:users!review_assignments_manager_id_fkey(slack_name)
      `)
      .eq("employee_id", userId)
      .eq("assignment_type", "standard")
      .eq("cycle.workspace_id", workspaceId)
      .order("created_at", { ascending: false }),

    supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
        cycle:performance_cycles!inner(id, name, status)
      `)
      .eq("manager_id", userId)
      .eq("assignment_type", "standard")
      .neq("employee_id", userId)
      .eq("cycle.workspace_id", workspaceId)
      .order("created_at", { ascending: false }),

    supabase
      .from("review_assignments")
      .select(`
        *,
        employee:users!review_assignments_employee_id_fkey(id, slack_name, job_title),
        cycle:performance_cycles!inner(id, name, status)
      `)
      .eq("reviewer_id", userId)
      .eq("assignment_type", "upward")
      .eq("cycle.workspace_id", workspaceId)
      .order("created_at", { ascending: false }),

    supabase
      .from("performance_cycles")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "in_review"])
      .order("created_at", { ascending: false }),
  ]);

  // Fetch review ratings for this user (received ratings from completed reviews)
  const allAssignmentIds = (myAssignments || []).map((a: any) => a.id);
  let reviewRatings: any[] = [];
  if (allAssignmentIds.length > 0) {
    const { data: ratings } = await supabase
      .from("review_responses")
      .select(`
        id, reviewer_role, rating, comment, created_at, assignment_id,
        competency:competencies(name, category),
        reviewer:users!review_responses_reviewer_id_fkey(slack_name),
        assignment:review_assignments!review_responses_assignment_id_fkey(
          id,
          employee:users!review_assignments_employee_id_fkey(slack_name),
          cycle:performance_cycles!review_assignments_cycle_id_fkey(name)
        )
      `)
      .in("assignment_id", allAssignmentIds)
      .order("created_at", { ascending: false })
      .limit(50);
    reviewRatings = ratings || [];
  }

  // For managers, also fetch ratings for their direct reports
  let reportRatings: any[] = [];
  if (isManagerOrAbove(role) || workspace.hasDirectReports) {
    const { data: reportAssignments } = await supabase
      .from("review_assignments")
      .select("id, cycle:performance_cycles!inner(workspace_id)")
      .eq("manager_id", userId)
      .eq("cycle.workspace_id", workspaceId);
    const reportAssignmentIds = (reportAssignments || []).map((a: any) => a.id);
    if (reportAssignmentIds.length > 0) {
      const { data: rRatings } = await supabase
        .from("review_responses")
        .select(`
          id, reviewer_role, rating, comment, created_at, assignment_id,
          competency:competencies(name, category),
          reviewer:users!review_responses_reviewer_id_fkey(slack_name),
          assignment:review_assignments!review_responses_assignment_id_fkey(
            id,
            employee:users!review_assignments_employee_id_fkey(slack_name),
            cycle:performance_cycles!review_assignments_cycle_id_fkey(name)
          )
        `)
        .in("assignment_id", reportAssignmentIds)
        .order("created_at", { ascending: false })
        .limit(100);
      reportRatings = rRatings || [];
    }
  }

  const allRatings = isHROrAbove(role)
    ? [...reviewRatings, ...reportRatings]
    : (isManagerOrAbove(role) || workspace.hasDirectReports)
    ? [...reviewRatings, ...reportRatings]
    : reviewRatings;

  // Deduplicate by id
  const seenIds = new Set<string>();
  const dedupedRatings = allRatings.filter((r: any) => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  const ratingMax = workspace?.ratingScale?.max || 5;

  const myAssignmentIds = (myAssignments || []).map((a: any) => a.id);
  let mySubmissions: Record<string, Set<string>> = {};
  if (myAssignmentIds.length > 0) {
    const { data: myResponses } = await supabase
      .from("review_responses")
      .select("id, assignment_id, reviewer_role")
      .eq("reviewer_id", userId)
      .in("assignment_id", myAssignmentIds);

    (myResponses || []).forEach((r: any) => {
      if (!mySubmissions[r.assignment_id]) {
        mySubmissions[r.assignment_id] = new Set();
      }
      mySubmissions[r.assignment_id].add(r.reviewer_role);
    });
  }

  // Fetch the user's own submitted responses (for inline "View" in completed section)
  const allCompletedAssignmentIds = [
    ...myAssignmentIds,
    ...(managerReviews || []).filter((r: any) => r.status === "completed").map((r: any) => r.id),
    ...(upwardReviews || []).filter((r: any) => r.status === "completed").map((r: any) => r.id),
  ];

  const submittedResponsesByAssignment: Record<string, SubmittedResponse[]> = {};
  if (allCompletedAssignmentIds.length > 0) {
    const { data: fullResponses } = await supabase
      .from("review_responses")
      .select(`
        assignment_id, rating, comment,
        competency:competencies(name, category)
      `)
      .eq("reviewer_id", userId)
      .in("assignment_id", allCompletedAssignmentIds)
      .order("created_at", { ascending: true });

    for (const r of (fullResponses || [])) {
      const aid = r.assignment_id;
      if (!submittedResponsesByAssignment[aid]) {
        submittedResponsesByAssignment[aid] = [];
      }
      submittedResponsesByAssignment[aid].push({
        competencyName: (r as any).competency?.name || "General",
        category: (r as any).competency?.category || null,
        rating: r.rating != null ? Number(r.rating) : null,
        comment: r.comment || null,
      });
    }
  }

  const enrichedAssignments = (myAssignments || []).map((a: any) => {
    const selfSubmitted = mySubmissions[a.id]?.has("self") || false;
    const cycleEnded = a.cycle?.status === "closed" || a.cycle?.status === "completed";
    return { ...a, selfSubmitted, cycleEnded };
  });

  /* ================================================================ */
  /*  Task 7: GROUP BY CYCLE                                          */
  /* ================================================================ */

  // 1. Collect all unique cycle IDs from all data sources
  const cycleMap = new Map<string, {
    id: string;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    reviewDeadline: string | null;
    gradesReleased: boolean;
  }>();

  for (const a of enrichedAssignments) {
    const c = a.cycle;
    if (c?.id && !cycleMap.has(c.id)) {
      cycleMap.set(c.id, {
        id: c.id,
        name: c.name || "Unknown Cycle",
        status: c.status || "unknown",
        startDate: c.start_date || null,
        endDate: c.end_date || null,
        reviewDeadline: c.review_deadline || null,
        gradesReleased: c.grades_released === true,
      });
    }
  }

  // Also collect cycles from manager and upward reviews (user might have reviews but no own assignment)
  for (const r of [...(managerReviews || []), ...(upwardReviews || [])]) {
    const c = r.cycle;
    if (c?.id && !cycleMap.has(c.id)) {
      cycleMap.set(c.id, {
        id: c.id,
        name: c.name || "Unknown Cycle",
        status: c.status || "unknown",
        startDate: null,
        endDate: null,
        reviewDeadline: null,
        gradesReleased: false,
      });
    }
  }

  // 2. Build assignment lookup by cycle id
  const assignmentsByCycle = new Map<string, any[]>();
  for (const a of enrichedAssignments) {
    const cid = a.cycle?.id;
    if (!cid) continue;
    if (!assignmentsByCycle.has(cid)) assignmentsByCycle.set(cid, []);
    assignmentsByCycle.get(cid)!.push(a);
  }

  // 3. Build manager reviews by cycle id
  const managerReviewsByCycle = new Map<string, any[]>();
  for (const r of (managerReviews || [])) {
    const cid = r.cycle?.id;
    if (!cid) continue;
    if (!managerReviewsByCycle.has(cid)) managerReviewsByCycle.set(cid, []);
    managerReviewsByCycle.get(cid)!.push(r);
  }

  // 4. Build upward reviews by cycle id
  const upwardReviewsByCycle = new Map<string, any[]>();
  for (const r of (upwardReviews || [])) {
    const cid = r.cycle?.id;
    if (!cid) continue;
    if (!upwardReviewsByCycle.has(cid)) upwardReviewsByCycle.set(cid, []);
    upwardReviewsByCycle.get(cid)!.push(r);
  }

  // 5. Build ratings by cycle — need to map assignment_id -> cycle_id
  const assignmentToCycle = new Map<string, string>();
  for (const a of enrichedAssignments) {
    if (a.cycle?.id) assignmentToCycle.set(a.id, a.cycle.id);
  }

  const ratingsByCycle = new Map<string, any[]>();
  for (const r of dedupedRatings) {
    const cid = assignmentToCycle.get(r.assignment_id);
    if (!cid) continue;
    if (!ratingsByCycle.has(cid)) ratingsByCycle.set(cid, []);
    ratingsByCycle.get(cid)!.push(r);
  }

  // 6. Fetch cycle_phases for all active/in_review cycles
  const activeCycleIds = Array.from(cycleMap.values())
    .filter((c) => c.status === "active" || c.status === "in_review")
    .map((c) => c.id);

  const phasesByCycle = new Map<string, any[]>();
  if (activeCycleIds.length > 0) {
    const { data: allPhases } = await supabase
      .from("cycle_phases")
      .select("cycle_id, phase_type, name, status, end_date, sort_order")
      .in("cycle_id", activeCycleIds)
      .order("sort_order");

    for (const p of (allPhases || [])) {
      if (!phasesByCycle.has(p.cycle_id)) phasesByCycle.set(p.cycle_id, []);
      phasesByCycle.get(p.cycle_id)!.push(p);
    }
  }

  // 7. Build the cycles array
  const phaseMap: Record<string, { label: string }> = {
    goal_setting: { label: "Goal Setting" },
    self_assessment: { label: "Self-Review" },
    peer_review: { label: "Peer Review" },
    manager_review: { label: "Manager Review" },
    calibration: { label: "Calibration" },
    communication: { label: "Results" },
  };

  const cycles: CycleData[] = Array.from(cycleMap.values())
    .sort((a, b) => {
      // Newest first
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return db - da;
    })
    .map((meta) => {
      const cid = meta.id;
      const isCurrent = meta.status === "active" || meta.status === "in_review";

      // Grade and rating from the first assignment for this cycle that has them
      const cycleAssignments = assignmentsByCycle.get(cid) || [];
      const gradedAssignment = cycleAssignments.find(
        (a: any) => meta.gradesReleased && (a.final_grade || a.overall_rating)
      );
      const grade = gradedAssignment?.final_grade || null;
      const rating = gradedAssignment?.overall_rating
        ? Number(gradedAssignment.overall_rating)
        : null;

      // ── Pending tasks ──
      const pendingTasks: ActionTask[] = [];

      // Self-review pending
      for (const a of cycleAssignments) {
        if (!a.selfSubmitted && !a.cycleEnded && a.status !== "completed") {
          pendingTasks.push({
            id: `self-${a.id}`,
            type: "self-review",
            label: meta.name,
            cycleName: meta.name,
            cycleId: cid,
            dueDate: meta.reviewDeadline,
            assignmentId: a.id,
          });
        }
      }

      // Manager reviews pending
      for (const r of (managerReviewsByCycle.get(cid) || [])) {
        if (r.status !== "completed") {
          pendingTasks.push({
            id: `mgr-${r.id}`,
            type: "manager-review",
            label: r.employee?.slack_name || "Unknown",
            cycleName: meta.name,
            cycleId: cid,
            dueDate: null,
            assignmentId: r.id,
          });
        }
      }

      // Upward reviews pending
      for (const r of (upwardReviewsByCycle.get(cid) || [])) {
        if (r.status !== "completed") {
          pendingTasks.push({
            id: `upward-${r.id}`,
            type: "upward-feedback",
            label: r.employee?.slack_name || "Unknown",
            cycleName: meta.name,
            cycleId: cid,
            dueDate: null,
            assignmentId: r.id,
          });
        }
      }

      // ── Completed items ──
      const completedItems: CompletedItem[] = [];

      // Self-review completed
      for (const a of cycleAssignments) {
        if (a.selfSubmitted || a.status === "completed") {
          completedItems.push({
            id: `done-self-${a.id}`,
            type: "self",
            label: meta.name,
            assignmentId: a.id,
            completedAt: a.updated_at || a.created_at || null,
          });
        }
      }

      // Manager reviews completed
      for (const r of (managerReviewsByCycle.get(cid) || [])) {
        if (r.status === "completed") {
          completedItems.push({
            id: `done-mgr-${r.id}`,
            type: "manager-review",
            label: r.employee?.slack_name || "Unknown",
            assignmentId: r.id,
            completedAt: r.updated_at || r.created_at || null,
          });
        }
      }

      // Upward reviews completed
      for (const r of (upwardReviewsByCycle.get(cid) || [])) {
        if (r.status === "completed") {
          completedItems.push({
            id: `done-up-${r.id}`,
            type: "upward",
            label: r.employee?.slack_name || "Unknown",
            assignmentId: r.id,
            completedAt: r.updated_at || r.created_at || null,
          });
        }
      }

      // ── Competency ratings (aggregate by competency name) ──
      const cycleRatings = ratingsByCycle.get(cid) || [];
      const compMap = new Map<string, { sum: number; count: number }>();
      for (const r of cycleRatings) {
        if (r.competency?.name && r.rating != null) {
          const existing = compMap.get(r.competency.name);
          if (existing) {
            existing.sum += Number(r.rating);
            existing.count += 1;
          } else {
            compMap.set(r.competency.name, { sum: Number(r.rating), count: 1 });
          }
        }
      }
      const competencyRatings: CompetencyRating[] = Array.from(compMap.entries()).map(
        ([name, { sum, count }]) => ({
          name,
          rating: Math.round((sum / count) * 10) / 10,
        })
      );

      // ── Feedback previews ──
      const feedbackPreviews: FeedbackPreview[] = cycleRatings
        .filter((r: any) => r.comment)
        .map((r: any) => ({
          reviewerName: r.reviewer?.slack_name || "Unknown",
          reviewerRole: r.reviewer_role || "peer",
          comment: r.comment,
          rating: r.rating != null ? Number(r.rating) : null,
        }));

      // ── Progress steps (only for active cycles) ──
      let progressSteps: ProgressStep[] = [];
      if (isCurrent) {
        const phases = phasesByCycle.get(cid);
        if (phases && phases.length > 0) {
          progressSteps = phases.map((p: any) => ({
            label: phaseMap[p.phase_type]?.label || p.name || p.phase_type,
            done: p.status === "completed",
            active: p.status === "active",
            deadline: p.end_date,
          }));
        } else {
          // Fallback — derive from assignment data
          const mainAssignment = cycleAssignments[0];
          if (mainAssignment) {
            progressSteps = [
              {
                label: "Self-Review",
                done: mainAssignment.selfSubmitted,
                deadline: null,
              },
              {
                label: "Manager Review",
                done: mainAssignment.status === "completed",
                deadline: meta.endDate,
              },
              {
                label: "Calibration",
                done: mainAssignment.calibrated_at != null,
                deadline: null,
              },
              {
                label: "Grade",
                done: meta.gradesReleased,
                deadline: null,
              },
            ];
          }
        }
      }

      return {
        cycleId: cid,
        cycleName: meta.name,
        cycleStatus: meta.status,
        startDate: meta.startDate,
        endDate: meta.endDate,
        gradesReleased: meta.gradesReleased,
        isCurrent,
        grade,
        rating,
        pendingTasks,
        completedItems,
        competencyRatings,
        feedbackPreviews,
        progressSteps,
      };
    });

  // 8. Summary hero stats
  const completedWithGrades = cycles.filter((c) => c.gradesReleased && c.rating != null);
  const completedCount = completedWithGrades.length;
  const avgRating =
    completedCount > 0
      ? completedWithGrades.reduce((sum, c) => sum + (c.rating ?? 0), 0) / completedCount
      : null;
  const latestGrade = cycles.find((c) => c.gradesReleased && c.grade)?.grade ?? null;

  // 9. Auto-expand logic — all collapsed by default
  const autoExpandIds = new Set<string>();

  /* ================================================================ */
  /*  Task 8: JSX                                                     */
  /* ================================================================ */

  // Border color logic
  function getBorderColor(cycle: CycleData): string {
    if (cycle.isCurrent) {
      const hasOverdue = cycle.pendingTasks.some((t) => {
        if (!t.dueDate) return false;
        return isPast(new Date(t.dueDate));
      });
      return hasOverdue ? "border-l-amber-400" : "border-l-primary/60";
    }
    return "border-l-emerald-400/60";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Performance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your performance journey across review cycles
        </p>
      </div>

      {/* Summary Hero */}
      <PerformanceSummaryHero
        completedCycles={completedCount}
        avgRating={avgRating}
        latestGrade={latestGrade}
        ratingMax={ratingMax}
      />

      {/* Cycle Cards */}
      {cycles.length > 0 ? (
        <div className="space-y-3">
          {cycles.map((cycle) => (
            <CycleCard
              key={cycle.cycleId}
              defaultOpen={autoExpandIds.has(cycle.cycleId)}
              borderColor={getBorderColor(cycle)}
              header={
                <CycleCardHeader cycle={cycle} ratingMax={ratingMax} />
              }
            >
              {cycle.isCurrent && cycle.progressSteps.length > 0 && (
                <div className="mb-4">
                  <ProgressStepper steps={cycle.progressSteps} />
                </div>
              )}
              <ActionRequiredSection tasks={cycle.pendingTasks} />
              <CompletedSection
                items={cycle.completedItems}
                responsesByAssignment={submittedResponsesByAssignment}
                ratingMax={ratingMax}
              />
              <ResultsSection
                overallRating={cycle.rating}
                grade={cycle.grade}
                ratingMax={ratingMax}
                competencyRatings={cycle.competencyRatings}
                feedbackPreviews={cycle.feedbackPreviews}
                gradesReleased={cycle.gradesReleased}
              />
            </CycleCard>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">
            No review cycles found. When you are added to a performance cycle,
            it will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
