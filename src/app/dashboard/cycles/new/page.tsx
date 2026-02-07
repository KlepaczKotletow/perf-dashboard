"use client";

import { useState } from "react";
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

const CYCLE_TYPES = [
  { value: "annual", label: "Annual Review" },
  { value: "mid_year", label: "Mid-Year Review" },
  { value: "quarterly", label: "Quarterly Review" },
  { value: "probation", label: "Probation Review" },
  { value: "custom", label: "Custom" },
];

const DEFAULT_PHASES = [
  { phase_type: "goal_setting", name: "Goal Setting", offsetWeeks: 0, durationWeeks: 2 },
  { phase_type: "self_assessment", name: "Self Assessment", offsetWeeks: 2, durationWeeks: 2 },
  { phase_type: "peer_review", name: "Peer Review", offsetWeeks: 4, durationWeeks: 3 },
  { phase_type: "manager_review", name: "Manager Review", offsetWeeks: 7, durationWeeks: 2 },
  { phase_type: "calibration", name: "Calibration", offsetWeeks: 9, durationWeeks: 1 },
  { phase_type: "communication", name: "Results Communication", offsetWeeks: 10, durationWeeks: 2 },
];

export default function NewCyclePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cycleType, setCycleType] = useState("annual");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const reviewDeadline = formData.get("reviewDeadline") as string;

    // Validate dates
    if (new Date(endDate) <= new Date(startDate)) {
      setError("End date must be after start date");
      setLoading(false);
      return;
    }

    if (reviewDeadline && new Date(reviewDeadline) > new Date(endDate)) {
      setError("Review deadline must be before or on the end date");
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const { data: cycleData, error: insertError } = await supabase
        .from("performance_cycles")
        .insert({
          name,
          description: description || null,
          start_date: startDate,
          end_date: endDate,
          review_deadline: reviewDeadline || null,
          type: cycleType,
          workspace_id: user.user_metadata?.workspace_id,
          created_by: user.user_metadata?.app_user_id,
          status: "draft",
        })
        .select("id")
        .single();

      if (insertError || !cycleData) {
        console.error("Insert error:", insertError);
        setError(insertError?.message || "Failed to create cycle");
        setLoading(false);
        return;
      }

      // Auto-create default phases based on cycle dates
      const cycleStart = new Date(startDate);
      const phases = DEFAULT_PHASES.map((phase, idx) => {
        const phaseStart = new Date(cycleStart);
        phaseStart.setDate(phaseStart.getDate() + phase.offsetWeeks * 7);
        const phaseEnd = new Date(phaseStart);
        phaseEnd.setDate(phaseEnd.getDate() + phase.durationWeeks * 7);
        return {
          cycle_id: cycleData.id,
          phase_type: phase.phase_type,
          name: phase.name,
          start_date: phaseStart.toISOString(),
          end_date: phaseEnd.toISOString(),
          status: "pending",
          sort_order: idx,
        };
      });

      await supabase.from("cycle_phases").insert(phases);

      router.push(`/dashboard/cycles/${cycleData.id}`);
      router.refresh();
    } catch (err) {
      console.error("Error creating cycle:", err);
      setError("Failed to create performance cycle");
      setLoading(false);
    }
  }

  // Calculate default dates
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  const formatDateForInput = (date: Date) => date.toISOString().split("T")[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/cycles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">New Performance Cycle</h1>
          <p className="text-muted-foreground mt-1">Create a new review period for your organization</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cycle Details</CardTitle>
          <CardDescription>
            Define the time period and settings for this performance cycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Cycle Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Q1 2026 Performance Review"
                required
              />
              <p className="text-xs text-muted-foreground">
                Give your cycle a descriptive name
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Cycle Type</Label>
              <Select value={cycleType} onValueChange={setCycleType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the goals and focus areas for this review cycle..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={formatDateForInput(today)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                  defaultValue={formatDateForInput(threeMonthsLater)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reviewDeadline">Review Deadline (Optional)</Label>
              <Input
                id="reviewDeadline"
                name="reviewDeadline"
                type="date"
              />
              <p className="text-xs text-muted-foreground">
                When should all reviews be submitted by?
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/cycles">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Cycle
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
