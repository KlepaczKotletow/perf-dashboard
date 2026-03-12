# Feedback Form Builder — Design Doc
**Date:** 2026-03-12
**Scope:** `/feedback` Slack command — full form builder for admin/HR
**Status:** Approved, ready for implementation

---

## Problem

The `/feedback` Slack modal is fully hardcoded in the `slack-commands` edge function. Every workspace sees the same fields: recipient, feedback type (Praise/Constructive/General), message, anonymous checkbox. Admins and HR have no way to customise what employees are asked when giving feedback.

The `/review` modal is already cycle-driven (via `cycle_questions` and `templates` tables) and is out of scope.

---

## Goals

- Admin and HR users can build a custom `/feedback` form in the dashboard
- Supports field types: text, rating (1–5), single-select, multi-select, checkbox, user-select
- Global per workspace — one form config applies to all `/feedback` invocations
- Zero disruption to existing workspaces (hardcoded fallback if no config exists)
- `/review` flow is untouched

---

## Data Model

### New table: `feedback_form_configs`

```sql
CREATE TABLE feedback_form_configs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  fields        jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE feedback_form_configs ENABLE ROW LEVEL SECURITY;
```

RLS: readable/writable only by authenticated users whose `workspace_id` matches and whose role is `admin` or `hr`.

### Field schema (element of `fields` JSONB array)

```json
{
  "id": "string (unique within form, e.g. 'recipient', 'field_abc123')",
  "type": "user_select | text | rating | single_select | multi_select | checkbox",
  "label": "string",
  "required": true,
  "multiline": false,
  "options": ["string"],
  "system": false
}
```

**Field type reference:**

| Type | Slack Block Kit element | Notes |
|---|---|---|
| `user_select` | `users_select` | System field — always first, locked, cannot be removed |
| `text` | `plain_text_input` | `multiline` flag supported |
| `rating` | `static_select` | Options rendered as 1–5 |
| `single_select` | `static_select` | Admin-defined options |
| `multi_select` | `multi_static_select` | Admin-defined options |
| `checkbox` | `checkboxes` | Single toggle option |

### Default fields (seed when no config exists)

```json
[
  { "id": "recipient",      "type": "user_select",   "label": "Who is this feedback for?", "required": true,  "system": true },
  { "id": "feedback_type",  "type": "single_select", "label": "Feedback Type",             "required": true,  "options": ["Praise", "Constructive", "General"] },
  { "id": "message",        "type": "text",          "label": "Your Feedback",             "required": true,  "multiline": true },
  { "id": "anonymous",      "type": "checkbox",      "label": "Send anonymously",          "required": false, "options": ["Send anonymously"] }
]
```

### `continuous_feedback` table change

Add column to store custom field responses:

```sql
ALTER TABLE continuous_feedback ADD COLUMN custom_fields jsonb DEFAULT '{}';
```

---

## Dashboard UI

### Location
`/dashboard/settings/forms` — visible in sidebar Settings section, accessible to `admin` and `hr` roles only.

### Layout
- **Left panel:** ordered list of fields
  - Each field: drag handle (reorder), type badge, inline-editable label, required toggle, expand (⚙) for options, delete (🗑)
  - `recipient` field pinned first with lock icon — cannot be removed or reordered
  - For `single_select` / `multi_select`: expanded view shows options list with add/remove/reorder
  - "+ Add field" button at bottom → field type picker modal
- **Right panel:** static Slack modal preview — updates live as fields are edited

### Save flow
- "Save" button (top right) → upserts to `feedback_form_configs`
- Creates row on first save, updates on subsequent saves
- Toast confirmation: *"Form saved — next /feedback will use the new layout"*
- No versioning (YAGNI)

### Navigation
Settings sidebar item "Forms" — shown only to `admin` and `hr`.

---

## Slack Integration

### `slack-commands` edge function

After fetching the workspace row, add a query:

```
GET /rest/v1/feedback_form_configs?workspace_id=eq.{ws.id}&select=fields&limit=1
```

**If config found:** convert `fields` array to Slack Block Kit blocks:
- Each field → `input` block with `block_id: field.id`, `action_id: field.id`
- `optional: !field.required`
- Field type → element mapping per table above
- Rating fields → `static_select` with 5 options `{text: "1", value: "1"}` … `{text: "5", value: "5"}`

**If no config found:** render existing hardcoded blocks unchanged (backward-compatible fallback).

Modal metadata: `private_metadata: JSON.stringify({ workspaceId: ws.id })` — same as today.

### `slack-interactivity` edge function

`feedback_modal` submission handler changes:

1. Fetch `feedback_form_configs` for the workspace
2. If config found — dynamic extraction:
   ```
   for each field in fields:
     value = view.state.values[field.id][field.id].value (or .selected_user, .selected_options, etc.)
   ```
3. Map known core fields to existing columns:
   - `recipient` → `to_user_id` (resolved via Slack user lookup)
   - `feedback_type` → `feedback_type`
   - `message` → `message`
   - `anonymous` → `is_anonymous`
4. All remaining fields → `custom_fields: { [field.id]: value }`
5. If no config found → current hardcoded extraction (fallback, no change)

### `/review` flow

No changes. `cycle_review_select`, `cycle_review_modal`, and all review submission handlers are untouched.

---

## Files Touched

| File | Change |
|---|---|
| Supabase migration | Create `feedback_form_configs` table + RLS; add `custom_fields` to `continuous_feedback` |
| `slack-commands` (edge function) | Fetch config, render dynamic blocks with fallback |
| `slack-interactivity` (edge function) | Dynamic field extraction on `feedback_modal` submit |
| `src/app/dashboard/settings/forms/page.tsx` | New form builder page |
| `src/components/forms/` | Form builder components (field list, field editor, type picker, preview) |
| `src/app/dashboard/layout.tsx` (or nav component) | Add "Forms" sidebar link for admin/hr |

---

## Out of Scope

- `/review` Slack modal customisation
- Form versioning / history
- Multiple feedback form variants per workspace
- Per-team or per-channel form assignment
