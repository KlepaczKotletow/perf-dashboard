import { Button } from "@/components/ui/button";
import {
  Slack, Shield, BarChart3, MessageSquare, Users, Star,
  Check, Target, TrendingUp, Flag, ChevronRight,
  Grid3X3, Bot, Bell, Zap, Send,
} from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { MobileNav } from "@/components/landing/mobile-nav";

export default function Home() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, '');
  const slackClientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
  const slackRedirectUri = `${supabaseUrl}/functions/v1/slack-oauth`;
  // CSRF: include a nonce state parameter (Slack requires this for App Directory)
  const oauthState = `nonce_${crypto.randomUUID()}`;
  const addToSlackUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=app_mentions:read,chat:write,commands,im:history,im:read,im:write,users:read,users:read.email&user_scope=identity.basic,identity.email&redirect_uri=${encodeURIComponent(slackRedirectUri)}&state=${oauthState}`;
  const signInWithSlackUrl = `${supabaseUrl}/functions/v1/dashboard-auth`;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ── Header ── */}
      <header className="border-b border-border/60 backdrop-blur-md bg-white/80 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="font-semibold tracking-tight text-foreground">Nami</span>
          </Link>
          <div className="hidden lg:flex items-center gap-3">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#goals" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Goals</a>
            <a href="#analytics" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Analytics</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href={signInWithSlackUrl} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</a>
            <Button size="sm" asChild>
              <a href={addToSlackUrl}>
                <Slack className="h-3.5 w-3.5 mr-1" />
                Add to Slack
              </a>
            </Button>
          </div>
          <MobileNav signInUrl={signInWithSlackUrl} addToSlackUrl={addToSlackUrl} />
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#fafaf5] via-[#f8f6f0] to-[#fefcf5] px-6">
        <div className="absolute top-[-80px] right-[-100px] w-[500px] h-[500px] bg-gradient-to-br from-primary/10 to-secondary/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-60px] left-[-80px] w-[350px] h-[350px] bg-gradient-to-tr from-secondary/8 to-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 items-end">

            {/* Left: text */}
            <div className="py-14 lg:py-18">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/[0.07] text-xs text-primary/80 mb-5">
                <Bot className="h-3.5 w-3.5 text-primary" />
                Meet Nami — your performance assistant in Slack
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight text-foreground leading-[1.08]">
                Performance reviews your team will{" "}
                <span className="text-primary">actually complete</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-[440px]">
                Nami lives in your team&apos;s Slack and handles everything — 360° reviews, goal tracking, surveys, and analytics. Your team just talks to Nami. No new tools. No forms.
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
                          <span className="text-xs font-semibold text-foreground">Nami</span>
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

      {/* ── Research-backed stats bar ── */}
      <section className="bg-white border-y border-border/40 py-14 lg:py-16">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-10">
            Why performance management matters — backed by research
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {[
              { stat: "23%", label: "higher profitability", detail: "at companies with engaged employees", source: "Gallup, 2024" },
              { stat: "4.2×", label: "more likely to outperform", detail: "competitors with robust performance management", source: "McKinsey" },
              { stat: "$438B", label: "lost to disengagement", detail: "in global productivity annually", source: "Gallup, 2024" },
              { stat: "51%", label: "lower turnover", detail: "at organisations with high employee engagement", source: "Gallup, 2024" },
            ].map((item) => (
              <div key={item.stat} className="text-center space-y-1.5">
                <p className="text-3xl lg:text-4xl font-bold tracking-tight text-primary">{item.stat}</p>
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
                <p className="text-[10px] text-muted-foreground/60 italic">{item.source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Spotlight 1: Reviews ── */}
      <section id="features" className="bg-white py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: copy */}
            <ScrollReveal>
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                  360° Reviews
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
                  Reviews that actually get completed — because they live in Slack
                </h2>
                <p className="mt-4 text-muted-foreground text-[15px] leading-relaxed">
                  Most teams struggle with 40–60% review completion. Nami fixes this by meeting people where they already work.
                </p>

                <ul className="mt-8 space-y-5">
                  {[
                    {
                      icon: MessageSquare,
                      title: "Slack DMs, not another form",
                      body: "Nami sends review requests as Slack DMs. Your team responds in the thread — no new tab, no new login, no context switch. Completion rates climb from ~40% to 95%+.",
                    },
                    {
                      icon: Users,
                      title: "Every angle covered: self, manager, peer, upward",
                      body: "One cycle covers all reviewer types. Nami auto-assigns based on reporting lines, sends reminders, and tracks who's outstanding — without you chasing anyone.",
                    },
                    {
                      icon: Star,
                      title: "Calibration built in, not bolted on",
                      body: "After collection, HR uses the 9-box calibration grid to align grades across managers before releasing results. No more calibration spreadsheets.",
                    },
                    {
                      icon: Shield,
                      title: "Grade-gated results",
                      body: "Employees only see their results after HR releases grades. You control the timing — not Slack, not the reviewer.",
                    },
                  ].map((item) => (
                    <li key={item.title} className="flex gap-4">
                      <div className="h-9 w-9 rounded-xl bg-primary/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            {/* Right: Slack DM mockup */}
            <ScrollReveal scale>
              <div className="relative">
                <div className="absolute -inset-6 bg-primary/[0.07] blur-3xl rounded-full -z-10 pointer-events-none" />
                <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-2xl shadow-primary/10">
                  {/* Slack header */}
                  <div className="bg-[#1e1b4b] px-5 py-3 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">N</span>
                      </div>
                      <span className="text-white text-sm font-semibold">Nami</span>
                    </div>
                    <span className="text-white/40 text-xs">app</span>
                  </div>

                  {/* Conversation */}
                  <div className="p-5 space-y-5 bg-white">
                    {/* Nami → competency review with score descriptors */}
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Nami</span>
                          <span className="text-[11px] text-muted-foreground">10:32 AM</span>
                        </div>
                        <div className="bg-muted/50 rounded-xl rounded-tl-sm p-4 border border-border/60 space-y-3">
                          <p className="text-[13px] font-semibold text-foreground">
                            2/6: Product Strategy
                          </p>
                          <p className="text-[11px] text-muted-foreground italic">
                            Defining product vision, roadmap, and competitive positioning
                          </p>
                          {/* Score descriptors */}
                          <div className="space-y-1.5 text-[11px] text-muted-foreground border-l-2 border-border/60 pl-3">
                            <p><span className="font-bold text-orange-600">2</span> — Contributes to roadmap discussions with feature-level ideas</p>
                            <p><span className="font-bold text-yellow-600">3</span> — Owns a product area&apos;s roadmap, prioritizing by impact</p>
                            <p><span className="font-bold text-green-600">4</span> — Defines multi-quarter strategy backed by market analysis</p>
                            <p><span className="font-bold text-emerald-600">5</span> — Sets company-wide product vision that aligns all teams</p>
                          </div>
                          <div className="border-t border-border/40 pt-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { n: 2, label: "Below expectations" },
                                { n: 3, label: "Meets expectations" },
                                { n: 4, label: "Exceeds expectations" },
                                { n: 5, label: "Exceptional" },
                              ].map((btn) => (
                                <div key={btn.n} className={`px-3 py-1.5 rounded-md text-[10px] font-medium ${btn.n === 4 ? 'bg-primary text-white ring-2 ring-primary/30' : 'bg-muted border border-border text-foreground'}`}>
                                  {btn.n} - {btn.label}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Manager rates 4 with context */}
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-full bg-chart-2/20 flex items-center justify-center shrink-0">
                        <span className="text-chart-2 text-xs font-bold">M</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Mike Torres</span>
                          <span className="text-[11px] text-muted-foreground">10:33 AM</span>
                        </div>
                        <p className="text-[13px] text-foreground leading-relaxed">
                          4 — Alex drove the Q4 roadmap independently and identified the upsell opportunity that became our top initiative.
                        </p>
                      </div>
                    </div>

                    {/* Nami confirmation + next */}
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Nami</span>
                          <span className="text-[11px] text-muted-foreground">10:33 AM</span>
                        </div>
                        <p className="text-[13px] text-foreground leading-relaxed">
                          Product Strategy: <span className="font-semibold text-primary">4/5</span> (target: 4). Next: <span className="font-semibold">Stakeholder Management</span>
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: '33%' }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium">2/6</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-center mt-5 text-sm text-muted-foreground/70">
                  Nami shows what each score means for that exact competency — no guesswork, no tab-switching.
                </p>
              </div>
            </ScrollReveal>

          </div>
        </div>
      </section>

      {/* ── Feature Spotlight 2: Goals ── */}
      <section id="goals" className="bg-gradient-to-br from-[#f5f5f0] via-[#faf8f2] to-[#f3f2ed] py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: Goals mockup — desktop only */}
            <ScrollReveal scale>
              <div className="relative">
                <div className="absolute -inset-6 bg-primary/[0.06] blur-3xl rounded-full -z-10 pointer-events-none" />
                <div className="rounded-2xl border border-border/60 overflow-hidden shadow-2xl shadow-primary/10 bg-white">
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Goals</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Q1 2025 · 4 active goals</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                      3 on track
                    </div>
                  </div>

                  {/* Goal rows */}
                  <div className="divide-y divide-border/50">
                    {[
                      {
                        title: "Achieve 90%+ review completion org-wide",
                        progress: 100,
                        statusLabel: "Achieved",
                        statusColor: "text-emerald-700 bg-emerald-50",
                        ringColor: "#10b981",
                      },
                      {
                        title: "Launch competency framework for all IC levels",
                        progress: 75,
                        statusLabel: "On Track",
                        statusColor: "text-emerald-700 bg-emerald-50",
                        ringColor: "#10b981",
                      },
                      {
                        title: "Reduce time-to-hire for Engineering by 20%",
                        progress: 38,
                        statusLabel: "At Risk",
                        statusColor: "text-amber-700 bg-amber-50",
                        ringColor: "#f59e0b",
                      },
                      {
                        title: "Complete 360 reviews for all senior ICs",
                        progress: 88,
                        statusLabel: "On Track",
                        statusColor: "text-emerald-700 bg-emerald-50",
                        ringColor: "#10b981",
                      },
                    ].map((goal) => {
                      const circumference = 2 * Math.PI * 14;
                      const dash = (goal.progress / 100) * circumference;
                      return (
                        <div key={goal.title} className="px-5 py-4 flex items-center gap-4">
                          {/* SVG ring indicator */}
                          <div className="relative h-11 w-11 shrink-0">
                            <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
                              <circle
                                cx="18" cy="18" r="14"
                                fill="none"
                                stroke="currentColor"
                                className="text-muted/50"
                                strokeWidth="3.5"
                              />
                              <circle
                                cx="18" cy="18" r="14"
                                fill="none"
                                stroke={goal.ringColor}
                                strokeWidth="3.5"
                                strokeDasharray={`${dash} ${circumference}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                              {goal.progress}%
                            </span>
                          </div>
                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">{goal.title}</p>
                            <div className={`mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${goal.statusColor}`}>
                              {goal.statusLabel}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Goal progress syncs with review data</p>
                    <div className="flex items-center gap-1 text-[11px] text-primary font-medium">
                      View all <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Right: copy */}
            <ScrollReveal>
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                  Goals & OKRs
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
                  Set a goal in 30 seconds. Track it forever.
                </h2>
                <p className="mt-4 text-muted-foreground text-[15px] leading-relaxed">
                  Most goal tools are glorified spreadsheets. Nami makes goals effortless — create one in seconds from a template, and it stays connected to reviews, analytics, and your team&apos;s Slack.
                </p>

                <ul className="mt-8 space-y-5">
                  {[
                    {
                      icon: Zap,
                      title: "One-click goal templates",
                      body: "Pick from pre-built templates — Improve a Metric, Complete a Project, Team Development — and the goal form is pre-filled. Edit the brackets, hit save. Done in 30 seconds.",
                    },
                    {
                      icon: Flag,
                      title: "Individual and team goals with live tracking",
                      body: "Every goal has an owner, due date, and status: On Track, At Risk, Delayed, or Achieved. Metrics update in real time — no manual check-ins needed.",
                    },
                    {
                      icon: Send,
                      title: "Status changes notify managers on Slack",
                      body: "When a goal moves to At Risk or Delayed, the employee\u2019s manager gets a Slack DM instantly. No surprises at review time — issues surface the moment they happen.",
                    },
                    {
                      icon: Users,
                      title: "Full context in every 1:1",
                      body: "Open any team member\u2019s profile and their goal progress is right there. Managers walk into every 1:1 knowing exactly where things stand — no \u2018what were you working on?\u2019",
                    },
                    {
                      icon: TrendingUp,
                      title: "Goals roll up into org-wide Analytics",
                      body: "See what percentage of the org is on track at any moment. Spot which teams are slipping and which are flying — before it shows up in quarterly results.",
                    },
                    {
                      icon: BarChart3,
                      title: "Goal data feeds directly into reviews",
                      body: "When a review cycle opens, historical goal progress is already in the competency framework. Ratings reflect real outcomes — not recency bias or guesswork.",
                    },
                  ].map((item) => (
                    <li key={item.title} className="flex gap-4">
                      <div className="h-9 w-9 rounded-xl bg-primary/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

          </div>
        </div>
      </section>

      {/* ── Feature Spotlight 3: Analytics ── */}
      <section id="analytics" className="bg-white py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: copy */}
            <ScrollReveal>
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                  Analytics
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
                  Analytics that tell you something — not just pretty charts
                </h2>
                <p className="mt-4 text-muted-foreground text-[15px] leading-relaxed">
                  Most HR tools give you a pie chart and call it analytics. Nami gives you actionable data sliced by role, department, level, and tenure — so you know exactly where to invest.
                </p>

                <ul className="mt-8 space-y-5">
                  {[
                    {
                      icon: Grid3X3,
                      title: "Competency Heatmap — one table, zero spreadsheets",
                      body: "See which competencies are strong and which need development, broken down by role, department, seniority level, or tenure. Instantly spot that Directors score low on Collaboration, or that new hires are struggling with Execution.",
                    },
                    {
                      icon: Star,
                      title: "Performance Ranking with tier badges",
                      body: "Every employee ranked by average rating with a clear tier: Exceptional, Strong, Solid, or Needs Development. Filterable by function and department. Useful for calibration, promotion decisions, and headcount planning.",
                    },
                    {
                      icon: TrendingUp,
                      title: "Cross-cycle trend analysis",
                      body: "See whether your org's average rating and completion rate are improving cycle over cycle — not just a snapshot of today. Know if your investment in people is working.",
                    },
                    {
                      icon: Target,
                      title: "Filter by cycle, function, or department",
                      body: "Every analytics view is filterable. Compare Engineering vs. Product. Look at just the last cycle. Drill into a specific department. The data adjusts in real time — no waiting for reports to run.",
                    },
                  ].map((item) => (
                    <li key={item.title} className="flex gap-4">
                      <div className="h-9 w-9 rounded-xl bg-primary/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            {/* Right: Heatmap + Ranking mockup — desktop only */}
            <ScrollReveal scale>
              <div className="relative space-y-4">
                <div className="absolute -inset-6 bg-primary/[0.06] blur-3xl rounded-full -z-10 pointer-events-none" />

                {/* Heatmap table */}
                <div className="rounded-2xl border border-border/60 overflow-hidden shadow-xl shadow-primary/8 bg-white">
                  <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Competency Heatmap</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Avg ratings × role — Q1 2025</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: "≥4.5", color: "bg-emerald-100" },
                        { label: "≥3.5", color: "bg-primary/10" },
                        { label: "<3.5", color: "bg-amber-100" },
                      ].map((l) => (
                        <div key={l.label} className="flex items-center gap-1">
                          <div className={`h-2.5 w-2.5 rounded-sm ${l.color}`} />
                          <span className="text-[9px] text-muted-foreground">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/20">
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground w-32">Competency</th>
                          {["All", "IC", "Manager", "Director"].map((g) => (
                            <th key={g} className="px-3 py-2 text-center font-medium text-muted-foreground min-w-[60px]">{g}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: "Leadership",    scores: [3.9, 3.5, 4.2, 4.8] },
                          { name: "Execution",     scores: [4.1, 4.3, 4.0, 3.8] },
                          { name: "Collaboration", scores: [4.4, 4.5, 4.3, 4.6] },
                          { name: "Communication", scores: [3.6, 3.5, 3.8, 4.1] },
                        ].map((row) => (
                          <tr key={row.name} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                            {row.scores.map((score, i) => (
                              <td
                                key={`${row.name}-${i}`}
                                className={`px-3 py-2.5 text-center font-semibold tabular-nums ${
                                  score >= 4.5 ? "bg-emerald-50 text-emerald-700" :
                                  score >= 3.5 ? "bg-primary/5 text-primary" :
                                  "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {score.toFixed(1)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {/* Overall row */}
                        <tr className="border-t-2 border-border/60 bg-muted/30 font-semibold">
                          <td className="px-4 py-2.5 text-foreground">Overall</td>
                          {[4.0, 4.0, 4.1, 4.3].map((score, i) => (
                            <td key={`overall-${i}`} className={`px-3 py-2.5 text-center font-semibold tabular-nums ${
                              score >= 4.5 ? "bg-emerald-50 text-emerald-700" :
                              score >= 3.5 ? "bg-primary/5 text-primary" :
                              "bg-amber-50 text-amber-700"
                            }`}>
                              {score.toFixed(1)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Performance ranking snippet */}
                <div className="rounded-2xl border border-border/60 overflow-hidden shadow-lg shadow-primary/5 bg-white">
                  <div className="px-5 py-3.5 border-b border-border/60 flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <p className="text-[13px] font-semibold text-foreground">Performance Ranking</p>
                  </div>
                  <div className="divide-y divide-border/40">
                    {[
                      { name: "Alex Johnson", fn: "Engineering", rating: 4.7, tier: "Exceptional", tierColor: "text-emerald-700 bg-emerald-50" },
                      { name: "Maria Garcia", fn: "Product",     rating: 4.2, tier: "Strong",      tierColor: "text-green-700 bg-green-50" },
                      { name: "Chris Lee",    fn: "Design",      rating: 3.6, tier: "Solid",       tierColor: "text-sky-700 bg-sky-50" },
                      { name: "Priya Nair",   fn: "Engineering", rating: 2.8, tier: "Needs Dev",   tierColor: "text-amber-700 bg-amber-50" },
                    ].map((emp, i) => (
                      <div key={emp.name} className="px-5 py-3 flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground font-mono w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-foreground">{emp.name}</p>
                          <p className="text-[10px] text-muted-foreground">{emp.fn}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(emp.rating / 5) * 100}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-foreground tabular-nums">{emp.rating}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${emp.tierColor}`}>{emp.tier}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </ScrollReveal>

          </div>
        </div>
      </section>

      {/* ── Nami Does It All ── */}
      <section className="bg-gradient-to-br from-[#f5f5f0] via-[#faf8f2] to-[#f3f2ed] py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5">
              Powered by Nami
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">One bot. Everything your team needs.</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto text-[15px]">
              Nami handles reviews, reminders, surveys, and results — all through Slack DMs. Your team never leaves their workflow.
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Card 1: Conversational Reviews */}
            <ScrollReveal>
              <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-lg shadow-primary/5">
                <div className="bg-[#1e1b4b] px-4 py-2.5 flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-white text-[7px] font-bold">N</span>
                  </div>
                  <span className="text-white text-xs font-semibold">Nami</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                      <span className="text-white text-[9px] font-bold">N</span>
                    </div>
                    <div>
                      <p className="text-[12px] text-foreground leading-relaxed">
                        How would you rate <span className="font-semibold">Alex</span> on <span className="font-semibold">Execution</span>?
                      </p>
                      <div className="flex gap-1 mt-2">
                        {[1,2,3,4,5].map((n) => (
                          <div key={n} className={`px-2.5 py-1 rounded text-[10px] font-medium ${n === 5 ? 'bg-primary text-white' : 'bg-muted border border-border/60 text-muted-foreground'}`}>{n}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <p className="text-[11px] font-medium text-foreground">Conversational Reviews</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Reviews happen in natural conversation — not forms</p>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 2: Manager Context */}
            <ScrollReveal delay={80}>
              <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-lg shadow-primary/5">
                <div className="bg-[#1e1b4b] px-4 py-2.5 flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-white text-[7px] font-bold">N</span>
                  </div>
                  <span className="text-white text-xs font-semibold">Nami</span>
                </div>
                <div className="p-4">
                  <div className="flex gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                      <span className="text-white text-[9px] font-bold">N</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-foreground leading-relaxed mb-2">
                        Before you rate Alex, here&apos;s some context:
                      </p>
                      <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border/50">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Self-assessment avg</span>
                          <span className="font-semibold text-foreground">4.2/5</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Active goals</span>
                          <span className="font-semibold text-emerald-600">3 (2 on track)</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Previous cycle</span>
                          <span className="font-semibold text-foreground">3.8/5</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <p className="text-[11px] font-medium text-foreground">Manager Context</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Managers get full context before rating</p>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 3: Smart Reminders */}
            <ScrollReveal delay={160}>
              <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-lg shadow-primary/5">
                <div className="bg-[#1e1b4b] px-4 py-2.5 flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-white text-[7px] font-bold">N</span>
                  </div>
                  <span className="text-white text-xs font-semibold">Nami</span>
                </div>
                <div className="p-4">
                  <div className="flex gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                      <span className="text-white text-[9px] font-bold">N</span>
                    </div>
                    <div>
                      <p className="text-[12px] text-foreground leading-relaxed">
                        Hey! You have <span className="font-semibold">2 reviews</span> left for the Q1 cycle. Want to knock them out now?
                      </p>
                      <div className="flex gap-1.5 mt-2.5">
                        <div className="px-3 py-1.5 rounded-md bg-primary text-white text-[10px] font-medium">Let&apos;s go</div>
                        <div className="px-3 py-1.5 rounded-md bg-muted border border-border/60 text-foreground text-[10px] font-medium">Remind me later</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-primary" />
                    <p className="text-[11px] font-medium text-foreground">Smart Reminders</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Gentle nudges, never annoying</p>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 4: Instant Results */}
            <ScrollReveal delay={240}>
              <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-lg shadow-primary/5">
                <div className="bg-[#1e1b4b] px-4 py-2.5 flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-white text-[7px] font-bold">N</span>
                  </div>
                  <span className="text-white text-xs font-semibold">Nami</span>
                </div>
                <div className="p-4">
                  <div className="flex gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                      <span className="text-white text-[9px] font-bold">N</span>
                    </div>
                    <div>
                      <p className="text-[12px] text-foreground leading-relaxed">
                        Q1 Performance Review is complete! <span className="font-semibold">47 participants</span> &middot; Avg rating: <span className="font-semibold text-primary">4.2/5</span>
                      </p>
                      <div className="flex gap-1.5 mt-2.5">
                        <div className="px-3 py-1.5 rounded-md bg-primary text-white text-[10px] font-medium">View Dashboard</div>
                        <div className="px-3 py-1.5 rounded-md bg-muted border border-border/60 text-foreground text-[10px] font-medium">Start Calibration</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <p className="text-[11px] font-medium text-foreground">Instant Results</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">HR gets notified the moment a cycle wraps</p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="bg-background py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5">
              How it works
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Up and running in minutes</h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto text-[15px]">
              No lengthy onboarding. No training. No new tool for your team to learn. Just add Nami to Slack and you&apos;re set.
            </p>
          </ScrollReveal>

          <div className="relative">
            <div className="hidden lg:block absolute top-[27px] left-[calc(16.66%+34px)] right-[calc(16.66%+34px)] h-px bg-border" aria-hidden="true" />
            <ol className="grid sm:grid-cols-3 gap-8 lg:gap-12 relative">
              {[
                {
                  step: 1,
                  icon: Slack,
                  title: "Add Nami to Slack",
                  description: "Click 'Add to Slack' and authorize in your workspace. Takes under 60 seconds. No engineering setup required.",
                },
                {
                  step: 2,
                  icon: Target,
                  title: "Import your team in seconds",
                  description: "Nami auto-syncs your Slack members — names, photos, emails. Assign managers with a click, then use pre-built competency frameworks to get started instantly.",
                },
                {
                  step: 3,
                  icon: BarChart3,
                  title: "Launch from templates",
                  description: "Pick from ready-made review, goal, or cycle templates — or create your own. Set a deadline and Nami handles assignments, reminders, and collection.",
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
        </div>
      </section>

      {/* ── Built-in features strip ── */}
      <section className="bg-[#f8f6f0] border-y border-border/40 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-8">
            Everything you need, built in
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Slack, title: "Slack Auto-Sync", desc: "Team members, photos, and emails imported automatically from your workspace" },
              { icon: Grid3X3, title: "Pre-built Templates", desc: "Review, competency, goal, and cycle templates — ready to use or customise" },
              { icon: Target, title: "Competency Frameworks", desc: "Engineering, Product, Management, and General frameworks with level expectations" },
              { icon: BarChart3, title: "Real-time Analytics", desc: "Heatmaps, rankings, trend analysis, and department breakdowns — no exports needed" },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-border/60 bg-white p-4 space-y-2">
                <div className="h-9 w-9 rounded-lg bg-primary/[0.08] flex items-center justify-center">
                  <f.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="bg-gradient-to-r from-primary via-[#4338ca] to-[#3730a3] py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-10 text-center">
            {[
              { metric: "95%+", label: "Average review completion — up from ~40% with traditional tools" },
              { metric: "< 2 min", label: "Average time Nami takes to complete a review via Slack" },
              { metric: "$1/user", label: "Everything included. No tiers. No add-ons. No upsells." },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl font-black text-white">{stat.metric}</p>
                <p className="mt-2 text-sm text-white/75 max-w-[200px] mx-auto">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-background border-t border-border/30">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5">
              Pricing
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Other tools charge $8–15/user. Nami is $1.</h2>
            <p className="mt-3 text-muted-foreground text-[15px]">Less than a coffee. More than most enterprise tools.</p>
          </ScrollReveal>

          <ScrollReveal>
            <div className="flex flex-col items-center max-w-lg mx-auto p-8 rounded-2xl border-2 border-primary bg-white shadow-xl shadow-primary/[0.15] relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-white text-xs font-bold">
                Everything included
              </div>
              <p className="text-5xl font-black text-foreground mt-3 mb-1">$1<span className="text-lg font-normal text-muted-foreground">/user/mo</span></p>
              <p className="text-[13px] text-muted-foreground mb-6">7-day free trial · No credit card · Cancel anytime</p>

              <div className="grid sm:grid-cols-3 gap-6 w-full text-left">
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Reviews</p>
                  <ul className="space-y-1.5">
                    {["Unlimited cycles", "360° via Slack (Nami)", "9-box calibration"].map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                        <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Goals</p>
                  <ul className="space-y-1.5">
                    {["OKR tracking", "Status updates", "Manager visibility"].map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                        <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Analytics</p>
                  <ul className="space-y-1.5">
                    {["Competency heatmap", "Performance ranking", "Trend analysis"].map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                        <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <Button className="mt-8 w-full" asChild>
                <a href={addToSlackUrl}>
                  <Slack className="h-4 w-4 mr-2" />
                  Start your free trial
                </a>
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#faf8f2] via-background to-[#f5f5f0] py-20">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight max-w-2xl mx-auto leading-[1.1]">
              Ready to let Nami handle your{" "}
              <span className="text-primary">performance management?</span>
            </h2>
            <p className="mt-5 text-muted-foreground text-lg max-w-lg mx-auto">
              Add Nami to your Slack workspace in under a minute. She&apos;ll handle reviews, goals, surveys, and analytics — so you don&apos;t have to.
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

      {/* ── Footer ── */}
      <footer className="bg-muted/40 border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">P</span>
              </div>
              <span className="font-semibold text-foreground">Nami</span>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-muted-foreground/60 hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="text-muted-foreground/60 hover:text-foreground transition-colors">Terms</Link>
              <Link href="/support" className="text-muted-foreground/60 hover:text-foreground transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
