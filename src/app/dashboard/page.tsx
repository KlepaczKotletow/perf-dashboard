import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
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
  Target,
  CheckCircle2,
  Circle,
  Slack,
  GitBranch,
  Layers,
  Rocket,
} from "lucide-react";
import { isManagerOrAbove, canManageUsers } from "@/lib/roles";

async function getStats(workspaceId: string | undefined) {
  const supabase = await createServerSupabaseClient();

  const [reviewsRes, feedbackRes, usersRes, activeRes] = await Promise.all([
    supabase.from("review_assignments").select("*", { count: "exact", head: true }),
    supabase.from("continuous_feedback").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("performance_cycles").select("*", { count: "exact", head: true }).eq("status", "active"),
  ]);

  return {
    totalReviews: reviewsRes.count || 0,
    activeCycles: activeRes.count || 0,
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

async function getSetupStatus(workspaceId: string | undefined) {
  if (!workspaceId) return { users: 0, competencies: 0, cycles: 0, hasManagers: false };
  const supabase = await createServerSupabaseClient();

  const [usersRes, compRes, cyclesRes, managersRes] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("competencies").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("performance_cycles").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).not("manager_id", "is", null),
  ]);

  return {
    users: usersRes.count || 0,
    competencies: compRes.count || 0,
    cycles: cyclesRes.count || 0,
    hasManagers: (managersRes.count || 0) > 0,
  };
}

export default async function DashboardPage() {
  const workspace = await getUserWorkspace();
  const stats = await getStats(workspace?.workspaceId);
  const activeCycles = await getActiveCycles(workspace?.workspaceId);
  const setup = await getSetupStatus(workspace?.workspaceId);
  const isManager = isManagerOrAbove(workspace?.role);
  const isAdmin = canManageUsers(workspace?.role);

  const firstName = workspace?.name?.split(" ")[0] || "there";

  // Determine if we should show onboarding vs normal dashboard
  const setupComplete = setup.users >= 2 && setup.competencies > 0 && setup.cycles > 0;
  const showOnboarding = isAdmin && !setupComplete;

  const steps = [
    {
      id: "sync",
      label: "Sync your team",
      description: "Import members from your Slack workspace",
      href: "/dashboard/team",
      icon: Slack,
      done: setup.users >= 2,
    },
    {
      id: "org",
      label: "Set up org structure",
      description: "Assign managers, departments, and job levels to each team member",
      href: "/dashboard/team",
      icon: GitBranch,
      done: setup.hasManagers,
    },
    {
      id: "competencies",
      label: "Define competencies",
      description: "Create the skills and behaviors your org values",
      href: "/dashboard/competencies",
      icon: Target,
      done: setup.competencies > 0,
    },
    {
      id: "matrix",
      label: "Map competencies to levels",
      description: "Set expected proficiency per role in the competency matrix",
      href: "/dashboard/competencies/matrix",
      icon: Layers,
      done: setup.competencies > 0 && setup.hasManagers,
    },
    {
      id: "cycle",
      label: "Launch your first review cycle",
      description: "Create a performance review cycle and notify your team",
      href: "/dashboard/cycles/new",
      icon: Rocket,
      done: setup.cycles > 0,
    },
  ];

  const completedSteps = steps.filter((s) => s.done).length;

  const metrics = [
    {
      label: "Active Cycles",
      value: stats.activeCycles,
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
    },
    {
      label: "Review Assignments",
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
          {showOnboarding
            ? "Let's get your workspace set up. Follow the steps below to start running reviews."
            : "Here's what's happening in your workspace."}
        </p>
      </div>

      {/* Onboarding Checklist (for admins with incomplete setup) */}
      {showOnboarding && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Setup Checklist</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {completedSteps} of {steps.length} steps complete
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {steps.map((s) => (
                  <div
                    key={s.id}
                    className={`h-1.5 w-6 rounded-full transition-colors ${
                      s.done ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              {steps.map((step) => (
                <Link
                  key={step.id}
                  href={step.href}
                  className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${
                    step.done
                      ? "opacity-60"
                      : "hover:bg-primary/[0.04] hover:shadow-sm"
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                  </div>
                  {!step.done && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
