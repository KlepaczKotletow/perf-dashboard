"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function NewGoalPage() {
  const router = useRouter();
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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const [{ data: users }, { data: perfCycles }, { data: goals }] = await Promise.all([
        supabase.from("users").select("id, slack_name").order("slack_name"),
        supabase.from("performance_cycles").select("id, name").order("created_at", { ascending: false }),
        supabase.from("goals").select("id, title").order("title"),
      ]);
      setEmployees(users || []);
      setCycles(perfCycles || []);
      setExistingGoals(goals || []);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const dueDate = formData.get("due_date") as string;
    const weight = parseFloat(formData.get("weight") as string) || 1.0;
    const metricStart = formData.get("metric_start") as string;
    const metricTarget = formData.get("metric_target") as string;
    const metricUnit = formData.get("metric_unit") as string;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated"); setLoading(false); return; }

      const { error: insertError } = await supabase.from("goals").insert({
        title,
        description: description || null,
        employee_id: employeeId,
        cycle_id: cycleId || null,
        parent_id: parentId || null,
        due_date: dueDate || null,
        status: "draft",
        progress: 0,
        weight,
        metric_start: metricStart ? parseFloat(metricStart) : null,
        metric_current: metricStart ? parseFloat(metricStart) : null,
        metric_target: metricTarget ? parseFloat(metricTarget) : null,
        metric_unit: metricUnit || null,
        tracking_status: trackingStatus,
        scope,
        workspace_id: user.user_metadata?.workspace_id,
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/goals"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">New Goal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Set an objective for tracking</p>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Goal Title *</Label>
              <Input id="title" name="title" placeholder="e.g., Improve API response times by 50%" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="Describe the goal, success criteria, and expected outcomes..." rows={3} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cycle">Performance Cycle</Label>
                <Select value={cycleId} onValueChange={setCycleId}>
                  <SelectTrigger><SelectValue placeholder="Link to cycle" /></SelectTrigger>
                  <SelectContent>
                    {cycles.map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>{cycle.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Parent Goal</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                  <SelectContent>
                    {existingGoals.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Metrics */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                Metric Tracking (optional)
              </Label>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="metric_start" className="text-xs">Start Value</Label>
                  <Input id="metric_start" name="metric_start" type="number" step="any" placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="metric_target" className="text-xs">Target Value</Label>
                  <Input id="metric_target" name="metric_target" type="number" step="any" placeholder="100" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="metric_unit" className="text-xs">Unit</Label>
                  <Input id="metric_unit" name="metric_unit" placeholder="%, deals, hours..." />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight</Label>
                <Input id="weight" name="weight" type="number" step="0.01" min="0.01" defaultValue="1.00" />
              </div>
              <div className="space-y-2">
                <Label>Tracking Status</Label>
                <Select value={trackingStatus} onValueChange={setTrackingStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_track">On Track</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input id="due_date" name="due_date" type="date" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/goals">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading || !employeeId}>
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
