"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Trash2,
  Plus,
  Save,
  Loader2,
  Lock,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldType =
  | "user_select"
  | "text"
  | "rating"
  | "single_select"
  | "multi_select"
  | "checkbox";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  multiline?: boolean;
  options?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FIELDS: FormField[] = [
  {
    id: "recipient",
    type: "user_select",
    label: "Who is this feedback for?",
    required: true,
  },
  {
    id: "feedback_type",
    type: "single_select",
    label: "Feedback Type",
    required: true,
    options: ["Praise", "Constructive", "General"],
  },
  {
    id: "message",
    type: "text",
    label: "Your Feedback",
    required: true,
    multiline: true,
  },
  {
    id: "anonymous",
    type: "checkbox",
    label: "Privacy",
    required: false,
    options: ["Send anonymously"],
  },
];

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  user_select: "User Select",
  text: "Text",
  rating: "Rating",
  single_select: "Single Select",
  multi_select: "Multi Select",
  checkbox: "Checkbox",
};

const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  user_select:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  text: "bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-300",
  rating:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  single_select:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  multi_select:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  checkbox:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

// Field types available when adding a new field (user_select is pinned)
const ADDABLE_FIELD_TYPES: FieldType[] = [
  "text",
  "rating",
  "single_select",
  "multi_select",
  "checkbox",
];

const FIELDS_WITH_OPTIONS: FieldType[] = [
  "single_select",
  "multi_select",
  "checkbox",
];

// ---------------------------------------------------------------------------
// Toast helper (simple state-based)
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

// ---------------------------------------------------------------------------
// Individual field row
// ---------------------------------------------------------------------------

interface FieldRowProps {
  field: FormField;
  index: number;
  total: number;
  onChange: (id: string, updated: Partial<FormField>) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onDelete: (id: string) => void;
}

function FieldRow({
  field,
  index,
  total,
  onChange,
  onMove,
  onDelete,
}: FieldRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(field.label);
  const [newOption, setNewOption] = useState("");
  const labelInputRef = useRef<HTMLInputElement>(null);

  const isLocked = field.type === "user_select";
  const hasOptions = FIELDS_WITH_OPTIONS.includes(field.type);
  const hasExpand = hasOptions || field.type === "text";

  function commitLabel() {
    const trimmed = labelDraft.trim();
    if (trimmed) onChange(field.id, { label: trimmed });
    else setLabelDraft(field.label);
    setEditingLabel(false);
  }

  function addOption() {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    onChange(field.id, { options: [...(field.options || []), trimmed] });
    setNewOption("");
  }

  function removeOption(opt: string) {
    onChange(field.id, {
      options: (field.options || []).filter((o) => o !== opt),
    });
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-3">
        {/* Main row */}
        <div className="flex items-center gap-2">
          {/* Drag handle (visual only) */}
          <span className="text-muted-foreground/40 text-lg select-none cursor-default shrink-0">
            ⠿
          </span>

          {/* Field type badge */}
          <span
            className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${FIELD_TYPE_COLORS[field.type]}`}
          >
            {FIELD_TYPE_LABELS[field.type]}
          </span>

          {/* Editable label */}
          <div className="flex-1 min-w-0">
            {editingLabel ? (
              <Input
                ref={labelInputRef}
                className="h-7 text-sm px-2"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLabel();
                  if (e.key === "Escape") {
                    setLabelDraft(field.label);
                    setEditingLabel(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                className="text-sm text-left truncate w-full hover:text-primary transition-colors"
                onClick={() => {
                  setLabelDraft(field.label);
                  setEditingLabel(true);
                }}
                title="Click to edit label"
              >
                {field.label}
              </button>
            )}
          </div>

          {/* Required toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Switch
              id={`req-${field.id}`}
              checked={field.required}
              onCheckedChange={(v) => onChange(field.id, { required: v })}
              disabled={isLocked}
              className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
            />
            <Label
              htmlFor={`req-${field.id}`}
              className="text-[11px] text-muted-foreground hidden sm:block"
            >
              Req
            </Label>
          </div>

          {/* Reorder buttons */}
          <div className="flex flex-col shrink-0">
            <button
              disabled={index === 0}
              onClick={() => onMove(field.id, "up")}
              className="h-4 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              disabled={index === total - 1}
              onClick={() => onMove(field.id, "down")}
              className="h-4 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {/* Expand chevron */}
          {hasExpand ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <div className="w-4 shrink-0" />
          )}

          {/* Delete button */}
          <button
            onClick={() => !isLocked && onDelete(field.id)}
            disabled={isLocked}
            title={isLocked ? "This field is required and cannot be removed" : "Delete field"}
            className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            {isLocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Expanded settings */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border/40 space-y-3 pl-6">
            {/* Text multiline toggle */}
            {field.type === "text" && (
              <div className="flex items-center gap-2">
                <Switch
                  id={`ml-${field.id}`}
                  checked={!!field.multiline}
                  onCheckedChange={(v) => onChange(field.id, { multiline: v })}
                  className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
                />
                <Label htmlFor={`ml-${field.id}`} className="text-xs text-muted-foreground">
                  Multiline textarea
                </Label>
              </div>
            )}

            {/* Options editor */}
            {hasOptions && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Options</p>
                <div className="space-y-1">
                  {(field.options || []).map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <span className="flex-1 text-xs bg-muted rounded px-2 py-1">{opt}</span>
                      <button
                        onClick={() => removeOption(opt)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="Add option…"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    onClick={addOption}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function FormsPage() {
  const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS);
  const [configId, setConfigId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const toastCounter = useRef(0);

  function showToast(message: string, type: "success" | "error") {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  // Load config on mount
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get current user / workspace
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const wsId: string | undefined = user.user_metadata?.workspace_id;
      const appUserId: string | undefined = user.user_metadata?.app_user_id;

      // Check role
      if (appUserId) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("role")
          .eq("id", appUserId)
          .single();

        const role: string = dbUser?.role || user.user_metadata?.role || "user";
        if (role !== "admin" && role !== "hr") {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      } else {
        const role: string = user.user_metadata?.role || "user";
        if (role !== "admin" && role !== "hr") {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      }

      if (!wsId) {
        setLoading(false);
        return;
      }

      setWorkspaceId(wsId);

      // Load existing config
      const { data } = await supabase
        .from("feedback_form_configs")
        .select("id, fields")
        .eq("workspace_id", wsId)
        .limit(1)
        .maybeSingle();

      if (data?.fields && Array.isArray(data.fields) && data.fields.length > 0) {
        setFields(data.fields as FormField[]);
        setConfigId(data.id);
      }
      // else keep DEFAULT_FIELDS

      setLoading(false);
    }

    load();
  }, []);

  function handleChange(id: string, updated: Partial<FormField>) {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updated } : f))
    );
  }

  function handleMove(id: string, direction: "up" | "down") {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }

  function handleDelete(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function handleAddField(type: FieldType) {
    const id = `field_${Date.now()}`;
    const newField: FormField = {
      id,
      type,
      label: FIELD_TYPE_LABELS[type],
      required: false,
      ...(FIELDS_WITH_OPTIONS.includes(type) ? { options: [] } : {}),
      ...(type === "text" ? { multiline: false } : {}),
    };
    setFields((prev) => [...prev, newField]);
  }

  async function handleSave() {
    if (!workspaceId) {
      showToast("No workspace found.", "error");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("feedback_form_configs")
        .upsert(
          { workspace_id: workspaceId, fields },
          { onConflict: "workspace_id" }
        );

      if (error) throw error;
      showToast("Form saved successfully.", "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save form.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Access Restricted
        </h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Feedback form configuration is only available to admins and HR.
        </p>
        <Button asChild variant="outline">
          <a href="/dashboard">Go to Dashboard</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl relative">
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg pointer-events-auto ${
              t.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Feedback Form
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the /feedback Slack modal
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Field list */}
      <div className="space-y-2">
        {fields.map((field, idx) => (
          <FieldRow
            key={field.id}
            field={field}
            index={idx}
            total={fields.length}
            onChange={handleChange}
            onMove={handleMove}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Add field button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full gap-2 border-dashed">
            <Plus className="h-4 w-4" />
            Add Field
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {ADDABLE_FIELD_TYPES.map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => handleAddField(type)}
              className="gap-2"
            >
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${FIELD_TYPE_COLORS[type]}`}
              >
                {FIELD_TYPE_LABELS[type]}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Helper note */}
      <p className="text-xs text-muted-foreground">
        The{" "}
        <Badge variant="outline" className="text-[10px] h-4 px-1">
          User Select
        </Badge>{" "}
        field is always pinned as the first field and cannot be removed.
      </p>
    </div>
  );
}
