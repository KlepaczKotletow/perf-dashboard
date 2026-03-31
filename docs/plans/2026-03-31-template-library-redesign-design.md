# Template Library UI Redesign — Design Document

**Date:** 2026-03-31
**Status:** Approved

## Problem

The template library page uses 5 tabs with inconsistent layouts (tables, 2-col cards, 3-col cards). It's overwhelming, hard to scan, and doesn't match the clean table patterns used elsewhere in the app (Directory, Cycles, Goals). Users can't preview template contents without clicking "Use Template" or navigating to a detail page.

## Solution

Replace the tabbed layout with a single scrollable page. All templates displayed in a unified table format grouped by type with section headers. Each row is expandable (accordion-style) to preview template contents inline. "Use Template" button stays in the row — no expansion needed to act.

## Page Structure

```
Page header: "Template Library" + search bar + "Create Template" button

FUNCTION TEMPLATES (8)
┌────────────────────────────────────────────────────────────────┐
│ ▶ Software Engineering  │ Career framework for... │ 5 lvl · 6 comp │ [Use Template] │
│ ▶ Product Management    │ PM career ladder...     │ 5 lvl · 6 comp │ [Use Template] │
│ ...                                                                                  │
└────────────────────────────────────────────────────────────────┘

REVIEW TEMPLATES (6)
┌────────────────────────────────────────────────────────────────┐
│ ▶ Annual Performance Review │ Comprehensive yearly... │ 7 questions │ [Use Template] │
│ ▶ Mid-Year Check-in         │ Lightweight mid-year... │ 5 questions │ [Use Template] │
│ ...                                                                                  │
└────────────────────────────────────────────────────────────────┘

COMPETENCY FRAMEWORKS (9)
...

CYCLE PROFILES (4)
...

GOAL TEMPLATES (4)
...
```

## Row Layout

### Collapsed state (all types)

```
grid-cols-[auto_1fr_auto_auto]

[▶ icon] [Name + badges] [Description truncated] [Stats] [Use Template button]
```

- **Chevron** — rotates 90° when expanded
- **Name** — template name + "System" badge if system template
- **Description** — truncated to 1 line, `text-muted-foreground`
- **Stats** — varies by type (see below)
- **Use Template** — primary button, triggers existing dialog/link per type

### Stats column per type

| Type | Stats display |
|---|---|
| Function Templates | `5 levels · 6 competencies` |
| Review Templates | `7 questions` |
| Competency Frameworks | `6 competencies · 5 levels` |
| Cycle Profiles | `Annual` (cycle type badge) |
| Goal Templates | `Individual` or `Team` (scope badge) |

## Expanded Content

Clicking the row (or chevron) expands an accordion panel below. Content varies by type:

### Function Templates — expanded

Shows the full competency matrix preview:
- Level names as column headers
- Competency rows with expected scores (color-coded badges, same `proficiencyColors` as functions page)
- Competency descriptions shown below each name

### Review Templates — expanded

List of questions:
- Rating questions: `⭐ Leadership: Demonstrates initiative...`
- Text questions: `💬 What areas should they focus on?`
- Shows required/optional badge

### Competency Frameworks — expanded

Competencies grouped by category:
- Category headers (Technical, Leadership, Core)
- Under each: competency name + description
- Level indicators if present

### Cycle Profiles — expanded

Key-value layout:
- Cycle type: Annual/Quarterly/etc
- Competency focus: Technical, Leadership, Core
- Review template: Annual Performance Review
- Phase weights visualization (optional)

### Goal Templates — expanded

- Title template: `Improve [metric] by [X]%`
- Scope: Individual/Team
- Metric: start → target (unit)

## Search

Single search bar at page level. Filters across all sections by name and description. Sections with zero matching templates are hidden entirely.

## Empty sections

Sections with zero templates don't render at all. After seeding, system templates always exist, so empty states are unlikely.

## Existing behaviors preserved

- Function templates → `FunctionImportDialog` (one-click draft function)
- Cycle profiles → `CycleImportDialog` (one-click draft cycle)
- Review templates → link to `/dashboard/cycles/new?reviewTemplate=<id>`
- Goal templates → link to `/dashboard/goals/new?templateId=<id>`
- Competency frameworks → link to `/dashboard/competencies?import=<id>`

## Files Changed

### Rewrite
- `src/app/dashboard/templates/templates-client.tsx` — complete rewrite from tabbed to sectioned table layout

### Unchanged
- `src/app/dashboard/templates/page.tsx` — no changes (data fetching + seeding stays the same)
- `src/app/dashboard/templates/function-import-dialog.tsx` — no changes
- `src/app/dashboard/templates/cycle-import-dialog.tsx` — no changes
- `src/app/dashboard/templates/framework-import-dialog.tsx` — can be removed (framework "Import" link still works without it)
