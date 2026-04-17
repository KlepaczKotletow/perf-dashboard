"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

interface Props {
  competency: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
  };
  descriptors: Array<{ id: string; score: number; description: string }>;
  workspaceId: string;
  scale: { min: number; max: number; labels: Record<string, string> };
}

export default function DescriptorsClient({
  competency,
  descriptors,
  workspaceId,
  scale,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  // Seed a row per score value in the scale, prefilled from existing descriptors.
  const initial = useMemo(() => {
    const byScore = new Map<number, string>();
    for (const d of descriptors) byScore.set(d.score, d.description);
    const out: Record<number, string> = {};
    for (let s = scale.min; s <= scale.max; s++) {
      out[s] = byScore.get(s) ?? "";
    }
    return out;
  }, [descriptors, scale.min, scale.max]);

  const [values, setValues] = useState<Record<number, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = Object.entries(values).some(
    ([s, v]) => (v ?? "") !== (initial[Number(s)] ?? ""),
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Upsert any score whose text is non-empty; delete rows whose text was
      // cleared so we don't store empty descriptors.
      const upserts = Object.entries(values)
        .filter(([, v]) => v.trim().length > 0)
        .map(([s, v]) => ({
          competency_id: competency.id,
          workspace_id: workspaceId,
          score: Number(s),
          description: v.trim(),
        }));

      const clearedScores = Object.entries(values)
        .filter(([s, v]) => v.trim().length === 0 && (initial[Number(s)] ?? "").length > 0)
        .map(([s]) => Number(s));

      if (upserts.length > 0) {
        const { error: upsertErr } = await supabase
          .from("competency_score_descriptors")
          .upsert(upserts, { onConflict: "competency_id,score" });
        if (upsertErr) throw upsertErr;
      }

      if (clearedScores.length > 0) {
        const { error: delErr } = await supabase
          .from("competency_score_descriptors")
          .delete()
          .eq("competency_id", competency.id)
          .eq("workspace_id", workspaceId)
          .in("score", clearedScores);
        if (delErr) throw delErr;
      }

      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save descriptors";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const scores: number[] = [];
  for (let s = scale.min; s <= scale.max; s++) scores.push(s);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        hat="manage"
        title="Score descriptors"
        subtitle={competency.name}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/competencies">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Link>
          </Button>
        }
      />
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {competency.name}
            </h2>
            {competency.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {competency.category}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Score descriptors — what does each rating mean for this competency?
            Reviewers see these on the review form to anchor their judgement,
            and employees see them on released grades.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border/60 bg-muted/20 py-3 px-6">
          <p className="text-xs text-muted-foreground">
            Rating scale: <span className="font-medium text-foreground">{scale.min} – {scale.max}</span>
            {Object.keys(scale.labels).length > 0 && (
              <span className="ml-2">
                ({scores.map((s) => scale.labels[String(s)]).filter(Boolean).join(" · ")})
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/60">
          {scores.map((score) => (
            <div key={score} className="px-6 py-4 grid grid-cols-[80px_1fr] gap-6 items-start">
              <div>
                <div className="text-2xl font-semibold tabular-nums text-foreground">
                  {score}
                </div>
                {scale.labels[String(score)] && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {scale.labels[String(score)]}
                  </div>
                )}
              </div>
              <textarea
                value={values[score] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [score]: e.target.value }))
                }
                placeholder={`What does a ${score} look like for ${competency.name}?`}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {!saving && savedAt && <Check className="h-4 w-4 mr-2 text-emerald-500" />}
          {savedAt ? "Saved" : "Save descriptors"}
        </Button>
        {dirty && !saving && !savedAt && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
