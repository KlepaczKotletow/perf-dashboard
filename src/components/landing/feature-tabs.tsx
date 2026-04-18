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
