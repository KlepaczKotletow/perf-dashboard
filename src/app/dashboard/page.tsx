import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FileText,
  MessageSquare,
  Users,
  TrendingUp,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  Crosshair,
  Target,
} from "lucide-react";
import { isManagerOrAbove } from "@/lib/roles";

async function getStats(workspaceId: string | undefined) {
  const supabase = await createServerSupabaseClient();

  const baseReviews = supabase.from("review_cycles").select("*", { count: "exact", head: true });
  const baseFeedback = supabase.from("continuous_feedback").select("*", { count: "exact", head: true });
  const baseUsers = supabase.from("users").select("*", { count: "exact", head: true });
  const baseActive = supabase.from("review_cycles").select("*", { count: "exact", head: true }).eq("status", "active");

  const [reviewsRes, feedbackRes, usersRes, activeReviewsRes] = await Promise.all([
    workspaceId ? baseReviews.eq("workspace_id", workspaceId) : baseReviews,
    workspaceId ? baseFeedback.eq("workspace_id", workspaceId) : baseFeedback,
    workspaceId ? baseUsers.eq("workspace_id", workspaceId) : baseUsers,
    workspaceId ? baseActive.eq("workspace_id", workspaceId) : baseActive,
  ]);

  return {
    totalReviews: reviewsRes.count || 0,
    activeReviews: activeReviewsRes.count || 0,
    totalFeedback: feedbackRes.count || 0,
    totalUsers: usersRes.count || 0,
  };
}

async function getActiveCycles(workspaceId: string | undefined) {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("performance_cycles")
    .select("id, name, status, start_date, end_date")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data } = await q;
  return data || [];
}

export default async function DashboardPage() {
  const workspace = await getUserWorkspace();
  const stats = await getStats(workspace?.workspaceId);
  const activeCycles = await getActiveCycles(workspace?.workspaceId);
  const isManager = isManagerOrAbove(workspace?.role);

  const firstName = workspace?.name?.split(" ")[0] || "there";

  const metrics = [
    {
      label: "Active Reviews",
      value: stats.activeReviews,
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
    },
    {
      label: "Total Reviews",
      value: stats.totalReviews,
      icon: FileText,
      color: "text-primary bg-primary/[0.08]",
    },
    {
      label: "Feedback Given",
      value: stats.totalFeedback,
      icon: MessageSquare,
      color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
    },
    {
      label: "Team Members",
      value: stats.totalUsers,
      icon: Users,
      color: "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
    },
  ];

  const quickLinks = [
    { href: "/dashboard/my-reviews", label: "My Reviews", icon: ClipboardCheck, description: "View your performance reviews and pending actions" },
    { href: "/dashboard/goals", label: "Goals", icon: Crosshair, description: "Track and manage your goals" },
    { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquare, description: "See feedback you've given and received" },
    ...(isManager
      ? [
          { href: "/dashboard/cycles", label: "Cycles", icon: CalendarClock, description: "Manage performance review cycles" },
          { href: "/dashboard/competencies", label: "Competencies", icon: Target, description: "Define and track competency frameworks" },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Hey {firstName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here&apos;s what&apos;s happening in your workspace.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
                  <p className="text-2xl font-semibold mt-1 text-foreground">{m.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${m.color}`}>
                  <m.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Quick Links */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Quick access
          </h2>
          <div className="grid gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-4 p-3.5 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
                  <link.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{link.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Active Cycles */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Active cycles
          </h2>
          <Card className="border-border/60">
            <CardContent className="pt-5">
              {activeCycles.length === 0 ? (
                <div className="text-center py-6">
                  <CalendarClock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No active cycles</p>
                  {isManager && (
                    <Button variant="outline" size="sm" className="mt-3" asChild>
                      <Link href="/dashboard/cycles/new">Create cycle</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCycles.map((cycle: any) => (
                    <Link
                      key={cycle.id}
                      href={`/dashboard/cycles/${cycle.id}`}
                      className="block p-3 rounded-lg border border-border/60 hover:border-border hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <p className="text-sm font-medium text-foreground truncate">{cycle.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-4">
                        {new Date(cycle.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" — "}
                        {new Date(cycle.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
