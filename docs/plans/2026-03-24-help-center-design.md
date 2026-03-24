# Help Center / Wiki — Design Document

**Date:** 2026-03-24
**Status:** Approved

## Overview

Add an in-app Help Center accessible to all logged-in users at `/dashboard/help`. Articles are authored as MDX files in the repo, rendered with `next-mdx-remote`, and displayed in a Confluence-like sidebar + content layout. Articles have role audience tags (All, Admin, HR, Manager) as visual hints — no access restrictions.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content storage | MDX files in repo | Version-controlled, no external deps, rich rendering |
| MDX rendering | `next-mdx-remote` | Supports custom components + frontmatter, battle-tested |
| Layout | Sidebar + content (inside dashboard) | Familiar Confluence/Notion reading experience |
| Role filtering | Visual tags only | Transparency — everyone can read everything |
| Search | Client-side filter on title + description | Sufficient for ~30 articles, no backend needed |

## Route Structure

```
/dashboard/help              → Landing / first article
/dashboard/help/[slug]       → Individual article
```

Slug is the MDX filename without extension (e.g., `first-15-minutes`, `creating-a-cycle`). Flat — no nested category routes.

## File Structure

```
/content/help/
├── getting-started/
│   ├── first-15-minutes.mdx
│   ├── nami-bot.mdx
│   └── roles-permissions.mdx
├── cycles/
│   ├── creating-a-cycle.mdx
│   ├── cycle-phases.mdx
│   └── lifecycle-explained.mdx
├── reviews/
│   ├── self-review.mdx
│   ├── manager-review.mdx
│   ├── upward-feedback.mdx
│   └── peer-review.mdx
├── goals/
│   └── goal-setting-okrs.mdx
├── team/
│   ├── workspace-setup.mdx
│   ├── managing-users.mdx
│   ├── bulk-csv-import.mdx
│   └── my-team-dashboard.mdx
├── surveys/
│   └── creating-surveys.mdx
├── competencies/
│   ├── frameworks.mdx
│   └── matrix-heatmap.mdx
├── analytics/
│   └── understanding-analytics.mdx
├── calibration/
│   ├── running-calibration.mdx
│   └── year-end-playbook.mdx
├── admin/
│   ├── billing-plans.mdx
│   ├── departments-levels.mdx
│   └── rating-scale.mdx
└── troubleshooting/
    └── faq.mdx
```

## MDX Frontmatter Schema

```yaml
---
title: "Creating & Launching a Performance Cycle"
description: "Step-by-step guide to the 5-step cycle wizard"
category: "Cycles"
audience: ["hr", "admin"]
order: 1
icon: "RefreshCw"
---
```

## Category Order (hardcoded config)

1. Getting Started
2. Cycles
3. Reviews
4. Goals
5. Team Management
6. Surveys
7. Competencies
8. Calibration
9. Analytics
10. Admin & Billing
11. Troubleshooting

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `HelpLayout` | `/app/dashboard/help/layout.tsx` | Two-column layout: sidebar + article content area |
| `HelpSidebar` | `/components/help/help-sidebar.tsx` | Search input + categorized article links, active state, mobile Sheet |
| `HelpArticle` | `/components/help/help-article.tsx` | Renders compiled MDX with title, audience badges, description |
| `HelpSearch` | Part of `HelpSidebar` | Client-side filter on title + description using `string.includes()` |

## Custom MDX Components

| Component | Purpose |
|-----------|---------|
| `<Callout type="info\|warning\|tip">` | Colored callout box with icon |
| `<RoleTag role="admin\|hr\|manager\|all">` | Inline colored audience badge |

Standard markdown handles everything else (numbered lists for steps, `![](...)` for images, tables, code blocks).

## Entry Points

1. **Footer dropdown** (`footer-dropdown.tsx`) — Add "Help Center" with `HelpCircle` icon, placed between Settings and Sign out separator
2. **Dashboard sidebar** (`layout.tsx`) — Add "Help" link at the bottom of the sidebar navigation, visible to all roles

## Data Flow

1. `getAllArticles()` utility reads `/content/help/**/*.mdx` at request time, parses frontmatter with `gray-matter`, returns articles sorted by category order then article order
2. `HelpLayout` (server component) fetches article index, passes to client `HelpSidebar`
3. `/dashboard/help/[slug]/page.tsx` reads the specific MDX file by slug, compiles with `next-mdx-remote`, renders with custom component map
4. `/dashboard/help/page.tsx` redirects to first article or shows a welcome landing

## Dependencies

- `next-mdx-remote` — MDX compilation and rendering
- `gray-matter` — Frontmatter parsing

No database changes. No API routes. No auth changes.

## Mobile Behavior

- Help sidebar collapses into a Sheet (slide-out drawer) triggered by a menu button
- Article content goes full-width
- Same pattern as the existing dashboard mobile sidebar

## Article List (33 articles, ranked by priority)

### Tier 1: Critical

1. Getting Started: Your First 15 Minutes — `All`
2. Initial Workspace Setup Guide — `Admin`
3. How to Complete a Self-Review — `All`
4. How to Write a Manager Review — `Manager`
5. Creating & Launching a Performance Cycle — `HR/Admin`
6. Understanding Roles & Permissions — `Admin`
7. Team Management: Adding & Managing Users — `Admin`

### Tier 2: High Priority

8. How Nami Bot Works — `All`
9. How to Give Upward Feedback (360) — `All`
10. Review Templates: Using & Creating — `HR/Admin`
11. Running Calibration Sessions — `HR/Admin`
12. Viewing Your Performance & Feedback — `All`
13. The Review Lifecycle Explained — `All`
14. Setting Up Competency Frameworks — `HR/Admin`

### Tier 3: Important

15. Goal Setting & OKR Tracking — `All`
16. My Team Dashboard (Manager Guide) — `Manager`
17. Creating & Running Surveys — `HR/Admin`
18. Understanding Analytics & Reports — `HR/Admin`, `Manager`
19. Departments, Job Families & Levels — `Admin`
20. Deadline Reminders & Notifications — `All`

### Tier 4: Supporting

21. Continuous Feedback via Slack — `All`
22. Billing, Plans & Upgrading — `Admin`
23. Competency Matrix & Heatmap Reading Guide — `HR/Admin`, `Manager`
24. Bulk CSV Import Guide — `Admin`
25. Cycle Phases Explained — `HR/Admin`
26. Peer Review: Selecting Reviewers & Process — `HR/Admin`, `Manager`
27. FAQ & Troubleshooting — `All`
28. Security, Privacy & Data Access — `All`

### Tier 5: Advanced

29. eNPS Survey Best Practices — `HR/Admin`
30. Rating Scale Configuration — `Admin`
31. Designing Your First Review Cycle (Playbook) — `HR/Admin`
32. Onboarding New Employees Mid-Cycle — `HR/Admin`
33. Year-End Calibration Playbook — `HR/Admin`
