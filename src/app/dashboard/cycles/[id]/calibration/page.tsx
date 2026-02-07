import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, Lock, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { isHROrAbove } from "@/lib/roles";

async function getCalibrationData(cycleId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: cycle } = await supabase
    .from("performance_cycles")
    .select("id, name, status")
    .eq("id", cycleId)
    .single();

  if (!cycle) return null;

  const { data: assignments } = await supabase
    .from("review_assignments")
    .select(`
      *,
      employee:users!review_assignments_employee_id_fkey(id, slack_name, department, job_title, level:levels(name, grade)),
      manager:users!review_assignments_manager_id_fkey(slack_name)
    `)
    .eq("cycle_id", cycleId)
    .order("overall_rating", { ascending: false, nullsFirst: false });

  // Get all review responses for these assignments
  const assignmentIds = (assignments || []).map((a: any) => a.id);
  let responses: any[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("review_responses")
      .select(`
        *,
        competency:competencies(name),
        reviewer:users!review_responses_reviewer_id_fkey(slack_name)
      `)
      .in("assignment_id", assignmentIds);
    responses = data || [];
  }

  // Group responses by assignment
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

const ratingColors: Record<number, string> = {
  1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  2: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  3: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  4: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  5: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default async function CalibrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getUserWorkspace();

  if (!isHROrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
        <p className="text-muted-foreground mb-6">Calibration is only available to HR and administrators.</p>
        <Button asChild><Link href="/dashboard">Go to Dashboard</Link></Button>
      </div>
    );
  }

  const data = await getCalibrationData(id);
  if (!data) notFound();

  const { cycle, assignments } = data;

  // Group by department for calibration
  const byDepartment: Record<string, any[]> = {};
  assignments.forEach((a: any) => {
    const dept = a.employee?.department || "Unassigned";
    if (!byDepartment[dept]) byDepartment[dept] = [];
    byDepartment[dept].push(a);
  });

  // Rating distribution
  const ratingDist = [0, 0, 0, 0, 0]; // 1-5
  assignments.forEach((a: any) => {
    if (a.overall_rating) {
      const idx = Math.min(Math.max(Math.round(a.overall_rating) - 1, 0), 4);
      ratingDist[idx]++;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/cycles/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Calibration</h1>
          <p className="text-muted-foreground mt-1">{cycle.name} - Compare ratings across the organization</p>
        </div>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Rating Distribution</CardTitle>
          <CardDescription>How ratings are distributed across employees</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 h-32">
            {ratingDist.map((count, idx) => {
              const maxCount = Math.max(...ratingDist, 1);
              const height = (count / maxCount) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-sm font-bold">{count}</span>
                  <div className="w-full rounded-t-md bg-primary/20 relative" style={{ height: `${Math.max(height, 4)}%` }}>
                    <div className="absolute inset-0 rounded-t-md bg-primary" style={{ height: `${height}%` }} />
                  </div>
                  <Badge className={ratingColors[idx + 1]}>{idx + 1}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Calibration Grid by Department */}
      {Object.entries(byDepartment).sort().map(([dept, deptAssignments]) => (
        <Card key={dept}>
          <CardHeader>
            <CardTitle className="text-lg">{dept}</CardTitle>
            <CardDescription>{deptAssignments.length} employees</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Title / Level</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Avg Rating</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Final Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deptAssignments
                  .sort((a: any, b: any) => (b.overall_rating || 0) - (a.overall_rating || 0))
                  .map((assignment: any) => {
                    const avgResponses = assignment.responses.filter((r: any) => r.rating);
                    const avgRating = avgResponses.length > 0
                      ? (avgResponses.reduce((sum: number, r: any) => sum + r.rating, 0) / avgResponses.length).toFixed(1)
                      : null;

                    return (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          <Link href={`/dashboard/team/${assignment.employee?.id}`} className="font-medium text-primary hover:underline">
                            {assignment.employee?.slack_name || "Unknown"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div>
                            {assignment.employee?.job_title && <span className="block text-sm">{assignment.employee.job_title}</span>}
                            {assignment.employee?.level && (
                              <span className="text-xs text-muted-foreground">
                                {assignment.employee.level.name}
                                {assignment.employee.level.grade ? ` (${assignment.employee.level.grade})` : ""}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{assignment.manager?.slack_name || "-"}</TableCell>
                        <TableCell>
                          {avgRating ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span className="font-bold">{avgRating}</span>
                              <span className="text-xs text-muted-foreground">/5</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{assignment.responses.length} responses</span>
                        </TableCell>
                        <TableCell>
                          {assignment.final_grade ? (
                            <Badge>{assignment.final_grade}</Badge>
                          ) : assignment.overall_rating ? (
                            <Badge variant="outline">{assignment.overall_rating.toFixed(1)}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Pending</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {assignments.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No review assignments yet. Add employees to the cycle and create assignments first.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
