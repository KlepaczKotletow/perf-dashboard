import {
  BarChart3, MessageSquare, Target, Activity, LayoutGrid, Layers,
  Bell, Upload, ClipboardList, Check,
} from "lucide-react";
import { GlowCard } from "@/components/marketing/glow-card";
import { Kicker } from "@/components/marketing/kicker";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { cn } from "@/lib/utils";

// The feature showcase — an Aceternity-style bento where every card carries a
// real Nami mini-UI (not just an icon + text), so the section shows the product
// instead of describing it. Replaces the old empty bento + the redundant tabs.

function CardHead({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{children}</p>
    </>
  );
}

export function FeatureBento() {
  return (
    <section className="border-b border-border/40 bg-muted/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <ScrollReveal className="mb-12 max-w-2xl">
          <Kicker className="mb-5">One assistant, every surface</Kicker>
          <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-4xl lg:text-[44px]">
            Everything performance, run from{" "}
            <span className="font-serif-accent text-primary">one Slack DM.</span>
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
            Reviews, goals, pulse, calibration, and analytics are separate products in most
            tools. In Nami they&apos;re the same conversation — at the same $5.
          </p>
        </ScrollReveal>

        <ScrollReveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[minmax(14rem,auto)]">

            {/* ── Analytics — big anchor tile ── */}
            <GlowCard className="flex flex-col p-6 sm:p-7 md:col-span-2 lg:col-span-2 lg:row-span-2">
              <CardHead icon={BarChart3} title="Analytics that read like answers">
                Rankings, competency heatmaps, completion by team, and eNPS trend — so decisions
                about people rest on more than who spoke loudest in one meeting.
              </CardHead>

              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { v: "4.2/5", k: "Overall" },
                  { v: "91%", k: "Completion" },
                  { v: "312", k: "Ratings" },
                  { v: "+42", k: "eNPS" },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2.5">
                    <p className="text-lg font-bold tabular-nums text-foreground">{s.v}</p>
                    <p className="text-[11px] text-muted-foreground">{s.k}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex-1 rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Competency ratings
                </p>
                <div className="space-y-2.5">
                  {[
                    { name: "Collaboration", score: 4.4 },
                    { name: "Leadership", score: 4.3 },
                    { name: "Execution", score: 3.9 },
                    { name: "Communication", score: 3.7 },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <p className="w-28 shrink-0 truncate text-[12px] text-muted-foreground">{c.name}</p>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(c.score / 5) * 100}%` }} />
                      </div>
                      <span className="w-7 shrink-0 text-right text-[12px] font-semibold tabular-nums text-foreground">{c.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlowCard>

            {/* ── 360° reviews — tall tile with a Slack rating widget ── */}
            <GlowCard className="flex flex-col p-6 lg:row-span-2">
              <CardHead icon={MessageSquare} title="360° reviews">
                Competencies, level descriptors, and comments — all inside one Slack modal.
                Reviewers never see a browser. ~95% completion.
              </CardHead>

              <div className="mt-auto rounded-xl border border-border/60 bg-background/70 p-3.5">
                <p className="mb-2.5 text-[11px] font-medium text-foreground">
                  Rate at L4 (Senior) — expected 4/5
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { n: 2, label: "Below" },
                    { n: 3, label: "Meets" },
                    { n: 4, label: "Exceeds", on: true },
                    { n: 5, label: "Excep." },
                  ].map((o) => (
                    <div
                      key={o.n}
                      className={cn(
                        "rounded-lg border px-1 py-2 text-center",
                        o.on ? "border-primary bg-primary/10" : "border-border bg-card",
                      )}
                    >
                      <p className={cn("text-base font-bold", o.on ? "text-primary" : "text-foreground")}>{o.n}</p>
                      <p className="text-[9px] text-muted-foreground">{o.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">4</span> — Defines multi-quarter
                  strategy backed by market analysis.
                </p>
              </div>
            </GlowCard>

            {/* ── Goals & OKRs — progress rows ── */}
            <GlowCard className="flex flex-col p-6">
              <CardHead icon={Target} title="Goals & OKRs">
                Quarterly objectives with weekly 30-second check-ins.
              </CardHead>
              <div className="mt-auto space-y-2.5">
                {[
                  { t: "Ship onboarding flow", pct: 72, chip: "ON TRACK", chipCls: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
                  { t: "Hire 2 senior engineers", pct: 25, chip: "AT RISK", chipCls: "bg-amber-100 text-amber-800", bar: "bg-amber-400" },
                  { t: "Launch design-system v2", pct: 100, chip: "DONE", chipCls: "bg-primary/15 text-primary", bar: "bg-primary" },
                ].map((g) => (
                  <div key={g.t}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] text-foreground">{g.t}</span>
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide", g.chipCls)}>{g.chip}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", g.bar)} style={{ width: `${g.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </GlowCard>

            {/* ── Pulse & eNPS — score + sparkline ── */}
            <GlowCard className="flex flex-col p-6">
              <CardHead icon={Activity} title="Pulse & eNPS">
                Anonymous one-tap surveys — the one insight worth acting on this week.
              </CardHead>
              <div className="mt-auto flex items-end justify-between gap-3">
                <div>
                  <p className="text-4xl font-bold leading-none tracking-tight text-foreground">+42</p>
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-600">↗ +8 vs. Feb</p>
                </div>
                <svg viewBox="0 0 120 44" className="h-12 w-28" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <linearGradient id="bentoPulse" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,34 L24,30 L48,32 L72,20 L96,22 L120,8 L120,44 L0,44 Z" fill="url(#bentoPulse)" />
                  <path d="M0,34 L24,30 L48,32 L72,20 L96,22 L120,8" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </GlowCard>

            {/* ── 9-box calibration — mini grid ── */}
            <GlowCard className="flex flex-col p-6">
              <CardHead icon={LayoutGrid} title="9-box calibration">
                HR aligns grades on a drag-and-drop grid before release.
              </CardHead>
              <div className="mt-5 grid w-32 grid-cols-3 gap-1.5">
                {[
                  "bg-muted", "bg-emerald-100", "bg-emerald-200",
                  "bg-muted", "bg-amber-100", "bg-emerald-100",
                  "bg-red-100", "bg-muted", "bg-amber-100",
                ].map((c, i) => (
                  <div
                    key={i}
                    className={cn(
                      "aspect-square rounded-md border border-border/50",
                      c,
                      i === 2 && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                    )}
                  />
                ))}
              </div>
            </GlowCard>

            {/* ── Career frameworks — wide tile with a ladder row ── */}
            <GlowCard className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-8 md:col-span-2 lg:col-span-3">
              <div className="sm:max-w-xs">
                <CardHead icon={Layers} title="8 career frameworks">
                  Fully editable ladders with a written descriptor in every cell, so reviews
                  aren&apos;t guesswork. Import one-click, customise anything.
                </CardHead>
              </div>
              <div className="flex-1 overflow-hidden rounded-xl border border-border/60 bg-background/70 p-4">
                <div className="mb-3 grid grid-cols-[1fr_repeat(5,minmax(0,2.5rem))] items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">Coding &amp; Quality</span>
                  {["Jr", "Mid", "Sr", "Staff", "Prin"].map((l) => (
                    <span key={l} className="text-center text-[10px] text-muted-foreground">{l}</span>
                  ))}
                </div>
                <div className="grid grid-cols-[1fr_repeat(5,minmax(0,2.5rem))] items-center gap-2">
                  <span className="truncate text-[12px] text-foreground">System design</span>
                  {[
                    { n: 2, c: "bg-orange-100 text-orange-700 border-orange-200" },
                    { n: 2, c: "bg-orange-100 text-orange-700 border-orange-200" },
                    { n: 3, c: "bg-yellow-100 text-yellow-700 border-yellow-200" },
                    { n: 4, c: "bg-green-100 text-green-700 border-green-200" },
                    { n: 5, c: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                  ].map((s, i) => (
                    <span key={i} className={cn("mx-auto grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold", s.c)}>{s.n}</span>
                  ))}
                </div>
              </div>
            </GlowCard>
          </div>
        </ScrollReveal>

        {/* ── Secondary features — clean icon row (Aceternity bottom row) ── */}
        <ScrollReveal className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Bell, title: "Smart Slack reminders", body: "Nami nudges the right person at the right time — and chases stragglers so you don't have to." },
            { icon: Upload, title: "CSV team import", body: "Bring your whole org in minutes, or auto-sync names, photos, and emails straight from Slack." },
            { icon: ClipboardList, title: "Audit log", body: "Every sensitive change on the record — who, what, when. Exportable anytime." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="text-[15px] font-semibold text-foreground">{f.title}</h3>
              </div>
              <p className="text-[13.5px] leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </ScrollReveal>

        {/* tiny honest footnote echoing the "everything included" promise */}
        <ScrollReveal className="mt-6 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <Check className="h-4 w-4 text-primary" />
          Every surface above is included in the one $5/user plan — and free for teams of 10 or fewer.
        </ScrollReveal>
      </div>
    </section>
  );
}
