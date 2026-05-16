"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { getClientIdentity } from "@/lib/client-auth";
import { PageHeader } from "@/components/page-header";

interface Question {
  id: string;
  type: "text" | "rating";
  text: string;
  required: boolean;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [templateType, setTemplateType] = useState<"review" | "competency_framework" | "cycle_profile" | "goal_template">("review");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([
    { id: crypto.randomUUID(), type: "rating", text: "Communication skills", required: true },
    { id: crypto.randomUUID(), type: "rating", text: "Teamwork and collaboration", required: true },
    { id: crypto.randomUUID(), type: "rating", text: "Technical competency", required: true },
    { id: crypto.randomUUID(), type: "text", text: "What are this person's key strengths?", required: true },
    { id: crypto.randomUUID(), type: "text", text: "What areas could they improve?", required: true },
  ]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: crypto.randomUUID(), type: "text", text: "", required: false },
    ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  // Competency framework fields
  const [frameworkCompetencies, setFrameworkCompetencies] = useState<Array<{
    name: string; description: string; category: string; is_core: boolean;
  }>>([{ name: "", description: "", category: "Core", is_core: true }]);

  // Cycle profile fields
  const [cycleType, setCycleType] = useState("annual");
  const [suggestedDescription, setSuggestedDescription] = useState("");
  const [suggestedCategories, setSuggestedCategories] = useState("");

  // Goal template fields
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalScope, setGoalScope] = useState("individual");
  const [goalMetricStart, setGoalMetricStart] = useState("");
  const [goalMetricTarget, setGoalMetricTarget] = useState("");
  const [goalMetricUnit, setGoalMetricUnit] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSubmitError(null);

    try {
      const supabase = createClient();

      // Securely resolve workspace_id from DB
      const identity = await getClientIdentity(supabase);
      if (!identity) {
        setSubmitError("Workspace not found. Please re-authenticate.");
        setSaving(false);
        return;
      }

      type TemplateInsert = {
        name: string;
        description: string | null;
        workspace_id: string;
        is_default: boolean;
        template_type: string | null;
        questions?: unknown;
        content?: Record<string, unknown>;
      };
      const insertData: TemplateInsert = {
        name,
        description: description || null,
        workspace_id: identity.workspaceId,
        is_default: isDefault && templateType === "review",
        template_type: templateType === "review" ? null : templateType,
      };

      if (templateType === "review") {
        insertData.questions = questions;
      } else if (templateType === "competency_framework") {
        insertData.content = {
          competencies: frameworkCompetencies.filter(c => c.name.trim()).map(c => ({
            name: c.name.trim(),
            description: c.description.trim() || null,
            category: c.category,
            is_core: c.is_core,
          })),
        };
      } else if (templateType === "cycle_profile") {
        insertData.content = {
          cycle_type: cycleType,
          suggested_description: suggestedDescription || null,
          suggested_competency_categories: suggestedCategories.split(",").map(s => s.trim()).filter(Boolean),
        };
      } else if (templateType === "goal_template") {
        insertData.content = {
          title: goalTitle || null,
          description: goalDescription || null,
          scope: goalScope,
          metric_start: goalMetricStart ? parseFloat(goalMetricStart) : null,
          metric_target: goalMetricTarget ? parseFloat(goalMetricTarget) : null,
          metric_unit: goalMetricUnit || null,
        };
      }

      const { error } = await supabase.from("templates").insert(insertData);

      if (error) throw error;
      router.push("/dashboard/templates");
      router.refresh();
    } catch (error: unknown) {
      console.error("Error creating template:", error);
      setSubmitError((error instanceof Error ? error.message : "") || "Failed to create template. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <PageHeader
        hat="manage"
        title="New template"
        subtitle="Create a custom template"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/templates">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Link>
          </Button>
        }
      />

      <div className="space-y-2">
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Template Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { value: "review", label: "Review Questions", icon: "\ud83d\udccb" },
            { value: "competency_framework", label: "Competency Framework", icon: "\ud83c\udfaf" },
            { value: "cycle_profile", label: "Cycle Profile", icon: "\ud83d\udd04" },
            { value: "goal_template", label: "Goal Template", icon: "\ud83c\udfc1" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTemplateType(opt.value as typeof templateType)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                templateType === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <span className="text-xl">{opt.icon}</span>
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>Basic information about this template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Quarterly Performance Review"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe when this template should be used..."
                rows={3}
              />
            </div>
            {templateType === "review" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <Label htmlFor="isDefault" className="font-normal">
                  Set as default template for new reviews
                </Label>
              </div>
            )}
          </CardContent>
        </Card>

        {templateType === "review" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>Define the questions for this review template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, idx) => (
                <div
                  key={question.id}
                  className="flex gap-3 items-start p-4 bg-muted/40 rounded-lg"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const newQ = [...questions];
                        [newQ[idx - 1], newQ[idx]] = [newQ[idx], newQ[idx - 1]];
                        setQuestions(newQ);
                      }}
                      className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === questions.length - 1}
                      onClick={() => {
                        const newQ = [...questions];
                        [newQ[idx], newQ[idx + 1]] = [newQ[idx + 1], newQ[idx]];
                        setQuestions(newQ);
                      }}
                      className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Input
                          value={question.text}
                          onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                          placeholder="Enter question text..."
                        />
                      </div>
                      <Select
                        value={question.type}
                        onValueChange={(value: "text" | "rating") =>
                          updateQuestion(question.id, { type: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="rating">Rating (1-5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`required-${question.id}`}
                        checked={question.required}
                        onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <Label htmlFor={`required-${question.id}`} className="text-sm font-normal">
                        Required
                      </Label>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(question.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </CardContent>
          </Card>
        )}

        {templateType === "competency_framework" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Competencies</CardTitle>
              <CardDescription>Define the competencies for this framework</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Competencies</Label>
              {frameworkCompetencies.map((comp, idx) => (
                <div key={idx} className="grid gap-3 md:grid-cols-4 p-3 rounded-lg border border-border/60">
                  <Input placeholder="Competency name *" value={comp.name} onChange={(e) => {
                    const updated = [...frameworkCompetencies];
                    updated[idx] = { ...updated[idx], name: e.target.value };
                    setFrameworkCompetencies(updated);
                  }} />
                  <Input placeholder="Description" value={comp.description} onChange={(e) => {
                    const updated = [...frameworkCompetencies];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    setFrameworkCompetencies(updated);
                  }} />
                  <Select value={comp.category} onValueChange={(v) => {
                    const updated = [...frameworkCompetencies];
                    updated[idx] = { ...updated[idx], category: v };
                    setFrameworkCompetencies(updated);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Core">Core</SelectItem>
                      <SelectItem value="Technical">Technical</SelectItem>
                      <SelectItem value="Leadership">Leadership</SelectItem>
                      <SelectItem value="Communication">Communication</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => {
                    setFrameworkCompetencies(frameworkCompetencies.filter((_, i) => i !== idx));
                  }} disabled={frameworkCompetencies.length <= 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => {
                setFrameworkCompetencies([...frameworkCompetencies, { name: "", description: "", category: "Core", is_core: false }]);
              }}>
                <Plus className="h-4 w-4 mr-1" /> Add Competency
              </Button>
            </CardContent>
          </Card>
        )}

        {templateType === "cycle_profile" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Cycle Profile</CardTitle>
              <CardDescription>Configure the cycle profile settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cycle Type</Label>
                  <Select value={cycleType} onValueChange={setCycleType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="probation">Probation</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Suggested Categories</Label>
                  <Input placeholder="Technical, Leadership, Core" value={suggestedCategories} onChange={(e) => setSuggestedCategories(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Comma-separated competency categories</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Suggested Description</Label>
                <Textarea placeholder="Description that will be pre-filled when this profile is used..." value={suggestedDescription} onChange={(e) => setSuggestedDescription(e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>
        )}

        {templateType === "goal_template" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Goal Template</CardTitle>
              <CardDescription>Define the goal template structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Goal Title Template</Label>
                <Input placeholder="e.g., Improve [metric] by [X]%" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
                <p className="text-xs text-muted-foreground">Use [brackets] for placeholder values</p>
              </div>
              <div className="space-y-2">
                <Label>Goal Description</Label>
                <Textarea placeholder="Describe the goal type..." value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} rows={2} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default Scope</Label>
                  <Select value={goalScope} onValueChange={setGoalScope}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Metric Defaults (optional)</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Value</Label>
                    <Input type="number" step="any" placeholder="0" value={goalMetricStart} onChange={(e) => setGoalMetricStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Target Value</Label>
                    <Input type="number" step="any" placeholder="100" value={goalMetricTarget} onChange={(e) => setGoalMetricTarget(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unit</Label>
                    <Input placeholder="%, deals, hours..." value={goalMetricUnit} onChange={(e) => setGoalMetricUnit(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {submitError && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-md px-3 py-2">
            {submitError}
          </p>
        )}

        <div className="flex gap-4 mt-6">
          <Button type="submit" disabled={saving || !name || (templateType === "review" && questions.length === 0)}>
            {saving ? "Creating..." : "Create Template"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/templates">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
