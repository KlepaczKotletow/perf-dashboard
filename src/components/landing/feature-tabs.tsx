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
    <section className="bg-[#faf9f6] border-y border-border/40 py-20 lg:py-28">
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

        {/* Panels — all four rendered, inactive ones hidden for stable aria-controls targets */}
        <div className="pt-14">
          <div
            role="tabpanel"
            id="panel-reviews"
            aria-labelledby="tab-reviews"
            hidden={active !== "reviews"}
          >
            <ReviewsPanel />
          </div>
          <div
            role="tabpanel"
            id="panel-goals"
            aria-labelledby="tab-goals"
            hidden={active !== "goals"}
          >
            <GoalsPanel />
          </div>
          <div
            role="tabpanel"
            id="panel-pulse"
            aria-labelledby="tab-pulse"
            hidden={active !== "pulse"}
          >
            <PulsePanel />
          </div>
          <div
            role="tabpanel"
            id="panel-checkins"
            aria-labelledby="tab-checkins"
            hidden={active !== "checkins"}
          >
            <CheckinsPanel />
          </div>
        </div>
      </div>
    </section>
  );
}

// ───── Panel stubs (filled in later tasks) ─────

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

        <ul className="mt-10 space-y-7 list-none">
          {features.map((f) => (
            <li key={f.num} className="grid grid-cols-[36px_1fr] gap-x-5">
              <span className="font-mono text-xs text-muted-foreground/60 pt-0.5">
                {f.num}
              </span>
              <div>
                <p className="text-[15px] font-semibold text-foreground">
                  {f.title}
                </p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: mockup — decorative reproduction of product UI */}
      <div className="relative" aria-hidden="true">{mockup}</div>
    </div>
  );
}

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
