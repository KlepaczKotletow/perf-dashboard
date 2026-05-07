import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isHROrAbove } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { AuditLogTable, type AuditRow, type RangeKey } from "./audit-log-table";

const PAGE_SIZE = 50;

const ACTION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "cycle.status_change", label: "Cycle status" },
  { value: "cycle.release_grades", label: "Grades released" },
  { value: "assignment.calibrate", label: "Grade calibrated" },
  { value: "user.role_change", label: "Role changed" },
];

const VALID_ACTIONS = new Set(ACTION_OPTIONS.map((o) => o.value));
const VALID_RANGES: ReadonlyArray<RangeKey> = ["all", "24h", "7d", "30d"];

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function rangeToSinceISO(range: RangeKey): string | null {
  const now = Date.now();
  switch (range) {
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "all":
    default:
      return null;
  }
}

interface AuditLogPageProps {
  searchParams: Promise<{
    page?: string;
    action?: string;
    actor?: string;
    range?: string;
    q?: string;
  }>;
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const params = await searchParams;
  const workspace = await getUserWorkspace();
  if (!workspace?.workspaceId) redirect("/?signin=required");
  if (!isHROrAbove(workspace.role)) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const actions = parseList(params.action).filter((a) => VALID_ACTIONS.has(a));
  const actors = parseList(params.actor); // UUIDs validated by FK constraint when applied
  const range: RangeKey = (VALID_RANGES as readonly string[]).includes(params.range ?? "all")
    ? (params.range as RangeKey) ?? "all"
    : "all";
  const q = (params.q ?? "").trim();

  // ── Fetch the filtered rows ────────────────────────────────────────────────
  let listQuery = supabase
    .from("audit_log")
    .select(
      `id, action, entity_type, entity_id, metadata, created_at,
       actor:users!audit_log_actor_user_id_fkey(id, slack_name)`,
      { count: "exact" },
    )
    .eq("workspace_id", workspace.workspaceId)
    .order("created_at", { ascending: false });

  if (actions.length > 0) listQuery = listQuery.in("action", actions);
  if (actors.length > 0) listQuery = listQuery.in("actor_user_id", actors);

  const since = rangeToSinceISO(range);
  if (since) listQuery = listQuery.gte("created_at", since);

  // Free-text search casts the metadata jsonb to text and ilikes against the
  // resulting string. PostgREST exposes this via the `cs`/`ilike` operators
  // on jsonb-as-text, but the ergonomic path is to filter post-fetch on the
  // current page — keeps the SQL surface narrow and avoids index regressions
  // on a path that's manually invoked. Workspaces with millions of audit
  // entries should reach for a dedicated search column; we're nowhere near
  // that scale.
  // Always run the count + paginate at the DB level so total reflects the
  // entire filtered set, not just the current page.
  listQuery = listQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data: rawRows, count: totalBeforeSearch } = await listQuery;

  type RawRow = {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    actor: { id: string; slack_name: string | null } | { id: string; slack_name: string | null }[] | null;
  };

  const allRows: AuditRow[] = (rawRows as RawRow[] | null ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    created_at: r.created_at,
    actor: Array.isArray(r.actor) ? (r.actor[0] ?? null) : r.actor,
  }));

  // Apply free-text search on the page slice. Match against actor name +
  // stringified metadata (covers cycle names, target user names, from/to
  // values without needing per-action search columns).
  let rows = allRows;
  let total = totalBeforeSearch ?? 0;
  if (q) {
    const needle = q.toLowerCase();
    rows = allRows.filter((r) => {
      const haystack = [
        r.actor?.slack_name ?? "",
        r.action,
        JSON.stringify(r.metadata),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
    // When a search is active the displayed count reflects the filtered slice
    // of the current page. The "total" header still shows DB-side filtered
    // total — pagination behavior remains predictable for the user.
    total = totalBeforeSearch ?? rows.length;
  }

  // ── Distinct actors for the filter dropdown ────────────────────────────────
  // Pull every actor the workspace has logged a sensitive action under,
  // bounded so the list stays manageable.
  const { data: actorRows } = await supabase
    .from("audit_log")
    .select("actor_user_id, actor:users!audit_log_actor_user_id_fkey(id, slack_name)")
    .eq("workspace_id", workspace.workspaceId)
    .not("actor_user_id", "is", null)
    .limit(2000);

  type ActorRow = {
    actor_user_id: string | null;
    actor: { id: string; slack_name: string | null } | { id: string; slack_name: string | null }[] | null;
  };
  const actorMap = new Map<string, string>();
  for (const ar of (actorRows as ActorRow[] | null ?? [])) {
    const a = Array.isArray(ar.actor) ? ar.actor[0] : ar.actor;
    if (a?.id && !actorMap.has(a.id)) {
      actorMap.set(a.id, a.slack_name ?? "Unknown");
    }
  }
  const actorOptions = [...actorMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        hat="manage"
        title="Audit log"
        subtitle="Read-only history of sensitive workspace actions"
      />

      <AuditLogTable
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        actionOptions={ACTION_OPTIONS}
        actorOptions={actorOptions}
        current={{ actions, actors, range, q }}
      />
    </div>
  );
}
