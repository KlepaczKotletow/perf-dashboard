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
  Building2, Star, Save, Check, Eye, Bell, MessageSquare,
  Shield, Link2,
} from "lucide-react";

interface Props {
  workspace: {
    id: string;
    teamName: string;
    teamId: string;
    ratingScale: { min: number; max: number; labels: Record<string, string> };
    installedAt: string | null;
  };
}

export function SettingsClient({ workspace }: Props) {
  const [teamName, setTeamName] = useState(workspace.teamName);
  const [ratingScale, setRatingScale] = useState(workspace.ratingScale);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Review visibility & process settings (stored locally for now, DB migration later)
  const [peerAnonymity, setPeerAnonymity] = useState(true);
  const [selfReviewRequired, setSelfReviewRequired] = useState(true);
  const [managerCanSeeUpward, setManagerCanSeeUpward] = useState(false);
  const [shareRatingsWithEmployee, setShareRatingsWithEmployee] = useState(true);

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
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how reviews, ratings, and notifications work across your organisation
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </Button>
      </div>

      {/* General */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organisation
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
              <p className="text-[11px] text-muted-foreground">Shown in Nami bot messages and review headers</p>
            </div>
            <div className="space-y-2">
              <Label>Slack workspace</Label>
              <div className="flex items-center gap-2">
                <Input value={workspace.teamId} disabled className="font-mono text-xs" />
                <Badge variant="secondary" className="shrink-0 text-[10px]">Connected</Badge>
              </div>
              {workspace.installedAt && (
                <p className="text-[11px] text-muted-foreground">
                  Since {new Date(workspace.installedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
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
            This scale is used across all performance reviews — both on the web dashboard and in Slack via Nami bot.
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
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Labels</Label>
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

      {/* Review Visibility & Process */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Review Visibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Anonymous peer reviews</Label>
              <p className="text-xs text-muted-foreground">
                Hide reviewer names when sharing peer feedback with employees
              </p>
            </div>
            <Switch checked={peerAnonymity} onCheckedChange={setPeerAnonymity} />
          </div>

          <div className="border-t border-border/40" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Share ratings with employees</Label>
              <p className="text-xs text-muted-foreground">
                Allow employees to see their numerical ratings after review completion
              </p>
            </div>
            <Switch checked={shareRatingsWithEmployee} onCheckedChange={setShareRatingsWithEmployee} />
          </div>

          <div className="border-t border-border/40" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Manager sees upward reviews</Label>
              <p className="text-xs text-muted-foreground">
                Let managers see individual upward feedback (not just aggregated)
              </p>
            </div>
            <Switch checked={managerCanSeeUpward} onCheckedChange={setManagerCanSeeUpward} />
          </div>
        </CardContent>
      </Card>

      {/* Review Process */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Review Process
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Require self-review</Label>
              <p className="text-xs text-muted-foreground">
                Employees must complete a self-review before the manager can submit theirs
              </p>
            </div>
            <Switch checked={selfReviewRequired} onCheckedChange={setSelfReviewRequired} />
          </div>
        </CardContent>
      </Card>

      {/* Nami Bot / Notifications */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Nami Bot & Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Slack notifications</p>
                <p className="text-xs text-muted-foreground">
                  Nami sends DMs when review cycles launch, reminders before deadlines (7 days, 3 days, day-of),
                  and alerts managers when their direct reports complete self-reviews.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  To configure which messages are sent, adjust settings in <strong>Step 4 (Nami Bot)</strong> when creating each cycle.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Related Settings
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
