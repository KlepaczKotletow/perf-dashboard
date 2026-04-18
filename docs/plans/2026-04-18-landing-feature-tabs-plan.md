# Landing Page Feature Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace four separate feature-spotlight sections on the landing page with a single tabbed "Four surfaces · one assistant" section (4 tabs: 360° Reviews / Goals & OKRs / Pulse & eNPS / Check-ins), and widen the page's main container to `max-w-7xl` so content fills more of wide desktops.

**Architecture:** One new client component `src/components/landing/feature-tabs.tsx` that owns tab state via `useState`. Four panel sub-components in the same file (no file sprawl). The Slack/dashboard mockups are lifted from the existing sections in `src/app/page.tsx` so we keep working markup. The old sections are deleted after the new one renders correctly.

**Tech Stack:** Next.js 15 (App Router), React 19 client component (`"use client"`), Tailwind CSS, `lucide-react` icons, `@/components/ui/*` primitives already in the project. No new dependencies.

**Design doc:** `docs/plans/2026-04-18-landing-feature-tabs-design.md`

**Verification approach:** This is presentational UI with no logic beyond `useState`. No unit tests — verify visually via Claude Preview tools (`preview_start`, `preview_click`, `preview_snapshot`, `preview_screenshot`, `preview_console_logs`). Each task ends with a browser check before commit.

**Commit cadence:** After every task (6 commits total).

---

## Task 1: Scaffold FeatureTabs component with stub panels, mount in page

**Goal:** Get a working tabbed shell on the page so we can iterate panel-by-panel. Old sections stay in place temporarily — we only delete them in Task 6 once the new section is complete.

**Files:**
- Create: `src/components/landing/feature-tabs.tsx`
- Modify: `src/app/page.tsx` (add import + mount component between stats bar and Goals & Analytics section)

**Step 1: Create the component file**

Write `src/components/landing/feature-tabs.tsx` with this exact content:

```tsx
"use client";

import { useState } from "react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { cn } from "@/lib/utils";

type TabId = "reviews" | "goals" | "pulse" | "checkins";

const TABS: Array<{ id: TabId; num: string; label: string }> = [
  { id: "reviews",  num: "01", label: "360° Reviews" },
  { id: "goals",    num: "02", label: "Goals & OKRs" },
  { id: "pulse",    num: "03", label: "Pulse & eNPS" },
  { id: "checkins", num: "04", label: "Check-ins" },
];

export function FeatureTabs() {
  const [active, setActive] = useState<TabId>("reviews");

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const idx = TABS.findIndex((t) => t.id === active);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive(TABS[(idx + 1) % TABS.length].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive(TABS[(idx - 1 + TABS.length) % TABS.length].id);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(TABS[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(TABS[TABS.length - 1].id);
    }
  };

  return (
    <section className="bg-[#faf9f4] border-y border-border/40 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        {/* Header */}
        <ScrollReveal className="max-w-3xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
              Four surfaces · One assistant
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-foreground leading-[1.05]">
            Everything performance,
            <br />
            <span className="font-serif italic font-normal text-foreground/80">
              run from one DM thread.
            </span>
          </h2>
          <p className="mt-6 text-[17px] leading-relaxed text-muted-foreground max-w-2xl">
            Reviews, goals, pulse surveys, and recurring check-ins are separate
            products in most tools. In Nami they&apos;re the same conversation —
            so adoption is the default, not the exception.
          </p>
        </ScrollReveal>

        {/* Tab nav */}
        <div
          role="tablist"
          aria-label="Feature surfaces"
          className="mt-12 flex flex-wrap gap-x-10 gap-y-3 border-b border-border/60"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={onKeyDown}
                className={cn(
                  "relative pb-4 flex items-baseline gap-3 text-left transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/70"
                )}
              >
                <span
                  className={cn(
                    "font-mono text-xs",
                    isActive ? "text-primary" : "text-muted-foreground/60"
                  )}
                >
                  {tab.num}
                </span>
                <span
                  className={cn(
                    "text-[15px] sm:text-base",
                    isActive ? "font-semibold" : "font-medium"
                  )}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-foreground" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active panel */}
        <div
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          className="pt-14"
        >
          {active === "reviews" && <ReviewsPanel />}
          {active === "goals" && <GoalsPanel />}
          {active === "pulse" && <PulsePanel />}
          {active === "checkins" && <CheckinsPanel />}
        </div>
      </div>
    </section>
  );
}

// ───── Panel stubs (filled in later tasks) ─────

function ReviewsPanel() {
  return <PanelStub title="360° Reviews — coming in Task 2" />;
}
function GoalsPanel() {
  return <PanelStub title="Goals & OKRs — coming in Task 3" />;
}
function PulsePanel() {
  return <PanelStub title="Pulse & eNPS — coming in Task 4" />;
}
function CheckinsPanel() {
  return <PanelStub title="Check-ins — coming in Task 5" />;
}

function PanelStub({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-muted-foreground">
      {title}
    </div>
  );
}
```

**Step 2: Mount in page.tsx**

In `src/app/page.tsx`:

- After the existing `import { AnimatedCounter } from "@/components/landing/animated-counter";` line (line 11), add:

  ```tsx
  import { FeatureTabs } from "@/components/landing/feature-tabs";
  ```

- Immediately after the closing `</section>` of the stats bar (the `</section>` on line 338, just before the `{/* ── Goals & Analytics — product showcase ── */}` comment on line 340), insert on its own line:

  ```tsx
        <FeatureTabs />
  ```

  Use the Edit tool with the `{/* ── Goals & Analytics` comment as the anchor so the new line goes directly above it.

**Step 3: Start dev server and verify**

1. `preview_start` the project.
2. `preview_eval` with `window.location.reload()` if the landing page is already open.
3. `preview_console_logs` — expect no errors.
4. `preview_snapshot` — confirm the new section appears between the stats bar and "Track goals. See patterns." heading; tab nav shows all four tabs; the active tab is "360° Reviews" with the underline indicator; the panel shows "360° Reviews — coming in Task 2" stub text.
5. `preview_click` each tab in turn (`role=tab` with the tab label). After each click, `preview_snapshot` and confirm:
   - The underline moves.
   - The stub panel text updates (e.g. "Goals & OKRs — coming in Task 3").
6. `preview_screenshot` at the default viewport for visual confirmation.

**Step 4: Commit**

```bash
git add src/components/landing/feature-tabs.tsx src/app/page.tsx
git commit -m "feat(landing): scaffold FeatureTabs with stub panels

Adds four-tab shell (360° Reviews / Goals & OKRs / Pulse & eNPS /
Check-ins) between the stats bar and existing feature sections.
Panels are stubs — filled in subsequent tasks before old sections
are removed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Build ReviewsPanel

**Goal:** Replace the `ReviewsPanel` stub with the real two-column layout — copy on the left (eyebrow / H3 / lede / numbered 01-04 feature list), Slack manager-review mockup on the right (title bar with dots + "Manager Review · Alex Kim · L4").

**Files:**
- Modify: `src/components/landing/feature-tabs.tsx` (replace the `ReviewsPanel` stub)

**Reference markup:** The existing Slack DM mockup at `src/app/page.tsx:640-790` is the closest match. Lift its conversation blocks — don't rewrite from scratch. The window chrome (dot row + `Manager Review · Alex Kim · L4` title bar) is new from the screenshot.

**Step 1: Import icons you'll need**

At the top of `src/components/landing/feature-tabs.tsx`, add this import (keep the existing `useState` and `ScrollReveal` imports):

```tsx
// no new icons needed for this panel — everything is hand-rolled
```

(If your implementation of the Slack mockup uses a lucide icon, add it here. The reference mockup does not require any.)

**Step 2: Replace the ReviewsPanel stub**

Remove the existing stub:

```tsx
function ReviewsPanel() {
  return <PanelStub title="360° Reviews — coming in Task 2" />;
}
```

Replace with the full panel below. It uses the shared `TwoColPanel` helper (create it too — one copy, four reuses).

First, add this shared helper above `ReviewsPanel`:

```tsx
function TwoColPanel({
  eyebrow,
  heading,
  lede,
  features,
  mockup,
}: {
  eyebrow: string;
  heading: React.ReactNode;
  lede: string;
  features: Array<{ num: string; title: string; body: string }>;
  mockup: React.ReactNode;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
      {/* Left: copy */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
            {eyebrow}
          </span>
        </div>
        <h3 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-foreground leading-[1.1]">
          {heading}
        </h3>
        <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground max-w-xl">
          {lede}
        </p>

        <dl className="mt-10 space-y-7">
          {features.map((f) => (
            <div key={f.num} className="grid grid-cols-[36px_1fr] gap-x-5">
              <dt className="font-mono text-xs text-muted-foreground/60 pt-0.5">
                {f.num}
              </dt>
              <div>
                <p className="text-[15px] font-semibold text-foreground">
                  {f.title}
                </p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            </div>
          ))}
        </dl>
      </div>

      {/* Right: mockup */}
      <div className="relative">{mockup}</div>
    </div>
  );
}
```

Then add `ReviewsPanel`:

```tsx
function ReviewsPanel() {
  return (
    <TwoColPanel
      eyebrow="Reviews & 360°"
      heading={
        <>
          Reviews that
          <br />
          <span className="font-serif italic font-normal text-foreground/80">
            actually get completed.
          </span>
        </>
      }
      lede="Most teams hover around 40–60% review completion. Nami clears 95%+ because the review lives where the work already does — and HR keeps control of visibility."
      features={[
        {
          num: "01",
          title: "Slack modals, not forms",
          body: "Competencies, level descriptors, open-ended comments — all inside a single Slack modal. Reviewers never see a browser.",
        },
        {
          num: "02",
          title: "Airtight visibility rules",
          body: "Managers can't see upward feedback until they've submitted their own. Employees see results only after HR releases grades.",
        },
        {
          num: "03",
          title: "9-box calibration built in",
          body: "HR aligns grades across managers on a drag-and-drop calibration grid before release. No spreadsheet exports.",
        },
        {
          num: "04",
          title: "Ratings tied to the framework",
          body: "Each rating shows the level descriptor for that exact competency at that exact level. Guesswork replaced with rubric.",
        },
      ]}
      mockup={<ReviewsMockup />}
    />
  );
}

function ReviewsMockup() {
  return (
    <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-2xl shadow-primary/10">
      {/* Window chrome */}
      <div className="bg-muted/70 border-b border-border/60 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <p className="flex-1 text-center text-[11px] text-muted-foreground font-medium">
          Manager Review · Alex Kim · L4
        </p>
      </div>

      {/* Slack-style conversation */}
      <div className="p-5 space-y-5 bg-white">
        {/* Nami → competency prompt */}
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">N</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">Nami</span>
              <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                APP
              </span>
              <span className="text-[11px] text-muted-foreground">10:32 AM</span>
            </div>
            <p className="text-[13px] font-semibold text-foreground">
              2 of 6 · Product Strategy
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Defining product vision, roadmap, and competitive positioning.
            </p>
            <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] font-semibold text-foreground mb-2.5">
                Rate at L4 (Senior) — expected: 4/5
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { n: 2, label: "Below" },
                  { n: 3, label: "Meets" },
                  { n: 4, label: "Exceeds", selected: true },
                  { n: 5, label: "Exceptional" },
                ].map((opt) => (
                  <div
                    key={opt.n}
                    className={cn(
                      "rounded-lg px-2 py-2 text-center border",
                      opt.selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-white text-foreground"
                    )}
                  >
                    <p
                      className={cn(
                        "text-lg font-bold",
                        opt.selected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {opt.n}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {opt.label}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">4</span> —
                Defines multi-quarter strategy backed by market analysis.
              </p>
            </div>
          </div>
        </div>

        {/* Manager context reply */}
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
            <span className="text-amber-900 text-xs font-bold">M</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">
                Mike Torres
              </span>
              <span className="text-[11px] text-muted-foreground">10:33 AM</span>
            </div>
            <p className="text-[13px] text-foreground italic leading-relaxed">
              &ldquo;Alex drove the Q4 roadmap independently and identified the
              upsell opportunity that became our top initiative.&rdquo;
            </p>
          </div>
        </div>

        {/* Nami confirmation */}
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">N</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">Nami</span>
              <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                APP
              </span>
              <span className="text-[11px] text-muted-foreground">10:33 AM</span>
            </div>
            <p className="text-[13px] text-foreground">
              Product Strategy{" "}
              <span className="font-semibold text-primary">4/5</span> ✓ · Next:
              Stakeholder Management
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Verify in browser**

1. `preview_eval` with `window.location.reload()`.
2. `preview_console_logs` — no errors.
3. `preview_click` the "360° Reviews" tab (already active on load, but click to be sure).
4. `preview_snapshot` — confirm left column shows eyebrow "REVIEWS & 360°", headline with italicised "actually get completed.", lede, and four 01-04 numbered features. Right column shows the window-chrome dots, "Manager Review · Alex Kim · L4" title, and the Slack conversation with the Product Strategy rating block (4 selected in primary colour), Mike's italicised quote, and Nami's confirmation line.
5. `preview_screenshot` at 1280px width.
6. `preview_resize` to 400px width; `preview_snapshot` to confirm the two columns stack into one.

**Step 4: Commit**

```bash
git add src/components/landing/feature-tabs.tsx
git commit -m "feat(landing): flesh out 360° Reviews tab panel

Two-column layout with numbered 01-04 feature list and a Slack-style
Manager Review mockup (rating buttons, manager context, Nami
confirmation). TwoColPanel helper added for reuse across the remaining
three tabs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Build GoalsPanel

**Goal:** Replace the `GoalsPanel` stub with the Goals & OKRs tab content. Right-side mockup is a dashboard card (not a Slack DM) — "My Goals · Q2 2026 · 4 of 5 on track" with five goals, each showing title + status chip + progress bar.

**Files:**
- Modify: `src/components/landing/feature-tabs.tsx` (replace the `GoalsPanel` stub)

**Reference markup:** Existing Goals card at `src/app/page.tsx:359-394` — same content, just re-skinned to match the screenshot's window-chrome style.

**Step 1: Replace GoalsPanel**

Remove the stub and add:

```tsx
function GoalsPanel() {
  return (
    <TwoColPanel
      eyebrow="Goals & OKRs"
      heading={
        <>
          Goals that <span className="text-foreground/80">feed the review</span>
          <br />
          <span className="font-serif italic font-normal text-foreground/80">
            — not a second tool.
          </span>
        </>
      }
      lede="OKRs, progress, and competency signals live next to the review they inform. No CSV exports, no end-of-quarter scramble, no parallel spreadsheet."
      features={[
        {
          num: "01",
          title: "Quarterly OKR tracking",
          body: "Set objectives, key results, and owners. Nami nudges owners in Slack for weekly progress updates — 30 seconds each.",
        },
        {
          num: "02",
          title: "On-track status, automatically",
          body: "On-track · At-risk · Achieved — rolled up across the org without anyone maintaining a status page.",
        },
        {
          num: "03",
          title: "Goals feed review cycles",
          body: "When the next review opens, goal progress is pre-loaded. Managers see what shipped, what slipped, and what changed.",
        },
        {
          num: "04",
          title: "Trend analytics for HR",
          body: "See which teams set stretch goals, which hit consistently, and where execution breaks down — by function and level.",
        },
      ]}
      mockup={<GoalsMockup />}
    />
  );
}

function GoalsMockup() {
  const goals: Array<{
    title: string;
    status: "ON TRACK" | "AT RISK" | "ACHIEVED";
    progress: number;
  }> = [
    { title: "Ship the new onboarding flow",    status: "ON TRACK", progress: 72 },
    { title: "Reduce p95 API latency <200ms",   status: "ON TRACK", progress: 58 },
    { title: "Hire 2 senior engineers",         status: "AT RISK",  progress: 25 },
    { title: "Launch design-system v2",         status: "ACHIEVED", progress: 100 },
    { title: "Publish quarterly eng blog",      status: "ON TRACK", progress: 40 },
  ];

  const chip = (s: (typeof goals)[number]["status"]) => {
    if (s === "ACHIEVED") return "bg-primary/15 text-primary";
    if (s === "AT RISK") return "bg-amber-100 text-amber-800";
    return "bg-emerald-100 text-emerald-800";
  };

  const bar = (s: (typeof goals)[number]["status"]) => {
    if (s === "ACHIEVED") return "bg-primary";
    if (s === "AT RISK") return "bg-amber-400";
    return "bg-emerald-500";
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-2xl shadow-primary/10">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
        <p className="font-mono text-[13px] text-muted-foreground">
          <span className="text-foreground font-semibold">My Goals</span> · Q2
          2026
        </p>
        <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 rounded-full px-3 py-1">
          4 of 5 on track
        </span>
      </div>
      <div className="divide-y divide-border/40">
        {goals.map((g) => (
          <div
            key={g.title}
            className="px-6 py-4 grid grid-cols-[1fr_auto_120px_40px] gap-4 items-center"
          >
            <p className="text-[14px] font-medium text-foreground truncate">
              {g.title}
            </p>
            <span
              className={cn(
                "text-[10px] font-semibold tracking-wide px-2 py-1 rounded",
                chip(g.status)
              )}
            >
              {g.status}
            </span>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", bar(g.status))}
                style={{ width: `${g.progress}%` }}
              />
            </div>
            <span className="text-[12px] font-semibold text-foreground tabular-nums text-right">
              {g.progress}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify in browser**

1. `preview_eval` with `window.location.reload()`.
2. `preview_click` the "Goals & OKRs" tab.
3. `preview_snapshot` — confirm:
   - Left: eyebrow "GOALS & OKRS", headline "Goals that feed the review — not a second tool." (with italicised "— not a second tool."), lede, four 01-04 features.
   - Right: card header "My Goals · Q2 2026" with "4 of 5 on track" pill; five rows with titles, coloured status chips (green ON TRACK, amber AT RISK, primary ACHIEVED), progress bars, percentages.
4. `preview_screenshot` at 1280px.
5. `preview_console_logs` — no errors.

**Step 3: Commit**

```bash
git add src/components/landing/feature-tabs.tsx
git commit -m "feat(landing): flesh out Goals & OKRs tab panel

Dashboard card mockup (My Goals · Q2 2026, 5 goals with status chips
and progress bars) paired with the 01-04 feature list on the left.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Build PulsePanel

**Goal:** Replace the `PulsePanel` stub with the Pulse & eNPS tab content. Three numbered features (not four). Right-side mockup is a pulse dashboard card — "Pulse · March 2026" with eNPS +42 block, promoters/passives/detractors bars, 6-pulse sentiment trend line chart, and a "Career growth clarity" insight callout in warm amber.

**Files:**
- Modify: `src/components/landing/feature-tabs.tsx`

**Reference markup:** Pulse results card at `src/app/page.tsx:845-912` — same shapes, different framing.

**Step 1: Replace PulsePanel**

Remove the stub and add:

```tsx
function PulsePanel() {
  return (
    <TwoColPanel
      eyebrow="Pulse & eNPS"
      heading={
        <>
          Sentiment without
          <br />
          <span className="font-serif italic font-normal text-foreground/80">
            the annual survey ritual.
          </span>
        </>
      }
      lede="Stop guessing how your team feels. Pulses, eNPS, and custom questionnaires collect answers in under a minute — and arrive as a dashboard with the one insight worth acting on this week."
      features={[
        {
          num: "01",
          title: "Pulse in 60 seconds",
          body: "5–15 question pulse surveys delivered as Slack DMs. One-tap responses, anonymised and aggregated by default.",
        },
        {
          num: "02",
          title: "eNPS, always on",
          body: "Promoters, passives, detractors, tracked over time. One number that flags the week something shifted.",
        },
        {
          num: "03",
          title: "The insight, not the data dump",
          body: "Every pulse report surfaces the biggest drop and the team it came from. No dashboards you have to go find.",
        },
      ]}
      mockup={<PulseMockup />}
    />
  );
}

function PulseMockup() {
  // Simple polyline sparkline — 6 months, normalized to a 0-100 Y axis
  const trend = [28, 30, 26, 34, 36, 42];
  const w = 340;
  const h = 90;
  const max = Math.max(...trend);
  const min = Math.min(...trend);
  const points = trend.map((v, i) => {
    const x = (i / (trend.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M${points.join(" L")}`;
  const area = `${path} L${w},${h} L0,${h} Z`;
  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

  return (
    <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-2xl shadow-primary/10">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
        <p className="font-mono text-[13px] text-muted-foreground">
          <span className="text-foreground font-semibold">Pulse</span> · March
          2026
        </p>
        <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 rounded-full px-3 py-1">
          87% response · 128 replies
        </span>
      </div>

      <div className="p-5 grid grid-cols-[auto_1fr] gap-5">
        {/* eNPS block */}
        <div className="rounded-xl bg-[#faf9f4] border border-border/50 p-4 min-w-[140px]">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
            ENPS
          </p>
          <p className="mt-2 font-serif text-[56px] leading-none font-normal text-foreground">
            +42
          </p>
          <p className="mt-2 text-[11px] font-medium text-emerald-700">
            ↗ +8 vs. Feb
          </p>
          <div className="mt-4 space-y-2 text-[11px]">
            {[
              { label: "Promoters",  pct: 58, color: "bg-emerald-500" },
              { label: "Passives",   pct: 26, color: "bg-amber-400" },
              { label: "Detractors", pct: 16, color: "bg-red-400" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-foreground">
                  <span>{row.label}</span>
                  <span className="tabular-nums font-medium">{row.pct}%</span>
                </div>
                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full", row.color)}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment trend + insight */}
        <div className="flex flex-col">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
            Sentiment · last 6 pulses
          </p>
          <div className="mt-2">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="w-full h-[90px]"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="pulseArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#pulseArea)" />
              <path
                d={path}
                fill="none"
                stroke="rgb(59 130 246)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((p, i) => {
                const [x, y] = p.split(",").map(Number);
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="white"
                    stroke="rgb(59 130 246)"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
            <div className="mt-1 grid grid-cols-6 text-[10px] text-muted-foreground">
              {months.map((m) => (
                <span key={m} className="text-center">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Insight */}
          <div className="mt-auto pt-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-3">
              <p className="text-[10px] font-semibold text-amber-900 uppercase tracking-[0.15em]">
                Insight · This week
              </p>
              <p className="mt-1 text-[12px] text-amber-900 leading-relaxed">
                <span className="font-semibold">Career growth clarity</span>{" "}
                dropped 0.6 points in Engineering (3.1/5). Worth addressing at
                the next all-hands.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify in browser**

1. `preview_eval` → reload.
2. `preview_click` "Pulse & eNPS".
3. `preview_snapshot` — confirm eyebrow, headline with italicised "the annual survey ritual.", lede, THREE numbered features (01/02/03 only — no 04), and the right card shows:
   - Header: "Pulse · March 2026" + "87% response · 128 replies" pill.
   - Left column inside card: big +42 eNPS number, promoters/passives/detractors rows with bars.
   - Right column inside card: sentiment sparkline (6 points, trending up), "Career growth clarity" amber insight box at the bottom.
4. `preview_screenshot` at 1280px.
5. `preview_console_logs` — no errors (watch for SVG warnings).

**Step 3: Commit**

```bash
git add src/components/landing/feature-tabs.tsx
git commit -m "feat(landing): flesh out Pulse & eNPS tab panel

Three-feature numbered list (not four — matches reference design).
Mockup card has eNPS +42 hero, promoter/passive/detractor bars, an
SVG sentiment sparkline, and an amber insight callout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Build CheckinsPanel

**Goal:** Replace the `CheckinsPanel` stub with the Recurring Check-ins tab content. Three numbered features. Right-side mockup is a Slack DM window — "DM · Sarah Chen" title bar, Nami bi-weekly check-in with 5 emoji buttons (🙂 active), Sarah's reply, Nami's "logged & anonymised" confirmation, then a "PRIVATE DM TO MIKE (MANAGER)" amber callout with the score-drop alert.

**Files:**
- Modify: `src/components/landing/feature-tabs.tsx`

**Reference markup:** Wellbeing section at `src/app/page.tsx:973-1145` — same content, new window-chrome framing.

**Step 1: Replace CheckinsPanel**

Remove the stub and add:

```tsx
function CheckinsPanel() {
  return (
    <TwoColPanel
      eyebrow="Recurring Check-ins"
      heading={
        <>
          Set it once.
          <br />
          <span className="font-serif italic font-normal text-foreground/80">
            Nami checks in forever.
          </span>
        </>
      }
      lede="Pick a group, pick a frequency. Every week (or two, or four), Nami runs a 30-second temperature check — and pings managers privately when sentiment drops."
      features={[
        {
          num: "01",
          title: "One emoji tap, optional comment",
          body: "That's the whole interaction. Response rates stay above 90% because it's effortless.",
        },
        {
          num: "02",
          title: "Runs on autopilot",
          body: "Weekly, bi-weekly, or monthly. Nami sends it, collects it, closes it. You never touch it again.",
        },
        {
          num: "03",
          title: "Early-warning alerts",
          body: "When a teammate's score drops across consecutive check-ins, their manager gets a private Slack DM — weeks before it becomes a resignation.",
        },
      ]}
      mockup={<CheckinsMockup />}
    />
  );
}

function CheckinsMockup() {
  const emojis = [
    { e: "😊", active: false },
    { e: "🙂", active: true },
    { e: "😐", active: false },
    { e: "😕", active: false },
    { e: "😞", active: false },
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-2xl shadow-primary/10">
      {/* Window chrome */}
      <div className="bg-muted/70 border-b border-border/60 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <p className="flex-1 text-center text-[11px] text-muted-foreground font-medium">
          DM · Sarah Chen
        </p>
      </div>

      <div className="p-5 space-y-5 bg-white">
        {/* Nami prompt */}
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">N</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">Nami</span>
              <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                APP
              </span>
              <span className="text-[11px] text-muted-foreground">
                Mon 9:00 AM
              </span>
            </div>
            <p className="text-[13px] text-foreground leading-relaxed">
              Quick bi-weekly check-in — how are you feeling about work right
              now?
            </p>
            <div className="mt-3 flex gap-2">
              {emojis.map((opt, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center text-lg border",
                    opt.active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-white"
                  )}
                >
                  {opt.e}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sarah reply */}
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-md bg-purple-400 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">
                Sarah Chen
              </span>
              <span className="text-[11px] text-muted-foreground">9:01 AM</span>
            </div>
            <p className="text-[13px] text-foreground italic leading-relaxed">
              Swamped with the migration, but team&apos;s been great about
              pairing.
            </p>
          </div>
        </div>

        {/* Nami confirmation */}
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">N</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">Nami</span>
              <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                APP
              </span>
              <span className="text-[11px] text-muted-foreground">9:01 AM</span>
            </div>
            <p className="text-[13px] text-foreground leading-relaxed">
              Thanks Sarah — logged &amp; anonymised. See you in two weeks ✦
            </p>
          </div>
        </div>

        {/* Private manager alert */}
        <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-3">
          <p className="text-[10px] font-semibold text-amber-900 uppercase tracking-[0.15em]">
            Private DM to Mike (Manager)
          </p>
          <p className="mt-1 text-[12px] text-amber-900 leading-relaxed">
            Sarah&apos;s check-in score dropped{" "}
            <span className="font-semibold">4.2 → 2.8</span> over 3 check-ins.
            Consider a gentle 1:1 check-in this week.
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify in browser**

1. `preview_eval` → reload.
2. `preview_click` "Check-ins".
3. `preview_snapshot` — confirm:
   - Left: eyebrow "RECURRING CHECK-INS", headline "Set it once. Nami checks in forever." (second line italicised), three numbered features.
   - Right: window chrome with "DM · Sarah Chen" title, Nami prompt with 5 emoji buttons (🙂 highlighted), Sarah's italic reply, Nami's logged message, amber callout "PRIVATE DM TO MIKE (MANAGER)" with the 4.2 → 2.8 alert.
4. Cycle through all four tabs with `preview_click` and confirm each swaps correctly.
5. `preview_screenshot` at 1280px.
6. `preview_console_logs` — no errors.

**Step 3: Commit**

```bash
git add src/components/landing/feature-tabs.tsx
git commit -m "feat(landing): flesh out Check-ins tab panel

Slack DM mockup with emoji response row, Sarah's reply, Nami's
anonymisation confirmation, and a private manager alert callout.
Matches reference design exactly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Delete four old spotlight sections + widen containers

**Goal:** With the new tabs section fully working, remove the four old feature-spotlight sections (Goals & Analytics, Reviews, Surveys & Pulse, Wellbeing) from `src/app/page.tsx`. Then widen remaining containers from `max-w-5xl`/`max-w-6xl` to `max-w-7xl` for a tighter desktop fit.

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Delete the four old sections**

Delete each section in turn (verify line numbers with `Read` before each Edit — line numbers shift as you delete). The sections to remove:

1. **Goals & Analytics** — starts at the `{/* ── Goals & Analytics — product showcase ── */}` comment (around line 340), ends at the closing `</section>` (around line 456).
2. **Feature Spotlight: Reviews** — starts at `{/* ── Feature Spotlight: Reviews ── */}` (around line 581), ends at its closing `</section>` (around line 789).
3. **Feature Spotlight: Surveys & Pulse** — starts at `{/* ── Feature Spotlight 3: Surveys & Pulse Checks ...*/}` (around line 790), ends at its closing `</section>` (around line 970).
4. **Feature Spotlight: Wellbeing** — starts at `{/* ── Feature Spotlight 4: Wellbeing & Engagement ── */}` (around line 972), ends at its closing `</section>` (around line 1145).

For each, use Read first to locate the exact opening comment and closing `</section>`, then Edit to replace the whole block with an empty string (i.e. delete it).

After deletion, `<FeatureTabs />` should sit directly between the stats bar and the Template Library section.

**Step 2: Prune unused imports in page.tsx**

Run Grep on `src/app/page.tsx` for each lucide-react icon imported at the top (line 2-7). Any icon that is no longer used anywhere in the file should be removed from the import statement. Likely candidates: `Target`, `TrendingUp`, `Flag`, `Grid3X3`, `Bell`, `Zap`, `Activity`, `Heart`, `ClipboardList`, `AlertTriangle`, `MessageSquare`, `Star`, `BarChart3`, `ChevronRight`. Keep whatever's still referenced (e.g. `Slack`, `Shield`, `Check`, `Bot`, `Users`, `Globe`, `Lock`, `Send`).

Verify with a final Grep over each remaining import name in the file — anything with only one match (the import itself) must be removed.

**Step 3: Widen containers**

In `src/app/page.tsx`, change these max-width classes (use `replace_all` where safe — each change is specific):

| Section | Current | New |
|---|---|---|
| Hero nav bar | `max-w-6xl mx-auto px-6` (line ~30) | `max-w-7xl mx-auto px-6 lg:px-10` |
| Hero grid wrapper | `max-w-6xl mx-auto px-4` (line ~53) | `max-w-7xl mx-auto px-4 lg:px-10` |
| Template Library | `max-w-5xl mx-auto px-6` (section at `id="templates"`) | `max-w-7xl mx-auto px-6 lg:px-10` |
| How It Works | `max-w-5xl mx-auto px-6` (section at `id="how-it-works"`) | `max-w-7xl mx-auto px-6 lg:px-10` |

Leave these at their current widths (narrower is better for these):
- Stats bar (`max-w-5xl`)
- Pricing (`max-w-5xl` or whatever is current)
- Security strip
- FAQ
- CTA
- Footer

**Step 4: Verify**

1. `preview_eval` → reload.
2. `preview_snapshot` the whole page — confirm:
   - Stats bar → FeatureTabs → Template Library is the new order.
   - No orphan remnants of the old sections.
   - Hero feels wider, Template Library/How-It-Works content uses more horizontal room on 1280px+.
3. `preview_click` through all four tabs once more — sanity check nothing regressed.
4. `preview_console_logs` — no errors or warnings about undefined icons.
5. `preview_screenshot` at 1280px and at 1440px to confirm the wider container looks right on big screens.
6. `preview_resize` to 400px; snapshot to confirm nothing breaks on mobile.
7. Build check: run `pnpm build` (or `npm run build`, whichever the project uses) to verify the production bundle compiles without TypeScript or ESLint errors. Expected: clean build.

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor(landing): remove old spotlight sections, widen to max-w-7xl

Four alternating feature sections (Goals & Analytics, Reviews,
Surveys & Pulse, Wellbeing) replaced by the new FeatureTabs
section. Hero, Template Library, and How It Works containers
widened from max-w-5xl/6xl to max-w-7xl so content fills more of
wide desktops. Unused lucide-react icon imports pruned.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Done — final smoke test

After Task 6:

1. `preview_screenshot` each tab at 1280px — hand these to the user for visual review.
2. `preview_resize` to mobile (400px) and screenshot each tab once.
3. Share screenshots + a short summary: "Tabs section live, four old sections removed, containers at max-w-7xl."

If the user spots something off in the visuals, iterate — this plan does not try to predict every design nit.
