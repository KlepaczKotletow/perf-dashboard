import type React from "react";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove } from "@/lib/roles";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Lock } from "lucide-react";
import CalibrationClient from "./calibration-client";

type LevelJoin = { name: string | null; grade: string | null };
type EmployeeJoin = { id: string; slack_name: string | null; department: string | null; level_id: string | null; level?: LevelJoin | LevelJoin[] | null };
type ManagerJoin = { slack_name: string | null };
type CompetencyJoin = { name: string | null; category: string | null };

type CalibrationAssignmentRow = {
  id: string;
  status: string;
  overall_rating: number | null;
  final_grade: string | null;
  potential_rating: number | null;
  calibrated_by: string | null;
  employee_id: string;
  employee?: EmployeeJoin | EmployeeJoin[] | null;
  manager?: ManagerJoin | ManagerJoin[] | null;
};

type CalibrationResponseRow = {
  id: string;
  assignment_id: string;
  rating: number | null;
  reviewer_role: string;
  competency_id: string | null;
  competency?: CompetencyJoin | CompetencyJoin[] | null;
};

async function getCalibrationData(cycleId: string, workspaceId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("id, name, status, grades_released")
    .eq("id", cycleId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!cycle) return null;

  const { data: assignments } = await supabase
    .from("review_assignments")
    .select(`
      id, status, overall_rating, final_grade, potential_rating, calibrated_by, employee_id,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, department, level_id, level:levels(name, grade)),
      manager:users!review_assignments_manager_id_fkey(slack_name)
    `)
    .eq("cycle_id", cycleId)
    .eq("assignment_type", "standard");

  const typedAssignments = (assignments || []) as unknown as CalibrationAssignmentRow[];
  const assignmentIds = typedAssignments.map((a) => a.id);
  let responses: CalibrationResponseRow[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("review_responses")
      .select(`
        id, assignment_id, rating, reviewer_role, competency_id,
        competency:competencies(name, category)
      `)
      .in("assignment_id", assignmentIds);
    responses = (data || []) as unknown as CalibrationResponseRow[];
  }

  // Group responses by assignment
  const responsesByAssignment: Record<string, CalibrationResponseRow[]> = {};
  responses.forEach((r) => {
    if (!responsesByAssignment[r.assignment_id]) {
      responsesByAssignment[r.assignment_id] = [];
    }
    responsesByAssignment[r.assignment_id].push(r);
  });

  return {
    cycle,
    assignments: typedAssignments.map((a) => ({
      ...a,
      employee: Array.isArray(a.employee) ? a.employee[0] ?? null : a.employee,
      manager: Array.isArray(a.manager) ? a.manager[0] ?? null : a.manager,
      responses: (responsesByAssignment[a.id] || []).map((r) => ({
        ...r,
        competency: Array.isArray(r.competency) ? r.competency[0] ?? null : r.competency,
      })),
    })),
  };
}

export default async function CalibrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: cycleId } = await params;
  const workspace = await getUserWorkspace();

  if (!workspace || !isHROrAbove(workspace.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
          Calibration is available to HR and administrators only.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const data = await getCalibrationData(cycleId, workspace.workspaceId!);

  if (!data) {
    notFound();
  }

  return (
    <CalibrationClient
      cycle={data.cycle}
      assignments={data.assignments as unknown as React.ComponentProps<typeof CalibrationClient>["assignments"]}
      cycleId={cycleId}
      workspaceId={workspace.workspaceId!}
    />
  );
}
