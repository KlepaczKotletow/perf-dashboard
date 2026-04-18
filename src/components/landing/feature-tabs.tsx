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
    <section id="features" className="bg-[#faf9f6] border-y border-border/40 py-20 lg:py-28">
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
            <span className="italic font-normal text-foreground/80">
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
          <span className="italic font-normal text-foreground/80">
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
          <span className="italic font-normal text-foreground/80">
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
  return (
    <TwoColPanel
      eyebrow="Pulse & eNPS"
      heading={
        <>
          Sentiment without
          <br />
          <span className="italic font-normal text-foreground/80">
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
        <div className="rounded-xl bg-[#faf9f6] border border-border/50 p-4 min-w-[140px]">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
            ENPS
          </p>
          <p className="mt-2 text-[56px] leading-none font-bold tracking-tight text-foreground">
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
function CheckinsPanel() {
  return (
    <TwoColPanel
      eyebrow="Recurring Check-ins"
      heading={
        <>
          Set it once.
          <br />
          <span className="italic font-normal text-foreground/80">
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

