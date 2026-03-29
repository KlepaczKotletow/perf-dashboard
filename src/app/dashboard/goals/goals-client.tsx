"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ChevronRight,
  ChevronDown,
  Search,
  Building2,
  Users,
  User,
  Plus,
  ArrowUpDown,
  CheckCircle2,
  X,
  AlertCircle,
  Copy,
  MoreHorizontal,
  Zap,
  Loader2,
  Download,
} from "lucide-react";
import { isHROrAbove } from "@/lib/roles";
import { getClientIdentity } from "@/lib/client-auth";

// ─── Types ──────────────────────────────────────────────

interface EmployeeRef { id: string; slack_name: string; department: string | null }
interface CycleRef { id: string; name: string }

interface GoalRow {
  id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  weight: number;
  metric_start: number | null;
  metric_current: number | null;
  metric_target: number | null;
  metric_unit: string | null;
  tracking_status: string;
  scope: string;
  due_date: string | null;
  // Supabase FK joins may return arrays or single objects depending on query shape
  employee?: EmployeeRef | EmployeeRef[] | null;
  cycle?: CycleRef | CycleRef[] | null;
}

/** A goal row after FK join arrays have been unwrapped into single objects */
interface NormalizedGoalRow extends Omit<GoalRow, "employee" | "cycle"> {
  employee: EmployeeRef | null;
  cycle: CycleRef | null;
}

/** Normalize a Supabase FK join that may be an array or a single object */
function unwrap<T>(val: T | T[] | null | undefined): T | null {
  if (val == null) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

interface Cycle {
  id: string;
  name: string;
}

interface GoalsClientProps {
  goals: GoalRow[];
  cycles: Cycle[];
  employees?: { id: string; slack_name: string }[];
  role?: string;
  workspaceId: string;
}

// ─── Tracking status config ─────────────────────────────

const trackingConfig: Record<string, { label: string; color: string; barColor: string }> = {
  on_track: {
    label: "On track",
    color: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
    barColor: "bg-emerald-500",
  },
  at_risk: {
    label: "At risk",
    color: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
    barColor: "bg-amber-500",
  },
  delayed: {
    label: "Delayed",
    color: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-400/10",
    barColor: "bg-red-500",
  },
  achieved: {
    label: "Achieved",
    color: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
    barColor: "bg-emerald-600",
  },
};

// ─── Tree builder ───────────────────────────────────────

interface GoalNode extends NormalizedGoalRow {
  children: GoalNode[];
  depth: number;
}

function buildTree(goals: NormalizedGoalRow[]): GoalNode[] {
  const map = new Map<string, GoalNode>();
  const roots: GoalNode[] = [];

  goals.forEach((g) => map.set(g.id, { ...g, children: [], depth: 0 }));

  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function flattenTree(nodes: GoalNode[], expanded: Set<string>): GoalNode[] {
  const result: GoalNode[] = [];
  function walk(list: GoalNode[]) {
    for (const node of list) {
      result.push(node);
      if (node.children.length > 0 && expanded.has(node.id)) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return result;
}

// ─── Component ──────────────────────────────────────────

export default function GoalsClient({ goals: rawGoals, cycles, employees = [], role, workspaceId }: GoalsClientProps) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Quick-add dialog
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickEmployeeId, setQuickEmployeeId] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);

  async function handleQuickAdd() {
    if (!quickTitle.trim() || !quickEmployeeId) return;
    setQuickAdding(true);
    try {
      const identity = await getClientIdentity(supabase);
      if (!identity) return;
      const { error } = await supabase.from("goals").insert({
        title: quickTitle.trim(),
        employee_id: quickEmployeeId,
        workspace_id: identity.workspaceId,
        status: "active",
        progress: 0,
        weight: 1.0,
        tracking_status: "on_track",
        scope: "individual",
      });
      if (!error) {
        setQuickTitle("");
        setQuickEmployeeId("");
        setQuickAddOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Quick add goal error:", err);
    } finally {
      setQuickAdding(false);
    }
  }

  // Normalize Supabase FK join arrays into single objects
  const goals: NormalizedGoalRow[] = useMemo(
    () =>
      rawGoals.map((g) => ({
        ...g,
        employee: unwrap(g.employee),
        cycle: unwrap(g.cycle),
      })),
    [rawGoals]
  );

  // Filters
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [updateError, setUpdateError] = useState<string | null>(null);

  // Sort
  const [sortKey, setSortKey] = useState<string>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ─── Filtered & sorted data ─────────────────────────

  const filtered = useMemo(() => {
    return goals.filter((g) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !g.title.toLowerCase().includes(q) &&
          !(g.description || "").toLowerCase().includes(q) &&
          !(g.employee?.slack_name || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (cycleFilter !== "all" && g.cycle?.id !== cycleFilter) return false;
      if (scopeFilter !== "all" && g.scope !== scopeFilter) return false;
      if (statusFilter !== "all" && g.tracking_status !== statusFilter) return false;
      return true;
    });
  }, [goals, search, cycleFilter, scopeFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortKey) {
        case "title":
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case "owner":
          aVal = (a.employee?.slack_name || "").toLowerCase();
          bVal = (b.employee?.slack_name || "").toLowerCase();
          break;
        case "weight":
          aVal = a.weight;
          bVal = b.weight;
          break;
        case "progress":
          aVal = a.progress;
          bVal = b.progress;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Build tree for hierarchy display
  const hasActiveFilter = search !== "" || cycleFilter !== "all" || scopeFilter !== "all" || statusFilter !== "all";

  const tree = useMemo(
    () => hasActiveFilter ? [] : buildTree(sorted),
    [sorted, hasActiveFilter]
  );

  const flat = useMemo(
    () => hasActiveFilter
      ? sorted.map((g) => ({ ...g, children: [], depth: 0 }))
      : flattenTree(tree, expanded),
    [sorted, tree, expanded, hasActiveFilter]
  );

  // ─── Summary stats ──────────────────────────────────

  const activeGoals = goals.filter((g) => g.status === "active");
  const weightedProgress =
    activeGoals.length > 0
      ? Math.round(
          activeGoals.reduce((sum, g) => sum + g.progress * g.weight, 0) /
            activeGoals.reduce((sum, g) => sum + g.weight, 0)
        )
      : 0;
  const goalsWithStatus = goals.filter((g) => g.tracking_status != null);
  const roadmapPct =
    goalsWithStatus.length > 0
      ? Math.round(
          (goalsWithStatus.filter(
            (g) => g.tracking_status === "on_track" || g.tracking_status === "achieved"
          ).length / goalsWithStatus.length) * 100
        )
      : 0;

  // ─── Handlers ───────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function updateTrackingStatus(goalId: string, status: string, employeeId?: string) {
    if (updatingIds.has(goalId)) return;
    setUpdatingIds((prev) => new Set(prev).add(goalId));

    const { error } = await supabase
      .from("goals")
      .update({ tracking_status: status })
      .eq("id", goalId)
      .eq("workspace_id", workspaceId);

    setUpdatingIds((prev) => { const next = new Set(prev); next.delete(goalId); return next; });

    if (error) {
      console.error("Failed to update tracking status:", error);
      setUpdateError("Failed to update status. Please try again.");
      return;
    }
    setUpdateError(null);

    if (employeeId && (status === "at_risk" || status === "delayed" || status === "achieved")) {
      supabase.functions.invoke("cycle-notifications", {
        body: { action: "goal_status", goal_id: goalId, new_status: status, employee_id: employeeId },
      }).catch(() => {});
    }

    router.refresh();
  }

  async function handleDuplicate(goal: NormalizedGoalRow) {
    const identity = await getClientIdentity(supabase);
    if (!identity) return;

    const { error } = await supabase.from("goals").insert({
      title: `${goal.title} (Copy)`,
      description: goal.description,
      employee_id: goal.employee?.id ?? null,
      cycle_id: goal.cycle?.id ?? null,
      parent_id: goal.parent_id,
      scope: goal.scope,
      weight: goal.weight,
      metric_start: goal.metric_start,
      metric_target: goal.metric_target,
      metric_unit: goal.metric_unit,
      metric_current: goal.metric_start,
      due_date: goal.due_date,
      status: "draft",
      progress: 0,
      tracking_status: "on_track",
      workspace_id: workspaceId,
    });

    if (error) {
      console.error("Failed to duplicate goal:", error);
      return;
    }

    router.refresh();
  }

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {role === "admin" || role === "hr"
              ? "All objectives and key results across the organisation"
              : role === "manager"
              ? "Company, team, and individual goals for you and your direct reports"
              : "Company-wide goals and your personal objectives"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isHROrAbove(role) && (
            <Button variant="outline" size="sm" onClick={() => {
              const a = document.createElement("a");
              a.href = "/api/goals/export";
              a.download = `goals-export-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
            }}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Quick Add
          </Button>
          <Button asChild>
            <Link href="/dashboard/goals/new">
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Link>
          </Button>
        </div>

        <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Quick Add Goal</DialogTitle>
              <DialogDescription>Create a goal with just a title and owner. You can add details later.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Goal Title *</Label>
                <Input
                  placeholder="e.g., Improve API response times by 50%"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Employee *</Label>
                <Select value={quickEmployeeId} onValueChange={setQuickEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.slack_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuickAddOpen(false)}>Cancel</Button>
              <Button onClick={handleQuickAdd} disabled={quickAdding || !quickTitle.trim() || !quickEmployeeId}>
                {quickAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="flex items-center gap-6 p-4 rounded-xl border border-border/60 bg-card">
        <div>
          <span className="text-3xl font-bold text-primary">{weightedProgress}%</span>
          <p className="text-xs text-muted-foreground mt-0.5">Goals</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {roadmapPct}%
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">Roadmap</p>
        </div>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground">
          {goals.length} total &middot; {activeGoals.length} active
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search goals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Cycle selector */}
        <Select value={cycleFilter} onValueChange={setCycleFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="All cycles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cycles</SelectItem>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Scope toggle */}
        <div className="flex items-center border rounded-md overflow-hidden">
          {[
            { key: "all", icon: null, label: "All" },
            { key: "company", icon: Building2, label: "Company" },
            { key: "team", icon: Users, label: "Team" },
            { key: "individual", icon: User, label: "Individual" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setScopeFilter(key)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${
                scopeFilter === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
              title={label}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {!Icon && <span>{label}</span>}
            </button>
          ))}
        </div>

        {/* Tracking status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="on_track">On track</SelectItem>
            <SelectItem value="at_risk">At risk</SelectItem>
            <SelectItem value="delayed">Delayed</SelectItem>
            <SelectItem value="achieved">Achieved</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {(search || cycleFilter !== "all" || scopeFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setSearch("");
              setCycleFilter("all");
              setScopeFilter("all");
              setStatusFilter("all");
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Update error banner */}
      {updateError && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 px-3 py-2 rounded-md">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {updateError}
        </div>
      )}

      {/* Data Table */}
      {flat.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card py-16 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </div>
          {goals.length > 0 ? (
            <>
              <p className="text-sm font-medium text-foreground mb-1">No goals found</p>
              <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground mb-1">No goals yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Create your first goal to start tracking objectives for your team.
              </p>
              <div className="flex items-center justify-center gap-2 mt-5">
                <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Quick Add
                </Button>
                <Button size="sm" asChild>
                  <Link href="/dashboard/goals/new">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    New Goal
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
        <div className="border rounded-xl overflow-hidden min-w-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[30%]">
                  <button onClick={() => toggleSort("title")} className="flex items-center gap-1 text-xs font-medium">
                    Goal <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("owner")} className="flex items-center gap-1 text-xs font-medium">
                    Owner <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="w-[70px]">
                  <button onClick={() => toggleSort("weight")} className="flex items-center gap-1 text-xs font-medium">
                    Weight <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Metric</TableHead>
                <TableHead className="w-[160px]">
                  <button onClick={() => toggleSort("progress")} className="flex items-center gap-1 text-xs font-medium">
                    Progress <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {flat.map((goal) => {
                const tc = trackingConfig[goal.tracking_status] || trackingConfig.on_track;
                const hasChildren = goal.children.length > 0;
                const isExpanded = expanded.has(goal.id);
                const indent = goal.depth * 24;

                return (
                  <TableRow key={goal.id} className="group">
                    {/* Goal title */}
                    <TableCell>
                      <div className="flex items-center gap-1.5" style={{ paddingLeft: indent }}>
                        {hasChildren ? (
                          <button
                            onClick={() => toggleExpand(goal.id)}
                            className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          <span className="w-[18px] shrink-0" />
                        )}
                        <Link
                          href={`/dashboard/goals/${goal.id}`}
                          className="text-sm font-medium text-foreground truncate hover:underline"
                        >
                          {goal.title}
                        </Link>
                        {goal.status === "draft" && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground ml-1.5 shrink-0 font-normal">
                            Draft
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Owner */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate">
                        {goal.employee?.slack_name || "—"}
                      </span>
                    </TableCell>

                    {/* Weight */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {goal.weight === 1 ? "1×" : `${goal.weight % 1 === 0 ? goal.weight.toFixed(0) : goal.weight.toFixed(1)}×`}
                      </span>
                    </TableCell>

                    {/* Metric */}
                    <TableCell>
                      {goal.metric_target != null ? (
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {goal.metric_start ?? 0}
                          <span className="mx-1 text-muted-foreground/40">→</span>
                          <span className="font-medium text-foreground">
                            {goal.metric_current ?? goal.metric_start ?? 0}
                          </span>
                          <span className="mx-1 text-muted-foreground/40">→</span>
                          {goal.metric_target}
                          {goal.metric_unit && (
                            <span className="ml-1 text-xs text-muted-foreground/60">
                              {goal.metric_unit}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Progress */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${tc.barColor}`}
                            style={{ width: `${Math.min(100, goal.progress)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-foreground w-8 text-right tabular-nums">
                          {goal.progress}%
                        </span>
                      </div>
                    </TableCell>

                    {/* Status (inline editable) */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={updatingIds.has(goal.id)}>
                          <button className="focus:outline-none disabled:opacity-50 disabled:cursor-wait">
                            <Badge className={`text-[10px] font-medium cursor-pointer ${tc.color}`}>
                              {tc.label}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {Object.entries(trackingConfig).map(([key, cfg]) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => updateTrackingStatus(goal.id, key, goal.employee?.id ?? undefined)}
                              className="text-xs"
                            >
                              <div className={`h-2 w-2 rounded-full ${cfg.barColor} mr-2`} />
                              {cfg.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="w-10 pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDuplicate(goal)}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </div>
      )}
    </div>
  );
}
