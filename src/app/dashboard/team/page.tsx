import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { RoleSelector } from "./role-selector";
import { canManageUsers } from "@/lib/roles";
import { Users, ArrowRight } from "lucide-react";

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

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const departments = [...new Set(users.map((u: any) => u.department || "Unassigned"))].sort();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} member{users.length !== 1 ? "s" : ""} across {departments.length} department{departments.length !== 1 ? "s" : ""}
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
            <Link href="/dashboard/admin/job-families" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Manage Job Families
            </Link>
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
            <p className="text-sm text-muted-foreground">Users will appear after they interact with the app in Slack.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((user: any) => (
            <div
              key={user.id}
              className="flex items-center gap-4 p-3 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all"
            >
              <Link href={`/dashboard/team/${user.id}`} className="shrink-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs bg-primary/[0.08] text-primary font-medium">
                    {getInitials(user.slack_name)}
                  </AvatarFallback>
                </Avatar>
              </Link>

              <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-center">
                {/* Name + email */}
                <Link href={`/dashboard/team/${user.id}`} className="min-w-0 group">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {user.slack_name || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.job_title || user.slack_email || "—"}
                  </p>
                </Link>

                {/* Department + Level */}
                <div className="min-w-0 hidden md:block">
                  <div className="flex items-center gap-1.5">
                    {user.department && (
                      <span className="text-xs text-muted-foreground truncate">{user.department}</span>
                    )}
                    {user.level && (
                      <span className="text-xs text-muted-foreground/60">
                        {user.department && " · "}
                        {user.level.name}
                      </span>
                    )}
                    {!user.department && !user.level && (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>
                </div>

                {/* Manager */}
                <div className="min-w-0 hidden lg:block">
                  {user.manager?.slack_name ? (
                    <span className="text-xs text-muted-foreground">Reports to {user.manager.slack_name}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">No manager</span>
                  )}
                </div>

                {/* Role + Action */}
                <div className="flex items-center gap-3 shrink-0">
                  <RoleSelector
                    userId={user.id}
                    currentRole={user.role || "user"}
                    canEdit={isAdmin && user.id !== workspace?.appUserId}
                  />
                  <Link
                    href={`/dashboard/team/${user.id}`}
                    className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
