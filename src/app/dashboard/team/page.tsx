import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SyncButton } from "./sync-button";
import { TeamList } from "./team-list";
import { canManageUsers } from "@/lib/roles";
import { Users, Upload } from "lucide-react";

async function getUsers() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("users")
    .select(`
      *,
      manager:users!users_manager_id_fkey(slack_name),
      level:levels!users_level_id_fkey(name, grade, job_family:job_families(name))
    `)
    .order("department", { ascending: true })
    .order("slack_name", { ascending: true });
  return data || [];
}

async function getSubscription() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, user_limit, status")
    .maybeSingle();
  return data;
}

export default async function TeamPage() {
  const [users, workspace, subscription] = await Promise.all([
    getUsers(),
    getUserWorkspace(),
    getSubscription(),
  ]);
  const isAdmin = canManageUsers(workspace?.role);
  const seatLimit = subscription?.user_limit || 5;
  const seatUsed = users.length;
  const seatPercent = Math.min(Math.round((seatUsed / seatLimit) * 100), 100);

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
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                <Link href="/dashboard/team/import">
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV
                </Link>
              </Button>
              <SyncButton workspaceId={workspace?.workspaceId} />
              <Link href="/dashboard/admin/job-families" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Manage Job Families
              </Link>
            </>
          )}
        </div>
      </div>

      {users.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No team members yet</p>
            <p className="text-sm text-muted-foreground">Click &quot;Sync from Slack&quot; above to import your workspace members.</p>
          </CardContent>
        </Card>
      ) : (
        <TeamList
          users={users}
          isAdmin={isAdmin}
          currentUserId={workspace?.appUserId}
          workspaceId={workspace?.workspaceId}
        />
      )}
    </div>
  );
}
