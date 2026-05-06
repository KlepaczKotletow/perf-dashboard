import { getUserWorkspace, createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, UserRole } from "@/lib/roles";
import { User, Mail, Briefcase, Building2, Users, GraduationCap, Flag, ClipboardCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default async function ProfilePage() {
  const workspace = await getUserWorkspace();
  if (!workspace) redirect("/");

  const supabase = await createServerSupabaseClient();
  const userId = workspace.appUserId;

  // Fetch enriched user data
  const [userRes, goalsRes, assignmentsRes] = await Promise.all([
    supabase
      .from("users")
      .select(`
        job_title, department,
        level:levels!users_level_id_fkey(name),
        manager:users!users_manager_id_fkey(slack_name)
      `)
      .eq("id", userId)
      .single(),
    supabase
      .from("goals")
      .select("id, status, progress")
      .eq("employee_id", userId)
      .eq("workspace_id", workspace.workspaceId)
      .in("status", ["active", "draft"]),
    supabase
      .from("review_assignments")
      .select(`
        id, status, overall_rating, final_grade,
        cycle:performance_cycles!review_assignments_cycle_id_fkey(name, status, grades_released)
      `)
      .eq("employee_id", userId)
      .eq("assignment_type", "standard")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  type GoalSummary = { id: string; status: string; progress: number | null };
  type ReviewSummary = {
    id: string;
    status: string;
    final_grade: string | null;
    cycle?: { id: string; name: string; grades_released?: boolean } | { id: string; name: string; grades_released?: boolean }[] | null;
  };
  const userData = userRes.data;
  const activeGoals = ((goalsRes.data || []) as GoalSummary[]).filter((g) => g.status === "active");
  const avgProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / activeGoals.length)
    : 0;
  const recentReviews = (assignmentsRes.data || []) as unknown as ReviewSummary[];

  const manager = Array.isArray(userData?.manager) ? userData.manager[0] : userData?.manager;
  const level = Array.isArray(userData?.level) ? userData.level[0] : userData?.level;

  const initials = workspace.name
    ? workspace.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : workspace.email?.[0]?.toUpperCase() || "?";

  const detailRows = [
    { icon: User, label: "Full name", value: workspace.name || "Not set" },
    { icon: Mail, label: "Email", value: workspace.email || "—" },
    { icon: Briefcase, label: "Job title", value: userData?.job_title || "—" },
    { icon: Building2, label: "Department", value: userData?.department || "—" },
    { icon: Users, label: "Manager", value: manager?.slack_name || "—" },
    { icon: GraduationCap, label: "Level", value: level?.name || "—" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        hat="my-work"
        title="Profile"
        subtitle="Your personal account details."
      />

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xl font-medium text-primary">{initials}</span>
        </div>
        <div>
          <p className="font-medium text-lg">{workspace.name || "Not set"}</p>
          <Badge variant="outline" className="text-xs capitalize mt-1">
            {ROLE_LABELS[workspace.role as UserRole] || workspace.role}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardContent className="divide-y divide-border/60 p-0">
          {detailRows.map((row) => (
            <div key={row.label} className="flex items-center gap-3 px-5 py-3.5">
              <row.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-sm font-medium truncate">{row.value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Active Goals summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">Goals</h2>
          <Link href="/dashboard/goals" className="text-xs text-primary font-medium hover:text-primary/80 flex items-center gap-1 transition-colors">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <Card className="border-border/60">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center shrink-0">
                <Flag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{activeGoals.length} active goal{activeGoals.length !== 1 ? "s" : ""}</p>
                {activeGoals.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${avgProgress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{avgProgress}%</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reviews summary */}
      {recentReviews.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">Recent Reviews</h2>
            <Link href="/dashboard/performance" className="text-xs text-primary font-medium hover:text-primary/80 flex items-center gap-1 transition-colors">
              View history <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <Card className="border-border/60">
            <CardContent className="divide-y divide-border/60 p-0">
              {recentReviews.map((r) => {
                const cycle = Array.isArray(r.cycle) ? r.cycle[0] : r.cycle;
                return (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{cycle?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground capitalize">{r.status?.replace("_", " ")}</p>
                      </div>
                    </div>
                    {cycle?.grades_released && r.final_grade && (
                      <Badge variant="outline" className="text-xs">{r.final_grade}</Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Profile details are synced from your Slack workspace. Contact your admin to make changes.
      </p>
    </div>
  );
}
