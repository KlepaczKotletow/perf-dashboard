# Score Descriptors Per Competency — Design Document

**Date:** 2026-03-31
**Status:** Approved

## Problem

When HR or managers set an expected score of 3 for "Communication" at the Senior level, there's no way to define what that actually means. Different competencies require different behaviors at the same score. Without per-competency score descriptors, the scoring system is ambiguous and inconsistent across reviewers.

## Solution

Add a new `competency_score_descriptors` table that stores one text description per score (1–5) per competency. The scale is fixed at 1–5 globally — not configurable. HR, admins, and managers can define and edit these descriptions. The UI lives on the function detail page, below the expected scores matrix, as a collapsible accordion per competency.

## Database

### New table: `competency_score_descriptors`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `competency_id` | `uuid` | FK → `competencies(id)` ON DELETE CASCADE, NOT NULL |
| `score` | `integer` | NOT NULL, CHECK (score >= 1 AND score <= 5) |
| `description` | `text` | NOT NULL |
| `workspace_id` | `uuid` | FK → `workspaces(id)`, NOT NULL |
| `created_at` | `timestamptz` | DEFAULT `now()` |
| `updated_at` | `timestamptz` | DEFAULT `now()` |

**Unique constraint:** `(competency_id, score)` — one description per score per competency.

**RLS policy:** Users can only read/write rows where `workspace_id` matches their workspace (same pattern as all other tables). Full tenant isolation.

**Row count:** Up to 5 rows per competency. A function with 6 competencies = up to 30 descriptor rows. Lightweight.

## Permissions

| Role | Can view | Can edit |
|---|---|---|
| Admin | Yes | Yes |
| HR | Yes | Yes |
| Manager | Yes | Yes |
| Employee | Yes | No |

Uses `isManagerOrAbove(role)` for edit access — same as the existing scorecard editing.

## UI — Function Detail Page

### Placement

Below the existing "Skills & Expected Scores" matrix table, a new section:

```
LEVELS
[Junior] [Mid] [Senior] [Staff] [Principal]

SKILLS & EXPECTED SCORES
┌──────────────┬───────┬─────┬────────┬───────┬───────────┐
│ Skill        │ Jun   │ Mid │ Senior │ Staff │ Principal │
├──────────────┼───────┼─────┼────────┼───────┼───────────┤
│ Communication│  1    │  2  │   3    │   4   │     5     │
│ ...          │       │     │        │       │           │
└──────────────┴───────┴─────┴────────┴───────┴───────────┘

SCORE DESCRIPTORS                    ← NEW SECTION
┌─ Communication                     ← collapsible per competency
│  ┌───────┬──────────────────────────────────────────────┐
│  │ 1 🔴  │ [Basic verbal and written skills; needs...]  │
│  │ 2 🟠  │ [Communicates clearly in routine...]         │
│  │ 3 🟡  │ [Tailors message to audience; leads...]      │
│  │ 4 🟢  │ [Influences cross-team decisions;...]        │
│  │ 5 🟩  │ [Sets org-wide communication standards...]   │
│  └───────┴──────────────────────────────────────────────┘
├─ System Design                     ← collapsed by default
├─ Problem Solving                   ← collapsed by default
```

### Editing behavior

- Each score row has a `<Textarea>` (2–3 rows) with auto-save on blur
- Save uses upsert: `INSERT ... ON CONFLICT (competency_id, score) DO UPDATE`
- Color badges use the existing `proficiencyColors` map (1=red, 2=orange, 3=yellow, 4=green, 5=emerald)
- Placeholder text: *"What does a [score] in [competency name] look like?"*
- Empty accordion shows: *"Define what each score means for this skill"*
- Read-only for employees: show text, no textarea
- If a competency has zero descriptors defined, show the accordion header dimmed with a "(not defined)" label

### Loading

- Descriptors are fetched alongside the function's competencies and level_competencies in a single query batch
- Query: `SELECT * FROM competency_score_descriptors WHERE competency_id IN (<function competency ids>)`

## Template Import

Score descriptors are **not** included in function templates. Templates provide structure (competencies + expected scores). Score descriptors are customer-specific definitions — each org defines what scores mean in their context.

## What Changes

### Database
- New table `competency_score_descriptors` with RLS

### Files modified
- `src/app/dashboard/admin/functions/functions-client.tsx` — add Score Descriptors section below the scorecard
- `src/app/dashboard/admin/functions/page.tsx` — fetch descriptors in the data loading query

### No other files affected
- Template import dialogs — no change (don't include descriptors)
- Review pages — could optionally show descriptors as tooltips in future, but out of scope here
