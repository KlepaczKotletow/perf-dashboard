import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SyncButton } from "./sync-button";
import { TeamList } from "./team-list";
import { canManageUsers } from "@/lib/roles";
import { Users, Upload, List, Network } from "lucide-react";
import { OrgChart } from "./org-chart";

async function getUsers(workspaceId: string) {
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
    const users = simple || [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    return users.map((u: any) => ({
      ...u,
      manager: u.manager_id ? { slack_name: userMap.get(u.manager_id)?.slack_name || null } : null,
      level: null,
    }));
  }

  // Resolve manager names from the same user array (avoids PostgREST self-join)
  const userMap = new Map((data || []).map((u: any) => [u.id, u]));
  return (data || []).map((u: any) => ({
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
  const filterUnassigned = params.filter === "unassigned";
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
  const seatUsed = users.length;
  const seatPercent = Math.min(Math.round((seatUsed / seatLimit) * 100), 100);

  const unassignedCount = users.filter((u: any) => !u.level).length;

  const departments = [...new Set(users.map((u: any) => u.department).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} member{users.length !== 1 ? "s" : ""}{departments.length > 0 ? ` across ${departments.length} department${departments.length !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
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
              <span className="text-[10px] text-muted-foreground">seats</span>
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
      </div>

      {/* Unassigned warning banner */}
      {isAdmin && unassignedCount > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-400 text-sm">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/>
              <path d="M12 17h.01"/>
            </svg>
            <span>
              <strong>{unassignedCount} {unassignedCount === 1 ? "person has" : "people have"} no job level assigned</strong>
              {" "}— their reviews won&apos;t have a competency baseline.
            </span>
          </div>
          {filterUnassigned ? (
            <Link href="/dashboard/team" className="shrink-0 text-xs font-medium underline underline-offset-2 whitespace-nowrap">
              Show all
            </Link>
          ) : (
            <Link href="/dashboard/team?filter=unassigned" className="shrink-0 text-xs font-medium underline underline-offset-2 whitespace-nowrap">
              Show unassigned →
            </Link>
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
          filterUnassigned={filterUnassigned}
        />
      )}
    </div>
  );
}
