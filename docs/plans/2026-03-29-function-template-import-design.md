# Function Template Import — Design Document

**Date:** 2026-03-29
**Status:** Approved

## Problem

Users must manually create functions (job families), add levels, add skills, and set expected scores one by one. This is tedious and most companies use similar competency structures for common departments. We need a one-click way to import a complete, pre-built competency matrix as a fully configured function.

## Solution

Add 8 "Function Template" cards to the Templates page. Each template contains a complete function definition: name, description, 5 career levels, 6 competencies with descriptions, and a pre-filled expected-scores matrix. Clicking "Use Template" creates all records in the user's workspace database — `job_family`, `levels`, `competencies`, and `level_competencies` — so the function appears instantly in their Functions page as if they built it themselves.

## Data Structure

Templates are seeded into the existing `templates` table with `template_type: 'function_template'`. The `content` JSON column stores:

```json
{
  "function_name": "Software Engineering",
  "function_description": "Career framework for software engineers covering coding, architecture, and technical leadership.",
  "levels": [
    { "name": "Junior", "sort_order": 0 },
    { "name": "Mid", "sort_order": 1 },
    { "name": "Senior", "sort_order": 2 },
    { "name": "Staff", "sort_order": 3 },
    { "name": "Principal", "sort_order": 4 }
  ],
  "competencies": [
    {
      "name": "Coding & Quality",
      "description": "Writing clean, maintainable, well-tested code with appropriate documentation",
      "category": "Technical",
      "expected_scores": [1, 2, 3, 4, 5]
    }
  ]
}
```

`expected_scores[i]` maps to `levels[i]` by index. Values are 1-5 proficiency scale.

## The 8 Function Templates

### 1. Software Engineering
**Levels:** Junior → Mid → Senior → Staff → Principal

| Competency | Category | Jun | Mid | Sen | Staff | Princ |
|---|---|---|---|---|---|---|
| Coding & Quality | Technical | 1 | 2 | 3 | 4 | 5 |
| System Design | Technical | 1 | 2 | 3 | 4 | 5 |
| Debugging & Problem Solving | Technical | 1 | 2 | 3 | 4 | 5 |
| Delivery & Execution | Execution | 1 | 2 | 3 | 4 | 5 |
| Communication | Leadership | 1 | 2 | 3 | 4 | 4 |
| Mentorship & Leadership | Leadership | 1 | 1 | 2 | 3 | 4 |

### 2. Product Management
**Levels:** Associate PM → PM → Senior PM → Lead PM → Director

| Competency | Category | Assoc | PM | Sen | Lead | Dir |
|---|---|---|---|---|---|---|
| Product Strategy | Strategic | 1 | 2 | 3 | 4 | 5 |
| User Research & Empathy | Strategic | 1 | 2 | 3 | 4 | 4 |
| Data-Driven Decisions | Analytical | 1 | 2 | 3 | 4 | 5 |
| Execution & Delivery | Execution | 1 | 2 | 3 | 4 | 4 |
| Stakeholder Management | Leadership | 1 | 2 | 3 | 4 | 5 |
| Technical Fluency | Technical | 1 | 2 | 3 | 3 | 4 |

### 3. Design
**Levels:** Junior Designer → Mid Designer → Senior Designer → Lead Designer → Design Director

| Competency | Category | Jun | Mid | Sen | Lead | Dir |
|---|---|---|---|---|---|---|
| Visual & UI Design | Craft | 1 | 2 | 3 | 4 | 4 |
| UX Research & Testing | Research | 1 | 2 | 3 | 4 | 5 |
| Interaction Design | Craft | 1 | 2 | 3 | 4 | 4 |
| Design Systems | Technical | 1 | 2 | 3 | 4 | 5 |
| Prototyping & Tools | Craft | 1 | 2 | 3 | 3 | 3 |
| Design Communication | Leadership | 1 | 2 | 3 | 4 | 5 |

### 4. Marketing
**Levels:** Coordinator → Specialist → Manager → Senior Manager → Director

| Competency | Category | Coord | Spec | Mgr | Sr Mgr | Dir |
|---|---|---|---|---|---|---|
| Campaign Strategy | Strategic | 1 | 2 | 3 | 4 | 5 |
| Content & Storytelling | Creative | 1 | 2 | 3 | 4 | 4 |
| Analytics & Attribution | Analytical | 1 | 2 | 3 | 4 | 5 |
| Channel Management | Execution | 1 | 2 | 3 | 4 | 4 |
| Brand & Positioning | Strategic | 1 | 2 | 3 | 4 | 5 |
| Cross-Functional Collaboration | Leadership | 1 | 1 | 2 | 3 | 4 |

### 5. Sales
**Levels:** SDR → Account Executive → Senior AE → Lead AE → Sales Director

| Competency | Category | SDR | AE | Sr AE | Lead | Dir |
|---|---|---|---|---|---|---|
| Prospecting & Pipeline | Execution | 1 | 2 | 3 | 4 | 4 |
| Discovery & Qualification | Execution | 1 | 2 | 3 | 4 | 5 |
| Negotiation & Closing | Execution | 1 | 2 | 3 | 4 | 5 |
| Product & Market Knowledge | Strategic | 1 | 2 | 3 | 4 | 5 |
| Account Management | Strategic | 1 | 2 | 3 | 4 | 4 |
| Communication & Influence | Leadership | 1 | 2 | 3 | 4 | 5 |

### 6. Customer Success
**Levels:** CS Associate → CSM → Senior CSM → Lead CSM → CS Director

| Competency | Category | Assoc | CSM | Sr | Lead | Dir |
|---|---|---|---|---|---|---|
| Onboarding & Adoption | Execution | 1 | 2 | 3 | 4 | 4 |
| Retention & Renewals | Strategic | 1 | 2 | 3 | 4 | 5 |
| Escalation Management | Execution | 1 | 2 | 3 | 4 | 5 |
| Product Expertise | Technical | 1 | 2 | 3 | 4 | 4 |
| Customer Advocacy | Strategic | 1 | 2 | 3 | 4 | 5 |
| Relationship Building | Leadership | 1 | 2 | 3 | 4 | 5 |

### 7. Data & Analytics
**Levels:** Junior Analyst → Analyst → Senior Analyst → Lead Analyst → Analytics Director

| Competency | Category | Jun | Analyst | Sen | Lead | Dir |
|---|---|---|---|---|---|---|
| Data Modeling & SQL | Technical | 1 | 2 | 3 | 4 | 4 |
| Statistical Analysis | Technical | 1 | 2 | 3 | 4 | 5 |
| Data Visualization | Craft | 1 | 2 | 3 | 4 | 4 |
| Business Acumen | Strategic | 1 | 2 | 3 | 4 | 5 |
| Data Engineering | Technical | 1 | 2 | 3 | 4 | 4 |
| Stakeholder Communication | Leadership | 1 | 1 | 2 | 3 | 4 |

### 8. People & HR
**Levels:** HR Coordinator → HR Specialist → HR Manager → Senior HR Manager → HR Director

| Competency | Category | Coord | Spec | Mgr | Sr Mgr | Dir |
|---|---|---|---|---|---|---|
| Talent Acquisition | Execution | 1 | 2 | 3 | 4 | 4 |
| Employee Relations | Execution | 1 | 2 | 3 | 4 | 5 |
| Learning & Development | Strategic | 1 | 2 | 3 | 4 | 5 |
| Compensation & Benefits | Technical | 1 | 2 | 3 | 4 | 4 |
| HR Operations & Compliance | Technical | 1 | 2 | 3 | 4 | 5 |
| People Analytics | Analytical | 1 | 1 | 2 | 3 | 4 |

## Import Flow (UX)

### Templates Page
1. User navigates to **Templates** → **Function Templates** tab
2. Sees 8 cards, each showing: function name, description, "5 levels · 6 skills" badge, category tags
3. Clicks **"Preview"** → card expands to show the full levels × competencies matrix with expected scores
4. Clicks **"Use Template"** → opens `FunctionImportDialog`

### Import Dialog
1. Shows function name, description, full matrix preview
2. **Duplicate check**: queries `job_families` for matching name in this workspace
3. If duplicate found: warns user, offers to "Import Anyway" (creates with " (Copy)" suffix) or cancel
4. If no duplicate: shows green "Ready to import" state
5. User clicks **"Create Function"**

### Import Execution (single transaction)
1. Insert into `job_families` → get `job_family_id`
2. Insert 5 rows into `levels` (with `job_family_id`, `sort_order`) → get level IDs
3. Insert 6 rows into `competencies` (with `job_family_id`, `workspace_id`) → get competency IDs
4. Insert 30 rows into `level_competencies` (5 levels × 6 competencies, with `expected_level` from the matrix)
5. Redirect to `/dashboard/admin/functions` with the new function selected
6. Show success toast

All records are scoped to the user's `workspace_id` — completely isolated per workspace.

## What Changes

### Files Modified
- **`src/app/dashboard/templates/page.tsx`** — Add `SYSTEM_FUNCTION_TEMPLATES` array (8 templates), update seeding to insert with `template_type: 'function_template'`, remove old `SYSTEM_COMPETENCY_FRAMEWORKS`
- **`src/app/dashboard/templates/templates-client.tsx`** — Replace `FrameworkCard` with `FunctionTemplateCard`, add matrix preview, update tab from "Competency Frameworks" to "Function Templates"

### Files Added
- **`src/app/dashboard/templates/function-import-dialog.tsx`** — New dialog component for the full function import flow (duplicate check, preview, create all records)

### Files Removed
- **`src/app/dashboard/templates/framework-import-dialog.tsx`** — Replaced by the new function import dialog

### No DB Schema Changes
All records use existing tables: `templates`, `job_families`, `levels`, `competencies`, `level_competencies`. No migrations needed.

## Edge Cases
- **Workspace has no levels yet**: Not an issue — the template creates its own levels scoped to the new function
- **Duplicate function name**: Warn user, offer to create with " (Copy)" suffix
- **Duplicate competency names**: Competencies are scoped to `job_family_id`, so same-named competencies in different functions are fine
- **User imports same template twice**: Second import gets " (Copy)" suffix on the function name
- **Partial failure**: If any insert fails mid-import, show error and don't redirect. User can retry. (Supabase doesn't support client-side transactions, so we insert in sequence and handle errors per step.)
