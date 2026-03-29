import { NextResponse } from "next/server";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove } from "@/lib/roles";

export async function GET() {
  try {
    const workspace = await getUserWorkspace();
    if (!workspace || !isHROrAbove(workspace.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();
    const wsId = workspace.workspaceId;

    const { data: goals } = await supabase
      .from("goals")
      .select(`
        id, title, description, status, progress, weight,
        metric_start, metric_current, metric_target, metric_unit,
        tracking_status, scope, due_date, created_at,
        employee:users!goals_employee_id_fkey(slack_name, department),
        cycle:performance_cycles!goals_cycle_id_fkey(name)
      `)
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });

    const header = [
      "Title", "Owner", "Department", "Cycle", "Scope", "Status",
      "Tracking Status", "Progress %", "Metric Start", "Metric Current",
      "Metric Target", "Metric Unit", "Weight", "Due Date", "Created",
    ];

    const rows: string[][] = [header];
    for (const g of (goals || [])) {
      const emp = g.employee as any;
      const cycle = g.cycle as any;
      rows.push([
        g.title || "",
        emp?.slack_name || "",
        emp?.department || "",
        cycle?.name || "",
        g.scope || "",
        g.status || "",
        g.tracking_status || "",
        String(g.progress ?? ""),
        String(g.metric_start ?? ""),
        String(g.metric_current ?? ""),
        String(g.metric_target ?? ""),
        g.metric_unit || "",
        String(g.weight ?? ""),
        g.due_date || "",
        g.created_at ? new Date(g.created_at).toISOString().split("T")[0] : "",
      ]);
    }

    const csv = rows
      .map((row) =>
        row.map((cell) =>
          cell.includes(",") || cell.includes('"') || cell.includes("\n")
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(",")
      ).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="goals-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err) {
    console.error("Goals export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
