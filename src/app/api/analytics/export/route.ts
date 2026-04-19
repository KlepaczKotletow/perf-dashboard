import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/roles";
import { csvStreamResponse } from "@/lib/csv";
import { sanitizeExportError } from "./error-sanitization";

export const runtime = "nodejs";

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

    // Pre-load the small metadata tables once. users and cycles are bounded
    // by workspace size — staying in-memory is safe even at 500+ people.
    const [{ data: usersData }, { data: cyclesData }] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id, department, slack_name, manager_id, level:levels!users_level_id_fkey(name, job_family_id, job_family:job_families(name))",
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("performance_cycles")
        .select("id, name")
        .eq("workspace_id", workspaceId),
    ]);
    const allUsers = usersData || [];
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const cycles = cyclesData || [];
    const cycleMap = new Map(cycles.map((c) => [c.id, c.name]));
    const wsCycleIds = cycles.map((c) => c.id);
    if (wsCycleIds.length === 0) {
      return new NextResponse("No cycles found", { status: 404 });
    }

    // Users filtered by dept/function. Only these employees' assignments appear
    // in the export. Set lookup keeps the stream hot-path fast.
    type UserRow = (typeof allUsers)[number];
    const filteredUserIds = new Set(
      allUsers
        .filter((u: UserRow) => {
          if (department && (u as { department?: string }).department !== department) return false;
          const lvl = (u as { level?: { job_family_id?: string } | null }).level;
          if (functionId && lvl?.job_family_id !== functionId) return false;
          return true;
        })
        .map((u: UserRow) => u.id),
    );

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

    return csvStreamResponse({
      filename: "analytics-export.csv",
      header,
      pageSize: 500,
      fetchPage: async (offset, limit) => {
        // Stream review_responses with assignment embed so each row has the
        // cycle + employee FK. Joined metadata is resolved from the in-memory
        // userMap / cycleMap below, keeping memory flat regardless of row count.
        let q = supabase
          .from("review_responses")
          .select(`
            rating,
            assignment:review_assignments!inner(
              id, status, employee_id, cycle_id
            ),
            competency:competencies(name)
          `)
          .not("rating", "is", null)
          .order("id");
        if (cycleId) {
          q = q.eq("assignment.cycle_id", cycleId);
        } else {
          q = q.in("assignment.cycle_id", wsCycleIds);
        }
        const { data } = await q.range(offset, offset + limit - 1);
        return (data ?? []).filter((r) => {
          const a = (r as { assignment?: { employee_id?: string } | null }).assignment;
          return a?.employee_id ? filteredUserIds.has(a.employee_id) : false;
        });
      },
      toRow: (r) => {
        const a = (r as { assignment?: { employee_id?: string; cycle_id?: string; status?: string } | null }).assignment!;
        const employee = userMap.get(a.employee_id as string) as UserRow | undefined;
        const mgrId = (employee as { manager_id?: string } | undefined)?.manager_id;
        const manager = mgrId ? (userMap.get(mgrId) as UserRow | undefined) : undefined;
        const competency = (r as { competency?: { name?: string } | null }).competency;
        const lvl = (employee as { level?: { job_family?: { name?: string } } } | undefined)?.level;
        return [
          cycleMap.get(a.cycle_id as string),
          (employee as { slack_name?: string } | undefined)?.slack_name,
          (employee as { department?: string } | undefined)?.department,
          lvl?.job_family?.name,
          (manager as { slack_name?: string } | undefined)?.slack_name,
          competency?.name,
          (r as { rating?: number | null }).rating,
          a.status,
        ];
      },
    });
  } catch (err: unknown) {
    console.error("Analytics export error:", err);
    return NextResponse.json(
      { error: sanitizeExportError(err) },
      { status: 500 },
    );
  }
}
