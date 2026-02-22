"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Loader2, Plus, X, Target, MessageSquare } from "lucide-react";
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

const SUGGESTED_TEXT_QUESTIONS = [
  "What were this person's key achievements this period?",
  "What areas should they focus on improving?",
  "How did they demonstrate company values?",
  "Any additional comments or recommendations?",
];

interface Competency {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
}

interface TextQuestion {
  prompt: string;
  required: boolean;
}

export default function NewCyclePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cycleType, setCycleType] = useState("annual");

  // Step 1 form data
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reviewDeadline, setReviewDeadline] = useState("");

  // Step 2: review questions
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [selectedCompIds, setSelectedCompIds] = useState<Set<string>>(new Set());
  const [textQuestions, setTextQuestions] = useState<TextQuestion[]>([]);
  const [newPrompt, setNewPrompt] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Calculate default dates
  const today = new Date();
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  useEffect(() => {
    setStartDate(formatDate(today));
    setEndDate(formatDate(threeMonthsLater));
  }, []);

  // Load competencies when moving to step 2
  useEffect(() => {
    if (step === 2 && competencies.length === 0) {
      loadCompetencies();
    }
  }, [step]);

  async function loadCompetencies() {
    const { data } = await supabase
      .from("competencies")
      .select("id, name, category, description")
      .order("category")
      .order("name");
    const comps = data || [];
    setCompetencies(comps);
    // Select all by default
    setSelectedCompIds(new Set(comps.map((c: Competency) => c.id)));
    // Add default text questions
    if (textQuestions.length === 0) {
      setTextQuestions([
        { prompt: "What were this person's key achievements this period?", required: true },
        { prompt: "What areas should they focus on improving?", required: true },
        { prompt: "Any additional comments or recommendations?", required: false },
      ]);
    }
  }

  function toggleCompetency(id: string) {
    setSelectedCompIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllCompetencies() {
    if (selectedCompIds.size === competencies.length) {
      setSelectedCompIds(new Set());
    } else {
      setSelectedCompIds(new Set(competencies.map((c) => c.id)));
    }
  }

  function addTextQuestion() {
    if (!newPrompt.trim()) return;
    setTextQuestions((prev) => [...prev, { prompt: newPrompt.trim(), required: true }]);
    setNewPrompt("");
  }

  function removeTextQuestion(idx: number) {
    setTextQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addSuggested(prompt: string) {
    if (textQuestions.some((q) => q.prompt === prompt)) return;
    setTextQuestions((prev) => [...prev, { prompt, required: true }]);
  }

  // Step 1 validation
  function validateStep1(): boolean {
    if (!name.trim()) { setError("Cycle name is required"); return false; }
    if (!startDate || !endDate) { setError("Start and end dates are required"); return false; }
    if (new Date(endDate) <= new Date(startDate)) { setError("End date must be after start date"); return false; }
    if (reviewDeadline && new Date(reviewDeadline) > new Date(endDate)) { setError("Review deadline must be before end date"); return false; }
    setError(null);
    return true;
  }

  function goToStep2() {
    if (validateStep1()) setStep(2);
  }

  // Final submit
  async function handleSubmit() {
    if (selectedCompIds.size === 0 && textQuestions.length === 0) {
      setError("Add at least one competency or text question");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated"); setLoading(false); return; }

      // 1. Create the cycle
      const { data: cycleData, error: insertError } = await supabase
        .from("performance_cycles")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
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
        setError(insertError?.message || "Failed to create cycle");
        setLoading(false);
        return;
      }

      // 2. Create default phases
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

      // 3. Create cycle_questions
      const questions: any[] = [];
      let sortOrder = 0;

      // Competency questions
      for (const compId of selectedCompIds) {
        questions.push({
          cycle_id: cycleData.id,
          question_type: "competency",
          competency_id: compId,
          sort_order: sortOrder++,
          required: true,
        });
      }

      // Text questions
      for (const tq of textQuestions) {
        questions.push({
          cycle_id: cycleData.id,
          question_type: "text",
          prompt: tq.prompt,
          sort_order: sortOrder++,
          required: tq.required,
        });
      }

      if (questions.length > 0) {
        const { error: qErr } = await supabase.from("cycle_questions").insert(questions);
        if (qErr) console.error("Error inserting cycle_questions:", qErr);
      }

      router.push(`/dashboard/cycles/${cycleData.id}`);
      router.refresh();
    } catch (err) {
      console.error("Error creating cycle:", err);
      setError("Failed to create performance cycle");
      setLoading(false);
    }
  }

  // Group competencies by category
  const categories = [...new Set(competencies.map((c) => c.category || "Uncategorized"))].sort();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/cycles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">New Performance Cycle</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {step === 1 ? "Step 1: Define the cycle period" : "Step 2: Configure review questions"}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          step === 1 ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        }`}>
          1. Cycle Details
        </div>
        <div className="w-6 h-px bg-border" />
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          2. Review Questions
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 1: Cycle Details */}
      {/* ============================================================ */}
      {step === 1 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Cycle Details</CardTitle>
            <CardDescription>Define the time period and type for this review cycle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Cycle Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q1 2026 Performance Review"
              />
            </div>

            <div className="space-y-2">
              <Label>Cycle Type</Label>
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the goals and focus areas for this review cycle..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Review Deadline (Optional)</Label>
              <Input type="date" value={reviewDeadline} onChange={(e) => setReviewDeadline(e.target.value)} />
              <p className="text-xs text-muted-foreground">When should all reviews be submitted by?</p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/cycles">Cancel</Link>
              </Button>
              <Button type="button" onClick={goToStep2}>
                Next: Review Questions
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* STEP 2: Review Questions */}
      {/* ============================================================ */}
      {step === 2 && (
        <>
          {/* Competency Selection */}
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Competency Ratings
                  </CardTitle>
                  <CardDescription>
                    Select which competencies employees will be rated on.
                    {competencies.length === 0 && (
                      <span className="block mt-1 text-amber-600">
                        No competencies defined yet. <Link href="/dashboard/competencies/new" className="underline">Create competencies</Link> first.
                      </span>
                    )}
                  </CardDescription>
                </div>
                {competencies.length > 0 && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={selectAllCompetencies}>
                    {selectedCompIds.size === competencies.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>
            </CardHeader>
            {competencies.length > 0 && (
              <CardContent>
                <div className="space-y-4">
                  {categories.map((cat) => (
                    <div key={cat}>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{cat}</p>
                      <div className="space-y-1">
                        {competencies
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
                                onCheckedChange={() => toggleCompetency(comp.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-foreground">{comp.name}</span>
                                {comp.description && (
                                  <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                                    {comp.description.slice(0, 60)}{comp.description.length > 60 ? "..." : ""}
                                  </span>
                                )}
                              </div>
                            </label>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {selectedCompIds.size} of {competencies.length} competencies selected
                </p>
              </CardContent>
            )}
          </Card>

          {/* Text Questions */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Open-Ended Questions
              </CardTitle>
              <CardDescription>
                Add text questions for strengths, areas for improvement, company values, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing questions */}
              {textQuestions.length > 0 && (
                <div className="space-y-2">
                  {textQuestions.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground flex-1">{q.prompt}</span>
                      {q.required && (
                        <Badge variant="outline" className="text-[10px] shrink-0">Required</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removeTextQuestion(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new question */}
              <div className="flex gap-2">
                <Input
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Type a question, e.g. 'How did they demonstrate leadership?'"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTextQuestion())}
                />
                <Button variant="outline" size="sm" onClick={addTextQuestion} disabled={!newPrompt.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_TEXT_QUESTIONS.filter(
                    (s) => !textQuestions.some((q) => q.prompt === s)
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      onClick={() => addSuggested(s)}
                    >
                      + {s.length > 50 ? s.slice(0, 47) + "..." : s}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between pt-2 pb-8">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Create Cycle
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
