import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isHROrAbove } from "@/lib/roles";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 100;

const ACTION_LABELS: Record<string, string> = {
  "cycle.status_change": "Cycle status change",
  "cycle.release_grades": "Grades released",
  "assignment.calibrate": "Grade calibrated",
  "user.role_change": "Role changed",
};

function renderMetadata(action: string, md: Record<string, unknown>): string {
  switch (action) {
    case "cycle.status_change":
      return `${md.cycle_name ?? "cycle"}: ${md.from ?? "–"} → ${md.to ?? "–"}`;
    case "cycle.release_grades":
      return `${md.cycle_name ?? "cycle"}`;
    case "assignment.calibrate":
      return `${md.from ?? "–"} → ${md.to ?? "–"}`;
    case "user.role_change":
      return `${md.target_slack_name ?? "user"}: ${md.from ?? "–"} → ${md.to ?? "–"}`;
    default:
      return JSON.stringify(md);
  }
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const params = await searchParams;
  const workspace = await getUserWorkspace();
  if (!workspace?.workspaceId) redirect("/?signin=required");
  if (!isHROrAbove(workspace.role)) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const actionFilter = params.action && params.action !== "all" ? params.action : null;

  let q = supabase
    .from("audit_log")
    .select(
      `id, action, entity_type, entity_id, metadata, created_at,
       actor:users!audit_log_actor_user_id_fkey(id, slack_name)`,
      { count: "exact" },
    )
    .eq("workspace_id", workspace.workspaceId)
    .order("created_at", { ascending: false });
  if (actionFilter) q = q.eq("action", actionFilter);
  q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data: rows, count } = await q;

  const actions = [
    { value: "all", label: "All actions" },
    { value: "cycle.status_change", label: ACTION_LABELS["cycle.status_change"] },
    { value: "cycle.release_grades", label: ACTION_LABELS["cycle.release_grades"] },
    { value: "assignment.calibrate", label: ACTION_LABELS["assignment.calibrate"] },
    { value: "user.role_change", label: ACTION_LABELS["user.role_change"] },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Audit log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sensitive actions in this workspace: cycle status changes, grade releases,
          calibration grade edits, and user role changes. Read-only.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        {actions.map((a) => {
          const active = (actionFilter ?? "all") === a.value;
          return (
            <a
              key={a.value}
              href={a.value === "all" ? "?" : `?action=${a.value}`}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              {a.label}
            </a>
          );
        })}
      </nav>

      <Card>
        <CardHeader className="border-b border-border/60 bg-muted/20 py-2.5 px-6">
          <p className="text-xs text-muted-foreground tabular-nums">
            {count ?? 0} events
            {actionFilter ? ` · filtered by ${ACTION_LABELS[actionFilter] ?? actionFilter}` : ""}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {!rows || rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No events recorded yet.
            </div>
          ) : (
            <ol className="divide-y divide-border/60">
              {rows.map((r) => {
                const md = (r.metadata ?? {}) as Record<string, unknown>;
                const when = new Date(r.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                });
                const actor = (r.actor as { slack_name?: string } | null)?.slack_name ?? "System";
                return (
                  <li
                    key={r.id}
                    className="px-6 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"
                  >
                    <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                      {ACTION_LABELS[r.action] ?? r.action}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{actor}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{when}</span>
                    <span className="text-xs text-muted-foreground w-full sm:w-auto sm:ml-auto">
                      {renderMetadata(r.action, md)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {count !== null && count !== undefined && count > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {Math.max(1, Math.ceil(count / PAGE_SIZE))}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?page=${page - 1}${actionFilter ? `&action=${actionFilter}` : ""}`}
                className="underline hover:no-underline"
              >
                Previous
              </a>
            )}
            {page * PAGE_SIZE < count && (
              <a
                href={`?page=${page + 1}${actionFilter ? `&action=${actionFilter}` : ""}`}
                className="underline hover:no-underline"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
