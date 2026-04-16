import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove } from "@/lib/roles";
import { csvFile } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const workspace = await getUserWorkspace();
    if (!workspace || !isHROrAbove(workspace.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();
    const wsId = workspace.workspaceId;
    const { searchParams } = request.nextUrl;
    const cycleId = searchParams.get("cycleId");

    // Get workspace cycle IDs
    const { data: cycles } = await supabase
      .from("performance_cycles")
      .select("id, name")
      .eq("workspace_id", wsId);
    const cycleMap = new Map((cycles || []).map((c: any) => [c.id, c.name]));
    const wsCycleIds = (cycles || []).map((c: any) => c.id);
    if (wsCycleIds.length === 0) {
      return new NextResponse("No cycles found", { status: 404 });
    }

    // Get assignments
    let assignQ = supabase
      .from("review_assignments")
      .select(`
        id, status, overall_rating, final_grade, assignment_type,
        employee:users!review_assignments_employee_id_fkey(slack_name, department, job_title),
        manager:users!review_assignments_manager_id_fkey(slack_name),
        cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name)
      `)
      .order("created_at", { ascending: false });

    if (cycleId) {
      assignQ = assignQ.eq("cycle_id", cycleId);
    } else {
      assignQ = assignQ.in("cycle_id", wsCycleIds);
    }

    const { data: assignments } = await assignQ;

    const header = [
      "Cycle", "Employee", "Department", "Job Title", "Reviewer/Manager",
      "Type", "Status", "Overall Rating", "Final Grade",
    ];

    const csv = csvFile(header, (assignments || []).map((a) => {
      const emp = a.employee as any;
      const mgr = a.manager as any;
      return [
        (a.cycle as any)?.name,
        emp?.slack_name,
        emp?.department,
        emp?.job_title,
        mgr?.slack_name,
        a.assignment_type || "standard",
        a.status,
        a.overall_rating,
        a.final_grade,
      ];
    }));

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="reviews-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err) {
    console.error("Reviews export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
