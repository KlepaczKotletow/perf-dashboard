import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { BarChart3, TrendingUp, Star, Users, Lock, Grid3X3 } from "lucide-react";
import { isManagerOrAbove } from "@/lib/roles";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  };
}

const ratingColors: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-yellow-500",
  4: "bg-green-500",
  5: "bg-emerald-500",
};

// 9-box grid mapping
function getNineBoxCell(rating: number, potential: number): { label: string; color: string } {
  const perf = rating >= 4 ? "high" : rating >= 3 ? "mid" : "low";
  const pot = potential >= 10 ? "high" : potential >= 5 ? "mid" : "low";

  const map: Record<string, { label: string; color: string }> = {
    "high-high": { label: "Star", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    "high-mid": { label: "High Performer", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    "high-low": { label: "Solid Performer", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    "mid-high": { label: "High Potential", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    "mid-mid": { label: "Core Player", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
    "mid-low": { label: "Needs Support", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
    "low-high": { label: "Enigma", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
    "low-mid": { label: "Underperformer", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    "low-low": { label: "Risk", color: "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300" },
  };
  return map[`${perf}-${pot}`] || map["mid-mid"];
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Skill Ratings Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Competency Ratings</CardTitle>
            <CardDescription>Average ratings by competency area</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.skillAverages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No rated responses yet</p>
            ) : (
              analytics.skillAverages
                .sort((a, b) => b.avg - a.avg)
                .map((skill) => (
                  <div key={skill.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[200px]">{skill.name}</span>
                      <span className="text-muted-foreground">{skill.count} ratings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(skill.avg / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold w-10 text-right">{skill.avg.toFixed(1)}</span>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>How ratings are distributed across all responses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-40">
              {analytics.ratingDistribution.map((count, idx) => {
                const maxCount = Math.max(...analytics.ratingDistribution, 1);
                const heightPct = (count / maxCount) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold">{count}</span>
                    <div className="w-full bg-muted rounded-t-md overflow-hidden" style={{ height: `${Math.max(heightPct, 4)}%` }}>
                      <div className={`w-full h-full ${ratingColors[idx + 1]} rounded-t-md`} />
                    </div>
                    <span className="text-xs text-muted-foreground text-center">{idx + 1}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Response Trend</CardTitle>
            <CardDescription>Review responses over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(analytics.monthlyData).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(analytics.monthlyData).map(([month, count]) => (
                  <div key={month} className="flex items-center justify-between">
                    <span className="text-sm w-20">{month}</span>
                    <div className="flex-1 mx-4">
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full"
                          style={{ width: `${Math.min((count / Math.max(...Object.values(analytics.monthlyData))) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No activity data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Department Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
            <CardDescription>Average ratings by department</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.departmentStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No department data yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.departmentStats.map((dept) => (
                  <div key={dept.department} className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{dept.department}</span>
                      <span className="text-xs text-muted-foreground ml-2">({dept.employeeCount} employees)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="font-bold">{dept.avgRating.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 9-Box Grid */}
      {analytics.nineBoxData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              Talent Grid (9-Box)
            </CardTitle>
            <CardDescription>
              Performance (avg rating) mapped against engagement (review count).
              This view helps identify talent categories for succession planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Avg Rating</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.nineBoxData
                  .sort((a, b) => b.avgRating - a.avgRating)
                  .map((emp) => {
                    const cell = getNineBoxCell(emp.avgRating, emp.reviewCount);
                    return (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <Link href={`/dashboard/team/${emp.id}`} className="font-medium text-primary hover:underline">
                            {emp.name}
                          </Link>
                        </TableCell>
                        <TableCell>{emp.department}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            {emp.avgRating.toFixed(1)}
                          </div>
                        </TableCell>
                        <TableCell>{emp.reviewCount}</TableCell>
                        <TableCell>
                          <Badge className={cell.color}>{cell.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
