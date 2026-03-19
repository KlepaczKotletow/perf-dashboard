import { Button } from "@/components/ui/button";
import {
  Slack, Zap, Shield, BarChart3, MessageSquare, Users, Star,
  ArrowRight, Check, Target, TrendingUp, Flag, ChevronRight,
  Grid3X3, CalendarClock,
} from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

export default function Home() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zhfvxfvmdlpdfgxrwtdn.supabase.co").replace(/\/+$/, '');
  const slackClientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
  const slackRedirectUri = `${supabaseUrl}/functions/v1/slack-oauth`;
  const addToSlackUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=app_mentions:read,chat:write,commands,im:history,im:read,im:write,users:read,users:read.email&redirect_uri=${encodeURIComponent(slackRedirectUri)}`;
  const signInWithSlackUrl = `${supabaseUrl}/functions/v1/dashboard-auth`;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <header className="border-b border-border/60 backdrop-blur-md bg-white/80 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="font-semibold tracking-tight text-foreground">Perf</span>
          </Link>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#goals" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">Goals</a>
            <a href="#analytics" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">Analytics</a>
            <Link href="#pricing" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <a href={signInWithSlackUrl} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</a>
            <Button size="sm" asChild>
              <a href={addToSlackUrl}>
                <Slack className="h-3.5 w-3.5 mr-1" />
                Add to Slack
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#f8f7ff] via-[#faf5ff] to-[#fff8ff] px-6">
        <div className="absolute top-[-80px] right-[-100px] w-[500px] h-[500px] bg-gradient-to-br from-primary/10 to-secondary/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-60px] left-[-80px] w-[350px] h-[350px] bg-gradient-to-tr from-secondary/8 to-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 items-end">

            {/* Left: text */}
            <div className="py-20 lg:py-24">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/[0.07] text-xs text-primary/80 mb-8">
                <Slack className="h-3.5 w-3.5 text-primary" />
                Reviews · Goals · Analytics · All in Slack
              </div>

              <p className="text-sm font-medium text-primary tracking-wide mb-4">
                Performance management, done right
              </p>

              <h1 className="text-5xl sm:text-[60px] lg:text-[64px] font-bold tracking-tight text-foreground leading-[1.05]">
                The performance platform your team will{" "}
                <span className="text-primary">actually use</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-[440px]">
                Perf brings 360° reviews, goal tracking, and competency analytics into one place —
                delivered through Slack so your team actually engages. No new logins. No forms nobody opens.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-3 mt-10">
                <Button size="lg" className="h-12 px-7 text-sm font-semibold" asChild>
                  <a href={addToSlackUrl}>
                    <Slack className="h-4 w-4 mr-2" />
                    Add to Slack — free
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12 px-7 text-sm text-foreground/65 hover:text-foreground hover:bg-foreground/[0.06] border border-foreground/15"
                  asChild
                >
                  <a href={signInWithSlackUrl}>Sign in with Slack</a>
                </Button>
              </div>

              <p className="mt-8 text-xs text-muted-foreground/60 tracking-wide">
                Free for up to 10 people · No credit card · Installs in 60 seconds
              </p>
            </div>

            {/* Right: Analytics dashboard mockup — desktop only */}
            <div className="hidden lg:block relative pt-10">
              <div className="absolute -inset-6 bg-primary/[0.10] blur-3xl rounded-full -z-10 pointer-events-none" />

              <div className="rounded-t-2xl border border-border/60 border-b-0 overflow-hidden shadow-2xl shadow-primary/10">
                {/* Browser chrome */}
                <div className="bg-muted/80 border-b border-border/60 px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-foreground/20" />
                    <div className="h-3 w-3 rounded-full bg-foreground/15" />
                    <div className="h-3 w-3 rounded-full bg-foreground/15" />
                  </div>
                  <div className="flex-1 bg-background/70 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
                    app.perf.team/dashboard/analytics
                  </div>
                </div>

                <div className="bg-white">
                  <div className="flex h-[340px] sm:h-[380px] overflow-hidden">
                    {/* Sidebar */}
                    <div className="hidden sm:flex w-44 border-r border-border/60 flex-col bg-muted/20 p-3 gap-0.5 shrink-0">
                      <div className="px-2 py-1.5 mb-1">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
                            <span className="text-white text-[9px] font-bold">P</span>
                          </div>
                          <span className="text-xs font-semibold text-foreground">Perf</span>
                        </div>
                      </div>
                      {[
                        { label: "Overview", active: false },
                        { label: "Cycles", active: false },
                        { label: "Goals", active: false },
                        { label: "Team", active: false },
                        { label: "Analytics", active: true },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`px-2.5 py-1.5 rounded-md text-[12px] ${
                            item.active
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>

                    {/* Analytics content */}
                    <div className="flex-1 p-5 overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-foreground">Analytics</p>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-[10px] text-muted-foreground">
                          Q1 2025
                        </div>
                      </div>

                      {/* KPI tiles */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {[
                          { label: "Overall Rating", value: "4.2/5", color: "text-yellow-500" },
                          { label: "Completion", value: "91%", color: "text-emerald-600" },
                          { label: "Participants", value: "47", color: "text-primary" },
                          { label: "Active Cycles", value: "2", color: "text-orange-500" },
                        ].map((tile) => (
                          <div key={tile.label} className="bg-muted/30 rounded-xl p-2.5 border border-border/40">
                            <p className="text-[10px] text-muted-foreground mb-1">{tile.label}</p>
                            <p className={`text-base font-bold ${tile.color}`}>{tile.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Competency bar chart */}
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Avg. by Competency</p>
                      <div className="space-y-2">
                        {[
                          { name: "Leadership", score: 4.3, pct: 86 },
                          { name: "Execution", score: 3.9, pct: 78 },
                          { name: "Collaboration", score: 4.4, pct: 88 },
                          { name: "Communication", score: 3.7, pct: 74 },
                        ].map((c) => (
                          <div key={c.name} className="flex items-center gap-2">
                            <p className="text-[10px] text-muted-foreground w-[90px] shrink-0 truncate">{c.name}</p>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${c.pct}%` }} />
                            </div>
                            <span className="text-[10px] font-semibold text-foreground w-5 text-right tabular-nums">{c.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Problem section — why reviews are broken */}
      <section className="bg-background py-24">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Performance reviews are broken
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto text-[15px]">
              Most teams know reviews matter. But the tools make them painful enough that people just... don&apos;t do them.
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Flag,
                problem: "Low completion",
                detail: "Reviews live in tools nobody opens. Completion rates hover around 40% — and the responses you do get are rushed.",
              },
              {
                icon: CalendarClock,
                problem: "Weeks of busywork",
                detail: "Managers chase responses in DMs, build spreadsheets by hand, and spend hours in calibration meetings with stale data.",
              },
              {
                icon: Target,
                problem: "No context",
                detail: "By the time the review cycle starts, the actual work is months old. Feedback is generic because nobody remembers the details.",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.problem} delay={i * 80}>
                <div className="p-6 rounded-2xl border border-border bg-card">
                  <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-destructive" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{item.problem}</h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{item.detail}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal className="text-center mt-14">
            <p className="text-lg font-semibold text-foreground">
              Perf fixes this by meeting your team where they already work — <span className="text-primary">Slack</span>.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Slack mockup — light lavender section */}
      <section className="bg-gradient-to-br from-[#f5f2ff] via-[#f8f5ff] to-[#f3f1ff] py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5">
              Works inside Slack
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Reviews happen in DMs, not another app
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto text-[15px]">
              Perf sends review requests as Slack DMs. Your team responds right there — no new logins, no new tabs, no friction.
            </p>
          </ScrollReveal>

          <ScrollReveal className="max-w-2xl mx-auto">
            {/* Slack-style mockup */}
            <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-2xl shadow-primary/10">
              {/* Slack header bar */}
              <div className="bg-[#3d1f7d] px-5 py-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">P</span>
                  </div>
                  <span className="text-white text-sm font-semibold">Perf</span>
                </div>
                <span className="text-white/40 text-xs">app</span>
              </div>

              {/* Conversation area */}
              <div className="p-5 space-y-5 bg-white">
                {/* Bot message — review request */}
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">P</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">Perf</span>
                      <span className="text-[11px] text-muted-foreground">10:32 AM</span>
                    </div>
                    <div className="bg-muted/50 rounded-xl rounded-tl-sm p-4 border border-border/60">
                      <p className="text-sm text-foreground leading-relaxed">
                        Hey Sarah! You have a peer review for <span className="font-semibold">Alex Johnson</span> as part of the <span className="font-semibold">Q1 Performance Review</span> cycle.
                      </p>
                      <div className="mt-3 p-3 rounded-lg bg-background border border-border/60">
                        <p className="text-xs text-muted-foreground mb-1">Competency: <span className="font-medium text-foreground">Collaboration</span></p>
                        <p className="text-xs text-muted-foreground">Rating: 1 (Needs improvement) → 5 (Exceptional)</p>
                      </div>
                      <p className="text-sm text-foreground mt-3 leading-relaxed">
                        Reply with a rating (1-5) and a brief comment, or click below to open the full review form.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <div className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium">
                          Open review form
                        </div>
                        <div className="px-3 py-1.5 rounded-md bg-muted border border-border text-foreground text-xs font-medium">
                          Remind me later
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User reply */}
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-full bg-chart-2/20 flex items-center justify-center shrink-0">
                    <span className="text-chart-2 text-xs font-bold">S</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">Sarah Chen</span>
                      <span className="text-[11px] text-muted-foreground">10:34 AM</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      4 — Alex has been great at cross-team coordination this quarter, especially on the platform migration. He proactively looped in the right stakeholders.
                    </p>
                  </div>
                </div>

                {/* Bot confirmation */}
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">P</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">Perf</span>
                      <span className="text-[11px] text-muted-foreground">10:34 AM</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      Got it! Collaboration rated <span className="font-semibold text-primary">4/5</span> for Alex Johnson. You have <span className="font-semibold">2 more competencies</span> to rate. Want to continue?
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center mt-6 text-sm text-muted-foreground/70">
              Reviews take less than 2 minutes per person — right inside Slack.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* How it Works — light */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-28">
        <ScrollReveal className="text-center mb-14">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5">
            How it works
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Up and running in minutes</h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto text-[15px]">
            No lengthy onboarding. No training required. Just add Perf to Slack and you&apos;re set.
          </p>
        </ScrollReveal>

        <div className="relative">
          {/* Connector line through icon centers */}
          <div className="hidden lg:block absolute top-[27px] left-[calc(16.66%+34px)] right-[calc(16.66%+34px)] h-px bg-border" aria-hidden="true" />

          <ol className="grid sm:grid-cols-3 gap-8 lg:gap-12 relative">
            {[
              {
                step: 1,
                icon: Slack,
                title: "Add Perf to Slack",
                description: "Click 'Add to Slack' and authorize Perf in your workspace. Takes under 60 seconds.",
              },
              {
                step: 2,
                icon: Users,
                title: "Set up your team",
                description: "Perf syncs your Slack members automatically. Assign managers and define reporting lines.",
              },
              {
                step: 3,
                icon: BarChart3,
                title: "Launch your first cycle",
                description: "Pick a template, set a deadline, and Perf handles assignments, reminders, and collection.",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 120}>
                <li className="flex flex-col items-center text-center sm:items-start sm:text-left">
                  <div className="relative mb-5">
                    <div className="h-14 w-14 rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[15px] text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>
                </li>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Dashboard Mockup — mobile only */}
      <section className="max-w-5xl mx-auto px-6 pb-24 lg:hidden">
        <ScrollReveal className="text-center mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5">
            The dashboard
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Everything in one place</h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto text-[15px]">
            Track cycles, calibrate scores, and explore team performance — all from a clean, focused interface.
          </p>
        </ScrollReveal>

        <ScrollReveal scale className="relative">
          <div className="absolute inset-x-12 top-8 bottom-0 bg-primary/[0.10] blur-3xl rounded-full -z-10 pointer-events-none" />

          <div className="rounded-2xl border border-border/70 overflow-hidden shadow-xl shadow-black/[0.06] bg-card">
            <div className="bg-muted/60 border-b border-border px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400/70" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
                <div className="h-3 w-3 rounded-full bg-green-400/70" />
              </div>
              <div className="flex-1 bg-background/70 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
                app.perf.team/dashboard/cycles
              </div>
            </div>

            <div className="flex h-[340px] sm:h-[400px] overflow-hidden">
              <div className="hidden sm:flex w-44 border-r border-border/60 flex-col bg-muted/20 p-3 gap-0.5 shrink-0">
                <div className="px-2 py-1.5 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
                      <span className="text-white text-[9px] font-bold">P</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">Perf</span>
                  </div>
                </div>
                {[
                  { label: "Overview", active: false },
                  { label: "Cycles", active: true },
                  { label: "My Reviews", active: false },
                  { label: "Goals", active: false },
                  { label: "Team", active: false },
                  { label: "Analytics", active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`px-2.5 py-1.5 rounded-md text-[12px] ${
                      item.active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>

              <div className="flex-1 p-5 sm:p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Active cycle</p>
                    <h3 className="text-sm font-semibold text-foreground mt-0.5">Q1 2025 Performance Review</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Completion</p>
                    <p className="text-lg font-bold text-primary">73%</p>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full mb-6 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "73%" }} />
                </div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-3">Avg. competency scores</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Leadership", score: 4.2, pct: 84, color: "bg-primary" },
                    { label: "Execution", score: 3.8, pct: 76, color: "bg-chart-2" },
                    { label: "Collaboration", score: 4.5, pct: 90, color: "bg-chart-3" },
                  ].map((c) => (
                    <div key={c.label} className="bg-muted/40 rounded-xl p-3">
                      <p className="text-[11px] text-muted-foreground mb-1">{c.label}</p>
                      <p className="text-base font-bold text-foreground">{c.score}</p>
                      <div className="h-1 bg-border rounded-full mt-2 overflow-hidden">
                        <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2 mt-5">Recent assignments</p>
                <div className="space-y-1.5">
                  {[
                    { name: "Alex Johnson", status: "Submitted", dot: "bg-green-500" },
                    { name: "Maria Garcia", status: "In progress", dot: "bg-yellow-500" },
                    { name: "Chris Lee", status: "Pending", dot: "bg-border" },
                  ].map((r) => (
                    <div key={r.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                          {r.name[0]}
                        </div>
                        <span className="text-[12px] text-foreground">{r.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />
                        <span className="text-[11px] text-muted-foreground">{r.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Features — light with white cards */}
      <section id="features" className="bg-white py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="mb-12">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5">
              Everything you need
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Built for how teams actually work
            </h2>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden mb-px">
            {[
              {
                icon: MessageSquare,
                title: "Anytime feedback",
                description: "Give praise or constructive feedback with /feedback — no forms, no friction.",
              },
              {
                icon: Star,
                title: "360 reviews",
                description: "Structured multi-rater reviews with competency ratings, built-in calibration, and deadlines.",
              },
            ].map((f) => (
              <ScrollReveal key={f.title}>
                <div className="bg-background p-10">
                  <f.icon className="h-6 w-6 text-primary mb-6" />
                  <h3 className="text-2xl font-bold text-foreground mb-3">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-b-2xl overflow-hidden">
            {[
              {
                icon: Users,
                title: "Performance cycles",
                description: "Launch org-wide review cycles with automated assignments based on reporting lines.",
              },
              {
                icon: BarChart3,
                title: "Live analytics",
                description: "Rating distributions, department benchmarks, 9-box grids, and trend analysis in real time.",
              },
              {
                icon: Shield,
                title: "Enterprise security",
                description: "Row-level isolation, cross-tenant validation triggers, and signed Slack payloads.",
              },
              {
                icon: Zap,
                title: "Zero context-switching",
                description: "Start reviews in Slack, finish on the web. Or do everything in Slack — your choice.",
              },
            ].map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 60}>
                <div className="bg-background p-7">
                  <f.icon className="h-5 w-5 text-primary/70 mb-4" />
                  <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — soft lavender */}
      <section className="bg-background py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5">
              What teams say
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Teams that switched don&apos;t go back
            </h2>
          </ScrollReveal>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                quote: "We went from 40% review completion to nearly 100% in one cycle. The Slack integration removes every excuse not to respond.",
                name: "Sarah Chen",
                role: "Engineering Manager",
                company: "Forma",
                initial: "S",
              },
              {
                quote: "Finally a tool that doesn't make HR feel like HR. Our team actually appreciates getting feedback — and giving it.",
                name: "Marcus Webb",
                role: "Head of People",
                company: "Archetype Labs",
                initial: "M",
              },
              {
                quote: "The 9-box calibration grid alone saved us hours of spreadsheet wrangling. Setup took an afternoon.",
                name: "Priya Nair",
                role: "VP of Engineering",
                company: "Meridian",
                initial: "P",
              },
            ].map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 100}>
                <figure className="flex flex-col h-full p-7 rounded-2xl border border-border bg-white shadow-sm shadow-primary/5">
                  <blockquote className="flex-1">
                    <span className="block text-5xl font-serif leading-none text-primary mb-5 select-none">&ldquo;</span>
                    <p className="text-[15px] leading-relaxed text-muted-foreground">{t.quote}</p>
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 pt-5 border-t border-border">
                    <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {t.initial}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role} · {t.company}</p>
                    </div>
                  </figcaption>
                </figure>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip — vibrant purple gradient */}
      <section className="bg-gradient-to-r from-primary via-[#8b35d6] to-secondary py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-10 text-center">
            {[
              { metric: "95%+", label: "Average review completion rate with Perf" },
              { metric: "< 2 min", label: "Time to complete a peer review via Slack" },
              { metric: "1 day", label: "From install to first live review cycle" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl font-black text-white">{stat.metric}</p>
                <p className="mt-2 text-sm text-white/75 max-w-[200px] mx-auto">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — light, with CTA buttons */}
      <section id="pricing" className="bg-background border-t border-border/30">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5">
              Pricing
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Simple, transparent pricing</h2>
            <p className="mt-3 text-muted-foreground text-[15px]">Start free. Upgrade when your team is ready.</p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Free tier */}
            <ScrollReveal delay={0}>
              <div className="flex flex-col h-full p-7 rounded-2xl border-2 border-border bg-white">
                <p className="text-sm font-semibold text-foreground mb-1">Free</p>
                <p className="text-4xl font-black text-foreground mb-1">$0</p>
                <p className="text-[12px] text-muted-foreground mb-5">Forever, no credit card</p>
                <ul className="space-y-2.5 flex-1">
                  {[
                    "Up to 10 team members",
                    "Slack /feedback command",
                    "Basic analytics",
                    "1 active review cycle",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="mt-6 w-full" asChild>
                  <a href={addToSlackUrl}>
                    <Slack className="h-4 w-4 mr-2" />
                    Get started free
                  </a>
                </Button>
              </div>
            </ScrollReveal>

            {/* Pro tier */}
            <ScrollReveal delay={100}>
              <div className="flex flex-col h-full p-7 rounded-2xl border-2 border-primary bg-white shadow-xl shadow-primary/[0.15] relative">
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-primary text-white text-[10px] font-semibold uppercase tracking-wider">
                  Popular
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Pro</p>
                <p className="text-4xl font-black text-foreground mb-1">$8<span className="text-base font-normal text-muted-foreground">/user/mo</span></p>
                <p className="text-[12px] text-muted-foreground mb-5">Billed monthly or annually</p>
                <ul className="space-y-2.5 flex-1">
                  {[
                    "Unlimited team members",
                    "360° review cycles",
                    "Competency frameworks",
                    "9-box calibration grid",
                    "Advanced analytics",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" asChild>
                  <a href={addToSlackUrl}>
                    <Slack className="h-4 w-4 mr-2" />
                    Start with Pro
                  </a>
                </Button>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA — light gradient, friendly */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#f8f5ff] via-background to-[#f5f7ff] py-28">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <ScrollReveal>
            <h2 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight max-w-2xl mx-auto leading-[1.1]">
              Ready to make reviews{" "}
              <span className="text-primary">actually happen?</span>
            </h2>
            <p className="mt-5 text-muted-foreground text-lg max-w-md mx-auto">
              Add Perf to your Slack workspace in under a minute. Free forever.
            </p>
            <div className="mt-10">
              <Button size="lg" className="h-13 px-8 text-base font-semibold" asChild>
                <a href={addToSlackUrl}>
                  <Slack className="h-5 w-5 mr-2" />
                  Add to Slack — it&apos;s free
                </a>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground/60">No credit card. No setup fee. Cancel anytime.</p>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer — light */}
      <footer className="bg-muted/40 border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">P</span>
              </div>
              <span className="font-semibold text-foreground">Perf</span>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-muted-foreground/60 hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-muted-foreground/60 hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/support" className="text-muted-foreground/60 hover:text-foreground transition-colors">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
