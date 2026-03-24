"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Star, MessageSquare, Pencil, Plus, Trash2, Info } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase";

interface Question {
  id: string;
  text: string;
  type: "text" | "rating";
  required?: boolean;
}

interface TemplateDetailClientProps {
  template: {
    id: string;
    name: string;
    description: string | null;
    questions: Question[];
    is_default: boolean;
    is_system: boolean;
    created_at: string;
    creator?: { slack_name: string } | null;
  };
  reviewCount: number;
}

export function TemplateDetailClient({ template, reviewCount }: TemplateDetailClientProps) {
  const router = useRouter();
  const questions = Array.isArray(template.questions) ? template.questions : [];

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [editQuestions, setEditQuestions] = useState<Question[]>(questions);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const wsId = user?.user_metadata?.workspace_id;
      if (!wsId) {
        alert("Workspace not found");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("templates")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          questions: editQuestions,
        })
        .eq("id", template.id)
        .eq("workspace_id", wsId);

      if (error) throw error;

      setEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(template.name);
    setDescription(template.description || "");
    setEditQuestions(questions);
    setEditing(false);
  };

  const addQuestion = () => {
    setEditQuestions([
      ...editQuestions,
      { id: `q-${Date.now()}`, text: "", type: "rating", required: true },
    ]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...editQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setEditQuestions(editQuestions.filter((_, i) => i !== index));
  };

  // ── Editing view ──────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Edit Template</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>Add, edit, or remove review questions</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Question
            </Button>
          </CardHeader>
          <CardContent>
            {editQuestions.length === 0 ? (
              <p className="text-center text-slate-500 py-4">
                No questions yet. Click &quot;Add Question&quot; to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {editQuestions.map((question, index) => (
                  <div
                    key={question.id}
                    className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg"
                  >
                    <span className="text-sm font-medium text-slate-400 w-6 pt-2">
                      {index + 1}.
                    </span>
                    <div className="flex-1 space-y-3">
                      <Input
                        value={question.text}
                        onChange={(e) => updateQuestion(index, "text", e.target.value)}
                        placeholder="Question text"
                      />
                      <div className="flex items-center gap-4">
                        <Select
                          value={question.type}
                          onValueChange={(v) => updateQuestion(index, "type", v)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rating">Rating</SelectItem>
                            <SelectItem value="text">Text</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`req-${question.id}`}
                            checked={question.required !== false}
                            onCheckedChange={(checked) =>
                              updateQuestion(index, "required", !!checked)
                            }
                          />
                          <label
                            htmlFor={`req-${question.id}`}
                            className="text-sm text-muted-foreground cursor-pointer"
                          >
                            Required
                          </label>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 shrink-0 mt-1"
                      onClick={() => removeQuestion(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Read-only view ────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              {template.name}
            </h1>
            {template.is_default && <Badge variant="secondary">Default</Badge>}
            {template.is_system && (
              <Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400">
                System
              </Badge>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {template.description || "No description"}
          </p>
        </div>
        {!template.is_system && (
          <Button variant="outline" size="icon" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {template.is_system && (
        <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
          <Info className="h-4 w-4 shrink-0" />
          System template &mdash; duplicate to customize
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reviews Using</CardTitle>
            <Star className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviewCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
            <MessageSquare className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {format(new Date(template.created_at), "MMM d, yyyy")}
            </div>
            <p className="text-xs text-slate-500">
              by {template.creator?.slack_name || "System"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>Review questions in this template</CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-center text-slate-500 py-4">No questions defined</p>
          ) : (
            <div className="space-y-3">
              {questions.map((question: any, index: number) => (
                <div
                  key={question.id || index}
                  className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg"
                >
                  <span className="text-sm font-medium text-slate-400 w-6">
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{question.text}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {question.type === "rating" ? "Rating (1-5)" : "Text"}
                      </Badge>
                      {question.required && (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                          Required
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
