"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase";
import {
  Building2, Star, Save, Check, Eye, Bell, MessageSquare,
  Shield, Link2, Upload, X, Clock, Plus, Trash2,
} from "lucide-react";
import type { TenureBucket } from "@/lib/types";
import { PageHeader } from "@/components/page-header";

interface Props {
  workspace: {
    id: string;
    teamName: string;
    teamId: string;
    logoUrl: string | null;
    ratingScale: { min: number; max: number; labels: Record<string, string> };
    installedAt: string | null;
  };
  tenureBuckets: TenureBucket[];
}

export function SettingsClient({ workspace, tenureBuckets: initialBuckets }: Props) {
  const [teamName, setTeamName] = useState(workspace.teamName);
  const [logoUrl, setLogoUrl] = useState(workspace.logoUrl);
  const [uploading, setUploading] = useState(false);
  const [ratingScale, setRatingScale] = useState(workspace.ratingScale);
  const [buckets, setBuckets] = useState<TenureBucket[]>(initialBuckets);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Logo must be under 2MB");
      return;
    }
    setUploading(true);
    // Resize to 128x128 and convert to small data URL
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 128, 128);
        const dataUrl = canvas.toDataURL("image/png", 0.8);
        setLogoUrl(dataUrl);
        setUploading(false);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      // Clamp scale: min >= 1, max <= 7 (Slack button limit)
      const clampedScale = {
        ...ratingScale,
        min: Math.max(1, Math.min(ratingScale.min, 6)),
        max: Math.min(7, Math.max(ratingScale.max, ratingScale.min + 1)),
      };
      const supabase = createClient();

      // Publish the rating scale via RPC so a new rating_scales row is created
      // (rather than mutating the existing one in place). Cycles launched
      // from now on stamp this new scale; previously-launched cycles keep
      // their original stamped scale — matches Lattice / Leapsome.
      const { error: scaleErr } = await supabase.rpc("publish_rating_scale", {
        p_min: clampedScale.min,
        p_max: clampedScale.max,
        p_labels: clampedScale.labels ?? {},
      });
      if (scaleErr) throw scaleErr;

      await supabase
        .from("workspaces")
        .update({
          team_name: teamName,
          logo_url: logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspace.id);

      // Save tenure buckets: delete all then re-insert
      await supabase
        .from("tenure_buckets")
        .delete()
        .eq("workspace_id", workspace.id);
      if (buckets.length > 0) {
        await supabase.from("tenure_buckets").insert(
          buckets.map((b, i) => ({
            workspace_id: workspace.id,
            label: b.label,
            min_months: b.min_months,
            max_months: b.max_months,
            sort_order: i,
          }))
        );
      }

      setRatingScale(clampedScale);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      <PageHeader
        hat="manage"
        title="Settings"
        subtitle="Configure how reviews, ratings, and notifications work across your organisation"
        actions={
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      {/* General */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organisation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo + Name row */}
          <div className="flex items-start gap-5">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="relative group">
                {logoUrl ? (
                  <div className="relative">
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-16 w-16 rounded-xl object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setLogoUrl(null)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-16 w-16 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">{uploading ? "..." : "Upload"}</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] text-primary hover:underline"
                >
                  Change
                </button>
              )}
            </div>
            <div className="flex-1 grid grid-cols-2 gap-5">
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
            This scale is used across all performance reviews — both on the web dashboard and in Slack via Nami bot. Maximum is 7 (Slack button limit).
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
                max={7}
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

      {/* Tenure Buckets */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tenure Buckets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Define how employee tenure is grouped in analytics heatmaps. Based on time since start date.
          </p>

          <div className="space-y-3">
            {buckets.map((bucket, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    value={bucket.label}
                    onChange={(e) => {
                      const updated = [...buckets];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setBuckets(updated);
                    }}
                    placeholder="Label"
                    className="text-sm"
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min={0}
                    value={bucket.min_months}
                    onChange={(e) => {
                      const updated = [...buckets];
                      updated[idx] = { ...updated[idx], min_months: parseInt(e.target.value) || 0 };
                      setBuckets(updated);
                    }}
                    placeholder="Min"
                    className="text-sm"
                  />
                </div>
                <span className="text-xs text-muted-foreground">to</span>
                <div className="w-24">
                  <Input
                    type="number"
                    min={0}
                    value={bucket.max_months ?? ""}
                    onChange={(e) => {
                      const updated = [...buckets];
                      const val = e.target.value === "" ? null : parseInt(e.target.value) || 0;
                      updated[idx] = { ...updated[idx], max_months: val };
                      setBuckets(updated);
                    }}
                    placeholder="∞"
                    className="text-sm"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground w-10">months</span>
                {buckets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = buckets.filter((_, i) => i !== idx).map((b, i) => ({ ...b, sort_order: i }));
                      setBuckets(updated);
                    }}
                    className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const lastMax = buckets.length > 0 ? (buckets[buckets.length - 1].max_months ?? 0) : 0;
              setBuckets([
                ...buckets,
                {
                  id: crypto.randomUUID(),
                  workspace_id: workspace.id,
                  label: "New bucket",
                  min_months: lastMax,
                  max_months: null,
                  sort_order: buckets.length,
                },
              ]);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add bucket
          </Button>
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
