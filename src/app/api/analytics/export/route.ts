import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/roles";
import { csvFile } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const workspace = await getUserWorkspace();

    if (!workspace || (!isManagerOrAbove(workspace.role) && !workspace.hasDirectReports)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = workspace.workspaceId;
    const supabase = await createServerSupabaseClient();
    const { searchParams } = request.nextUrl;
    const cycleId = searchParams.get("cycleId") || null;
    const functionId = searchParams.get("functionId") || null;
    const department = searchParams.get("department") || null;

    // 1. Users with level -> job_family, manager
    const { data: usersData } = await supabase
      .from("users")
      .select(
        "id, department, slack_name, manager_id, level:levels!users_level_id_fkey(name, job_family_id, job_family:job_families(name))"
      )
      .eq("workspace_id", workspaceId);

    const allUsers = usersData || [];
    const userMap = new Map(allUsers.map((u: any) => [u.id, u]));

    // Apply filters to users
    let filteredUsers = allUsers;
    if (department) {
      filteredUsers = filteredUsers.filter((u: any) => u.department === department);
    }
    if (functionId) {
      filteredUsers = filteredUsers.filter(
        (u: any) => u.level?.job_family_id === functionId
      );
    }
    const filteredUserIds = new Set(filteredUsers.map((u: any) => u.id));

    // 2. Workspace cycle IDs
    let cyclesQ = supabase
      .from("performance_cycles")
      .select("id, name")
      .eq("workspace_id", workspaceId);
    const { data: cyclesData } = await cyclesQ;
    const cycles = cyclesData || [];
    const cycleMap = new Map(cycles.map((c: any) => [c.id, c.name]));
    const wsCycleIds = cycles.map((c: any) => c.id);

    // 3. Assignments
    let assignments: any[] = [];
    if (wsCycleIds.length > 0) {
      let assignQ = supabase
        .from("review_assignments")
        .select("id, status, employee_id, cycle_id");

      if (cycleId) {
        assignQ = assignQ.eq("cycle_id", cycleId);
      } else {
        assignQ = assignQ.in("cycle_id", wsCycleIds);
      }

      const { data: assignRaw } = await assignQ;
      assignments = (assignRaw || []).filter((a: any) =>
        filteredUserIds.has(a.employee_id)
      );
    }

    const assignmentIds = assignments.map((a: any) => a.id);

    // 4. Responses with competency names
    let responses: any[] = [];
    if (assignmentIds.length > 0) {
      const { data: respRaw } = await supabase
        .from("review_responses")
        .select("rating, assignment_id, competency:competencies(name)")
        .in("assignment_id", assignmentIds)
        .not("rating", "is", null);
      responses = respRaw || [];
    }

    // Build assignment lookup
    const assignmentMap = new Map(
      assignments.map((a: any) => [a.id, a])
    );

    // 5. Build CSV rows
    const header = [
      "cycle_name",
      "employee_name",
      "department",
      "function",
      "manager",
      "competency",
      "rating",
      "assignment_status",
    ];
    const dataRows: unknown[][] = [];

    for (const resp of responses) {
      const assignment = assignmentMap.get(resp.assignment_id);
      if (!assignment) continue;

      const employee = userMap.get(assignment.employee_id);
      if (!employee) continue;

      const manager = employee.manager_id
        ? userMap.get(employee.manager_id)
        : null;

      dataRows.push([
        cycleMap.get(assignment.cycle_id),
        employee.slack_name,
        employee.department,
        (employee.level as any)?.job_family?.name,
        manager?.slack_name,
        (resp.competency as any)?.name,
        resp.rating,
        assignment.status,
      ]);
    }

    // If no responses, still include employees with assignments (no ratings yet)
    if (responses.length === 0) {
      for (const assignment of assignments) {
        const employee = userMap.get(assignment.employee_id);
        if (!employee) continue;

        const manager = employee.manager_id
          ? userMap.get(employee.manager_id)
          : null;

        dataRows.push([
          cycleMap.get(assignment.cycle_id),
          employee.slack_name,
          employee.department,
          (employee.level as any)?.job_family?.name,
          manager?.slack_name,
          "",
          "",
          assignment.status,
        ]);
      }
    }

    // 6. Convert to CSV string
    const csvContent = csvFile(header, dataRows);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="analytics-export.csv"',
      },
    });
  } catch (err: unknown) {
    console.error("Analytics export error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to export analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
