"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Building2, Briefcase, AlertTriangle, X } from "lucide-react";

interface Props {
  workspaceId: string;
  useDepartments: boolean;
  useCareerFramework: boolean;
}

export function GeneralClient({ workspaceId, useDepartments: initialDepts, useCareerFramework: initialCF }: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const [depts, setDepts] = useState(initialDepts);
  const [cf, setCf] = useState(initialCF);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(field: "use_departments" | "use_career_framework", value: boolean) {
    if (field === "use_departments" && !value && !cf) return;
    if (field === "use_career_framework" && !value && !depts) return;

    if (field === "use_departments") setDepts(value);
    else setCf(value);

    setSaving(true);
    try {
      const { error: err } = await supabase
        .from("workspaces")
        .update({ [field]: value })
        .eq("id", workspaceId);
      if (err) throw err;
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
      if (field === "use_departments") setDepts(!value);
      else setCf(!value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">General Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure how your workspace is structured.</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="border border-border rounded-xl bg-card divide-y divide-border">
        <div className="flex items-start justify-between px-5 py-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-medium">Departments</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track team members by department (Finance, Operations…).
                {!depts && <span className="text-amber-600 ml-1">Hidden from directory and bulk actions.</span>}
              </p>
              {!depts && !cf && <p className="text-xs text-destructive mt-1">At least one must be enabled.</p>}
            </div>
          </div>
          <Switch
            checked={depts}
            disabled={saving || (!depts && !cf)}
            onCheckedChange={(v) => toggle("use_departments", v)}
          />
        </div>

        <div className="flex items-start justify-between px-5 py-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-medium">Career Framework</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enable job functions, levels and competency scorecards.
                {!cf && <span className="text-amber-600 ml-1">Performance scorecards hidden.</span>}
              </p>
              {!depts && !cf && <p className="text-xs text-destructive mt-1">At least one must be enabled.</p>}
            </div>
          </div>
          <Switch
            checked={cf}
            disabled={saving || (!depts && !cf)}
            onCheckedChange={(v) => toggle("use_career_framework", v)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Turning off a feature hides it from the UI but preserves all data. Re-enabling restores everything.
      </p>
    </div>
  );
}
