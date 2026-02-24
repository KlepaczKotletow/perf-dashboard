import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { notFound } from "next/navigation";
import { canAccessCalibration } from "@/lib/roles";
import { CalibrationView } from "./calibration-view";

async function getCalibrationData(cycleId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("id, name, status, grades_released")
    .eq("id", cycleId)
    .single();

  if (!cycle) return null;

  const { data: assignments } = await supabase
    .from("review_assignments")
    .select(`
      id, status, overall_rating, final_grade, calibrated_by, calibrated_at, assignment_type,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, department, job_title, level:levels(name, grade)),
      manager:users!review_assignments_manager_id_fkey(slack_name)
    `)
    .eq("cycle_id", cycleId)
    .eq("assignment_type", "standard")
    .order("overall_rating", { ascending: false, nullsFirst: false });

  // Get all review responses for these assignments
  const assignmentIds = (assignments || []).map((a: any) => a.id);
  let responses: any[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("review_responses")
      .select(`
        id, assignment_id, reviewer_role, rating, comment,
        competency:competencies(name)
      `)
      .in("assignment_id", assignmentIds);
    responses = data || [];
  }

  // Group responses by assignment, then by role
  const responsesByAssignment: Record<string, any[]> = {};
  responses.forEach((r: any) => {
    if (!responsesByAssignment[r.assignment_id]) {
      responsesByAssignment[r.assignment_id] = [];
    }
    responsesByAssignment[r.assignment_id].push(r);
  });

  return {
    cycle,
    assignments: (assignments || []).map((a: any) => ({
      ...a,
      responses: responsesByAssignment[a.id] || [],
    })),
  };
}

async function getCurrentUserInfo() {
  const supabase = await createServerSupabaseClient();
  const workspace = await getUserWorkspace();
  if (!workspace?.appUserId) return null;

  const { data: user } = await supabase
    .from("users")
    .select("id, department, is_department_head")
    .eq("id", workspace.appUserId)
    .single();

  return {
    ...workspace,
    department: user?.department || null,
    isDeptHead: user?.is_department_head || false,
  };
}

export default async function CalibrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userInfo = await getCurrentUserInfo();

  if (!userInfo || !canAccessCalibration(userInfo.role, userInfo.isDeptHead)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
        <p className="text-muted-foreground mb-6">Calibration is available to HR, administrators, and department heads.</p>
        <Button asChild><Link href="/dashboard">Go to Dashboard</Link></Button>
      </div>
    );
  }

  const data = await getCalibrationData(id);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/cycles/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calibration</h1>
          <p className="text-sm text-muted-foreground mt-1">{data.cycle.name}</p>
        </div>
      </div>

      <CalibrationView
        cycle={data.cycle}
        assignments={data.assignments}
        userRole={userInfo.role || "user"}
        userDepartment={userInfo.department}
        isDeptHead={userInfo.isDeptHead}
        currentUserId={userInfo.appUserId || ""}
      />
    </div>
  );
}
