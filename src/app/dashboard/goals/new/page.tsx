"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, ChevronDown, ChevronRight, Zap } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { getClientIdentity } from "@/lib/client-auth";

const GOAL_TEMPLATES = [
  { label: "Improve a Metric", icon: "📈", title: "Improve [metric] by [X]%", metric_start: "0", metric_target: "100", metric_unit: "%", scope: "individual" },
  { label: "Complete a Project", icon: "🏁", title: "Complete [project name] by [date]", scope: "individual" },
  { label: "Earn Certification", icon: "🎓", title: "Obtain [certification name]", scope: "individual" },
  { label: "Reduce Costs", icon: "💰", title: "Reduce [cost area] by [X]%", metric_start: "0", metric_target: "100", metric_unit: "%", scope: "team" },
  { label: "Customer Satisfaction", icon: "⭐", title: "Increase CSAT score to [target]", metric_start: "0", metric_target: "5", metric_unit: "score", scope: "team" },
  { label: "Team Development", icon: "👥", title: "Complete [X] team development sessions", metric_start: "0", metric_target: "4", metric_unit: "sessions", scope: "team" },
];

export default function NewGoalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [existingGoals, setExistingGoals] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [parentId, setParentId] = useState("");
  const [scope, setScope] = useState("individual");
  const [trackingStatus, setTrackingStatus] = useState("on_track");
  const [goalStatus, setGoalStatus] = useState("active");
  const [title, setTitle] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [weight, setWeight] = useState("1.00");
  const [metricStart, setMetricStart] = useState("");
  const [metricTarget, setMetricTarget] = useState("");
  const [metricUnit, setMetricUnit] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const identity = await getClientIdentity(supabase);
      if (!identity) return;
      const wsId = identity.workspaceId;

      const [{ data: users }, { data: perfCycles }, { data: goals }] = await Promise.all([
        supabase.from("users").select("id, slack_name").eq("workspace_id", wsId).order("slack_name"),
        supabase.from("performance_cycles").select("id, name").eq("workspace_id", wsId).order("created_at", { ascending: false }),
        supabase.from("goals").select("id, title").eq("workspace_id", wsId).order("title"),
      ]);
      setEmployees(users || []);
      setCycles(perfCycles || []);
      setExistingGoals(goals || []);

      const paramCycle = searchParams.get("cycle_id");
      const paramEmployee = searchParams.get("employee_id");
      const paramParent = searchParams.get("parent_id");
      if (paramCycle) setCycleId(paramCycle);
      if (paramEmployee) setEmployeeId(paramEmployee);
      if (paramParent) setParentId(paramParent);
    }
    load();
  }, []);

  function applyTemplate(tpl: typeof GOAL_TEMPLATES[0]) {
    setTitle(tpl.title);
    if (tpl.scope) setScope(tpl.scope);
    if (tpl.metric_start) { setMetricStart(tpl.metric_start); setShowAdvanced(true); }
    if (tpl.metric_target) { setMetricTarget(tpl.metric_target); setShowAdvanced(true); }
    if (tpl.metric_unit) { setMetricUnit(tpl.metric_unit); setShowAdvanced(true); }
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const identity = await getClientIdentity(supabase);
      if (!identity) { setError("Not authenticated or workspace not found."); setLoading(false); return; }
      const workspaceId = identity.workspaceId;

      const { error: insertError } = await supabase.from("goals").insert({
        title,
        description: description || null,
        employee_id: employeeId,
        cycle_id: cycleId && cycleId !== "__none__" ? cycleId : null,
        parent_id: parentId && parentId !== "__none__" ? parentId : null,
        due_date: dueDate || null,
        status: goalStatus,
        progress: 0,
        weight: parseFloat(weight) || 1.0,
        metric_start: metricStart ? parseFloat(metricStart) : null,
        metric_current: metricStart ? parseFloat(metricStart) : null,
        metric_target: metricTarget ? parseFloat(metricTarget) : null,
        metric_unit: metricUnit || null,
        tracking_status: trackingStatus,
        scope,
        workspace_id: workspaceId,
      });

      if (insertError) { setError(insertError.message); setLoading(false); return; }
      router.push("/dashboard/goals");
      router.refresh();
    } catch {
      setError("Failed to create goal");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/goals"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">New Goal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Set an objective for tracking</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Start from a template</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {GOAL_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
            >
              <span className="text-xl">{tpl.icon}</span>
              <span className="text-sm font-medium text-foreground">{tpl.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Goal Details</CardTitle>
          <CardDescription>Define a clear, measurable objective</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select value={employeeId} onValueChange={setEmployeeId} required>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.slack_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Goal Title *</Label>
              <Input id="title" ref={titleInputRef} placeholder="e.g., Improve API response times by 50%" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Describe the goal, success criteria, and expected outcomes..." rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cycle">Performance Cycle</Label>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger><SelectValue placeholder="Link to cycle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (no cycle)</SelectItem>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>{cycle.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-2"
            >
              {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {showAdvanced ? "Hide" : "Show"} advanced options
            </button>

            {showAdvanced && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Scope</Label>
                    <Select value={scope} onValueChange={setScope}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Parent Goal</Label>
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (top-level)</SelectItem>
                        {existingGoals.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                    Metric Tracking (optional)
                  </Label>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="metric_start" className="text-xs">Start Value</Label>
                      <Input id="metric_start" type="number" step="any" placeholder="0" value={metricStart} onChange={(e) => setMetricStart(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="metric_target" className="text-xs">Target Value</Label>
                      <Input id="metric_target" type="number" step="any" placeholder="100" value={metricTarget} onChange={(e) => setMetricTarget(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="metric_unit" className="text-xs">Unit</Label>
                      <Input id="metric_unit" placeholder="%, deals, hours..." value={metricUnit} onChange={(e) => setMetricUnit(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <Input id="weight" type="number" step="0.01" min="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={goalStatus} onValueChange={setGoalStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tracking Status</Label>
                    <Select value={trackingStatus} onValueChange={setTrackingStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_track">On Track</SelectItem>
                        <SelectItem value="at_risk">At Risk</SelectItem>
                        <SelectItem value="delayed">Delayed</SelectItem>
                        <SelectItem value="achieved">Achieved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/goals">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading || !employeeId || !title.trim()}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Goal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
