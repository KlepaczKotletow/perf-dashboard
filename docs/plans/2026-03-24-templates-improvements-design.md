# Templates Improvements Design

**Date:** 2026-03-24
**Status:** Approved

## Problem Statement

The templates system has no built-in templates, no edit functionality, no duplication, and isn't connected to the cycle creation wizard. Users have to build review questions from scratch every time.

## Design

### 1. Built-in System Templates (6)

Seeded per workspace with `is_system: true`, `created_by: null`. Cannot be edited or deleted. Can be duplicated.

1. **Annual Performance Review** — 5 ratings (Leadership, Communication, Execution, Collaboration, Innovation) + 2 text questions
2. **Mid-Year Check-in** — 3 ratings (Goal Progress, Collaboration, Initiative) + 2 text
3. **90-Day Probation Review** — 4 ratings (Role Fit, Learning Agility, Team Integration, Work Quality) + 2 text
4. **Quarterly Pulse** — 3 ratings (Engagement, Workload Balance, Manager Support) + 1 text
5. **Manager Effectiveness** — 4 ratings (Clear Communication, Provides Feedback, Supports Growth, Sets Direction) + 2 text
6. **Peer Feedback** — 3 ratings (Collaboration, Reliability, Communication) + 2 text

### 2. Template Editing

Add edit mode to template detail page. Same form fields as creation (name, description, questions) but pre-filled. Save Changes button. System templates are read-only.

### 3. Template Duplication

"Duplicate" action creates a copy named "Copy of {name}" and navigates to edit page.

### 4. Cycle Wizard Integration

Step 3 (Questions) of cycle wizard gets a "Start from template" dropdown. Selecting a template pre-fills text questions. User can modify after applying.

### 5. Schema Changes

Add `is_system` boolean column to `templates` table (default false).

## Files to Modify

- `supabase/migrations/` — add is_system column
- `src/app/dashboard/templates/page.tsx` — system badge, seed on first visit
- `src/app/dashboard/templates/new/page.tsx` — no changes
- `src/app/dashboard/templates/[id]/page.tsx` — add edit mode
- `src/app/dashboard/templates/[id]/template-actions.tsx` — add duplicate, protect system templates
- `src/app/dashboard/cycles/new/page.tsx` — template picker in Step 3
