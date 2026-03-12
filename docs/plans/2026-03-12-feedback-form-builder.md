# Feedback Form Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let admin/HR users build a fully custom `/feedback` Slack modal from a dashboard UI, supporting text, rating, single-select, multi-select, and checkbox field types.

**Architecture:** New `feedback_form_configs` table (one row per workspace) stores an ordered JSONB array of field definitions. The `slack-commands` edge function fetches this config at request time and renders the Slack modal dynamically. The `slack-interactivity` edge function extracts responses dynamically and stores custom fields in a new `custom_fields` JSONB column on `continuous_feedback`. A new dashboard page at `/dashboard/settings/forms` gives admin/HR a drag-and-drop form builder with a live Slack preview.

**Tech Stack:** Next.js 16 App Router (Server Components + Client Components), Supabase (PostgreSQL + Deno Edge Functions), Tailwind CSS, shadcn/ui (`Card`, `Button`, `Badge`, `Dialog`, `Input`, `Label`, `Switch`), `lucide-react` icons.

---

## Task 1: DB Migration — `feedback_form_configs` table

**Files:**
- Supabase migration via MCP (no local file needed)

**Step 1: Apply migration using Supabase MCP**

Run this SQL via `mcp__supabase__apply_migration` with name `create_feedback_form_configs`:

```sql
CREATE TABLE feedback_form_configs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  fields       jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE feedback_form_configs ENABLE ROW LEVEL SECURITY;

-- Admins and HR can read/write their workspace's config
CREATE POLICY "hr_admin_read_form_config" ON feedback_form_configs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM users
      WHERE id::text = (auth.jwt() -> 'user_metadata' ->> 'app_user_id')
      AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY "hr_admin_write_form_config" ON feedback_form_configs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM users
      WHERE id::text = (auth.jwt() -> 'user_metadata' ->> 'app_user_id')
      AND role IN ('admin', 'hr')
    )
  );
```

**Step 2: Verify table exists**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'feedback_form_configs';
```
Expected: rows for `id`, `workspace_id`, `fields`, `created_at`, `updated_at`.

**Step 3: Commit**
```bash
git commit -m "feat: add feedback_form_configs table migration"
```

---

## Task 2: DB Migration — `custom_fields` on `continuous_feedback`

**Files:**
- Supabase migration via MCP

**Step 1: Apply migration using Supabase MCP** with name `add_custom_fields_to_continuous_feedback`:

```sql
ALTER TABLE continuous_feedback
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';
```

**Step 2: Verify column exists**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'continuous_feedback' AND column_name = 'custom_fields';
```
Expected: 1 row.

**Step 3: Commit**
```bash
git commit -m "feat: add custom_fields column to continuous_feedback"
```

---

## Task 3: Update `slack-commands` edge function — dynamic `/feedback` modal

**Files:**
- Modify: `slack-commands` edge function (deployed via Supabase MCP)

**Context:** The current `/feedback` handler in `slack-commands` builds a hardcoded Slack modal. We need to:
1. After fetching the workspace, query `feedback_form_configs`
2. If config found → build Slack blocks dynamically from `fields`
3. If not → fall back to the existing hardcoded blocks

**Step 1: Read the current full edge function source**

Get it via `mcp__supabase__get_edge_function` with slug `slack-commands`. Save the full source locally — you will make a targeted change inside the `/feedback` handler only.

**Step 2: Add the config fetch + block builder helper**

Inside the `Deno.serve` handler, right after the workspace fetch and before the command routing, add this helper function:

```typescript
// Helper: convert a feedback_form_configs field to a Slack Block Kit input block
function fieldToBlock(field: any): any {
  const element = (() => {
    switch (field.type) {
      case "user_select":
        return {
          type: "users_select",
          action_id: field.id,
          placeholder: { type: "plain_text", text: "Select person" },
        };
      case "text":
        return {
          type: "plain_text_input",
          action_id: field.id,
          multiline: field.multiline === true,
          placeholder: { type: "plain_text", text: field.placeholder || "Enter text..." },
        };
      case "rating":
        return {
          type: "static_select",
          action_id: field.id,
          placeholder: { type: "plain_text", text: "Select rating" },
          options: [1, 2, 3, 4, 5].map(n => ({
            text: { type: "plain_text", text: String(n) },
            value: String(n),
          })),
        };
      case "single_select":
        return {
          type: "static_select",
          action_id: field.id,
          placeholder: { type: "plain_text", text: "Select an option" },
          options: (field.options || []).map((o: string) => ({
            text: { type: "plain_text", text: o },
            value: o,
          })),
        };
      case "multi_select":
        return {
          type: "multi_static_select",
          action_id: field.id,
          placeholder: { type: "plain_text", text: "Select options" },
          options: (field.options || []).map((o: string) => ({
            text: { type: "plain_text", text: o },
            value: o,
          })),
        };
      case "checkbox":
        return {
          type: "checkboxes",
          action_id: field.id,
          options: (field.options || [field.label]).map((o: string) => ({
            text: { type: "plain_text", text: o },
            value: o,
          })),
        };
      default:
        return null;
    }
  })();

  if (!element) return null;

  return {
    type: "input",
    block_id: field.id,
    optional: !field.required,
    label: { type: "plain_text", text: field.label },
    element,
  };
}
```

**Step 3: Replace the `/feedback` handler section**

Find the `/feedback` section (starts with `if (cmd === "/feedback")`). Replace the `const view = { ... }` declaration and the `views.open` call with:

```typescript
if (cmd === "/feedback") {
  // Fetch custom form config for this workspace
  const configRows = await dbQuery("feedback_form_configs", `workspace_id=eq.${ws.id}&select=fields&limit=1`);
  const formConfig = configRows?.[0];

  let blocks: any[];

  if (formConfig?.fields && formConfig.fields.length > 0) {
    // Dynamic blocks from config
    blocks = formConfig.fields
      .map((field: any) => {
        // Inject initial_user for recipient field if @mention was used
        if (field.type === "user_select" && mentionedUser) {
          return fieldToBlock({ ...field, initial_user: mentionedUser });
        }
        return fieldToBlock(field);
      })
      .filter(Boolean);
  } else {
    // Hardcoded fallback (existing behaviour)
    blocks = [
      {
        type: "input",
        block_id: "recipient_block",
        label: { type: "plain_text", text: "Who is this feedback for?" },
        element: {
          type: "users_select",
          action_id: "recipient",
          placeholder: { type: "plain_text", text: "Select person" },
          ...(mentionedUser ? { initial_user: mentionedUser } : {}),
        },
      },
      {
        type: "input",
        block_id: "feedback_type_block",
        label: { type: "plain_text", text: "Feedback Type" },
        element: {
          type: "static_select",
          action_id: "feedback_type",
          options: [
            { text: { type: "plain_text", text: "Praise" }, value: "praise" },
            { text: { type: "plain_text", text: "Constructive" }, value: "constructive" },
            { text: { type: "plain_text", text: "General" }, value: "general" },
          ],
        },
      },
      {
        type: "input",
        block_id: "message_block",
        label: { type: "plain_text", text: "Your Feedback" },
        element: {
          type: "plain_text_input",
          action_id: "message",
          multiline: true,
          placeholder: { type: "plain_text", text: "Share your feedback..." },
        },
      },
      {
        type: "input",
        block_id: "anonymous_block",
        optional: true,
        label: { type: "plain_text", text: "Privacy" },
        element: {
          type: "checkboxes",
          action_id: "anonymous",
          options: [
            { text: { type: "plain_text", text: "Send anonymously" }, value: "anonymous" },
          ],
        },
      },
    ];
  }

  const view = {
    type: "modal",
    callback_id: "feedback_modal",
    title: { type: "plain_text", text: "Give Feedback" },
    submit: { type: "plain_text", text: "Send" },
    close: { type: "plain_text", text: "Cancel" },
    private_metadata: JSON.stringify({ workspaceId: ws.id, usedConfig: !!formConfig }),
    blocks,
  };

  const slackRes = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: { Authorization: `Bearer ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ trigger_id: tr, view }),
  });
  const slackResult = await slackRes.json();
  if (!slackResult.ok) console.error("[slack-commands] views.open failed:", slackResult.error);

  return new Response("", { status: 200 });
}
```

**Step 4: Deploy the updated edge function**

Use `mcp__supabase__deploy_edge_function` with slug `slack-commands`, `verify_jwt: false`.

**Step 5: Manual verification**

In Slack, type `/feedback`. The modal should open. If no config exists yet, it should show the hardcoded form (unchanged). Expected: modal opens, fields match hardcoded defaults.

**Step 6: Commit**
```bash
git commit -m "feat: slack-commands renders /feedback modal from db config with fallback"
```

---

## Task 4: Update `slack-interactivity` edge function — dynamic submission handling

**Files:**
- Modify: `slack-interactivity` edge function (deployed via Supabase MCP)

**Context:** The `feedback_modal` callback_id handler currently extracts hardcoded block IDs from `view.state.values`. We need to make it dynamic when a config exists, while keeping the hardcoded path as fallback.

**Step 1: Read the current full edge function source**

Get it via `mcp__supabase__get_edge_function` with slug `slack-interactivity`.

**Step 2: Find the `feedback_modal` handler**

Look for `callback_id === "feedback_modal"` or `callbackId === "feedback_modal"`. This section:
1. Extracts `to_user_id` from `recipient_block`
2. Extracts `feedback_type` from `feedback_type_block`
3. Extracts `message` from `message_block`
4. Extracts `is_anonymous` from `anonymous_block`
5. Inserts into `continuous_feedback`

**Step 3: Replace that section with the dynamic version**

```typescript
if (callbackId === "feedback_modal") {
  const stateValues = payload.view.state.values;
  const meta = JSON.parse(payload.view.private_metadata || "{}");
  const workspaceId = meta.workspaceId;
  const usedConfig = meta.usedConfig;

  // Core fields (always extracted — present in both dynamic and hardcoded forms)
  // For dynamic forms: field.id is used as both block_id and action_id
  // For hardcoded fallback: original block_id/action_id names are used

  let toUserId: string | null = null;
  let feedbackType = "general";
  let message = "";
  let isAnonymous = false;
  const customFields: Record<string, any> = {};

  if (usedConfig) {
    // Dynamic extraction — fetch config to know field types
    const configRows = await dbQuery("feedback_form_configs", `workspace_id=eq.${workspaceId}&select=fields&limit=1`);
    const fields: any[] = configRows?.[0]?.fields || [];

    for (const field of fields) {
      const blockValues = stateValues[field.id];
      if (!blockValues) continue;
      const actionValues = blockValues[field.id];
      if (!actionValues) continue;

      let value: any = null;
      switch (field.type) {
        case "user_select":
          value = actionValues.selected_user;
          break;
        case "text":
          value = actionValues.value;
          break;
        case "rating":
        case "single_select":
          value = actionValues.selected_option?.value ?? null;
          break;
        case "multi_select":
          value = (actionValues.selected_options || []).map((o: any) => o.value);
          break;
        case "checkbox":
          value = (actionValues.selected_options || []).map((o: any) => o.value);
          break;
      }

      // Map to known core columns
      if (field.id === "recipient") {
        toUserId = value;
      } else if (field.id === "feedback_type") {
        feedbackType = (value || "general").toLowerCase();
      } else if (field.id === "message") {
        message = value || "";
      } else if (field.id === "anonymous") {
        isAnonymous = Array.isArray(value) && value.length > 0;
      } else {
        // Custom field — store in custom_fields
        customFields[field.id] = value;
      }
    }
  } else {
    // Hardcoded fallback extraction (original logic, unchanged)
    toUserId = stateValues?.recipient_block?.recipient?.selected_user ?? null;
    feedbackType = stateValues?.feedback_type_block?.feedback_type?.selected_option?.value ?? "general";
    message = stateValues?.message_block?.message?.value ?? "";
    const anonOptions = stateValues?.anonymous_block?.anonymous?.selected_options ?? [];
    isAnonymous = anonOptions.some((o: any) => o.value === "anonymous");
  }

  if (!toUserId || !message) {
    return new Response("", { status: 200 });
  }

  // Resolve Slack user ID to internal user record
  const ws = await dbQuery("workspaces", `id=eq.${workspaceId}&select=id,bot_token`);
  // (Note: workspace/botToken already available at top of handler — use those)

  const recipientUsers = await dbQuery("users", `workspace_id=eq.${workspaceId}&slack_user_id=eq.${toUserId}&select=id`);
  const recipientDbId = recipientUsers?.[0]?.id;
  if (!recipientDbId) return new Response("", { status: 200 });

  const submitterUsers = await dbQuery("users", `workspace_id=eq.${workspaceId}&slack_user_id=eq.${payload.user.id}&select=id`);
  const submitterDbId = submitterUsers?.[0]?.id;

  // Insert into continuous_feedback
  await dbInsert("continuous_feedback", {
    workspace_id: workspaceId,
    from_user_id: isAnonymous ? null : submitterDbId,
    to_user_id: recipientDbId,
    message,
    feedback_type: feedbackType,
    is_anonymous: isAnonymous,
    custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
  });

  return new Response("", { status: 200 });
}
```

**Important:** The existing handler likely already has `dbInsert`, `dbQuery` helpers and workspace/botToken resolved at the top. Keep those unchanged — only replace the `feedback_modal` block. If the existing code uses different variable names, match them.

**Step 4: Deploy the updated edge function**

Use `mcp__supabase__deploy_edge_function` with slug `slack-interactivity`, `verify_jwt: false`.

**Step 5: Manual verification**

Open `/feedback` in Slack, submit feedback. Check Supabase `continuous_feedback` table — a new row should appear with correct `to_user_id`, `message`, `feedback_type`.

**Step 6: Commit**
```bash
git commit -m "feat: slack-interactivity handles dynamic feedback_modal submissions"
```

---

## Task 5: Form builder page

**Files:**
- Create: `src/app/dashboard/settings/forms/page.tsx`

**Context:** Server component that loads the current config (if any) and renders a `FormBuilder` client component. Uses `createServerSupabaseClient` and `getUserWorkspace` patterns (same as billing page). Accessible to `admin` and `hr` roles only.

**Step 1: Create the page file**

```typescript
// src/app/dashboard/settings/forms/page.tsx
import { createServerSupabaseClient, getUserWorkspace } from "@/lib/supabase-server";
import { isHROrAbove } from "@/lib/roles";
import { redirect } from "next/navigation";
import { FormBuilder } from "./form-builder";

const DEFAULT_FIELDS = [
  { id: "recipient",     type: "user_select",   label: "Who is this feedback for?", required: true,  system: true },
  { id: "feedback_type", type: "single_select", label: "Feedback Type",             required: true,  options: ["Praise", "Constructive", "General"] },
  { id: "message",       type: "text",          label: "Your Feedback",             required: true,  multiline: true },
  { id: "anonymous",     type: "checkbox",      label: "Privacy",                   required: false, options: ["Send anonymously"] },
];

async function getFormConfig() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("feedback_form_configs")
    .select("id, fields")
    .maybeSingle();
  return data;
}

export default async function FormsPage() {
  const workspace = await getUserWorkspace();
  if (!isHROrAbove(workspace?.role)) redirect("/dashboard");

  const config = await getFormConfig();
  const initialFields = config?.fields?.length ? config.fields : DEFAULT_FIELDS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customise the fields employees see when they use <code className="text-xs bg-muted px-1 py-0.5 rounded">/feedback</code> in Slack.
        </p>
      </div>
      <FormBuilder initialFields={initialFields} configId={config?.id ?? null} />
    </div>
  );
}
```

**Step 2: Create the FormBuilder client component**

Create `src/app/dashboard/settings/forms/form-builder.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  GripVertical, Trash2, Settings2, Plus, Lock,
  Type, Star, List, CheckSquare, ChevronDown, User,
} from "lucide-react";

export type FieldType = "user_select" | "text" | "rating" | "single_select" | "multi_select" | "checkbox";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  multiline?: boolean;
  options?: string[];
  system?: boolean;
}

const TYPE_META: Record<FieldType, { label: string; icon: React.ReactNode; description: string }> = {
  user_select:   { label: "Person picker",  icon: <User className="h-4 w-4" />,        description: "Slack user selector" },
  text:          { label: "Text",           icon: <Type className="h-4 w-4" />,         description: "Short or long text input" },
  rating:        { label: "Rating (1–5)",   icon: <Star className="h-4 w-4" />,         description: "Numeric rating scale" },
  single_select: { label: "Single select",  icon: <List className="h-4 w-4" />,         description: "Choose one from a list" },
  multi_select:  { label: "Multi select",   icon: <ChevronDown className="h-4 w-4" />,  description: "Choose multiple from a list" },
  checkbox:      { label: "Checkbox",       icon: <CheckSquare className="h-4 w-4" />,  description: "One or more tick boxes" },
};

function nanoid() {
  return "field_" + Math.random().toString(36).slice(2, 10);
}

interface FieldRowProps {
  field: FormField;
  index: number;
  onUpdate: (id: string, patch: Partial<FormField>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
}

function FieldRow({ field, index, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: FieldRowProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[field.type];

  return (
    <div className="border rounded-lg bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle / move buttons */}
        <div className="flex flex-col gap-0.5 shrink-0">
          {field.system ? (
            <Lock className="h-4 w-4 text-muted-foreground/40" />
          ) : (
            <div className="flex flex-col">
              <button
                onClick={() => onMoveUp(index)}
                disabled={isFirst}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                aria-label="Move up"
              >▲</button>
              <button
                onClick={() => onMoveDown(index)}
                disabled={isLast}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                aria-label="Move down"
              >▼</button>
            </div>
          )}
        </div>

        {/* Type badge */}
        <Badge variant="secondary" className="gap-1 shrink-0 text-xs font-normal">
          {meta.icon}
          {meta.label}
        </Badge>

        {/* Label */}
        <span className="flex-1 text-sm font-medium truncate">{field.label}</span>

        {/* Required badge */}
        <Badge variant={field.required ? "default" : "outline"} className="text-xs shrink-0">
          {field.required ? "Required" : "Optional"}
        </Badge>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!field.system && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Field settings"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}
          {!field.system && (
            <button
              onClick={() => onDelete(field.id)}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              aria-label="Delete field"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded settings */}
      {expanded && !field.system && (
        <div className="border-t px-4 py-4 space-y-4 bg-muted/30">
          {/* Label editor */}
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={field.label}
              onChange={e => onUpdate(field.id, { label: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          {/* Required toggle */}
          <div className="flex items-center gap-2">
            <Switch
              checked={field.required}
              onCheckedChange={v => onUpdate(field.id, { required: v })}
            />
            <Label className="text-xs">Required</Label>
          </div>

          {/* Multiline toggle for text fields */}
          {field.type === "text" && (
            <div className="flex items-center gap-2">
              <Switch
                checked={field.multiline === true}
                onCheckedChange={v => onUpdate(field.id, { multiline: v })}
              />
              <Label className="text-xs">Multi-line (paragraph)</Label>
            </div>
          )}

          {/* Options editor for select / checkbox */}
          {(field.type === "single_select" || field.type === "multi_select" || field.type === "checkbox") && (
            <div className="space-y-2">
              <Label className="text-xs">Options</Label>
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={e => {
                      const newOpts = [...(field.options || [])];
                      newOpts[i] = e.target.value;
                      onUpdate(field.id, { options: newOpts });
                    }}
                    className="h-7 text-sm flex-1"
                  />
                  <button
                    onClick={() => {
                      const newOpts = (field.options || []).filter((_, j) => j !== i);
                      onUpdate(field.id, { options: newOpts });
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove option"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => onUpdate(field.id, { options: [...(field.options || []), "New option"] })}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FormBuilderProps {
  initialFields: FormField[];
  configId: string | null;
}

export function FormBuilder({ initialFields, configId }: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateField = useCallback((id: string, patch: Partial<FormField>) => {
    setFields(fs => fs.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  const deleteField = useCallback((id: string) => {
    setFields(fs => fs.filter(f => f.id !== id));
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index <= 1) return; // Never move above system field at index 0
    setFields(fs => {
      const next = [...fs];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setFields(fs => {
      if (index >= fs.length - 1) return fs;
      const next = [...fs];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const addField = useCallback((type: FieldType) => {
    const defaults: Partial<FormField> = {
      single_select: { options: ["Option 1", "Option 2"] },
      multi_select:  { options: ["Option 1", "Option 2"] },
      checkbox:      { options: ["Check this box"] },
      text:          { multiline: false },
    }[type] || {};

    setFields(fs => [...fs, {
      id: nanoid(),
      type,
      label: TYPE_META[type].label,
      required: false,
      ...defaults,
    }]);
    setShowTypePicker(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabase
        .from("feedback_form_configs")
        .upsert({ ...(configId ? { id: configId } : {}), fields }, { onConflict: "workspace_id" });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
      {/* Left: builder */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between py-4">
            <CardTitle className="text-base">Feedback Form Fields</CardTitle>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? "Saving..." : saved ? "✓ Saved" : "Save"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {fields.map((field, index) => (
              <FieldRow
                key={field.id}
                field={field}
                index={index}
                onUpdate={updateField}
                onDelete={deleteField}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
                isFirst={index === 0}
                isLast={index === fields.length - 1}
              />
            ))}
            <button
              onClick={() => setShowTypePicker(true)}
              className="w-full border-2 border-dashed border-muted-foreground/20 rounded-lg py-3 text-sm text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add field
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Right: Slack preview */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Slack Preview</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="bg-[#1a1d21] rounded-lg p-4 text-white font-sans text-sm space-y-4">
              {/* Mock Slack modal header */}
              <div className="border-b border-white/10 pb-3">
                <p className="font-bold text-base">Give Feedback</p>
              </div>
              {fields.map(field => (
                <div key={field.id} className="space-y-1.5">
                  <p className="text-xs font-semibold text-white/80">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </p>
                  {field.type === "user_select" && (
                    <div className="bg-white/10 rounded px-3 py-2 text-white/50 text-xs">Select person…</div>
                  )}
                  {field.type === "text" && (
                    <div className={`bg-white/10 rounded px-3 py-2 text-white/50 text-xs ${field.multiline ? "h-16" : ""}`}>
                      Enter text…
                    </div>
                  )}
                  {field.type === "rating" && (
                    <div className="bg-white/10 rounded px-3 py-2 text-white/50 text-xs">1 – 2 – 3 – 4 – 5</div>
                  )}
                  {(field.type === "single_select" || field.type === "multi_select") && (
                    <div className="bg-white/10 rounded px-3 py-2 text-white/50 text-xs flex justify-between">
                      <span>{field.options?.[0] ?? "Option…"}</span>
                      <span>▾</span>
                    </div>
                  )}
                  {field.type === "checkbox" && (
                    <div className="space-y-1">
                      {(field.options || ["Check this box"]).map((o, i) => (
                        <div key={i} className="flex items-center gap-2 text-white/50 text-xs">
                          <div className="h-3.5 w-3.5 rounded border border-white/30" />
                          {o}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {/* Mock send/cancel buttons */}
              <div className="border-t border-white/10 pt-3 flex justify-end gap-2">
                <div className="px-3 py-1.5 rounded text-xs bg-white/10 text-white/50">Cancel</div>
                <div className="px-3 py-1.5 rounded text-xs bg-[#007a5a] text-white font-semibold">Send</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Field type picker dialog */}
      <Dialog open={showTypePicker} onOpenChange={setShowTypePicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a field</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {(Object.keys(TYPE_META) as FieldType[])
              .filter(t => t !== "user_select") // user_select is system-only
              .map(type => {
                const meta = TYPE_META[type];
                return (
                  <button
                    key={type}
                    onClick={() => addField(type)}
                    className="flex flex-col gap-1.5 p-3 rounded-lg border hover:bg-muted text-left"
                  >
                    <div className="text-muted-foreground">{meta.icon}</div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 3: Manual verification**

Run the dev server: `npm run dev`. Navigate to `/dashboard/settings/forms`. Confirm:
- Default 4 fields are shown
- Recipient field has lock icon, no delete/settings button
- Other fields can be expanded with Settings2 icon
- "+ Add field" opens the picker dialog
- Adding a single_select field shows option editor
- Right panel shows a dark Slack preview that updates as you edit
- Clicking Save shows "✓ Saved" briefly

**Step 4: Commit**
```bash
git add src/app/dashboard/settings/forms/
git commit -m "feat: add feedback form builder dashboard page"
```

---

## Task 6: Add "Forms" link to sidebar navigation

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Add the import**

In `src/app/dashboard/layout.tsx`, add `FormInput` to the lucide-react import block:

```typescript
import {
  LayoutDashboard, FileText, Users, MessageSquare, BarChart3,
  CalendarClock, Target, CreditCard, Briefcase, ClipboardCheck,
  UsersRound, ListChecks, Flag,
  FormInput,   // ← add this
} from "lucide-react";
```

**Step 2: Add the nav item**

Find the `"Settings"` section items array. Add the Forms entry before Billing:

```typescript
{
  label: "Settings",
  items: [
    { href: "/dashboard/admin/job-families", label: "Job Families", icon: Briefcase,   requiresManager: false, requiresAdmin: true },
    { href: "/dashboard/settings/forms",     label: "Forms",        icon: FormInput,   requiresManager: false, requiresAdmin: false, requiresHR: true },
    { href: "/dashboard/settings/billing",   label: "Billing",      icon: CreditCard,  requiresManager: false, requiresAdmin: true },
  ],
},
```

**Important:** The current nav item type doesn't have `requiresHR`. The simplest approach is to add a `requiresHR` field to the `NavSection` item type and update the filter:

```typescript
interface NavSection {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiresManager: boolean;
    requiresAdmin: boolean;
    requiresHR?: boolean;  // ← add this optional field
  }[];
}
```

And update the filter function:

```typescript
items: section.items.filter((item) => {
  if (item.requiresAdmin) return canAccessAdminFeatures;
  if (item.requiresHR) return isHROrAbove(workspace?.role);   // ← add this check
  if (item.requiresManager) return canAccessManagerFeatures;
  return true;
}),
```

Also add the import for `isHROrAbove` (it's already exported from `@/lib/roles`):

```typescript
import { isManagerOrAbove, isAdmin, isHROrAbove, ROLE_LABELS, UserRole } from "@/lib/roles";
```

**Step 3: Manual verification**

Sign in as admin or HR — "Forms" link should appear in the Settings section of the sidebar.
Sign in as manager — "Forms" should NOT appear.

**Step 4: Commit**
```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: add Forms nav item to sidebar for admin/HR users"
```

---

## Task 7: End-to-end test and deploy

**Step 1: Test the full flow**

1. Go to `/dashboard/settings/forms`
2. Add a new "Rating (1–5)" field with label "How collaborative were they?"
3. Add a new "Single select" field with options "Excellent / Good / Needs improvement"
4. Delete the default "Feedback Type" field
5. Click Save
6. In Slack, type `/feedback` — confirm the modal now shows the 4 custom fields (no Feedback Type, yes Rating and your select)
7. Submit the form — check `continuous_feedback` table in Supabase: `custom_fields` should contain your rating and select values

**Step 2: Test fallback**

Create a brand new workspace or temporarily delete the `feedback_form_configs` row. Type `/feedback` in Slack — the modal should show the original hardcoded 4 fields.

**Step 3: Deploy to production**
```bash
vercel --prod
```

**Step 4: Final commit and tag**
```bash
git commit --allow-empty -m "feat: feedback form builder complete — /feedback modal is now customisable by admin/HR"
```
