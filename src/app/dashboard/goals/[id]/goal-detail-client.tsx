"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GoalDetailClientProps {
  goal: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    progress: number;
    weight: number;
    metric_start: number | null;
    metric_current: number | null;
    metric_target: number | null;
    metric_unit: string | null;
    tracking_status: string | null;
    scope: string;
    due_date: string | null;
    employee?: { id: string; slack_name: string; department: string | null } | null;
    cycle?: { id: string; name: string } | null;
    parent?: { id: string; title: string } | null;
  };
  children: Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
    tracking_status: string | null;
    weight: number;
  }>;
  canEdit: boolean;
  cycles: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; slack_name: string }>;
}

interface EditForm {
  title: string;
  description: string;
  progress: number;
  tracking_status: string;
  status: string;
  metric_current: string;
  due_date: string;
  weight: number;
}

// ─── Tracking status config ──────────────────────────────────────────────────

const trackingConfig: Record<string, { label: string; color: string }> = {
  on_track: {
    label: "On track",
    color:
      "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
  },
  at_risk: {
    label: "At risk",
    color:
      "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
  },
  delayed: {
    label: "Delayed",
    color: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-400/10",
  },
  achieved: {
    label: "Achieved",
    color:
      "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
  },
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function scopeLabel(scope: string): string {
  switch (scope) {
    case "company":
      return "Company";
    case "team":
      return "Team";
    case "individual":
      return "Individual";
    default:
      return scope;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GoalDetailClient({
  goal,
  children,
  canEdit,
  cycles,
  employees,
}: GoalDetailClientProps) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState<EditForm>({
    title: goal.title,
    description: goal.description ?? "",
    progress: goal.progress,
    tracking_status: goal.tracking_status ?? "on_track",
    status: goal.status,
    metric_current: goal.metric_current != null ? String(goal.metric_current) : "",
    due_date: goal.due_date ? goal.due_date.slice(0, 10) : "",
    weight: goal.weight,
  });

  function handleCancel() {
    setForm({
      title: goal.title,
      description: goal.description ?? "",
      progress: goal.progress,
      tracking_status: goal.tracking_status ?? "on_track",
      status: goal.status,
      metric_current: goal.metric_current != null ? String(goal.metric_current) : "",
      due_date: goal.due_date ? goal.due_date.slice(0, 10) : "",
      weight: goal.weight,
    });
    setSaveError(null);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      progress: Number(form.progress),
      tracking_status: form.tracking_status,
      status: form.status,
      metric_current: form.metric_current !== "" ? Number(form.metric_current) : null,
      due_date: form.due_date || null,
      weight: Number(form.weight),
    };

    const { error } = await supabase.from("goals").update(payload).eq("id", goal.id);

    setSaving(false);

    if (error) {
      setSaveError(error.message || "Failed to save changes. Please try again.");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  // ─── Derived ────────────────────────────────────────────────────────────

  const tc = goal.tracking_status ? trackingConfig[goal.tracking_status] : null;
  const progressPct = Math.min(100, Math.max(0, goal.progress));

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" asChild>
            <Link href="/dashboard/goals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Link href="/dashboard/goals" className="hover:text-foreground transition-colors">
                Goals
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="text-foreground font-medium truncate">{goal.title}</span>
            </nav>
            {/* Title + badges */}
            {editing ? (
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="text-xl font-semibold h-auto py-1 px-2 -mx-2"
              />
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {goal.title}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {tc && (
                <Badge className={`text-[11px] font-medium ${tc.color}`}>{tc.label}</Badge>
              )}
              {goal.status === "draft" && (
                <Badge
                  variant="outline"
                  className="text-[11px] font-normal text-muted-foreground"
                >
                  Draft
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Edit / Save / Cancel buttons */}
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {editing ? (
              <>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={saving}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                className="gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 px-3 py-2 rounded-md">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {saveError}
        </div>
      )}

      {/* ── Goal Details card ─────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Goal Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {/* Owner */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Owner
            </p>
            <p className="text-foreground font-medium">
              {goal.employee?.slack_name ?? "—"}
            </p>
            {goal.employee?.department && (
              <p className="text-xs text-muted-foreground">{goal.employee.department}</p>
            )}
          </div>

          {/* Scope */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Scope
            </p>
            <p className="text-foreground font-medium">{scopeLabel(goal.scope)}</p>
          </div>

          {/* Cycle */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Cycle
            </p>
            <p className="text-foreground font-medium">{goal.cycle?.name ?? "—"}</p>
          </div>

          {/* Parent goal */}
          {goal.parent && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Parent Goal
              </p>
              <Link
                href={`/dashboard/goals/${goal.parent.id}`}
                className="text-foreground font-medium hover:underline"
              >
                {goal.parent.title}
              </Link>
            </div>
          )}

          {/* Due date */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Due Date
            </p>
            {editing ? (
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="h-8 text-sm max-w-[180px]"
              />
            ) : (
              <p className="text-foreground font-medium">
                {goal.due_date
                  ? format(new Date(goal.due_date), "MMM d, yyyy")
                  : "—"}
              </p>
            )}
          </div>

          {/* Weight */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Weight
            </p>
            {editing ? (
              <Input
                type="number"
                min={1}
                max={5}
                step={1}
                value={form.weight}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weight: Number(e.target.value) }))
                }
                className="h-8 text-sm max-w-[100px]"
              />
            ) : (
              <p className="text-foreground font-medium">{goal.weight}&times;</p>
            )}
          </div>

          {/* Status (edit) */}
          {editing && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                Status
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="h-8 text-sm max-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tracking status (edit) */}
          {editing && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                Tracking Status
              </Label>
              <Select
                value={form.tracking_status}
                onValueChange={(v) => setForm((f) => ({ ...f, tracking_status: v }))}
              >
                <SelectTrigger className="h-8 text-sm max-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(trackingConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Progress card ─────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar + number */}
          {editing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={form.progress}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, progress: Number(e.target.value) }))
                  }
                  className="flex-1 accent-primary"
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.progress}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        progress: Math.min(100, Math.max(0, Number(e.target.value))),
                      }))
                    }
                    className="h-8 w-16 text-sm text-right"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-foreground">{progressPct}%</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Metric row */}
          {goal.metric_target != null && (
            <div className="pt-2 border-t border-border/60">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Metric
              </p>
              {editing ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    {goal.metric_start ?? 0}
                    {goal.metric_unit ? ` ${goal.metric_unit}` : ""}
                  </span>
                  <span className="text-muted-foreground/40">→</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={form.metric_current}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, metric_current: e.target.value }))
                      }
                      className="h-8 w-24 text-sm"
                      placeholder="Current"
                    />
                    {goal.metric_unit && (
                      <span className="text-xs text-muted-foreground">{goal.metric_unit}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground/40">→</span>
                  <span className="text-sm text-muted-foreground">
                    {goal.metric_target}
                    {goal.metric_unit ? ` ${goal.metric_unit}` : ""}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
                  <span>{goal.metric_start ?? 0}</span>
                  <span className="text-muted-foreground/40">→</span>
                  <span className="font-medium text-foreground">
                    {goal.metric_current ?? goal.metric_start ?? 0}
                  </span>
                  <span className="text-muted-foreground/40">→</span>
                  <span>{goal.metric_target}</span>
                  {goal.metric_unit && (
                    <span className="text-xs text-muted-foreground/60">{goal.metric_unit}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Description card ──────────────────────────────────────────────── */}
      {(goal.description || editing) && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Description</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                className="text-sm resize-none"
                placeholder="Add a description…"
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {goal.description}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Child Goals card ──────────────────────────────────────────────── */}
      {children.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Child Goals
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({children.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {children.map((child) => {
                const childTc = child.tracking_status
                  ? trackingConfig[child.tracking_status]
                  : null;
                const childProgress = Math.min(100, Math.max(0, child.progress));

                return (
                  <Link
                    key={child.id}
                    href={`/dashboard/goals/${child.id}`}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Title + badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate group-hover:underline">
                          {child.title}
                        </span>
                        {child.status === "draft" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal text-muted-foreground shrink-0"
                          >
                            Draft
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 shrink-0 w-32">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${childProgress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground w-8 text-right tabular-nums">
                        {child.progress}%
                      </span>
                    </div>

                    {/* Status badge */}
                    {childTc && (
                      <Badge
                        className={`text-[10px] font-medium shrink-0 ${childTc.color}`}
                      >
                        {childTc.label}
                      </Badge>
                    )}

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
