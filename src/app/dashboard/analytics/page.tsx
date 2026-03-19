import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { BarChart3, TrendingUp, Star, Users, Lock, Grid3X3 } from "lucide-react";
import { isManagerOrAbove } from "@/lib/roles";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsCharts, type AnalyticsChartsData } from "./analytics-charts";
import { AnalyticsTrends, type TrendsData } from "./analytics-trends";
import { AnalyticsFilterBar } from "./analytics-filter-bar";
import { AnalyticsTabNav } from "./analytics-tab-nav";
import { STATUS_COLORS } from "@/components/charts/chart-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FilterParams {
  cycleId: string | null;
  functionId: string | null;
  department: string | null;
}

// ─── Heatmap types ────────────────────────────────────────────────────────────

type HeatmapDim = "role" | "department" | "level" | "tenure";

interface HeatmapCell {
  sum: number;
  count: number;
}

interface HeatmapData {
  competencies: string[];          // sorted alphabetically
  groups: string[];                // sorted alphabetically
  cells: Record<string, HeatmapCell>;           // key: `${comp}::${group}`
  overallByGroup: Record<string, HeatmapCell>;  // "Overall" row
  overallByComp: Record<string, HeatmapCell>;   // "All" column
  grandTotal: HeatmapCell;
}

// ─── Heatmap helpers ──────────────────────────────────────────────────────────

function getTenureBucket(hireDate: string | null | undefined): string {
  if (!hireDate) return "Unknown";
  const ms = Date.now() - new Date(hireDate).getTime();
  const years = ms / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) return "< 1yr";
  if (years < 2) return "1–2yr";
  if (years < 5) return "2–5yr";
  return "5yr+";
}

function heatmapCellClass(avg: number | null): string {
  if (avg === null) return "";
  if (avg >= 4.5) return "bg-emerald-50 dark:bg-emerald-950/40";
  if (avg >= 3.5) return "bg-primary/5 dark:bg-primary/10";
  if (avg >= 2.5) return "bg-amber-50 dark:bg-amber-950/40";
  return "bg-red-50 dark:bg-red-950/40";
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getFilterOptions() {
  const supabase = await createServerSupabaseClient();

  const [{ data: cycles }, { data: functions }, { data: users }] = await Promise.all([
    supabase
      .from("performance_cycles")
      .select("id, name, status")
      .order("created_at", { ascending: false }),
    supabase
      .from("job_families")
      .select("id, name")
      .order("name"),
    supabase
      .from("users")
      .select("department"),
  ]);

  const departments = [...new Set((users || []).map((u: any) => u.department).filter(Boolean))].sort() as string[];

  return {
    cycles: cycles || [],
    functions: functions || [],
    departments,
  };
}

async function getAnalyticsData(filters: FilterParams) {
  const supabase = await createServerSupabaseClient();

  // 1. Users — with level → job_family join for function breakdown
  const { data: usersData } = await supabase
    .from("users")
    .select("id, department, slack_name, level_id, level:levels!users_level_id_fkey(name, job_family_id, job_family:job_families(name))");

  const allUsers = usersData || [];

  // Apply department filter to user list
  const filteredUsers = filters.department
    ? allUsers.filter((u: any) => u.department === filters.department)
    : allUsers;

  // Apply function filter to user list (via level → job_family_id)
  const functionFilteredUsers = filters.functionId
    ? filteredUsers.filter((u: any) => u.level?.job_family_id === filters.functionId)
    : filteredUsers;

  const filteredUserIds = new Set(functionFilteredUsers.map((u: any) => u.id));
  const userMap = new Map(allUsers.map((u: any) => [u.id, u]));

  // 2. Assignments — optionally filtered by cycle
  let assignmentsQuery = supabase
    .from("review_assignments")
    .select("id, status, employee_id, cycle_id");

  if (filters.cycleId) {
    assignmentsQuery = assignmentsQuery.eq("cycle_id", filters.cycleId);
  }

  const { data: assignmentsRaw } = await assignmentsQuery;
  const assignments = (assignmentsRaw || []).filter((a: any) => filteredUserIds.has(a.employee_id));

  const assignmentIds = new Set(assignments.map((a: any) => a.id));
  const assignmentEmployeeMap = new Map(assignments.map((a: any) => [a.id, a.employee_id]));

  // 3. Review responses for those assignments
  const { data: responsesRaw } = await supabase
    .from("review_responses")
    .select("id, rating, assignment_id, competency:competencies(name, category)")
    .not("rating", "is", null);

  const responses = (responsesRaw || []).filter((r: any) => assignmentIds.has(r.assignment_id));

  // 4. Goals (not filtered by cycle — workspace-wide)
  const { data: goalsData } = await supabase
    .from("goals")
    .select("id, tracking_status, status");

  // 5. All cycles (for cycle stats tile)
  const { data: allCycles } = await supabase
    .from("performance_cycles")
    .select("id, status");

  // ── Derived metrics ──

  const allRatings = responses.map((r: any) => r.rating as number);
  const overallAvg = allRatings.length > 0
    ? allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length
    : 0;

  // Rating distribution 1–5
  const ratingDist = [0, 0, 0, 0, 0];
  allRatings.forEach((r: number) => { ratingDist[Math.min(Math.max(r - 1, 0), 4)]++; });

  // Completion rate
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a: any) => a.status === "completed").length;
  const completionRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  // Participants (distinct employees in filtered assignments)
  const participants = new Set(assignments.map((a: any) => a.employee_id)).size;

  // Competency averages
  const compRatings: Record<string, number[]> = {};
  responses.forEach((r: any) => {
    const name = r.competency?.name;
    if (name) {
      if (!compRatings[name]) compRatings[name] = [];
      compRatings[name].push(r.rating);
    }
  });

  const competencyRatings = Object.entries(compRatings)
    .map(([name, vals]) => ({ name, value: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => b.value - a.value);

  // Per-employee averages
  const empRatings: Record<string, number[]> = {};
  responses.forEach((r: any) => {
    const empId = assignmentEmployeeMap.get(r.assignment_id);
    if (empId) {
      if (!empRatings[empId]) empRatings[empId] = [];
      empRatings[empId].push(r.rating);
    }
  });

  const rankingData = Object.entries(empRatings).map(([empId, ratings]) => {
    const user = userMap.get(empId) as any;
    return {
      id: empId,
      name: user?.slack_name || "Unknown",
      department: user?.department || "—",
      functionName: (user?.level as any)?.job_family?.name || "—",
      levelName: (user?.level as any)?.name || "—",
      avgRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      reviewCount: ratings.length,
    };
  }).sort((a, b) => b.avgRating - a.avgRating);

  // Function performance (avg per job_family)
  const funcRatings: Record<string, number[]> = {};
  rankingData.forEach((emp) => {
    if (emp.functionName !== "—") {
      if (!funcRatings[emp.functionName]) funcRatings[emp.functionName] = [];
      funcRatings[emp.functionName].push(emp.avgRating);
    }
  });
  const functionPerformance = Object.entries(funcRatings)
    .map(([name, vals]) => ({ name, value: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => b.value - a.value);

  // Department performance
  const deptRatings: Record<string, number[]> = {};
  rankingData.forEach((emp) => {
    const dept = emp.department;
    if (dept !== "—") {
      if (!deptRatings[dept]) deptRatings[dept] = [];
      deptRatings[dept].push(emp.avgRating);
    }
  });
  const departmentPerformance = Object.entries(deptRatings)
    .map(([name, vals]) => ({ name, value: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => b.value - a.value);

  // Goal status
  const activeGoals = (goalsData || []).filter((g: any) => g.status === "active" || g.status === "draft");
  const trackingCounts: Record<string, number> = { on_track: 0, at_risk: 0, delayed: 0, achieved: 0 };
  activeGoals.forEach((g: any) => {
    if (g.tracking_status && g.tracking_status in trackingCounts) {
      trackingCounts[g.tracking_status]++;
    }
  });
  const goalStatusDistribution = Object.entries(trackingCounts).map(([key, value]) => ({
    name: STATUS_COLORS[key as keyof typeof STATUS_COLORS]?.label || key,
    value,
    color: STATUS_COLORS[key as keyof typeof STATUS_COLORS]?.fill || "#a1a1aa",
  }));

  // Rating distribution for charts
  const ratingColors: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#22c55e", 5: "#10b981" };
  const chartRatingDistribution = ratingDist.map((count, idx) => ({
    name: `${idx + 1}`,
    value: count,
    color: ratingColors[idx + 1],
  }));

  const chartsData: AnalyticsChartsData = {
    ratingDistribution: chartRatingDistribution,
    functionPerformance,
    departmentPerformance,
    competencyRatings,
    goalStatusDistribution,
  };

  return {
    overallAvg: overallAvg.toFixed(1),
    completionRate,
    totalRatings: allRatings.length,
    participants,
    totalAssignments,
    completedAssignments,
    cycleStats: {
      active: (allCycles || []).filter((c: any) => c.status === "active").length,
      total: (allCycles || []).length,
    },
    rankingData,
    chartsData,
  };
}

async function getTrendsData(filters: Omit<FilterParams, "cycleId">): Promise<TrendsData> {
  const supabase = await createServerSupabaseClient();

  const { data: cycles } = await supabase
    .from("performance_cycles")
    .select("id, name, status")
    .in("status", ["completed", "active"])
    .order("created_at", { ascending: false })
    .limit(6);

  const recentCycles = (cycles || []).reverse();

  if (recentCycles.length === 0) return { ratingTrend: [], completionTrend: [] };

  const { data: usersData } = await supabase
    .from("users")
    .select("id, department, level:levels!users_level_id_fkey(job_family_id)");

  const filteredUserIds = new Set(
    (usersData || [])
      .filter((u: any) => {
        if (filters.department && u.department !== filters.department) return false;
        if (filters.functionId && u.level?.job_family_id !== filters.functionId) return false;
        return true;
      })
      .map((u: any) => u.id)
  );

  // Batch: fetch all assignments for all cycles at once
  const cycleIds = recentCycles.map((c: any) => c.id);
  const { data: allAssignmentsRaw } = await supabase
    .from("review_assignments")
    .select("id, status, employee_id, cycle_id")
    .in("cycle_id", cycleIds);

  const allAssignments = (allAssignmentsRaw || []).filter((a: any) => filteredUserIds.has(a.employee_id));
  const allAssignmentIds = allAssignments.map((a: any) => a.id);

  // Batch: fetch all responses for all assignments at once
  let allResponses: any[] = [];
  if (allAssignmentIds.length > 0) {
    const { data: responsesRaw } = await supabase
      .from("review_responses")
      .select("rating, assignment_id")
      .in("assignment_id", allAssignmentIds)
      .not("rating", "is", null);
    allResponses = responsesRaw || [];
  }

  // Build lookup maps
  const assignmentsByCycle = new Map<string, typeof allAssignments>();
  for (const a of allAssignments) {
    const list = assignmentsByCycle.get(a.cycle_id) || [];
    list.push(a);
    assignmentsByCycle.set(a.cycle_id, list);
  }

  const responsesByAssignment = new Map<string, number[]>();
  for (const r of allResponses) {
    const list = responsesByAssignment.get(r.assignment_id) || [];
    list.push(r.rating as number);
    responsesByAssignment.set(r.assignment_id, list);
  }

  const ratingTrend: { name: string; value: number }[] = [];
  const completionTrend: { name: string; value: number }[] = [];

  for (const cycle of recentCycles) {
    const cycleAssignments = assignmentsByCycle.get(cycle.id) || [];
    const total = cycleAssignments.length;
    const completed = cycleAssignments.filter((a: any) => a.status === "completed").length;

    const cycleRatings = cycleAssignments.flatMap((a: any) => responsesByAssignment.get(a.id) || []);
    const avgRating = cycleRatings.length > 0
      ? cycleRatings.reduce((a: number, b: number) => a + b, 0) / cycleRatings.length
      : 0;

    ratingTrend.push({ name: cycle.name, value: parseFloat(avgRating.toFixed(2)) });
    completionTrend.push({
      name: cycle.name,
      value: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  }

  return { ratingTrend, completionTrend };
}

async function getHeatmapData(filters: FilterParams, dim: HeatmapDim): Promise<HeatmapData> {
  const supabase = await createServerSupabaseClient();

  // 1. Fetch users with dimension fields
  const { data: usersRaw } = await supabase
    .from("users")
    .select("id, role, department, hire_date, level:levels!users_level_id_fkey(name)");

  const userMap = new Map(
    (usersRaw || []).map((u: any) => {
      let groupValue: string;
      if (dim === "role") groupValue = u.role || "Unknown";
      else if (dim === "department") groupValue = u.department || "Unknown";
      else if (dim === "level") groupValue = (u.level as any)?.name || "Unknown";
      else groupValue = getTenureBucket(u.hire_date);
      return [u.id as string, groupValue];
    })
  );

  // 2. Fetch responses with competency name and assignment employee_id
  const { data: responsesRaw } = await supabase
    .from("review_responses")
    .select("rating, competency:competencies(name), assignment:review_assignments!inner(employee_id, cycle_id)")
    .not("rating", "is", null);

  const responses = (responsesRaw || []).filter((r: any) => {
    if (filters.cycleId && (r.assignment as any)?.cycle_id !== filters.cycleId) return false;
    const empId = (r.assignment as any)?.employee_id;
    if (!empId) return false;
    return userMap.has(empId);
  });

  // 3. Aggregate
  const cells: Record<string, HeatmapCell> = {};
  const overallByGroup: Record<string, HeatmapCell> = {};
  const overallByComp: Record<string, HeatmapCell> = {};
  const grandTotal: HeatmapCell = { sum: 0, count: 0 };
  const competencySet = new Set<string>();
  const groupSet = new Set<string>();

  function accumulate(cell: HeatmapCell, rating: number) {
    cell.sum += rating;
    cell.count += 1;
  }

  for (const r of responses) {
    const comp = (r.competency as any)?.name as string | undefined;
    const empId = (r.assignment as any)?.employee_id as string;
    const group = userMap.get(empId);
    const rating = r.rating as number;

    if (!comp || !group) continue;

    competencySet.add(comp);
    groupSet.add(group);

    const cellKey = `${comp}::${group}`;
    if (!cells[cellKey]) cells[cellKey] = { sum: 0, count: 0 };
    accumulate(cells[cellKey], rating);

    if (!overallByGroup[group]) overallByGroup[group] = { sum: 0, count: 0 };
    accumulate(overallByGroup[group], rating);

    if (!overallByComp[comp]) overallByComp[comp] = { sum: 0, count: 0 };
    accumulate(overallByComp[comp], rating);

    accumulate(grandTotal, rating);
  }

  return {
    competencies: [...competencySet].sort(),
    groups: [...groupSet].sort(),
    cells,
    overallByGroup,
    overallByComp,
    grandTotal,
  };
}

// ─── Performance tier helper ──────────────────────────────────────────────────

function getPerformanceTier(avgRating: number): { label: string; color: string } {
  if (avgRating >= 4.5) return { label: "Exceptional", color: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" };
  if (avgRating >= 4.0) return { label: "Strong", color: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-400/10" };
  if (avgRating >= 3.0) return { label: "Solid", color: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10" };
  return { label: "Needs Dev", color: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycleId?: string; functionId?: string; department?: string; tab?: string; heatmap_dim?: string }>;
}) {
  const workspace = await getUserWorkspace();

  if (!isManagerOrAbove(workspace?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Analytics are only available to managers and administrators.
        </p>
        <Button asChild><Link href="/dashboard">Go to Dashboard</Link></Button>
      </div>
    );
  }

  const params = await searchParams;
  const activeTab = (params.tab === "heatmap" ? "heatmap" : "overview") as "overview" | "heatmap";
  const filters: FilterParams = {
    cycleId: params.cycleId || null,
    functionId: params.functionId || null,
    department: params.department || null,
  };
  const heatmapDim = (["role", "department", "level", "tenure"].includes(params.heatmap_dim || "")
    ? params.heatmap_dim
    : "role") as HeatmapDim;

  const [filterOptions, analytics, trends] = await Promise.all([
    getFilterOptions(),
    getAnalyticsData(filters),
    getTrendsData({ functionId: filters.functionId, department: filters.department }),
  ]);
  const heatmapData = activeTab === "heatmap"
    ? await getHeatmapData(filters, heatmapDim)
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Performance insights for {workspace?.workspaceName || "your workspace"}
        </p>
      </div>

      {/* Tab nav */}
      <Suspense fallback={null}>
        <AnalyticsTabNav activeTab={activeTab} />
      </Suspense>

      {/* Filter bar */}
      <AnalyticsFilterBar
        cycles={filterOptions.cycles}
        functions={filterOptions.functions}
        departments={filterOptions.departments}
        selectedCycleId={filters.cycleId || ""}
        selectedFunctionId={filters.functionId || ""}
        selectedDepartment={filters.department || ""}
      />

      {activeTab === "overview" && (
        <>
      {/* KPI tiles */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 px-6 pt-6 pb-2">
            <p className="text-sm font-medium">Overall Rating</p>
            <Star className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="px-6 pb-6">
            <div className="text-2xl font-bold">{analytics.overallAvg}/5</div>
            <p className="text-xs text-muted-foreground">Avg across all competencies</p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 px-6 pt-6 pb-2">
            <p className="text-sm font-medium">Completion Rate</p>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="px-6 pb-6">
            <div className="text-2xl font-bold">{analytics.completionRate}%</div>
            <p className="text-xs text-muted-foreground">{analytics.completedAssignments}/{analytics.totalAssignments} assignments</p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 px-6 pt-6 pb-2">
            <p className="text-sm font-medium">Total Ratings</p>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="px-6 pb-6">
            <div className="text-2xl font-bold">{analytics.totalRatings}</div>
            <p className="text-xs text-muted-foreground">Review response ratings</p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 px-6 pt-6 pb-2">
            <p className="text-sm font-medium">Participants</p>
            <Users className="h-4 w-4 text-purple-500" />
          </div>
          <div className="px-6 pb-6">
            <div className="text-2xl font-bold">{analytics.participants}</div>
            <p className="text-xs text-muted-foreground">Employees in scope</p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 px-6 pt-6 pb-2">
            <p className="text-sm font-medium">Active Cycles</p>
            <Grid3X3 className="h-4 w-4 text-orange-500" />
          </div>
          <div className="px-6 pb-6">
            <div className="text-2xl font-bold">{analytics.cycleStats.active}</div>
            <p className="text-xs text-muted-foreground">{analytics.cycleStats.total} total</p>
          </div>
        </Card>
      </div>

      {/* Empty state */}
      {analytics.totalRatings === 0 && analytics.totalAssignments === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No data for this selection</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Try adjusting the filters above, or launch a performance cycle to start collecting data.
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
      {analytics.rankingData.length > 0 && (
        <Card>
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <h2 className="text-base font-semibold">Performance Ranking</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Employees ranked by average rating. Tier: Exceptional ≥ 4.5 · Strong ≥ 4.0 · Solid ≥ 3.0 · Needs Dev &lt; 3.0
            </p>
          </div>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Function</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="w-[180px]">Avg Rating</TableHead>
                    <TableHead className="w-[80px] text-right">Reviews</TableHead>
                    <TableHead className="w-[120px]">Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.rankingData.map((emp, idx) => {
                    const tier = getPerformanceTier(emp.avgRating);
                    const pct = Math.round((emp.avgRating / 5) * 100);
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="text-sm text-muted-foreground font-mono">{idx + 1}</TableCell>
                        <TableCell>
                          <Link href={`/dashboard/team/${emp.id}`} className="font-medium text-foreground hover:underline">
                            {emp.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{emp.functionName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{emp.levelName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{emp.department}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                              <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm font-semibold tabular-nums">{emp.avgRating.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">/5</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground text-right tabular-nums">{emp.reviewCount}</TableCell>
                        <TableCell>
                          <Badge className={`text-[11px] font-medium ${tier.color}`}>{tier.label}</Badge>
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

      {/* Trends (cross-cycle) */}
      <AnalyticsTrends data={trends} />
        </>
      )}

      {activeTab === "heatmap" && (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Heatmap coming in next step…</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
