"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase";
import {
  Building2, Star, Save, Check, Eye, Bell,
  Upload, X, Clock, Plus, Trash2, ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TenureBucket } from "@/lib/types";
import { PageHeader } from "@/components/page-header";

/**
 * Shared section header — icon badge + title + optional subtitle.
 * Used for every top-level section of Settings so the rhythm is consistent.
 */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground leading-tight">{title}</h3>
        {subtitle && (
          <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

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
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        hat="manage"
        title="Settings"
        subtitle="Workspace defaults"
        actions={
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      {/* Organisation */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <SectionHeader icon={Building2} title="Organisation" subtitle="Branding and Slack connection" />
          <div className="flex items-start gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Logo</Label>
              <div className="relative group">
                {logoUrl ? (
                  <div className="relative">
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-20 w-20 rounded-2xl object-cover border border-border/60 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setLogoUrl(null)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      aria-label="Remove logo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-20 w-20 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.03] flex flex-col items-center justify-center gap-1 transition-colors"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{uploading ? "Uploading…" : "Upload"}</span>
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
                  className="text-[11px] text-primary hover:underline"
                >
                  Change
                </button>
              )}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="teamName" className="text-xs font-medium text-muted-foreground">Organisation name</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Your company name"
                />
                <p className="text-[11px] text-muted-foreground">Shown in Nami bot messages and review headers.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Slack workspace</Label>
                <div className="flex items-center gap-2">
                  <Input value={workspace.teamId} disabled className="font-mono text-xs" />
                  <Badge className="shrink-0 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-400/20">Connected</Badge>
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
      <Card className="border-border/60">
        <CardContent className="p-6">
          <SectionHeader
            icon={Star}
            title="Rating Scale"
            subtitle="Used across reviews on the web and in Slack. Max is 7 (Slack button limit)."
          />
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="space-y-1.5">
              <Label htmlFor="scaleMin" className="text-xs font-medium text-muted-foreground">Minimum</Label>
              <Input
                id="scaleMin"
                type="number"
                min={0}
                max={ratingScale.max - 1}
                value={ratingScale.min}
                onChange={(e) => setRatingScale({ ...ratingScale, min: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scaleMax" className="text-xs font-medium text-muted-foreground">Maximum</Label>
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

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Labels</Label>
            <div className="space-y-2 rounded-lg border border-border/60 overflow-hidden">
              {Array.from({ length: ratingScale.max - ratingScale.min + 1 }, (_, i) => {
                const val = ratingScale.min + i;
                const span = ratingScale.max - ratingScale.min;
                // Interpolate across red → amber → green based on position in range
                const pos = span === 0 ? 1 : (val - ratingScale.min) / span;
                const tileClass =
                  pos < 0.34 ? "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400"
                  : pos < 0.67 ? "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400"
                  : pos < 0.85 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"
                  : "bg-emerald-200 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-300";
                return (
                  <div key={val} className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-b-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${tileClass}`}>
                      <span className="text-sm font-bold tabular-nums">{val}</span>
                    </div>
                    <Input
                      value={ratingScale.labels[val] || ""}
                      onChange={(e) => updateLabel(String(val), e.target.value)}
                      placeholder={`Label for ${val}`}
                      className="text-sm border-0 shadow-none px-0 focus-visible:ring-0 bg-transparent"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenure Buckets */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <SectionHeader
            icon={Clock}
            title="Tenure Buckets"
            subtitle="How employee tenure is grouped in analytics heatmaps. Based on time since start date."
          />

          <div className="space-y-2">
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
            className="gap-1.5 mt-4"
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

      {/* Review Process & Visibility — merged */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <SectionHeader
            icon={Eye}
            title="Review process & visibility"
            subtitle="How reviews are conducted and what participants see"
          />
          <div className="rounded-lg border border-border/60 divide-y divide-border/60 overflow-hidden">
            {[
              {
                label: "Require self-review",
                description: "Employees must complete a self-review before the manager can submit theirs.",
                checked: selfReviewRequired,
                onChange: setSelfReviewRequired,
              },
              {
                label: "Anonymous peer reviews",
                description: "Hide reviewer names when sharing peer feedback with employees.",
                checked: peerAnonymity,
                onChange: setPeerAnonymity,
              },
              {
                label: "Share ratings with employees",
                description: "Allow employees to see their numerical ratings after review completion.",
                checked: shareRatingsWithEmployee,
                onChange: setShareRatingsWithEmployee,
              },
              {
                label: "Manager sees individual upward reviews",
                description: "Let managers see individual upward feedback (not just aggregated).",
                checked: managerCanSeeUpward,
                onChange: setManagerCanSeeUpward,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <Label className="text-sm font-medium text-foreground">{row.label}</Label>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{row.description}</p>
                </div>
                <Switch checked={row.checked} onCheckedChange={row.onChange} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Nami Bot & Notifications */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <SectionHeader
            icon={Bell}
            title="Nami Bot & Notifications"
            subtitle="How Slack messages are sent from this workspace"
          />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Nami sends Slack DMs when review cycles launch, reminders at <strong className="text-foreground">7 days</strong>, <strong className="text-foreground">3 days</strong>, and <strong className="text-foreground">day-of</strong> before deadlines, and alerts managers when their direct reports complete self-reviews.
          </p>
          <p className="text-[13px] text-muted-foreground leading-relaxed mt-2">
            To configure which messages are sent for a specific cycle, adjust <strong className="text-foreground">Step 4 (Nami Bot)</strong> when launching it.
          </p>
        </CardContent>
      </Card>

      {/* Related Settings — compact link list */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Related settings
          </p>
          <div className="rounded-lg border border-border/60 divide-y divide-border/60 overflow-hidden">
            {[
              { href: "/dashboard/settings/forms",   title: "Kudos Form Builder", subtitle: "Customise the /kudos Slack modal" },
              { href: "/dashboard/settings/billing", title: "Billing & Subscription", subtitle: "Manage plan and payments" },
              { href: "/dashboard/competencies",     title: "Competencies", subtitle: "Manage the competency library" },
              { href: "/dashboard/templates",        title: "Review Templates", subtitle: "Configure review question sets" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{link.title}</p>
                  <p className="text-[11px] text-muted-foreground">{link.subtitle}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
