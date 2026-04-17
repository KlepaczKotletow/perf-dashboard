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
import { AnalyticsBreakdowns } from "./analytics-breakdowns";
import { AnalyticsFilterBar } from "./analytics-filter-bar";
import { AnalyticsTabNav } from "./analytics-tab-nav";
import { AnalyticsHeatmapDimSwitcher } from "./analytics-heatmap-dim-switcher";
import { AnalyticsCycles } from "./analytics-cycles";
import { AnalyticsExportButton } from "./analytics-export-button";
import { STATUS_COLORS } from "@/components/charts/chart-utils";
import { getHeatmapColor, getHeatmapLegend } from "@/components/charts/heatmap-colors";
import { PageHeader } from "@/components/page-header";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FilterParams {
  cycleId: string | null;
  functionId: string | null;
  department: string | null;
}

// ─── Heatmap types ────────────────────────────────────────────────────────────

type HeatmapDim = "role" | "department" | "level" | "tenure" | "manager";

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

function getEmployeeTenureBucket(
  startDate: string | null | undefined,
  buckets: { min_months: number; max_months: number | null; label: string }[]
): string {
  if (!startDate) return "Not set";
  const ms = Date.now() - new Date(startDate).getTime();
  const months = ms / (1000 * 60 * 60 * 24 * 30.44);
  for (const b of buckets) {
    if (months >= b.min_months && (b.max_months === null || months < b.max_months)) {
      return b.label;
    }
  }
  return "Not set";
}

// Default rating scale fallback (1–5)
const DEFAULT_RATING_SCALE = { min: 1, max: 5, labels: { "1": "1", "2": "2", "3": "3", "4": "4", "5": "5" } };

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getFilterOptions(workspaceId: string | undefined) {
  if (!workspaceId) return { cycles: [], functions: [], departments: [] };
  const supabase = await createServerSupabaseClient();

  let cyclesQ = supabase.from("performance_cycles").select("id, name, status").order("created_at", { ascending: false });
  let functionsQ = supabase.from("job_families").select("id, name").order("name");
  let usersQ = supabase.from("users").select("department");

  cyclesQ = cyclesQ.eq("workspace_id", workspaceId);
  functionsQ = functionsQ.eq("workspace_id", workspaceId);
  usersQ = usersQ.eq("workspace_id", workspaceId);

  const [{ data: cycles, error: cyclesErr }, { data: functions, error: functionsErr }, { data: users, error: usersErr }] = await Promise.all([
    cyclesQ,
    functionsQ,
    usersQ,
  ]);
  if (cyclesErr) console.error("Failed to fetch filter cycles:", cyclesErr.message);
  if (functionsErr) console.error("Failed to fetch filter functions:", functionsErr.message);
  if (usersErr) console.error("Failed to fetch filter users:", usersErr.message);

  const departments = [...new Set((users || []).map((u: any) => u.department).filter(Boolean))].sort() as string[];

  return {
    cycles: cycles || [],
    functions: functions || [],
    departments,
  };
}

async function getAnalyticsData(filters: FilterParams, workspaceId: string | undefined) {
  if (!workspaceId) throw new Error("workspaceId required");
  const supabase = await createServerSupabaseClient();

  // 1. Users — with level → job_family join for function breakdown
  let usersQ = supabase
    .from("users")
    .select("id, department, slack_name, level_id, level:levels!users_level_id_fkey(name, job_family_id, job_family:job_families(name))");
  usersQ = usersQ.eq("workspace_id", workspaceId);
  const { data: usersData, error: usersDataErr } = await usersQ;
  if (usersDataErr) console.error("Failed to fetch analytics users:", usersDataErr.message);

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

  // 2. Pre-aggregated analytics via RPCs. Replaces what used to be unbounded
  // SELECTs on review_assignments + review_responses with two focused,
  // workspace-scoped SQL functions. This keeps the page responsive at 500+
  // employees and tens of thousands of review_response rows.
  const [{ data: respAgg }, { data: compAgg }] = await Promise.all([
    supabase.rpc("get_analytics_response_aggregates", {
      p_cycle_id: filters.cycleId,
      p_function_id: filters.functionId,
      p_department: filters.department,
    }),
    supabase.rpc("get_analytics_completion_aggregates", {
      p_cycle_id: filters.cycleId,
      p_function_id: filters.functionId,
      p_department: filters.department,
    }),
  ]);

  type RpcResp = {
    overall: { avg: number | null; n: number };
    distribution: Array<{ rating: number; n: number }>;
    by_competency: Array<{ competency_id: string; name: string | null; category: string | null; avg_rating: number; n: number }>;
    by_employee: Array<{ employee_id: string; avg_rating: number; n: number }>;
    by_department: Array<{ name: string; avg_rating: number; n: number }>;
    by_function: Array<{ name: string; avg_rating: number; n: number }>;
  };
  type RpcComp = {
    overall: { total: number; completed: number; participants: number };
    by_department: Array<{ name: string; total: number; completed: number }>;
    by_function: Array<{ name: string; total: number; completed: number }>;
  };

  const responseAgg = (respAgg ?? {
    overall: { avg: null, n: 0 }, distribution: [], by_competency: [],
    by_employee: [], by_department: [], by_function: [],
  }) as RpcResp;
  const completionAgg = (compAgg ?? {
    overall: { total: 0, completed: 0, participants: 0 },
    by_department: [], by_function: [],
  }) as RpcComp;

  // 3. Goals (workspace-wide, small — keep client-side)
  let goalsQ = supabase.from("goals").select("id, tracking_status, status");
  goalsQ = goalsQ.eq("workspace_id", workspaceId);
  const { data: goalsData, error: goalsErr } = await goalsQ;
  if (goalsErr) console.error("Failed to fetch analytics goals:", goalsErr.message);

  // 4. All cycles (for cycle stats tile — small)
  let allCyclesQ = supabase.from("performance_cycles").select("id, status");
  allCyclesQ = allCyclesQ.eq("workspace_id", workspaceId);
  const { data: allCycles, error: allCyclesErr } = await allCyclesQ;
  if (allCyclesErr) console.error("Failed to fetch all cycles:", allCyclesErr.message);

  // ── Derived metrics (now mostly lookups into pre-aggregated jsonb) ──
  void functionFilteredUsers; // filter scope already applied inside the RPCs

  const overallAvg = Number(responseAgg.overall.avg ?? 0);
  const totalRatings = responseAgg.overall.n;

  // Rating distribution 1–5 (keep five-bucket shape for the existing chart)
  const ratingDist = [0, 0, 0, 0, 0];
  for (const d of responseAgg.distribution) {
    const idx = Math.min(Math.max(d.rating - 1, 0), 4);
    ratingDist[idx] += d.n;
  }

  const totalAssignments = completionAgg.overall.total;
  const completedAssignments = completionAgg.overall.completed;
  const completionRate = totalAssignments > 0
    ? Math.round((completedAssignments / totalAssignments) * 100)
    : 0;
  const participants = completionAgg.overall.participants;

  const competencyRatings = responseAgg.by_competency
    .filter((c) => c.name)
    .map((c) => ({ name: c.name as string, value: Number(c.avg_rating) }))
    .sort((a, b) => b.value - a.value);

  const rankingData = responseAgg.by_employee.map((e) => {
    const user = userMap.get(e.employee_id) as any;
    return {
      id: e.employee_id,
      name: user?.slack_name || "Unknown",
      department: user?.department || "—",
      functionName: (user?.level as any)?.job_family?.name || "—",
      levelName: (user?.level as any)?.name || "—",
      avgRating: Number(e.avg_rating),
      reviewCount: e.n,
    };
  }).sort((a, b) => b.avgRating - a.avgRating);

  const functionPerformance = responseAgg.by_function
    .filter((f) => f.name !== "Unknown")
    .map((f) => ({ name: f.name, value: Number(f.avg_rating) }))
    .sort((a, b) => b.value - a.value);

  const departmentPerformance = responseAgg.by_department
    .filter((d) => d.name !== "Unknown")
    .map((d) => ({ name: d.name, value: Number(d.avg_rating) }))
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

  // ── Breakdowns (pre-aggregated by RPCs above) ──
  const completionByDepartment = completionAgg.by_department
    .map((d) => ({
      name: d.name,
      value: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const completionByFunction = completionAgg.by_function
    .map((f) => ({
      name: f.name,
      value: f.total > 0 ? Math.round((f.completed / f.total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const avgRatingByDepartment = responseAgg.by_department
    .map((d) => ({ name: d.name, value: parseFloat(Number(d.avg_rating).toFixed(1)) }))
    .sort((a, b) => b.value - a.value);

  const avgRatingByFunction = responseAgg.by_function
    .map((f) => ({ name: f.name, value: parseFloat(Number(f.avg_rating).toFixed(1)) }))
    .sort((a, b) => b.value - a.value);

  return {
    overallAvg: overallAvg.toFixed(1),
    completionRate,
    totalRatings,
    participants,
    totalAssignments,
    completedAssignments,
    cycleStats: {
      active: (allCycles || []).filter((c: any) => c.status === "active").length,
      total: (allCycles || []).length,
    },
    rankingData,
    chartsData,
    completionByDepartment,
    completionByFunction,
    avgRatingByDepartment,
    avgRatingByFunction,
  };
}

async function getTrendsData(filters: Omit<FilterParams, "cycleId">, workspaceId: string | undefined): Promise<TrendsData> {
  if (!workspaceId) return { ratingTrend: [], completionTrend: [] };
  const supabase = await createServerSupabaseClient();

  let cyclesQ = supabase
    .from("performance_cycles")
    .select("id, name, status")
    .in("status", ["completed", "active"])
    .order("created_at", { ascending: false })
    .limit(6);
  cyclesQ = cyclesQ.eq("workspace_id", workspaceId);
  const { data: cycles, error: trendCyclesErr } = await cyclesQ;
  if (trendCyclesErr) console.error("Failed to fetch trend cycles:", trendCyclesErr.message);

  const recentCycles = (cycles || []).reverse();

  if (recentCycles.length === 0) return { ratingTrend: [], completionTrend: [] };

  let trendsUsersQ = supabase
    .from("users")
    .select("id, department, level:levels!users_level_id_fkey(job_family_id)");
  trendsUsersQ = trendsUsersQ.eq("workspace_id", workspaceId);
  const { data: usersData, error: trendsUsersErr } = await trendsUsersQ;
  if (trendsUsersErr) console.error("Failed to fetch trends users:", trendsUsersErr.message);

  const filteredUserIds = new Set(
    (usersData || [])
      .filter((u: any) => {
        if (filters.department && u.department !== filters.department) return false;
        if (filters.functionId && u.level?.job_family_id !== filters.functionId) return false;
        return true;
      })
      .map((u: any) => u.id)
  );

  // Batch: fetch all assignments for all cycles at once (already workspace-scoped via cycles)
  const cycleIds = recentCycles.map((c: any) => c.id);
  const { data: allAssignmentsRaw, error: trendAssignmentsErr } = await supabase
    .from("review_assignments")
    .select("id, status, employee_id, cycle_id")
    .in("cycle_id", cycleIds);
  if (trendAssignmentsErr) console.error("Failed to fetch trend assignments:", trendAssignmentsErr.message);

  const allAssignments = (allAssignmentsRaw || []).filter((a: any) => filteredUserIds.has(a.employee_id));
  const allAssignmentIds = allAssignments.map((a: any) => a.id);

  // Batch: fetch all responses for all assignments at once
  let allResponses: any[] = [];
  if (allAssignmentIds.length > 0) {
    const { data: responsesRaw, error: trendResponsesErr } = await supabase
      .from("review_responses")
      .select("rating, assignment_id")
      .in("assignment_id", allAssignmentIds)
      .not("rating", "is", null);
    if (trendResponsesErr) console.error("Failed to fetch trend responses:", trendResponsesErr.message);
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

async function getHeatmapData(filters: FilterParams, dim: HeatmapDim, workspaceId: string | undefined): Promise<HeatmapData> {
  if (!workspaceId) return { competencies: [], groups: [], cells: {}, overallByGroup: {}, overallByComp: {}, grandTotal: { sum: 0, count: 0 } };
  const supabase = await createServerSupabaseClient();

  // Fetch configurable tenure buckets if needed
  let tenureBuckets: { label: string; min_months: number; max_months: number | null; sort_order: number }[] = [];
  if (dim === "tenure" && workspaceId) {
    const { data: tb } = await supabase
      .from("tenure_buckets")
      .select("label, min_months, max_months, sort_order")
      .eq("workspace_id", workspaceId)
      .order("sort_order");
    tenureBuckets = tb || [];
  }

  // 1. Fetch users with dimension fields
  let heatmapUsersQ = supabase
    .from("users")
    .select("id, role, department, start_date, slack_name, manager_id, level:levels!users_level_id_fkey(name, job_family_id)");
  heatmapUsersQ = heatmapUsersQ.eq("workspace_id", workspaceId);
  const { data: usersRaw, error: heatmapUsersErr } = await heatmapUsersQ;
  if (heatmapUsersErr) console.error("Failed to fetch heatmap users:", heatmapUsersErr.message);

  const allUsers = usersRaw || [];

  const userMap = new Map(
    allUsers
      .filter((u: any) => {
        if (filters.department && u.department !== filters.department) return false;
        if (filters.functionId && (u.level as any)?.job_family_id !== filters.functionId) return false;
        return true;
      })
      .map((u: any) => {
        let groupValue: string;
        if (dim === "role") groupValue = u.role || "Unknown";
        else if (dim === "department") groupValue = u.department || "Unknown";
        else if (dim === "level") groupValue = (u.level as any)?.name || "Unknown";
        else if (dim === "manager") {
          const mgr = allUsers.find((m: any) => m.id === u.manager_id);
          groupValue = mgr ? mgr.slack_name : "No manager";
        }
        else groupValue = getEmployeeTenureBucket(u.start_date, tenureBuckets);
        return [u.id as string, groupValue];
      })
  );

  // 2. Scope responses to workspace cycles
  let hmCyclesQ = supabase.from("performance_cycles").select("id");
  hmCyclesQ = hmCyclesQ.eq("workspace_id", workspaceId);
  const { data: hmCyclesData, error: hmCyclesErr } = await hmCyclesQ;
  if (hmCyclesErr) console.error("Failed to fetch heatmap cycles:", hmCyclesErr.message);
  const hmCycleIdSet = new Set((hmCyclesData || []).map((c: any) => c.id));

  const { data: responsesRaw, error: hmResponsesErr } = await supabase
    .from("review_responses")
    .select("rating, competency:competencies(name), assignment:review_assignments!inner(employee_id, cycle_id)")
    .not("rating", "is", null)
    .limit(10000);
  if (hmResponsesErr) console.error("Failed to fetch heatmap responses:", hmResponsesErr.message);

  const responses = (responsesRaw || []).filter((r: any) => {
    const cycleId = (r.assignment as any)?.cycle_id;
    if (!cycleId || !hmCycleIdSet.has(cycleId)) return false;
    if (filters.cycleId && cycleId !== filters.cycleId) return false;
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

// ─── Cycles comparison types ─────────────────────────────────────────────────

export interface CycleRow {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  completionRate: number;
  avgRating: number | null;
  participants: number;
}

export interface BreakdownRow {
  name: string;
  completionRate: number;
  avgRating: number | null;
}

export interface ManagerBreakdownRow {
  managerName: string;
  managerId: string;
  completionRate: number;
  avgRating: number | null;
}

export interface ManagerRankRow {
  name: string;
  completionRate: number;
}

export interface CyclesComparisonData {
  cycles: CycleRow[];
  byDepartment: Record<string, BreakdownRow[]>;
  byFunction: Record<string, BreakdownRow[]>;
  byManager: Record<string, ManagerBreakdownRow[]>;
  topManagers: ManagerRankRow[];
  bottomManagers: ManagerRankRow[];
  hasMore: boolean;
  allManagers: { id: string; name: string }[];
}

// ─── Cycles comparison data fetching ─────────────────────────────────────────

async function getCyclesComparisonData(workspaceId: string | undefined, showAll: boolean): Promise<CyclesComparisonData> {
  if (!workspaceId) return { cycles: [], byDepartment: {}, byFunction: {}, byManager: {}, topManagers: [], bottomManagers: [], hasMore: false, allManagers: [] } as CyclesComparisonData;
  const supabase = await createServerSupabaseClient();

  // 1. Fetch cycles
  let cyclesQ = supabase
    .from("performance_cycles")
    .select("id, name, status, start_date, end_date")
    .in("status", ["active", "in_review", "completed", "closed"])
    .order("start_date", { ascending: false });
  cyclesQ = cyclesQ.eq("workspace_id", workspaceId);
  if (!showAll) cyclesQ = cyclesQ.limit(4);

  const { data: cyclesRaw, error: cyclesErr } = await cyclesQ;
  if (cyclesErr) console.error("Failed to fetch cycles comparison:", cyclesErr.message);

  // Check if there are more cycles beyond the 4 shown
  let hasMore = false;
  if (!showAll) {
    let countQ = supabase
      .from("performance_cycles")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "in_review", "completed", "closed"]);
    countQ = countQ.eq("workspace_id", workspaceId);
    const { count } = await countQ;
    hasMore = (count || 0) > 4;
  }

  const allCycles = cyclesRaw || [];
  if (allCycles.length === 0) {
    return { cycles: [], byDepartment: {}, byFunction: {}, byManager: {}, topManagers: [], bottomManagers: [], hasMore: false, allManagers: [] };
  }

  const cycleIds = allCycles.map((c: any) => c.id);

  // 2. Fetch all assignments for these cycles
  const { data: assignmentsRaw, error: assignmentsErr } = await supabase
    .from("review_assignments")
    .select("id, status, employee_id, cycle_id, overall_rating")
    .in("cycle_id", cycleIds);
  if (assignmentsErr) console.error("Failed to fetch cycles assignments:", assignmentsErr.message);
  const assignments = assignmentsRaw || [];

  // 3. Fetch users with department, job_family (via level), and manager info
  let usersQ = supabase
    .from("users")
    .select("id, department, slack_name, manager_id, level:levels!users_level_id_fkey(name, job_family:job_families(name))");
  usersQ = usersQ.eq("workspace_id", workspaceId);
  const { data: usersRaw, error: usersErr } = await usersQ;
  if (usersErr) console.error("Failed to fetch cycles users:", usersErr.message);
  const allUsers = usersRaw || [];
  const userMap = new Map(allUsers.map((u: any) => [u.id, u]));

  // Build cycle rows
  const cycleRows: CycleRow[] = allCycles.map((c: any) => {
    const cycleAssignments = assignments.filter((a: any) => a.cycle_id === c.id);
    const total = cycleAssignments.length;
    const completed = cycleAssignments.filter((a: any) => a.status === "completed").length;
    const rated = cycleAssignments.filter((a: any) => a.overall_rating != null);
    const avgRating = rated.length > 0
      ? parseFloat((rated.reduce((sum: number, a: any) => sum + (a.overall_rating as number), 0) / rated.length).toFixed(2))
      : null;
    const participants = new Set(cycleAssignments.map((a: any) => a.employee_id)).size;

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      startDate: c.start_date,
      endDate: c.end_date,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgRating,
      participants,
    };
  });

  // 4. Compute breakdowns by department
  const byDepartment: Record<string, BreakdownRow[]> = {};
  for (const cycleId of cycleIds) {
    const cycleAssignments = assignments.filter((a: any) => a.cycle_id === cycleId);
    const deptGroups = new Map<string, { completed: number; total: number; ratings: number[] }>();
    for (const a of cycleAssignments) {
      const emp = userMap.get(a.employee_id);
      const dept = (emp as any)?.department || "Unknown";
      const g = deptGroups.get(dept) || { completed: 0, total: 0, ratings: [] };
      g.total++;
      if (a.status === "completed") g.completed++;
      if (a.overall_rating != null) g.ratings.push(a.overall_rating as number);
      deptGroups.set(dept, g);
    }
    byDepartment[cycleId] = [...deptGroups.entries()]
      .map(([name, g]) => ({
        name,
        completionRate: g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0,
        avgRating: g.ratings.length > 0 ? parseFloat((g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length).toFixed(2)) : null,
      }))
      .sort((a, b) => b.completionRate - a.completionRate);
  }

  // 5. Compute breakdowns by function (job_family)
  const byFunction: Record<string, BreakdownRow[]> = {};
  for (const cycleId of cycleIds) {
    const cycleAssignments = assignments.filter((a: any) => a.cycle_id === cycleId);
    const funcGroups = new Map<string, { completed: number; total: number; ratings: number[] }>();
    for (const a of cycleAssignments) {
      const emp = userMap.get(a.employee_id);
      const funcName = (emp as any)?.level?.job_family?.name || "Unknown";
      const g = funcGroups.get(funcName) || { completed: 0, total: 0, ratings: [] };
      g.total++;
      if (a.status === "completed") g.completed++;
      if (a.overall_rating != null) g.ratings.push(a.overall_rating as number);
      funcGroups.set(funcName, g);
    }
    byFunction[cycleId] = [...funcGroups.entries()]
      .map(([name, g]) => ({
        name,
        completionRate: g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0,
        avgRating: g.ratings.length > 0 ? parseFloat((g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length).toFixed(2)) : null,
      }))
      .sort((a, b) => b.completionRate - a.completionRate);
  }

  // 6. Compute breakdowns by manager
  const byManager: Record<string, ManagerBreakdownRow[]> = {};
  const managerIdSet = new Set<string>();
  for (const cycleId of cycleIds) {
    const cycleAssignments = assignments.filter((a: any) => a.cycle_id === cycleId);
    const mgrGroups = new Map<string, { managerId: string; managerName: string; completed: number; total: number; ratings: number[] }>();
    for (const a of cycleAssignments) {
      const emp = userMap.get(a.employee_id);
      const managerId = (emp as any)?.manager_id;
      if (!managerId) continue;
      const mgr = userMap.get(managerId);
      const managerName = (mgr as any)?.slack_name || "Unknown";
      managerIdSet.add(managerId);
      const g = mgrGroups.get(managerId) || { managerId, managerName, completed: 0, total: 0, ratings: [] as number[] };
      g.total++;
      if (a.status === "completed") g.completed++;
      if (a.overall_rating != null) g.ratings.push(a.overall_rating as number);
      mgrGroups.set(managerId, g);
    }
    byManager[cycleId] = [...mgrGroups.values()]
      .map((g) => ({
        managerName: g.managerName,
        managerId: g.managerId,
        completionRate: g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0,
        avgRating: g.ratings.length > 0 ? parseFloat((g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length).toFixed(2)) : null,
      }))
      .sort((a, b) => b.completionRate - a.completionRate);
  }

  // All managers for dropdown
  const allManagers = [...managerIdSet].map((id) => {
    const mgr = userMap.get(id);
    return { id, name: (mgr as any)?.slack_name || "Unknown" };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // 7. Top/bottom 5 managers by current (most recent) cycle completion
  const currentCycleId = cycleIds[0]; // most recent
  const currentManagerData = byManager[currentCycleId] || [];
  const sortedByCompletion = [...currentManagerData].sort((a, b) => b.completionRate - a.completionRate);
  const topManagers: ManagerRankRow[] = sortedByCompletion.slice(0, 5).map((m) => ({ name: m.managerName, completionRate: m.completionRate }));
  const bottomManagers: ManagerRankRow[] = [...currentManagerData]
    .sort((a, b) => a.completionRate - b.completionRate)
    .slice(0, 5)
    .map((m) => ({ name: m.managerName, completionRate: m.completionRate }));

  return {
    cycles: cycleRows,
    byDepartment,
    byFunction,
    byManager,
    topManagers,
    bottomManagers,
    hasMore,
    allManagers,
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
  searchParams: Promise<{ cycleId?: string; functionId?: string; department?: string; tab?: string; heatmap_dim?: string; showAll?: string }>;
}) {
  const workspace = await getUserWorkspace();

  if (!isManagerOrAbove(workspace?.role) && !workspace?.hasDirectReports) {
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
  const activeTab = (params.tab === "heatmap" ? "heatmap" : params.tab === "cycles" ? "cycles" : "overview") as "overview" | "heatmap" | "cycles";
  const showAllCycles = params.showAll === "true";
  const filters: FilterParams = {
    cycleId: params.cycleId || null,
    functionId: params.functionId || null,
    department: params.department || null,
  };
  const heatmapDim = (["role", "department", "level", "tenure", "manager"].includes(params.heatmap_dim || "")
    ? params.heatmap_dim
    : "role") as HeatmapDim;

  const wsId = workspace?.workspaceId;
  const [filterOptions, analytics, trends] = await Promise.all([
    getFilterOptions(wsId),
    getAnalyticsData(filters, wsId),
    getTrendsData({ functionId: filters.functionId, department: filters.department }, wsId),
  ]);
  const heatmapData = activeTab === "heatmap"
    ? await getHeatmapData(filters, heatmapDim, wsId)
    : null;
  const cyclesData = activeTab === "cycles"
    ? await getCyclesComparisonData(wsId, showAllCycles)
    : null;
  const ratingScale = workspace?.ratingScale ?? DEFAULT_RATING_SCALE;

  // Subtitle carries real metadata instead of marketing copy
  const subtitleParts: string[] = [];
  if (analytics.totalRatings > 0) {
    subtitleParts.push(
      `${analytics.totalRatings.toLocaleString()} rating${analytics.totalRatings !== 1 ? "s" : ""}`,
    );
  }
  if (analytics.participants > 0) {
    subtitleParts.push(
      `${analytics.participants} participant${analytics.participants !== 1 ? "s" : ""}`,
    );
  }
  if (filters.cycleId) {
    const cycleName = filterOptions.cycles.find((c) => c.id === filters.cycleId)?.name;
    if (cycleName) subtitleParts.push(`Cycle: ${cycleName}`);
  } else if (analytics.cycleStats.total > 0) {
    subtitleParts.push(
      `${analytics.cycleStats.total} cycle${analytics.cycleStats.total !== 1 ? "s" : ""}`,
    );
  }
  const analyticsSubtitle = subtitleParts.length > 0
    ? subtitleParts.join(" · ")
    : "Performance insights across your workspace";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        hat="manage"
        title="Analytics"
        subtitle={analyticsSubtitle}
        actions={
          <AnalyticsExportButton
            cycleId={filters.cycleId || undefined}
            functionId={filters.functionId || undefined}
            department={filters.department || undefined}
          />
        }
      />

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
          {/* Compact KPI strip — one row, unified primary-toned icons */}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 px-4 py-3 rounded-xl border border-border/60 bg-card">
            {[
              { label: "Overall", value: `${analytics.overallAvg}/${ratingScale.max}`, icon: Star, tone: "text-amber-500", help: "Average rating across all competencies for the selected cycle" },
              { label: "Completion", value: `${analytics.completionRate}%`, icon: TrendingUp, tone: "text-primary", help: "Percentage of assigned reviews that have been submitted" },
              { label: "Ratings", value: analytics.totalRatings.toLocaleString(), icon: BarChart3, tone: "text-primary", help: "Number of individual competency ratings submitted" },
              { label: "Participants", value: String(analytics.participants), icon: Users, tone: "text-primary", help: "Number of employees with at least one review assignment" },
              { label: "Active cycles", value: String(analytics.cycleStats.active), icon: Grid3X3, tone: "text-primary", help: "Cycles currently in active or in-review status" },
            ].map((m, i) => (
              <div key={m.label} className="flex items-center gap-5 sm:gap-7">
                {i > 0 && <span className="h-8 w-px bg-border/60 hidden sm:block" aria-hidden="true" />}
                <div className="flex items-center gap-2.5" title={m.help}>
                  <m.icon className={`h-4 w-4 shrink-0 ${m.tone}`} />
                  <div>
                    <p className="text-lg font-semibold text-foreground leading-none tabular-nums">{m.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{m.label}</p>
                  </div>
                </div>
              </div>
            ))}
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

          {/* Trends — promoted above Charts because "are we improving?" is the
               most important question on this page. */}
          <AnalyticsTrends data={trends} />

          {/* Charts */}
          <AnalyticsCharts data={analytics.chartsData} />

          {/* Breakdowns — shorter subtitles (titles were already self-describing) */}
          <AnalyticsBreakdowns charts={[
            {
              title: "Completion by Department",
              subtitle: "% of reviews submitted",
              data: analytics.completionByDepartment,
              unit: "%",
            },
            {
              title: "Completion by Function",
              subtitle: "% of reviews submitted",
              data: analytics.completionByFunction,
              unit: "%",
            },
            {
              title: "Avg Rating by Department",
              subtitle: "Competency average",
              data: analytics.avgRatingByDepartment,
              unit: "avg",
            },
            {
              title: "Avg Rating by Function",
              subtitle: "Competency average",
              data: analytics.avgRatingByFunction,
              unit: "avg",
            },
          ]} />

          {/* Performance Ranking */}
          {analytics.rankingData.length > 0 && (
            <Card>
              <div className="px-6 pt-6 pb-2">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
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
        </>
      )}

      {activeTab === "cycles" && cyclesData && (
        <AnalyticsCycles data={cyclesData} />
      )}

      {activeTab === "heatmap" && heatmapData && (
        <Card className="border-border/60">
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Competency Heatmap</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Average ratings across competencies, grouped by the selected dimension. Colors reflect your rating scale.
              </p>
            </div>
            <Suspense fallback={null}>
              <AnalyticsHeatmapDimSwitcher activeDim={heatmapDim} />
            </Suspense>
          </div>
          <CardContent className="px-0 pb-6">
            {heatmapData.competencies.length === 0 ? (
              <div className="py-16 text-center px-6">
                <p className="text-sm font-semibold text-foreground mb-1">No performance data for this period</p>
                <p className="text-sm text-muted-foreground">Complete a review cycle to populate the heatmap.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-background px-4 py-2 text-left text-xs font-medium text-muted-foreground w-48 min-w-48">
                        Competency
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground min-w-[80px]">
                        All
                      </th>
                      {heatmapData.groups.map((group) => (
                        <th
                          key={group}
                          className="px-3 py-2 text-center text-xs font-medium text-muted-foreground min-w-[80px]"
                          title={group}
                        >
                          {group}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.competencies.map((comp) => {
                      const allCell = heatmapData.overallByComp[comp];
                      const allAvg = allCell && allCell.count > 0 ? allCell.sum / allCell.count : null;
                      return (
                        <tr key={comp} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                          <td className="sticky left-0 z-10 bg-background px-4 py-2.5 font-medium text-foreground">
                            {comp}
                          </td>
                          <td className={`px-3 py-2.5 text-center ${getHeatmapColor(allAvg, ratingScale)}`}>
                            {allAvg !== null ? (
                              <>
                                <div className="font-semibold tabular-nums">{allAvg.toFixed(1)}</div>
                                <div className="text-[10px] text-muted-foreground tabular-nums">n={allCell.count}</div>
                              </>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          {heatmapData.groups.map((group) => {
                            const cell = heatmapData.cells[`${comp}::${group}`];
                            const avg = cell && cell.count > 0 ? cell.sum / cell.count : null;
                            return (
                              <td
                                key={group}
                                className={`px-3 py-2.5 text-center ${getHeatmapColor(avg, ratingScale)}`}
                              >
                                {avg !== null ? (
                                  <>
                                    <div className="font-semibold tabular-nums">{avg.toFixed(1)}</div>
                                    <div className="text-[10px] text-muted-foreground tabular-nums">n={cell.count}</div>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Overall row */}
                    <tr className="border-t-2 border-border/60 bg-muted/30 font-medium">
                      <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2.5 font-semibold text-foreground">
                        Overall
                      </td>
                      <td className={`px-3 py-2.5 text-center ${getHeatmapColor(heatmapData.grandTotal.count > 0 ? heatmapData.grandTotal.sum / heatmapData.grandTotal.count : null, ratingScale)}`}>
                        {heatmapData.grandTotal.count > 0 ? (
                          <>
                            <div className="font-semibold tabular-nums">
                              {(heatmapData.grandTotal.sum / heatmapData.grandTotal.count).toFixed(1)}
                            </div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">n={heatmapData.grandTotal.count}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      {heatmapData.groups.map((group) => {
                        const cell = heatmapData.overallByGroup[group];
                        const avg = cell && cell.count > 0 ? cell.sum / cell.count : null;
                        return (
                          <td
                            key={group}
                            className={`px-3 py-2.5 text-center ${getHeatmapColor(avg, ratingScale)}`}
                          >
                            {avg !== null ? (
                              <>
                                <div className="font-semibold tabular-nums">{avg.toFixed(1)}</div>
                                <div className="text-[10px] text-muted-foreground tabular-nums">n={cell.count}</div>
                              </>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
                <div className="flex items-center gap-3 mt-4 px-4 text-xs text-muted-foreground">
                  <span>Scale:</span>
                  {getHeatmapLegend(ratingScale).map((p) => (
                    <div key={p.value} className="flex items-center gap-1.5">
                      <div className={`h-4 w-4 rounded ${p.colorClass}`} />
                      <span>{p.value} — {p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
