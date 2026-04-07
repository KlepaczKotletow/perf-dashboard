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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
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
  Trash2,
  Save,
  Edit2,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { isHROrAbove } from "@/lib/roles";
import { getClientIdentity } from "@/lib/client-auth";
import {
  type EmployeeRef,
  type CycleRef,
  type GoalRow,
  type NormalizedGoalRow,
  type GoalNode,
  unwrap,
  calculateProgress,
  directionIcon,
  trackingConfig,
  buildTree,
  flattenTree,
} from "@/lib/goals-utils";

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

// ─── Column visibility ─────────────────────────────────

type ColumnKey = "goal" | "owner" | "cycle" | "status" | "weight" | "metric" | "progress" | "health";

const DEFAULT_VISIBLE: ColumnKey[] = ["goal", "owner", "progress", "health"];
const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "goal", label: "Goal" },
  { key: "owner", label: "Owner" },
  { key: "cycle", label: "Cycle" },
  { key: "status", label: "Status" },
  { key: "weight", label: "Weight" },
  { key: "metric", label: "Metric" },
  { key: "progress", label: "Progress" },
  { key: "health", label: "Health" },
];

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

  // Side panel create
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: "",
    employee_id: "",
    goal_direction: "increase" as string,
    metric_target: "" as string,
    metric_unit: "",
    metric_start: "" as string,
    cycle_id: "" as string,
    due_date: "" as string,
    scope: "individual" as string,
    parent_id: "" as string,
    description: "",
    weight: "1",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Delete
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<NormalizedGoalRow | null>(null);

  // Duplicate to cycle
  const [showDupCycleDialog, setShowDupCycleDialog] = useState(false);
  const [goalToDuplicate, setGoalToDuplicate] = useState<NormalizedGoalRow | null>(null);
  const [dupTargetCycleId, setDupTargetCycleId] = useState("");

  // Quick-add dialog
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickEmployeeId, setQuickEmployeeId] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);

  // Edit panel
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editGoal, setEditGoal] = useState<NormalizedGoalRow | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    employee_id: "",
    goal_direction: "increase",
    metric_target: "" as string,
    metric_unit: "",
    metric_start: "" as string,
    metric_current: "" as string,
    cycle_id: "" as string,
    due_date: "" as string,
    scope: "individual",
    parent_id: "" as string,
    weight: "1",
    status: "active",
    tracking_status: "on_track",
  });
  const [editLoading, setEditLoading] = useState(false);

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

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_VISIBLE));

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
        case "cycle":
          aVal = (a.cycle?.name || "").toLowerCase();
          bVal = (b.cycle?.name || "").toLowerCase();
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

  function toggleColumn(col: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      // Always keep "goal" visible
      if (col === "goal") return next;
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  const activeColumns = ALL_COLUMNS.filter((c) => visibleColumns.has(c.key));

  function renderColumnHeader(col: ColumnKey) {
    switch (col) {
      case "goal":
        return <TableHead key={col} className="min-w-[180px]"><button onClick={() => toggleSort("title")} className="flex items-center gap-1 text-xs font-medium">Goal <ArrowUpDown className="h-3 w-3" /></button></TableHead>;
      case "owner":
        return <TableHead key={col} className="w-[120px]"><button onClick={() => toggleSort("owner")} className="flex items-center gap-1 text-xs font-medium">Owner <ArrowUpDown className="h-3 w-3" /></button></TableHead>;
      case "cycle":
        return <TableHead key={col} className="w-[100px]"><button onClick={() => toggleSort("cycle")} className="flex items-center gap-1 text-xs font-medium">Cycle <ArrowUpDown className="h-3 w-3" /></button></TableHead>;
      case "status":
        return <TableHead key={col} className="w-[80px]"><span className="text-xs font-medium">Status</span></TableHead>;
      case "weight":
        return <TableHead key={col} className="w-[60px]"><button onClick={() => toggleSort("weight")} className="flex items-center gap-1 text-xs font-medium">Wt <ArrowUpDown className="h-3 w-3" /></button></TableHead>;
      case "metric":
        return <TableHead key={col} className="w-[160px]"><span className="text-xs font-medium">Metric</span></TableHead>;
      case "progress":
        return <TableHead key={col} className="w-[140px]"><button onClick={() => toggleSort("progress")} className="flex items-center gap-1 text-xs font-medium">Progress <ArrowUpDown className="h-3 w-3" /></button></TableHead>;
      case "health":
        return <TableHead key={col} className="w-[90px]"><span className="text-xs font-medium">Health</span></TableHead>;
    }
  }

  function renderColumnCell(col: ColumnKey, goal: typeof flat[0], tc: { label: string; color: string; barColor: string }) {
    switch (col) {
      case "goal":
        return (
          <TableCell key={col}>
            <div className="flex items-center gap-1.5" style={{ paddingLeft: goal.depth * 24 }}>
              {goal.children.length > 0 ? (
                <button onClick={() => toggleExpand(goal.id)} className="p-0.5 rounded hover:bg-muted transition-colors shrink-0">
                  {expanded.has(goal.id) ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              ) : (
                <span className="w-[18px] shrink-0" />
              )}
              <button onClick={() => openEditPanel(goal)} className="text-sm font-medium text-foreground truncate hover:underline text-left">{goal.title}</button>
              {goal.status === "draft" && <Badge variant="outline" className="text-[10px] text-muted-foreground ml-1.5 shrink-0 font-normal">Draft</Badge>}
            </div>
          </TableCell>
        );
      case "owner":
        return <TableCell key={col}><span className="text-sm text-muted-foreground truncate">{goal.employee?.slack_name || "\u2014"}</span></TableCell>;
      case "cycle":
        return <TableCell key={col}><span className="text-sm text-muted-foreground truncate">{goal.cycle?.name || "\u2014"}</span></TableCell>;
      case "status":
        return (
          <TableCell key={col}>
            <Badge className={`text-[10px] font-medium ${
              goal.status === "active" ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10"
              : goal.status === "completed" ? "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10"
              : "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10"
            }`}>
              {goal.status === "active" ? "Active" : goal.status === "completed" ? "Completed" : goal.status === "cancelled" ? "Cancelled" : "Draft"}
            </Badge>
          </TableCell>
        );
      case "weight":
        return <TableCell key={col}><span className="text-sm text-muted-foreground">{goal.weight === 1 ? "1\u00d7" : `${goal.weight % 1 === 0 ? goal.weight.toFixed(0) : goal.weight.toFixed(1)}\u00d7`}</span></TableCell>;
      case "metric":
        return (
          <TableCell key={col}>
            {goal.metric_target != null ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {goal.metric_start ?? 0}<span className="mx-1 text-muted-foreground/40">{"→"}</span>
                <span className="font-medium text-foreground">{goal.metric_current ?? goal.metric_start ?? 0}</span>
                <span className="mx-1 text-muted-foreground/40">{"→"}</span>
                {directionIcon(goal.goal_direction)} {goal.metric_target}
                {goal.metric_unit && <span className="ml-1 text-xs text-muted-foreground/60">{goal.metric_unit}</span>}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground/40">\u2014</span>
            )}
          </TableCell>
        );
      case "progress":
        return (
          <TableCell key={col}>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${tc.barColor}`} style={{ width: `${Math.min(100, goal.progress)}%` }} />
              </div>
              <span className="text-xs font-medium text-foreground w-8 text-right tabular-nums">{goal.progress}%</span>
            </div>
          </TableCell>
        );
      case "health":
        return (
          <TableCell key={col}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={updatingIds.has(goal.id)}>
                <button className="focus:outline-none disabled:opacity-50 disabled:cursor-wait">
                  <Badge className={`text-[10px] font-medium cursor-pointer ${tc.color}`}>{tc.label}</Badge>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.entries(trackingConfig).map(([key, cfg]) => (
                  <DropdownMenuItem key={key} onClick={() => updateTrackingStatus(goal.id, key, goal.employee?.id ?? undefined)} className="text-xs">
                    <div className={`h-2 w-2 rounded-full ${cfg.barColor} mr-2`} />{cfg.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        );
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

  async function handleCreate() {
    if (!newGoal.title || !newGoal.employee_id) return;
    setCreateLoading(true);
    try {
      const { error } = await supabase.from("goals").insert({
        title: newGoal.title,
        employee_id: newGoal.employee_id,
        workspace_id: workspaceId,
        goal_direction: newGoal.goal_direction,
        metric_target: newGoal.metric_target ? Number(newGoal.metric_target) : null,
        metric_unit: newGoal.metric_unit || null,
        metric_start: newGoal.metric_start ? Number(newGoal.metric_start) : null,
        cycle_id: newGoal.cycle_id || null,
        due_date: newGoal.due_date || null,
        scope: newGoal.scope,
        parent_id: newGoal.parent_id || null,
        description: newGoal.description || null,
        weight: Math.min(1, Math.max(0, Number(newGoal.weight) || 1)),
        status: "active",
        progress: 0,
      });
      if (error) throw error;
      setShowCreatePanel(false);
      setNewGoal({ title: "", employee_id: "", goal_direction: "increase", metric_target: "", metric_unit: "", metric_start: "", cycle_id: "", due_date: "", scope: "individual", parent_id: "", description: "", weight: "1" });
      router.refresh();
    } catch (err) {
      console.error("Failed to create goal:", err);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDelete() {
    if (!goalToDelete) return;
    try {
      await supabase.from("goals").update({ parent_id: null }).eq("parent_id", goalToDelete.id).eq("workspace_id", workspaceId);
      const { error } = await supabase.from("goals").delete().eq("id", goalToDelete.id).eq("workspace_id", workspaceId);
      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error("Failed to delete goal:", err);
    } finally {
      setShowDeleteDialog(false);
      setGoalToDelete(null);
    }
  }

  async function handleDuplicateToCycle() {
    if (!goalToDuplicate || !dupTargetCycleId) return;
    setCreateLoading(true);
    try {
      const { error } = await supabase.from("goals").insert({
        title: goalToDuplicate.title,
        description: goalToDuplicate.description,
        employee_id: goalToDuplicate.employee?.id ?? null,
        cycle_id: dupTargetCycleId,
        parent_id: goalToDuplicate.parent_id,
        scope: goalToDuplicate.scope,
        goal_direction: goalToDuplicate.goal_direction || "increase",
        metric_unit: goalToDuplicate.metric_unit,
        metric_start: goalToDuplicate.metric_current ?? goalToDuplicate.metric_start,
        metric_target: goalToDuplicate.metric_target,
        metric_current: null,
        weight: goalToDuplicate.weight,
        workspace_id: workspaceId,
        status: "active",
        progress: 0,
        tracking_status: null,
        due_date: null,
      });
      if (error) throw error;
      setShowDupCycleDialog(false);
      setGoalToDuplicate(null);
      setDupTargetCycleId("");
      router.refresh();
    } catch (err) {
      console.error("Failed to duplicate goal to cycle:", err);
    } finally {
      setCreateLoading(false);
    }
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

  function openEditPanel(goal: NormalizedGoalRow) {
    setEditGoal(goal);
    setEditForm({
      title: goal.title,
      description: goal.description || "",
      employee_id: goal.employee?.id || "",
      goal_direction: goal.goal_direction || "increase",
      metric_target: goal.metric_target != null ? String(goal.metric_target) : "",
      metric_unit: goal.metric_unit || "",
      metric_start: goal.metric_start != null ? String(goal.metric_start) : "",
      metric_current: goal.metric_current != null ? String(goal.metric_current) : "",
      cycle_id: goal.cycle?.id || "",
      due_date: goal.due_date || "",
      scope: goal.scope || "individual",
      parent_id: goal.parent_id || "",
      weight: String(goal.weight ?? 1),
      status: goal.status || "active",
      tracking_status: goal.tracking_status || "on_track",
    });
    setShowEditPanel(true);
  }

  async function handleEdit() {
    if (!editGoal || !editForm.title) return;
    setEditLoading(true);
    try {
      const { error } = await supabase.from("goals").update({
        title: editForm.title,
        description: editForm.description || null,
        employee_id: editForm.employee_id || null,
        goal_direction: editForm.goal_direction,
        metric_target: editForm.metric_target ? Number(editForm.metric_target) : null,
        metric_unit: editForm.metric_unit || null,
        metric_start: editForm.metric_start ? Number(editForm.metric_start) : null,
        metric_current: editForm.metric_current ? Number(editForm.metric_current) : null,
        cycle_id: editForm.cycle_id || null,
        due_date: editForm.due_date || null,
        scope: editForm.scope,
        parent_id: editForm.parent_id || null,
        weight: Math.min(1, Math.max(0, Number(editForm.weight) || 1)),
        status: editForm.status,
        tracking_status: editForm.tracking_status,
      }).eq("id", editGoal.id).eq("workspace_id", workspaceId);
      if (error) throw error;
      setShowEditPanel(false);
      setEditGoal(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to update goal:", err);
    } finally {
      setEditLoading(false);
    }
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
          <Button size="sm" onClick={() => setShowCreatePanel(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Goal
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

        {/* Column visibility toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs ml-auto">
              <SlidersHorizontal className="h-3 w-3 mr-1.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {ALL_COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50 rounded-sm"
              >
                <Checkbox
                  checked={visibleColumns.has(col.key)}
                  disabled={col.key === "goal"}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                {col.label}
              </label>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hierarchy warning when filters active */}
      {hasActiveFilter && goals.some((g) => g.parent_id) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-400/5 text-sky-700 dark:text-sky-300 text-xs">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Goal hierarchy is hidden while filters are active.</span>
          <button
            onClick={() => { setSearch(""); setCycleFilter("all"); setScopeFilter("all"); setStatusFilter("all"); }}
            className="underline ml-0.5"
          >
            Clear filters
          </button>
        </div>
      )}

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
                {activeColumns.map((c) => renderColumnHeader(c.key))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {flat.map((goal) => {
                const tc = trackingConfig[goal.tracking_status] || trackingConfig.on_track;

                return (
                  <TableRow key={goal.id} className="group">
                    {activeColumns.map((c) => renderColumnCell(c.key, goal, tc))}
                    {/* Actions */}
                    <TableCell className="w-10 pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditPanel(goal)}>
                            <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(goal)}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setGoalToDuplicate(goal); setShowDupCycleDialog(true); }}>
                            <ArrowUpDown className="h-3.5 w-3.5 mr-2" /> Duplicate to Cycle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { setGoalToDelete(goal); setShowDeleteDialog(true); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
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
      <Sheet open={showCreatePanel} onOpenChange={setShowCreatePanel}>
        <SheetContent className="sm:max-w-md overflow-y-auto px-6">
          <SheetHeader className="pb-4">
            <SheetTitle>Create Goal</SheetTitle>
            <SheetDescription>Set a KPI target for your team or individual.</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Goal title *</Label>
              <Input placeholder="e.g. Increase quarterly revenue" value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Owner *</Label>
              <Select value={newGoal.employee_id} onValueChange={(v) => setNewGoal({ ...newGoal, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {(employees || []).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.slack_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tracking</Label>
              <div className="flex gap-2">
                <Select value={newGoal.goal_direction} onValueChange={(v) => setNewGoal({ ...newGoal, goal_direction: v })}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">&#8593; Increase to</SelectItem>
                    <SelectItem value="decrease">&#8595; Decrease to</SelectItem>
                    <SelectItem value="above">&#8805; Stay above</SelectItem>
                    <SelectItem value="below">&#8804; Stay below</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Target" value={newGoal.metric_target} onChange={(e) => setNewGoal({ ...newGoal, metric_target: e.target.value })} className="w-24" />
                <Input placeholder="Unit" value={newGoal.metric_unit} onChange={(e) => setNewGoal({ ...newGoal, metric_unit: e.target.value })} className="w-20" />
              </div>
              <div className="flex gap-2 mt-2">
                <Input type="number" placeholder="Baseline" value={newGoal.metric_start} onChange={(e) => setNewGoal({ ...newGoal, metric_start: e.target.value })} className="w-24" />
                <p className="text-[11px] text-muted-foreground self-center">Starting value for progress calculation</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="What does success look like?" value={newGoal.description} onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })} rows={3} />
            </div>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              More options
            </button>
            {showAdvanced && (
              <div className="space-y-4 pl-3 border-l-2 border-border/50">
                <div className="space-y-1.5">
                  <Label>Performance Cycle</Label>
                  <Select value={newGoal.cycle_id} onValueChange={(v) => setNewGoal({ ...newGoal, cycle_id: v })}>
                    <SelectTrigger><SelectValue placeholder="None (standalone)" /></SelectTrigger>
                    <SelectContent>
                      {cycles.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due date</Label>
                  <Input type="date" value={newGoal.due_date} onChange={(e) => setNewGoal({ ...newGoal, due_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Scope</Label>
                  <Select value={newGoal.scope} onValueChange={(v) => setNewGoal({ ...newGoal, scope: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Parent goal</Label>
                  <Select value={newGoal.parent_id} onValueChange={(v) => setNewGoal({ ...newGoal, parent_id: v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {goals.map((g: any) => (<SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Weight</Label>
                  <Input type="number" step="0.1" min="0" max="1" value={newGoal.weight} onChange={(e) => {
                    const val = Math.min(1, Math.max(0, Number(e.target.value) || 0));
                    setNewGoal({ ...newGoal, weight: String(val) });
                  }} className="w-24" />
                  <p className="text-[11px] text-muted-foreground">0 to 1.0 — relative importance</p>
                </div>
              </div>
            )}
          </div>
          <SheetFooter className="pt-6">
            <Button onClick={handleCreate} disabled={createLoading || !newGoal.title || !newGoal.employee_id} className="w-full">
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Goal
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={showEditPanel} onOpenChange={setShowEditPanel}>
        <SheetContent className="sm:max-w-md overflow-y-auto px-6">
          <SheetHeader className="pb-4">
            <SheetTitle>Edit Goal</SheetTitle>
            <SheetDescription>Update this KPI target.</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Goal title *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={editForm.employee_id} onValueChange={(v) => setEditForm({ ...editForm, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {(employees || []).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.slack_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>KPI Target</Label>
              <div className="flex gap-2">
                <Select value={editForm.goal_direction} onValueChange={(v) => setEditForm({ ...editForm, goal_direction: v })}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">&#8593; Increase to</SelectItem>
                    <SelectItem value="decrease">&#8595; Decrease to</SelectItem>
                    <SelectItem value="above">&#8805; Stay above</SelectItem>
                    <SelectItem value="below">&#8804; Stay below</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Target" value={editForm.metric_target} onChange={(e) => setEditForm({ ...editForm, metric_target: e.target.value })} className="w-24" />
                <Input placeholder="Unit" value={editForm.metric_unit} onChange={(e) => setEditForm({ ...editForm, metric_unit: e.target.value })} className="w-20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Current value</Label>
              <Input type="number" placeholder="Current" value={editForm.metric_current} onChange={(e) => setEditForm({ ...editForm, metric_current: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Baseline value</Label>
              <Input type="number" placeholder="Starting value" value={editForm.metric_start} onChange={(e) => setEditForm({ ...editForm, metric_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Performance Cycle</Label>
              <Select value={editForm.cycle_id} onValueChange={(v) => setEditForm({ ...editForm, cycle_id: v })}>
                <SelectTrigger><SelectValue placeholder="None (standalone)" /></SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={editForm.scope} onValueChange={(v) => setEditForm({ ...editForm, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tracking Status</Label>
              <Select value={editForm.tracking_status} onValueChange={(v) => setEditForm({ ...editForm, tracking_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="achieved">Achieved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="What does success look like?" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Weight</Label>
              <Input type="number" step="0.1" min="0" max="1" value={editForm.weight} onChange={(e) => {
                const val = Math.min(1, Math.max(0, Number(e.target.value) || 0));
                setEditForm({ ...editForm, weight: String(val) });
              }} className="w-24" />
              <p className="text-[11px] text-muted-foreground">0 to 1.0 — relative importance</p>
            </div>
          </div>
          <SheetFooter className="pt-6">
            <Button onClick={handleEdit} disabled={editLoading || !editForm.title} className="w-full">
              {editLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Goal?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{goalToDelete?.title}&quot;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDupCycleDialog} onOpenChange={setShowDupCycleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate to Cycle</DialogTitle>
            <DialogDescription>
              Copy &quot;{goalToDuplicate?.title}&quot; to a new cycle. The current value will become the new baseline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Target cycle</Label>
              <Select value={dupTargetCycleId} onValueChange={setDupTargetCycleId}>
                <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {goalToDuplicate?.metric_current != null && (
              <p className="text-xs text-muted-foreground">
                New baseline: {goalToDuplicate.metric_current}{goalToDuplicate.metric_unit || ""} (carried from current value)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDupCycleDialog(false)}>Cancel</Button>
            <Button onClick={handleDuplicateToCycle} disabled={!dupTargetCycleId || createLoading}>
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
