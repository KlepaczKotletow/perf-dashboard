import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { BarChart3, TrendingUp, Star, Users, Lock, Grid3X3 } from "lucide-react";
import { isManagerOrAbove } from "@/lib/roles";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsCharts, type AnalyticsChartsData } from "./analytics-charts";
import { STATUS_COLORS } from "@/components/charts/chart-utils";

async function getAnalyticsData() {
  const supabase = await createServerSupabaseClient();

  // 1. All review responses with competency info (modern system)
  const { data: responses } = await supabase
    .from("review_responses")
    .select(`
      id, rating, comment, created_at,
      competency:competencies(name, category),
      assignment:review_assignments!review_responses_assignment_id_fkey(
        id, employee_id, status
      )
    `)
    .not("rating", "is", null);

  // 2. All review assignments for completion rate
  const { data: assignments } = await supabase
    .from("review_assignments")
    .select("id, status, employee_id");

  // 3. Users with department info
  const { data: usersWithDept } = await supabase
    .from("users")
    .select("id, department, slack_name");

  // 4. Performance cycles stats (already modern)
  const { data: perfCycles } = await supabase
    .from("performance_cycles")
    .select("id, name, status");

  const allResponses = responses || [];
  const allAssignments = assignments || [];
  const userMap = new Map((usersWithDept || []).map(u => [u.id, u]));

  // --- Skill averages (by competency name) ---
  const skillRatings: Record<string, number[]> = {};
  allResponses.forEach((r: any) => {
    const compName = r.competency?.name;
    if (r.rating && compName) {
      if (!skillRatings[compName]) skillRatings[compName] = [];
      skillRatings[compName].push(r.rating);
    }
  });

  const skillAverages = Object.entries(skillRatings).map(([name, ratings]) => ({
    name,
    avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
    count: ratings.length,
  }));

  // --- Overall average rating ---
  const allRatings = allResponses.filter((r: any) => r.rating).map((r: any) => r.rating as number);
  const overallAvg = allRatings.length > 0
    ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
    : 0;

  // --- Rating distribution (1-5) ---
  const ratingDistribution = [0, 0, 0, 0, 0];
  allRatings.forEach(r => {
    const idx = Math.min(Math.max(r - 1, 0), 4);
    ratingDistribution[idx]++;
  });

  // --- Completion rate (from review_assignments) ---
  const totalAssignments = allAssignments.length;
  const completedAssignments = allAssignments.filter((a: any) => a.status === "completed").length;
  const completionRate = totalAssignments > 0
    ? Math.round((completedAssignments / totalAssignments) * 100)
    : 0;

  // --- Monthly trend (from review_responses created_at) ---
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyData: Record<string, number> = {};
  allResponses.forEach((r: any) => {
    if (r.created_at && new Date(r.created_at) >= sixMonthsAgo) {
      const month = new Date(r.created_at).toLocaleString("default", { month: "short", year: "2-digit" });
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    }
  });

  // --- Per-employee average ratings (for 9-box grid) ---
  const employeeRatings: Record<string, number[]> = {};
  allResponses.forEach((r: any) => {
    const empId = r.assignment?.employee_id;
    if (r.rating && empId) {
      if (!employeeRatings[empId]) employeeRatings[empId] = [];
      employeeRatings[empId].push(r.rating);
    }
  });

  const nineBoxData: { name: string; department: string; avgRating: number; reviewCount: number; id: string }[] = [];
  Object.entries(employeeRatings).forEach(([empId, ratings]) => {
    const user = userMap.get(empId);
    if (user && ratings.length > 0) {
      nineBoxData.push({
        id: empId,
        name: user.slack_name || "Unknown",
        department: user.department || "Unassigned",
        avgRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
        reviewCount: ratings.length,
      });
    }
  });

  // --- Department averages ---
  const deptAverages: Record<string, { ratings: number[]; count: number }> = {};
  nineBoxData.forEach(emp => {
    if (!deptAverages[emp.department]) deptAverages[emp.department] = { ratings: [], count: 0 };
    deptAverages[emp.department].ratings.push(emp.avgRating);
    deptAverages[emp.department].count++;
  });

  const departmentStats = Object.entries(deptAverages).map(([dept, data]) => ({
    department: dept,
    avgRating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
    employeeCount: data.count,
  })).sort((a, b) => b.avgRating - a.avgRating);

  // --- Cycle stats (already modern) ---
  const cycleStats = {
    total: perfCycles?.length || 0,
    active: perfCycles?.filter(c => c.status === "active").length || 0,
    completed: perfCycles?.filter(c => c.status === "completed").length || 0,
  };

  // --- Goal tracking status distribution ---
  const { data: goalsData } = await supabase
    .from("goals")
    .select("id, tracking_status, status");
  const activeGoals = (goalsData || []).filter((g: any) => g.status === "active" || g.status === "draft");
  const trackingCounts: Record<string, number> = { on_track: 0, at_risk: 0, delayed: 0, achieved: 0 };
  activeGoals.forEach((g: any) => {
    // Skip goals with no tracking status rather than silently inflating on_track
    if (g.tracking_status && g.tracking_status in trackingCounts) {
      trackingCounts[g.tracking_status]++;
    }
  });
  const goalStatusDistribution = Object.entries(trackingCounts).map(([key, value]) => ({
    name: STATUS_COLORS[key as keyof typeof STATUS_COLORS]?.label || key,
    value,
    color: STATUS_COLORS[key as keyof typeof STATUS_COLORS]?.fill || "#a1a1aa",
  }));

  // --- Build chart data ---
  const ratingColors: Record<number, string> = {
    1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#22c55e", 5: "#10b981",
  };
  const chartRatingDistribution = ratingDistribution.map((count, idx) => ({
    name: `${idx + 1}`,
    value: count,
    color: ratingColors[idx + 1],
  }));

  const chartCompetencyRatings = skillAverages
    .sort((a, b) => b.avg - a.avg)
    .map((s) => ({ name: s.name, value: s.avg }));

  // Monthly trend for charts (last 6 months, ordered)
  const chartResponseTrend: { name: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
    chartResponseTrend.push({ name: key, value: monthlyData[key] || 0 });
  }

  const chartDeptPerformance = departmentStats.map((d) => ({
    name: d.department,
    value: d.avgRating,
  }));

  const chartsData: AnalyticsChartsData = {
    ratingDistribution: chartRatingDistribution,
    competencyRatings: chartCompetencyRatings,
    responseTrend: chartResponseTrend,
    departmentPerformance: chartDeptPerformance,
    goalStatusDistribution,
  };

  return {
    skillAverages,
    overallAvg: overallAvg.toFixed(1),
    ratingDistribution,
    completionRate,
    totalFeedback: allRatings.length,
    monthlyData,
    nineBoxData,
    departmentStats,
    cycleStats,
    totalAssignments,
    completedAssignments,
    chartsData,
  };
}

// Performance tier based on average rating
function getPerformanceTier(avgRating: number): { label: string; color: string } {
  if (avgRating >= 4.5) return { label: "Exceptional", color: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" };
  if (avgRating >= 4.0) return { label: "Strong", color: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-400/10" };
  if (avgRating >= 3.0) return { label: "Solid", color: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" };
  return { label: "Needs Dev", color: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" };
}

export default async function AnalyticsPage() {
  const workspace = await getUserWorkspace();

  if (!isManagerOrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Analytics are only available to managers and administrators.
          Contact your workspace admin if you need access.
        </p>
        <Button asChild><Link href="/dashboard">Go to Dashboard</Link></Button>
      </div>
    );
  }

  const analytics = await getAnalyticsData();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance insights for {workspace?.workspaceName || "your workspace"}
          </p>
        </div>
      </div>

      {/* Top-level Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overallAvg}/5</div>
            <p className="text-xs text-muted-foreground">Average across all competencies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.completedAssignments}/{analytics.totalAssignments} assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ratings</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalFeedback}</div>
            <p className="text-xs text-muted-foreground">Review response ratings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Competencies</CardTitle>
            <Grid3X3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.skillAverages.length}</div>
            <p className="text-xs text-muted-foreground">Tracked competency areas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cycles</CardTitle>
            <Users className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.cycleStats.active}</div>
            <p className="text-xs text-muted-foreground">{analytics.cycleStats.total} total</p>
          </CardContent>
        </Card>
      </div>

      {analytics.totalFeedback === 0 && analytics.totalAssignments === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No review data yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Analytics will populate once performance cycles are launched and employees submit reviews.
            </p>
            <Button asChild className="mt-5" variant="outline" size="sm">
              <Link href="/dashboard/cycles">Go to Cycles</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <AnalyticsCharts data={analytics.chartsData} />

      {/* Performance Ranking */}
      {analytics.nineBoxData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Performance Ranking
            </CardTitle>
            <CardDescription>
              Employees ranked by average review rating across all competencies.
              Tier is derived from rating: Exceptional ≥ 4.5 · Strong ≥ 4.0 · Solid ≥ 3.0 · Needs Dev &lt; 3.0.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="w-[180px]">Avg Rating</TableHead>
                    <TableHead className="w-[80px] text-right">Reviews</TableHead>
                    <TableHead className="w-[120px]">Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.nineBoxData
                    .sort((a, b) => b.avgRating - a.avgRating)
                    .map((emp, idx) => {
                      const tier = getPerformanceTier(emp.avgRating);
                      const pct = Math.round((emp.avgRating / 5) * 100);
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <Link href={`/dashboard/team/${emp.id}`} className="font-medium text-foreground hover:underline">
                              {emp.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {emp.department}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                                <div
                                  className="h-full bg-yellow-400 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold tabular-nums">
                                {emp.avgRating.toFixed(1)}
                              </span>
                              <span className="text-xs text-muted-foreground">/5</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground text-right tabular-nums">
                            {emp.reviewCount}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[11px] font-medium ${tier.color}`}>
                              {tier.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
