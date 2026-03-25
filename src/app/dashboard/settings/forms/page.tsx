"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
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
  ChevronRight,
  Trash2,
  Plus,
  Save,
  Loader2,
  Lock,
  X,
  GripVertical,
  User,
  Type,
  Star,
  List,
  ListChecks,
  CheckSquare,
  MessageSquare,
  Info,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

const FIELD_TYPE_CONFIG: Record<
  FieldType,
  { bg: string; text: string; border: string; icon: typeof User; description: string }
> = {
  user_select: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200/80 dark:border-blue-500/20",
    icon: User,
    description: "Select a team member",
  },
  text: {
    bg: "bg-slate-50 dark:bg-slate-500/10",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200/80 dark:border-slate-500/20",
    icon: Type,
    description: "Free-form text input",
  },
  rating: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/80 dark:border-amber-500/20",
    icon: Star,
    description: "1-5 star rating",
  },
  single_select: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-200/80 dark:border-violet-500/20",
    icon: List,
    description: "Choose one option",
  },
  multi_select: {
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-200/80 dark:border-indigo-500/20",
    icon: ListChecks,
    description: "Choose multiple options",
  },
  checkbox: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/80 dark:border-emerald-500/20",
    icon: CheckSquare,
    description: "Toggle checkbox",
  },
};

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
// Toast helper
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

// ---------------------------------------------------------------------------
// Sortable field row
// ---------------------------------------------------------------------------

interface FieldRowProps {
  field: FormField;
  index: number;
  onChange: (id: string, updated: Partial<FormField>) => void;
  onDelete: (id: string) => void;
}

function SortableFieldRow(props: FieldRowProps) {
  const { field } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <FieldRow
        {...props}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

interface FieldRowInternalProps extends FieldRowProps {
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

function FieldRow({
  field,
  index,
  onChange,
  onDelete,
  isDragging,
  dragHandleProps,
}: FieldRowInternalProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(field.label);
  const [newOption, setNewOption] = useState("");
  const labelInputRef = useRef<HTMLInputElement>(null);

  const isLocked = field.type === "user_select";
  const hasOptions = FIELDS_WITH_OPTIONS.includes(field.type);
  const hasExpand = hasOptions || field.type === "text";
  const config = FIELD_TYPE_CONFIG[field.type];
  const FieldIcon = config.icon;

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
    <div
      className={`group rounded-xl border bg-card transition-all duration-200 ${
        isDragging
          ? "shadow-xl ring-2 ring-primary/20 opacity-95"
          : "shadow-sm hover:shadow-md"
      }`}
    >
      <div className="flex items-center gap-0">
        {/* Color accent strip */}
        <div className={`w-1 self-stretch rounded-l-xl ${config.bg} ${config.border} border-r-0`} />

        <div className="flex-1 px-4 py-3.5">
          {/* Main row */}
          <div className="flex items-center gap-3">
            {/* Drag handle */}
            <button
              className="shrink-0 h-8 w-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors touch-none"
              {...dragHandleProps}
              tabIndex={-1}
            >
              <GripVertical className="h-4 w-4" />
            </button>

            {/* Field type badge with icon */}
            <div
              className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md ${config.text} ${config.bg} border ${config.border}`}
            >
              <FieldIcon className="h-3 w-3" />
              <span className="hidden sm:inline">{FIELD_TYPE_LABELS[field.type]}</span>
            </div>

            {/* Editable label */}
            <div className="flex-1 min-w-0">
              {editingLabel ? (
                <Input
                  ref={labelInputRef}
                  className="h-8 text-sm px-2.5"
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
                  className="text-sm font-medium text-left truncate w-full text-foreground hover:text-primary transition-colors"
                  onClick={() => {
                    if (!isLocked) {
                      setLabelDraft(field.label);
                      setEditingLabel(true);
                    }
                  }}
                  title={isLocked ? "This field cannot be edited" : "Click to edit label"}
                >
                  {field.label}
                </button>
              )}
            </div>

            {/* Required toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                id={`req-${field.id}`}
                checked={field.required}
                onCheckedChange={(v) => onChange(field.id, { required: v })}
                disabled={isLocked}
                className="data-[state=checked]:bg-primary"
              />
              <Label
                htmlFor={`req-${field.id}`}
                className="text-xs text-muted-foreground font-medium hidden sm:block select-none cursor-pointer"
              >
                Required
              </Label>
            </div>

            {/* Expand chevron */}
            {hasExpand ? (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                title={expanded ? "Collapse" : "Configure options"}
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                />
              </button>
            ) : null}

            {/* Delete button */}
            {isLocked ? (
              <div
                className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/30"
                title="This field is pinned and cannot be removed"
              >
                <Lock className="h-3.5 w-3.5" />
              </div>
            ) : (
              <button
                onClick={() => onDelete(field.id)}
                className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                title="Delete field"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Expanded settings */}
          {expanded && (
            <div className="mt-4 pt-4 border-t border-border/40 space-y-4 ml-9">
              {/* Text multiline toggle */}
              {field.type === "text" && (
                <div className="flex items-center gap-2.5">
                  <Switch
                    id={`ml-${field.id}`}
                    checked={!!field.multiline}
                    onCheckedChange={(v) =>
                      onChange(field.id, { multiline: v })
                    }
                    className="data-[state=checked]:bg-primary"
                  />
                  <Label
                    htmlFor={`ml-${field.id}`}
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Multiline textarea
                  </Label>
                </div>
              )}

              {/* Options editor */}
              {hasOptions && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Options
                  </p>
                  <div className="space-y-1.5">
                    {(field.options || []).map((opt) => (
                      <div
                        key={opt}
                        className="flex items-center gap-2 group/opt"
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 ${config.bg} border ${config.border}`} />
                        <span className="flex-1 text-sm text-foreground">
                          {opt}
                        </span>
                        <button
                          onClick={() => removeOption(opt)}
                          className="opacity-0 group-hover/opt:opacity-100 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-600 transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      className="h-8 text-sm flex-1"
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
                      className="h-8 text-xs px-3"
                      onClick={addOption}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function showToast(message: string, type: "success" | "error") {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();

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

      if (appUserId) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("role")
          .eq("id", appUserId)
          .single();

        const role: string =
          dbUser?.role || user.user_metadata?.role || "user";
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

      const { data } = await supabase
        .from("feedback_form_configs")
        .select("id, fields")
        .eq("workspace_id", wsId)
        .limit(1)
        .maybeSingle();

      if (
        data?.fields &&
        Array.isArray(data.fields) &&
        data.fields.length > 0
      ) {
        setFields(data.fields as FormField[]);
        setConfigId(data.id);
      }

      setLoading(false);
    }

    load();
  }, []);

  function handleChange(id: string, updated: Partial<FormField>) {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updated } : f))
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
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
          Kudos form configuration is only available to admins and HR.
        </p>
        <Button asChild variant="outline">
          <a href="/dashboard">Go to Dashboard</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg pointer-events-auto animate-in slide-in-from-bottom-2 ${
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Kudos Form Builder
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure the{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                /kudos
              </code>{" "}
              Slack modal. Drag fields to reorder.
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          size="default"
          className="shrink-0"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Field list with DnD */}
      <div className="space-y-2.5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {fields.map((field, idx) => (
              <SortableFieldRow
                key={field.id}
                field={field}
                index={idx}
                onChange={handleChange}
                onDelete={handleDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Add field button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full py-3 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4" />
            Add Field
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-60">
          {ADDABLE_FIELD_TYPES.map((type) => {
            const c = FIELD_TYPE_CONFIG[type];
            const Icon = c.icon;
            return (
              <DropdownMenuItem
                key={type}
                onClick={() => handleAddField(type)}
                className="gap-3 py-2.5 cursor-pointer"
              >
                <div
                  className={`flex items-center justify-center h-7 w-7 rounded-lg ${c.bg} ${c.text} ${c.border} border shrink-0`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{FIELD_TYPE_LABELS[type]}</p>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Info notes */}
      <div className="space-y-2">
        <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-3 border border-border/30">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            The{" "}
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 font-medium"
            >
              User Select
            </Badge>{" "}
            field is always pinned as the first field and cannot be removed.
          </p>
        </div>
        <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-blue-50/50 dark:bg-blue-500/5 rounded-lg px-4 py-3 border border-blue-100/60 dark:border-blue-500/10">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
          <p>
            Submitted kudos appear in{" "}
            <span className="font-medium text-foreground">Dashboard → Kudos</span>{" "}
            for both the recipient and their manager. HR and admins can view all kudos.
          </p>
        </div>
      </div>
    </div>
  );
}
