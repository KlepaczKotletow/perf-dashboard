import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SyncButton } from "./sync-button";
import { TeamList } from "./team-list";
import { canManageUsers } from "@/lib/roles";
import { Users, Upload, List, Network } from "lucide-react";
import { OrgChart } from "./org-chart";
import { PageHeader } from "@/components/page-header";

type TeamUserRow = {
  id: string;
  slack_name: string | null;
  slack_email: string | null;
  job_title: string | null;
  department: string | null;
  role: string | null;
  manager_id: string | null;
  is_department_head?: boolean | null;
  employee_status?: string | null;
  slack_user_id?: string | null;
  level_id?: string | null;
  level?: { name: string | null; grade: string | null; job_family?: { name: string } | { name: string }[] | null } | null;
  manager?: { slack_name: string | null } | null;
};

/**
 * One readiness count. Zero is rendered plainly rather than hidden — "0 no
 * Slack account" is information, and a strip whose items appear and disappear
 * is harder to read than one that stays put.
 */
function ReadinessItem({
  count,
  label,
  hint,
  filter,
  active,
}: {
  count: number;
  label: string;
  hint: string;
  filter: string;
  active: boolean;
}) {
  if (count === 0) {
    return (
      <span className="text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">0</span> {label}
      </span>
    );
  }
  return (
    <Link
      href={active ? "/dashboard/team" : `/dashboard/team?filter=${filter}`}
      title={hint}
      className={`tabular-nums underline-offset-2 transition-colors hover:text-foreground hover:underline ${
        active ? "text-foreground font-medium underline" : "text-muted-foreground"
      }`}
    >
      <span className="font-semibold text-amber-600 dark:text-amber-400">{count}</span> {label}
    </Link>
  );
}

async function getUsers(workspaceId: string): Promise<TeamUserRow[]> {
  const supabase = await createServerSupabaseClient();

  // Fetch users with level info (avoid self-join which causes PostgREST 400)
  const { data, error } = await supabase
    .from("users")
    .select(`
      *,
      level:levels!users_level_id_fkey(name, grade, job_family:job_families(name))
    `)
    .eq("workspace_id", workspaceId)
    .order("department", { ascending: true })
    .order("slack_name", { ascending: true });

  if (error) {
    console.error("getUsers error:", error);
    // Fallback: fetch without any joins
    const { data: simple } = await supabase
      .from("users")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("department", { ascending: true })
      .order("slack_name", { ascending: true });
    const users = (simple || []) as unknown as TeamUserRow[];
    const userMap = new Map<string, TeamUserRow>(users.map((u) => [u.id, u]));
    return users.map((u) => ({
      ...u,
      manager: u.manager_id ? { slack_name: userMap.get(u.manager_id)?.slack_name || null } : null,
      level: null,
    }));
  }

  // Resolve manager names from the same user array (avoids PostgREST self-join)
  const typedData = (data || []) as unknown as TeamUserRow[];
  const userMap = new Map<string, TeamUserRow>(typedData.map((u) => [u.id, u]));
  return typedData.map((u) => ({
    ...u,
    manager: u.manager_id ? { slack_name: userMap.get(u.manager_id)?.slack_name || null } : null,
  }));
}

async function getSubscription(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, user_limit, status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) console.error("Failed to fetch subscription:", error.message);
  return data;
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; view?: string }>;
}) {
  const params = await searchParams;
  // One of "unassigned" | "no-manager" | "no-slack", or null. Generalised from
  // a single boolean so the readiness strip can drive the list.
  const readinessFilter = params.filter ?? null;
  const viewChart = params.view === "chart";

  const workspace = await getUserWorkspace();
  const workspaceId = workspace?.workspaceId;
  if (!workspaceId) {
    return <div className="p-8 text-center text-muted-foreground">Workspace not found.</div>;
  }

  const [users, subscription] = await Promise.all([
    getUsers(workspaceId),
    getSubscription(workspaceId),
  ]);
  const isAdmin = canManageUsers(workspace?.role);
  const seatLimit = subscription?.user_limit || 5;

  // One canonical population, matching what billing actually counts
  // (api/internal/seat-sync filters on `.neq("employee_status", "deactivated")`).
  //
  // The page used to show three mutually contradictory headcounts in one
  // viewport: a seat meter over every row including deactivated people, a
  // data-quality banner over that same unfiltered array, and a list that hides
  // deactivated by default and said so nowhere. An admin checking headcount
  // before launching a cycle could not trust any of the three.
  const activeUsers = users.filter((u) => u.employee_status !== "deactivated");
  const seatUsed = activeUsers.length;
  const seatPercent = Math.min(Math.round((seatUsed / seatLimit) * 100), 100);

  // The three things that stop a cycle from working, counted over the same
  // population. "No Slack account" is the one that guarantees a review never
  // completes — Nami can create the assignment but can never deliver the DM —
  // and it was invisible on the page whose whole job is fixing exactly this.
  const noBracketCount = activeUsers.filter((u) => !u.level).length;
  const noManagerCount = activeUsers.filter((u) => !u.manager_id).length;
  const noSlackCount = activeUsers.filter((u) => !u.slack_user_id).length;

  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort() as string[];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        hat="manage"
        title="Directory"
        subtitle={`${activeUsers.length} member${activeUsers.length !== 1 ? "s" : ""}${departments.length > 0 ? ` across ${departments.length} department${departments.length !== 1 ? "s" : ""}` : ""}`}
        actions={
          <div className="flex items-center gap-4">
            {/* Seat usage indicator */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/50">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {seatUsed} / {seatLimit}
                </span>
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      seatPercent >= 90
                        ? "bg-red-500"
                        : seatPercent >= 70
                        ? "bg-yellow-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${seatPercent}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">seats</span>
              </div>
            </div>
            {/* View toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Link
                href="/dashboard/team"
                className={`p-1.5 transition-colors ${!viewChart ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/team?view=chart"
                className={`p-1.5 transition-colors ${viewChart ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Org chart"
              >
                <Network className="h-4 w-4" />
              </Link>
            </div>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                  <Link href="/dashboard/team/import">
                    <Upload className="h-3.5 w-3.5" />
                    Import CSV
                  </Link>
                </Button>
                <SyncButton workspaceId={workspace?.workspaceId} />
                <Link href="/dashboard/admin/functions" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Manage Functions
                </Link>
              </>
            )}
          </div>
        }
      />

      {/* Readiness strip.
          The Directory opened as N rows of fields, so it read as a database
          dump however good the table was — nothing on the page said what it was
          FOR. It is for getting the org clean enough to launch a cycle, so it
          now opens with the three things that stop one from working, each of
          them a filter. When all three are zero it says so and gets out of the
          way, rather than disappearing and leaving the question unanswered. */}
      {isAdmin && activeUsers.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-3">
          {noBracketCount + noManagerCount + noSlackCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Ready to launch a cycle.</span>{" "}
              Everyone has a manager, a competency bracket and a Slack account.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground mb-2">Before you launch a cycle</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <ReadinessItem
                  count={noSlackCount}
                  label="no Slack account"
                  hint="Nami can't deliver their review"
                  filter="no-slack"
                  active={readinessFilter === "no-slack"}
                />
                <ReadinessItem
                  count={noManagerCount}
                  label="no manager"
                  hint="nobody is assigned to review them"
                  filter="no-manager"
                  active={readinessFilter === "no-manager"}
                />
                <ReadinessItem
                  count={noBracketCount}
                  label="no competency bracket"
                  hint="their review skips competency ratings"
                  filter="unassigned"
                  active={readinessFilter === "unassigned"}
                />
                {readinessFilter && (
                  <Link
                    href="/dashboard/team"
                    className="text-xs font-medium underline underline-offset-2 text-muted-foreground hover:text-foreground"
                  >
                    Show all
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {users.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No team members yet</p>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              Import your Slack workspace members to get started. This will pull in names, emails, departments, and job titles.
            </p>
            {isAdmin && (
              <div className="flex items-center gap-3 justify-center">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/team/import">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Import CSV
                  </Link>
                </Button>
                <SyncButton workspaceId={workspace?.workspaceId} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : viewChart ? (
        <OrgChart users={users} />
      ) : (
        <TeamList
          users={users}
          isAdmin={isAdmin}
          currentUserId={workspace?.appUserId}
          workspaceId={workspace?.workspaceId}
          readinessFilter={readinessFilter}
        />
      )}
    </div>
  );
}
