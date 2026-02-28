import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, Target, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { isManagerOrAbove } from "@/lib/roles";

async function getGoals(workspaceId: string | undefined, isManager: boolean, appUserId: string | undefined) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("goals")
    .select(`
      *,
      employee:users!goals_employee_id_fkey(id, slack_name, department),
      cycle:performance_cycles!goals_cycle_id_fkey(name)
    `)
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data } = await query;
  return data || [];
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: Clock },
  active: { label: "Active", color: "bg-primary/20 text-primary", icon: Target },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: AlertCircle },
};

export default async function GoalsPage() {
  const workspace = await getUserWorkspace();
  const isManager = isManagerOrAbove(workspace?.role);
  const goals = await getGoals(workspace?.workspaceId, isManager, workspace?.appUserId);

  // Group by employee for managers, flat list for employees
  const groupedByEmployee: Record<string, { name: string; goals: any[] }> = {};
  goals.forEach((goal: any) => {
    const empName = goal.employee?.slack_name || "Unknown";
    const empId = goal.employee?.id || "unknown";
    if (!groupedByEmployee[empId]) {
      groupedByEmployee[empId] = { name: empName, goals: [] };
    }
    groupedByEmployee[empId].goals.push(goal);
  });

  const stats = {
    total: goals.length,
    active: goals.filter((g: any) => g.status === "active").length,
    completed: goals.filter((g: any) => g.status === "completed").length,
    avgProgress: goals.length > 0 ? Math.round(goals.reduce((sum: number, g: any) => sum + (g.progress || 0), 0) / goals.length) : 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Goals</h1>
          <p className="text-muted-foreground mt-2">Track objectives and key results</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/goals/new">
            <Plus className="h-4 w-4 mr-2" />
            New Goal
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Goals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.avgProgress}%</div>
            <p className="text-sm text-muted-foreground">Avg Progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="mb-4">No goals set yet. Create goals to track objectives.</p>
            <Button asChild>
              <Link href="/dashboard/goals/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Goal
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByEmployee).map(([empId, { name, goals: empGoals }]) => (
          <Card key={empId}>
            <CardHeader>
              <CardTitle className="text-lg">{name}</CardTitle>
              <CardDescription>{empGoals.length} goal{empGoals.length !== 1 ? "s" : ""}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {empGoals.map((goal: any) => {
                  const config = statusConfig[goal.status] || statusConfig.draft;
                  return (
                    <div key={goal.id} className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium">{goal.title}</h3>
                          {goal.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{goal.description}</p>
                          )}
                        </div>
                        <Badge className={config.color}>{config.label}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex-1">
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-2 transition-all duration-300"
                              style={{ width: `${goal.progress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{goal.progress}%</span>
                        {goal.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Due {format(new Date(goal.due_date), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      {goal.cycle?.name && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">{goal.cycle.name}</Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
