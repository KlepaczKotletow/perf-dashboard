"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Target, MessageSquare, Plus, X, Loader2, Edit3, Save } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

interface CycleQuestion {
  id: string;
  question_type: "competency" | "text";
  competency_id: string | null;
  prompt: string | null;
  sort_order: number;
  required: boolean;
  competency?: { id: string; name: string; category: string | null } | null;
}

interface Competency {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
}

interface CycleQuestionsProps {
  cycleId: string;
  isDraft: boolean;
  questions: CycleQuestion[];
  allCompetencies: Competency[];
}

export function CycleQuestions({ cycleId, isDraft, questions, allCompetencies }: CycleQuestionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable state
  const [selectedCompIds, setSelectedCompIds] = useState<Set<string>>(
    new Set(questions.filter((q) => q.question_type === "competency" && q.competency_id).map((q) => q.competency_id!))
  );
  const [textQs, setTextQs] = useState(
    questions.filter((q) => q.question_type === "text").map((q) => ({
      prompt: q.prompt || "",
      required: q.required,
    }))
  );
  const [newPrompt, setNewPrompt] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const compQuestions = questions.filter((q) => q.question_type === "competency");
  const txtQuestions = questions.filter((q) => q.question_type === "text");

  // Group competencies
  const categories = [...new Set(allCompetencies.map((c) => c.category || "Uncategorized"))].sort();

  function toggleComp(id: string) {
    setSelectedCompIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeText(idx: number) {
    setTextQs((prev) => prev.filter((_, i) => i !== idx));
  }

  function addText() {
    if (!newPrompt.trim()) return;
    setTextQs((prev) => [...prev, { prompt: newPrompt.trim(), required: true }]);
    setNewPrompt("");
  }

  async function saveChanges() {
    if (selectedCompIds.size === 0 && textQs.length === 0) {
      setError("Add at least one competency or text question");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      // Delete existing questions for this cycle
      await supabase.from("cycle_questions").delete().eq("cycle_id", cycleId);

      // Insert new ones
      const rows: any[] = [];
      let sortOrder = 0;

      for (const compId of selectedCompIds) {
        rows.push({
          cycle_id: cycleId,
          question_type: "competency",
          competency_id: compId,
          sort_order: sortOrder++,
          required: true,
        });
      }

      for (const tq of textQs) {
        rows.push({
          cycle_id: cycleId,
          question_type: "text",
          prompt: tq.prompt,
          sort_order: sortOrder++,
          required: tq.required,
        });
      }

      if (rows.length > 0) {
        const { error: insertErr } = await supabase.from("cycle_questions").insert(rows);
        if (insertErr) throw insertErr;
      }

      setEditing(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ======================================
  // READ-ONLY VIEW
  // ======================================
  if (!editing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-4.5 w-4.5 text-primary" />
                Review Questions
              </CardTitle>
              <CardDescription>
                {questions.length === 0
                  ? "No review questions configured for this cycle."
                  : `${compQuestions.length} competenc${compQuestions.length === 1 ? "y" : "ies"} · ${txtQuestions.length} text question${txtQuestions.length === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
            {isDraft && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        {questions.length > 0 && (
          <CardContent className="space-y-4">
            {/* Competencies */}
            {compQuestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Competency Ratings</p>
                <div className="flex flex-wrap gap-2">
                  {compQuestions.map((q) => (
                    <Badge key={q.id} variant="outline" className="text-sm py-1 px-2.5">
                      {q.competency?.name || "Unknown competency"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {/* Text questions */}
            {txtQuestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Open-Ended Questions</p>
                <div className="space-y-2">
                  {txtQuestions.map((q) => (
                    <div key={q.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1">{q.prompt}</span>
                      {q.required && (
                        <Badge variant="secondary" className="text-[10px]">Required</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
        {questions.length === 0 && isDraft && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click "Edit" to configure which competencies and text questions will be asked during reviews.
            </p>
          </CardContent>
        )}
      </Card>
    );
  }

  // ======================================
  // EDITING VIEW
  // ======================================
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Competency selection */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Competency Ratings
              </CardTitle>
              <CardDescription>Select which competencies to include in this cycle&apos;s reviews</CardDescription>
            </div>
            {allCompetencies.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  if (selectedCompIds.size === allCompetencies.length) setSelectedCompIds(new Set());
                  else setSelectedCompIds(new Set(allCompetencies.map((c) => c.id)));
                }}
              >
                {selectedCompIds.size === allCompetencies.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {allCompetencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No competencies exist yet.{" "}
              <a href="/dashboard/competencies/new" className="underline text-primary">Create competencies</a> first.
            </p>
          ) : (
            <div className="space-y-4">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{cat}</p>
                  <div className="space-y-1">
                    {allCompetencies
                      .filter((c) => (c.category || "Uncategorized") === cat)
                      .map((comp) => (
                        <label
                          key={comp.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                            selectedCompIds.has(comp.id)
                              ? "border-primary/40 bg-primary/[0.03]"
                              : "border-border/60 hover:border-border"
                          }`}
                        >
                          <Checkbox
                            checked={selectedCompIds.has(comp.id)}
                            onCheckedChange={() => toggleComp(comp.id)}
                          />
                          <span className="text-sm font-medium">{comp.name}</span>
                          {comp.description && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              — {comp.description.slice(0, 60)}{comp.description.length > 60 ? "..." : ""}
                            </span>
                          )}
                        </label>
                      ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {selectedCompIds.size} of {allCompetencies.length} selected
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Text questions */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Open-Ended Questions
          </CardTitle>
          <CardDescription>Free-text questions for strengths, values, improvements, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {textQs.map((q, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">{q.prompt}</span>
              {q.required && <Badge variant="outline" className="text-[10px]">Required</Badge>}
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeText(idx)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Type a question..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addText())}
            />
            <Button variant="outline" size="sm" onClick={addText} disabled={!newPrompt.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        <Button onClick={saveChanges} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Save Questions
        </Button>
      </div>
    </div>
  );
}
