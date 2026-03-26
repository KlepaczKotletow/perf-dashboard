"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase";
import {
  Building2, Star, Users, BarChart3, Layers, Save, Check,
  Hash, GitBranch, Briefcase,
} from "lucide-react";

interface Props {
  workspace: {
    id: string;
    teamName: string;
    teamId: string;
    useDepartments: boolean;
    useCareerFramework: boolean;
    ratingScale: { min: number; max: number; labels: Record<string, string> };
    installedAt: string | null;
  };
  stats: {
    users: number;
    cycles: number;
    competencies: number;
  };
}

export function SettingsClient({ workspace, stats }: Props) {
  const [teamName, setTeamName] = useState(workspace.teamName);
  const [useDepartments, setUseDepartments] = useState(workspace.useDepartments);
  const [useCareerFramework, setUseCareerFramework] = useState(workspace.useCareerFramework);
  const [ratingScale, setRatingScale] = useState(workspace.ratingScale);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateLabel = (key: string, value: string) => {
    setRatingScale((prev) => ({
      ...prev,
      labels: { ...prev.labels, [key]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const supabase = createClient();
      await supabase
        .from("workspaces")
        .update({
          team_name: teamName,
          use_departments: useDepartments,
          use_career_framework: useCareerFramework,
          rating_scale: ratingScale,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspace.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your workspace configuration
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </Button>
      </div>

      {/* Workspace Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{stats.users}</p>
              <p className="text-xs text-muted-foreground">Team members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{stats.cycles}</p>
              <p className="text-xs text-muted-foreground">Review cycles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{stats.competencies}</p>
              <p className="text-xs text-muted-foreground">Competencies</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="teamName">Organisation name</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Your company name"
              />
            </div>
            <div className="space-y-2">
              <Label>Slack Team ID</Label>
              <div className="flex items-center gap-2">
                <Input value={workspace.teamId} disabled className="font-mono text-xs" />
                <Badge variant="secondary" className="shrink-0 text-[10px]">Read-only</Badge>
              </div>
            </div>
          </div>
          {workspace.installedAt && (
            <p className="text-xs text-muted-foreground">
              Connected since {new Date(workspace.installedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                Departments
              </Label>
              <p className="text-xs text-muted-foreground">
                Organise employees into departments for filtering and reporting
              </p>
            </div>
            <Switch checked={useDepartments} onCheckedChange={setUseDepartments} />
          </div>
          <div className="border-t border-border/40" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                Career Framework
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable job families, levels, and competency matrices
              </p>
            </div>
            <Switch checked={useCareerFramework} onCheckedChange={setUseCareerFramework} />
          </div>
        </CardContent>
      </Card>

      {/* Rating Scale */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Rating Scale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configure the rating scale used across all performance reviews and competency assessments.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scaleMin">Minimum</Label>
              <Input
                id="scaleMin"
                type="number"
                min={0}
                max={ratingScale.max - 1}
                value={ratingScale.min}
                onChange={(e) => setRatingScale({ ...ratingScale, min: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scaleMax">Maximum</Label>
              <Input
                id="scaleMax"
                type="number"
                min={ratingScale.min + 1}
                max={10}
                value={ratingScale.max}
                onChange={(e) => setRatingScale({ ...ratingScale, max: parseInt(e.target.value) || 5 })}
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Scale Labels</Label>
            {Array.from({ length: ratingScale.max - ratingScale.min + 1 }, (_, i) => {
              const val = ratingScale.min + i;
              return (
                <div key={val} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold tabular-nums">{val}</span>
                  </div>
                  <Input
                    value={ratingScale.labels[val] || ""}
                    onChange={(e) => updateLabel(String(val), e.target.value)}
                    placeholder={`Label for ${val}`}
                    className="text-sm"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <a href="/dashboard/settings/forms" className="block rounded-lg border border-border/60 p-3.5 hover:bg-muted/50 transition-colors">
              <p className="text-sm font-medium">Kudos Form Builder</p>
              <p className="text-xs text-muted-foreground mt-0.5">Customise feedback form fields</p>
            </a>
            <a href="/dashboard/settings/billing" className="block rounded-lg border border-border/60 p-3.5 hover:bg-muted/50 transition-colors">
              <p className="text-sm font-medium">Billing & Subscription</p>
              <p className="text-xs text-muted-foreground mt-0.5">Manage plan and payments</p>
            </a>
            <a href="/dashboard/competencies" className="block rounded-lg border border-border/60 p-3.5 hover:bg-muted/50 transition-colors">
              <p className="text-sm font-medium">Competencies</p>
              <p className="text-xs text-muted-foreground mt-0.5">Manage competency library</p>
            </a>
            <a href="/dashboard/templates" className="block rounded-lg border border-border/60 p-3.5 hover:bg-muted/50 transition-colors">
              <p className="text-sm font-medium">Review Templates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Configure review question sets</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
