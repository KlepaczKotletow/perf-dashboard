# Landing Page: Feature Tabs + Width Widening

**Date:** 2026-04-18
**Status:** Approved for implementation

## Goal

Replace four separate feature-spotlight sections on the marketing landing page with one tabbed "Four surfaces · one assistant" section. Also widen the page container so content fills more of wide desktops.

## Motivation

The current landing page has four alternating feature sections (Goals & Analytics, Reviews, Surveys & Pulse, Wellbeing) that cover the same four surfaces the product ships. Each section is ~400+ lines of copy and a mockup, so the page scrolls for a long time before a visitor sees pricing or the CTA. A tabbed pattern (designed by the user's partner, mirrored from reference screenshots) compresses the same content into one screen and lets a visitor flip between surfaces without scrolling.

A secondary ask: on full-screen desktops the `max-w-5xl` / `max-w-6xl` containers leave large empty margins. Bump to `max-w-7xl` (1280px) for a tighter, more modern feel.

## Scope

### In scope
- New client component `src/components/landing/feature-tabs.tsx` with 4 tabs.
- Edit `src/app/page.tsx` to:
  - Delete the four spotlight sections (Goals & Analytics, Reviews, Surveys & Pulse, Wellbeing).
  - Mount `<FeatureTabs />` in their place, between the stats bar and the Template Library section.
  - Update container widths from `max-w-5xl`/`max-w-6xl` to `max-w-7xl` on all remaining sections for consistency.

### Out of scope
- Changing the hero copy, template library, pricing, FAQ, or CTA content.
- Redesigning the stats bar, security strip, or footer.
- Any routing / data changes.

## Design

### Section layout

Mirrors the reference screenshots exactly:

1. **Header block** (left-aligned, centered on page):
   - Eyebrow: `● FOUR SURFACES · ONE ASSISTANT` (small caps, muted)
   - H2: "Everything performance, run from one DM thread." (big serif-weighted)
   - Lede: "Reviews, goals, pulse surveys, and recurring check-ins are separate products in most tools. In Nami they're the same conversation — so adoption is the default, not the exception."

2. **Tab nav** (below header, spans full width with bottom border):
   - Four tabs, each rendered as `01 360° Reviews`, `02 Goals & OKRs`, `03 Pulse & eNPS`, `04 Check-ins`
   - Inactive: muted text, no underline
   - Active: foreground text, bold-weighted, with an underline indicator directly below the tab label
   - Keyboard accessible (Tab / Arrow keys) with ARIA tablist semantics

3. **Active tab panel**: 2-column grid (≥lg) — left copy / right mockup:
   - Left column:
     - Eyebrow (tab-specific small caps label)
     - H3 (tab-specific headline, same type scale as screenshots)
     - Lede paragraph
     - Numbered feature list: `01` / `02` / `03` / `04` with a bolded title + body paragraph per item. Numbers in monospace muted, title bold foreground, body muted.
   - Right column: tab-specific mockup (see "Mockups" below)

### Tab content (verbatim from screenshots)

**Tab 1 — 360° Reviews**
- Eyebrow: `REVIEWS & 360°`
- H3: "Reviews that actually get completed."
- Lede: "Most teams hover around 40–60% review completion. Nami clears 95%+ because the review lives where the work already does — and HR keeps control of visibility."
- Features:
  - 01 **Slack modals, not forms** — Competencies, level descriptors, open-ended comments — all inside a single Slack modal. Reviewers never see a browser.
  - 02 **Airtight visibility rules** — Managers can't see upward feedback until they've submitted their own. Employees see results only after HR releases grades.
  - 03 **9-box calibration built in** — HR aligns grades across managers on a drag-and-drop calibration grid before release. No spreadsheet exports.
  - 04 **Ratings tied to the framework** — Each rating shows the level descriptor for that exact competency at that exact level. Guesswork replaced with rubric.

**Tab 2 — Goals & OKRs**
- Eyebrow: `GOALS & OKRS`
- H3: "Goals that feed the review — not a second tool."
- Lede: "OKRs, progress, and competency signals live next to the review they inform. No CSV exports, no end-of-quarter scramble, no parallel spreadsheet."
- Features:
  - 01 **Quarterly OKR tracking** — Set objectives, key results, and owners. Nami nudges owners in Slack for weekly progress updates — 30 seconds each.
  - 02 **On-track status, automatically** — On-track · At-risk · Achieved — rolled up across the org without anyone maintaining a status page.
  - 03 **Goals feed review cycles** — When the next review opens, goal progress is pre-loaded. Managers see what shipped, what slipped, and what changed.
  - 04 **Trend analytics for HR** — See which teams set stretch goals, which hit consistently, and where execution breaks down — by function and level.

**Tab 3 — Pulse & eNPS**
- Eyebrow: `PULSE & ENPS`
- H3: "Sentiment without the annual survey ritual."
- Lede: "Stop guessing how your team feels. Pulses, eNPS, and custom questionnaires collect answers in under a minute — and arrive as a dashboard with the one insight worth acting on this week."
- Features:
  - 01 **Pulse in 60 seconds** — 5–15 question pulse surveys delivered as Slack DMs. One-tap responses, anonymised and aggregated by default.
  - 02 **eNPS, always on** — Promoters, passives, detractors, tracked over time. One number that flags the week something shifted.
  - 03 **The insight, not the data dump** — Every pulse report surfaces the biggest drop and the team it came from. No dashboards you have to go find.

**Tab 4 — Check-ins**
- Eyebrow: `RECURRING CHECK-INS`
- H3: "Set it once. Nami checks in forever."
- Lede: "Pick a group, pick a frequency. Every week (or two, or four), Nami runs a 30-second temperature check — and pings managers privately when sentiment drops."
- Features:
  - 01 **One emoji tap, optional comment** — That's the whole interaction. Response rates stay above 90% because it's effortless.
  - 02 **Runs on autopilot** — Weekly, bi-weekly, or monthly. Nami sends it, collects it, closes it. You never touch it again.
  - 03 **Early-warning alerts** — When a teammate's score drops across consecutive check-ins, their manager gets a private Slack DM — weeks before it becomes a resignation.

### Mockups per tab

Reuse existing markup as much as possible — the current page already has JSX for 3 of the 4 mockups. Adapt to match the reference screenshots' framed card style (title bar with dots, tab-specific title such as "Manager Review · Alex Kim · L4").

1. **360° Reviews** — Slack manager-review conversation: "2 of 6 · Product Strategy", descriptor list, rating buttons with 4-Exceeds selected, a manager reply with Q4 roadmap context, Nami confirmation "Product Strategy 4/5 ✓ · Next: Stakeholder Management". Base existing mockup at `src/app/page.tsx:652`.
2. **Goals & OKRs** — Card "My Goals · Q2 2026 · 4 of 5 on track" with five goals (title, status chip, progress bar). Base existing mockup at `src/app/page.tsx:359`.
3. **Pulse & eNPS** — Card "Pulse · March 2026 · 87% response · 128 replies" with eNPS +42 block, promoters/passives/detractors bars, 6-point sentiment trend sparkline, "Career growth clarity" insight callout. Base existing mockup at `src/app/page.tsx:846`.
4. **Check-ins** — Slack DM "DM · Sarah Chen": Nami bi-weekly check-in with 5 emoji buttons (🙂 selected), Sarah's reply "Swamped with the migration…", Nami "Thanks Sarah — logged & anonymised", then a private manager alert callout. Base existing mockup at `src/app/page.tsx:983`.

### Component architecture

```tsx
// src/components/landing/feature-tabs.tsx
"use client";
import { useState } from "react";
// ...
const TABS = [
  { id: "reviews",   num: "01", label: "360° Reviews",   panel: <ReviewsPanel /> },
  { id: "goals",     num: "02", label: "Goals & OKRs",   panel: <GoalsPanel /> },
  { id: "pulse",     num: "03", label: "Pulse & eNPS",   panel: <PulsePanel /> },
  { id: "checkins",  num: "04", label: "Check-ins",      panel: <CheckinsPanel /> },
] as const;

export function FeatureTabs() {
  const [active, setActive] = useState<typeof TABS[number]["id"]>("reviews");
  // Render tablist + active panel
}
```

Each panel is a local function component (`ReviewsPanel`, etc.) in the same file — keeps imports / state simple, avoids file sprawl.

### Width changes

- Hero container: `max-w-6xl` → `max-w-7xl` (line 30, line 53).
- Stats bar: keep at `max-w-5xl` (looks better with tight typography).
- Goals & Analytics / Reviews / Surveys / Wellbeing sections: deleted.
- Template Library: `max-w-5xl` → `max-w-7xl` (line 460).
- Feature Tabs section: `max-w-7xl`.
- How It Works: `max-w-5xl` → `max-w-7xl` (line 1149).
- Pricing / FAQ / CTA / Security: leave at current widths — these read better narrow.

### Responsive behavior

- ≥lg (1024px+): 2-column panel (left copy, right mockup, 50/50).
- <lg: single column, mockup stacks below copy.
- <sm: tab nav wraps or becomes horizontally scrollable.

### Accessibility

- `role="tablist"`, `role="tab"`, `role="tabpanel"`.
- `aria-selected` on active tab.
- `aria-controls` + `id` pairing between tab and panel.
- Keyboard: Arrow Left/Right move focus and activate; Home / End jump to ends.

## Non-goals / YAGNI

- No URL hash sync (`#reviews`, etc.) — overkill for a marketing section. Skip unless the user asks.
- No animation library — a CSS transition on the indicator is plenty.
- No lazy-loading of inactive panels — the mockups are static JSX, not heavy.

## Testing

Manual browser verification via preview workflow:
1. Dev server up, reload landing page.
2. Check each tab renders correctly on desktop and mobile width (`preview_resize`).
3. `preview_click` each tab, `preview_snapshot` to confirm panel content swaps.
4. Keyboard nav: Tab to tablist, Arrow keys cycle tabs.
5. Visual check: `preview_screenshot` of each tab at 1280px and 400px widths.

No unit tests — pure presentational component, no logic beyond `useState`.

## Risks

- Deleting four sections removes ~600 lines of copy from the page. The tabs section compensates, but visitors who previously scrolled past all four will now see less total content. Acceptable tradeoff (the page is long; compression is the goal).
- If the user later wants the long-form sections back for SEO, they're in git history — easy to restore.
