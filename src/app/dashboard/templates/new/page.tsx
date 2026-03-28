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

      const { error } = await supabase.from("templates").insert({
        workspace_id: identity.workspaceId,
        name,
        description,
        is_default: isDefault,
        questions,
      });

      if (error) throw error;
      router.push("/dashboard/templates");
      router.refresh();
    } catch (error: any) {
      console.error("Error creating template:", error);
      setSubmitError(error?.message || "Failed to create template. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">New Template</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Create a custom review template</p>
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
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>Define the questions for this review template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((question, idx) => (
              <div
                key={question.id}
                className="flex gap-3 items-start p-4 bg-slate-50 dark:bg-slate-900 rounded-lg"
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

        {submitError && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-md px-3 py-2">
            {submitError}
          </p>
        )}

        <div className="flex gap-4 mt-6">
          <Button type="submit" disabled={saving || !name || questions.length === 0}>
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
