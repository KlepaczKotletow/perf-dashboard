import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove } from "@/lib/roles";
import { csvStreamResponse } from "@/lib/csv";

export const runtime = "nodejs";

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

    // Resolve workspace cycles once (small result — safe to buffer)
    const { data: cycles } = await supabase
      .from("performance_cycles")
      .select("id")
      .eq("workspace_id", wsId);
    const wsCycleIds = (cycles || []).map((c) => c.id);
    if (wsCycleIds.length === 0) {
      return new NextResponse("No cycles found", { status: 404 });
    }

    const header = [
      "Cycle", "Employee", "Department", "Job Title", "Reviewer/Manager",
      "Type", "Status", "Overall Rating", "Final Grade",
    ];

    return csvStreamResponse({
      filename: `reviews-export-${new Date().toISOString().split("T")[0]}.csv`,
      header,
      pageSize: 500,
      fetchPage: async (offset, limit) => {
        let q = supabase
          .from("review_assignments")
          .select(`
            id, status, overall_rating, final_grade, assignment_type,
            employee:users!review_assignments_employee_id_fkey(slack_name, department, job_title),
            manager:users!review_assignments_manager_id_fkey(slack_name),
            cycle:performance_cycles!review_assignments_cycle_id_fkey(id, name)
          `)
          .order("created_at", { ascending: false });
        if (cycleId) {
          q = q.eq("cycle_id", cycleId);
        } else {
          q = q.in("cycle_id", wsCycleIds);
        }
        const { data } = await q.range(offset, offset + limit - 1);
        return data ?? [];
      },
      toRow: (a) => {
        const emp = (a as { employee?: { slack_name?: string; department?: string; job_title?: string } | null }).employee;
        const mgr = (a as { manager?: { slack_name?: string } | null }).manager;
        const cyc = (a as { cycle?: { name?: string } | null }).cycle;
        return [
          cyc?.name,
          emp?.slack_name,
          emp?.department,
          emp?.job_title,
          mgr?.slack_name,
          a.assignment_type || "standard",
          a.status,
          a.overall_rating,
          a.final_grade,
        ];
      },
    });
  } catch (err) {
    console.error("Reviews export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
