import { Button } from "@/components/ui/button";
import {
  Slack, Shield, BarChart3, MessageSquare, Users, Star,
  Check, Target, TrendingUp, Flag, ChevronRight,
  Grid3X3, Bot, Bell, Zap, Send, Clock, BookOpen, MousePointerClick,
  Activity, Heart, ClipboardList, AlertTriangle, Smile,
} from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { MobileNav } from "@/components/landing/mobile-nav";
import { AnimatedCounter } from "@/components/landing/animated-counter";

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

      {/* ── Header + Hero (seamless) ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#fafaf5] via-[#f8f6f0] to-[#fefcf5]">

        {/* Sticky nav */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-[#fafaf5]/80">
          <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[40px] font-black tracking-tight text-foreground">Nami</span>
            </Link>
            <div className="hidden lg:flex items-center gap-6">
              <a href="#features" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#surveys" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Surveys</a>
              <a href="#pricing" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <Link href="/roadmap" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Roadmap</Link>
              <a href={signInWithSlackUrl} className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors border border-border rounded-full px-5 py-2">Sign in</a>
              <Button className="rounded-full px-6 h-10 text-[15px]" asChild>
                <a href={addToSlackUrl}>
                  <Slack className="h-4 w-4 mr-1.5" />
                  Add to Slack
                </a>
              </Button>
            </div>
            <MobileNav signInUrl={signInWithSlackUrl} addToSlackUrl={addToSlackUrl} />
          </div>
        </header>

        {/* Hero — two-card Deel-style layout */}
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-4">
          <div className="grid lg:grid-cols-2 gap-3 min-h-[520px] lg:min-h-[560px]">

            {/* Left card — dark with copy */}
            <div className="relative rounded-3xl bg-[#1a1a2e] overflow-hidden p-8 sm:p-10 lg:p-12 flex flex-col justify-between">
              {/* Subtle gradient orb */}
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-3xl pointer-events-none animate-orb-drift" />

              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 mb-6">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  Meet Nami — your performance assistant in Slack
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[64px] font-bold tracking-tight text-white leading-[1.1]">
                  Performance reviews your team will{" "}
                  <span className="text-primary text-shimmer">actually complete.</span>
                </h1>

                <p className="mt-5 text-lg text-white/60 leading-relaxed max-w-[480px]">
                  Nami lives in your team&apos;s Slack and handles everything — 360° reviews, goal tracking, surveys, and analytics. No new tools. No forms.
                </p>
              </div>

              <div className="relative mt-8">
                <div className="flex flex-col sm:flex-row items-start gap-3">
                  <Button size="lg" className="h-12 px-7 text-sm font-semibold rounded-full btn-glow" asChild>
                    <a href={addToSlackUrl}>
                      <Slack className="h-4 w-4 mr-2" />
                      Add to Slack — free
                    </a>
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-12 px-7 text-sm text-white/60 hover:text-white hover:bg-white/10 border border-white/15 rounded-full"
                    asChild
                  >
                    <a href={signInWithSlackUrl}>Sign in with Slack</a>
                  </Button>
                </div>
                <p className="mt-4 text-xs text-white/30 tracking-wide">
                  Free for up to 10 people · No credit card · Installs in 60 seconds
                </p>
              </div>
            </div>

            {/* Right card — light with dashboard mockup */}
            <div className="relative rounded-3xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-secondary/[0.06] overflow-hidden flex items-stretch">
              {/* Dashboard mockup — fills the whole card */}
              <div className="w-full m-3 rounded-2xl border border-border/60 overflow-hidden shadow-2xl shadow-primary/10 bg-white flex flex-col">
                {/* Browser chrome */}
                <div className="bg-muted/80 border-b border-border/60 px-4 py-2 flex items-center gap-3 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                    <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                    <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                  </div>
                  <div className="flex-1 bg-background/70 rounded-md px-3 py-1 text-[10px] text-muted-foreground font-mono">
                    app.nami.team/dashboard/analytics
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar — matches real app */}
                  <div className="hidden sm:flex w-[140px] border-r border-border/60 flex-col bg-muted/20 p-2.5 gap-0.5 shrink-0 overflow-hidden">
                    {/* Logo */}
                    <div className="px-2 py-1.5 mb-1">
                      <span className="text-[11px] font-bold text-foreground">Nami</span>
                      <span className="block text-[7px] text-muted-foreground/50 italic" style={{ fontFamily: "'Georgia', serif" }}>Powered by Nami</span>
                    </div>
                    {/* Nav items — matching real sidebar */}
                    {[
                      { label: "Home", active: false },
                      { label: "Performance", active: false },
                      { label: "Goals", active: false },
                      { label: "Kudos", active: false },
                    ].map((item) => (
                      <div key={item.label} className="px-2 py-1 rounded-md text-[10px] text-muted-foreground">{item.label}</div>
                    ))}
                    <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider font-semibold px-2 mt-2 mb-0.5">Team</p>
                    {[
                      { label: "My Team", active: false },
                      { label: "Reviews", active: false },
                    ].map((item) => (
                      <div key={item.label} className="px-2 py-1 rounded-md text-[10px] text-muted-foreground">{item.label}</div>
                    ))}
                    <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider font-semibold px-2 mt-2 mb-0.5">Admin</p>
                    {[
                      { label: "Cycles", active: false },
                      { label: "Directory", active: false },
                      { label: "Surveys", active: false },
                      { label: "Templates", active: false },
                      { label: "Analytics", active: true },
                      { label: "Settings", active: false },
                    ].map((item) => (
                      <div key={item.label} className={`px-2 py-1 rounded-md text-[10px] ${item.active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>{item.label}</div>
                    ))}
                  </div>

                  {/* Analytics content — matches real dashboard */}
                  <div className="flex-1 p-4 overflow-hidden bg-[#fafaf9]">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Analytics</p>
                        <p className="text-[9px] text-muted-foreground">Performance insights for Acme Corp</p>
                      </div>
                      <div className="px-2 py-1 rounded-md bg-muted/60 text-[9px] text-muted-foreground border border-border/40">Export</div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-3 mb-3 border-b border-border/40 pb-1.5">
                      {["Overview", "Heatmap", "Cycles"].map((tab, i) => (
                        <span key={tab} className={`text-[9px] font-medium pb-1 ${i === 0 ? "text-primary border-b border-primary" : "text-muted-foreground"}`}>{tab}</span>
                      ))}
                    </div>

                    {/* Filters */}
                    <div className="flex gap-1.5 mb-3">
                      {["All Cycles", "All Functions", "All Depts"].map((f) => (
                        <div key={f} className="px-2 py-0.5 rounded-md bg-white border border-border/50 text-[8px] text-muted-foreground">{f}</div>
                      ))}
                    </div>

                    {/* 5 KPI cards — matches real app layout */}
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {[
                        { icon: "★", label: "Overall Rating", value: "4.2/5", color: "text-amber-500", iconBg: "bg-amber-50" },
                        { icon: "↗", label: "Completion", value: "91%", color: "text-emerald-600", iconBg: "bg-emerald-50" },
                        { icon: "▊", label: "Total Ratings", value: "312", color: "text-primary", iconBg: "bg-primary/10" },
                        { icon: "◉", label: "Participants", value: "47", color: "text-purple-600", iconBg: "bg-purple-50" },
                        { icon: "⊞", label: "Active Cycles", value: "2", color: "text-orange-500", iconBg: "bg-orange-50" },
                      ].map((kpi) => (
                        <div key={kpi.label} className="bg-white rounded-lg p-2 border border-border/40">
                          <div className={`h-4 w-4 rounded-md ${kpi.iconBg} flex items-center justify-center text-[8px] mb-1`}>{kpi.icon}</div>
                          <p className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</p>
                          <p className="text-[7px] text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Rating Distribution + Competency Ratings side by side */}
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      {/* Rating Distribution */}
                      <div className="bg-white rounded-lg p-2.5 border border-border/40">
                        <p className="text-[9px] font-semibold text-foreground mb-2">Rating Distribution</p>
                        <div className="flex items-end gap-1 h-12">
                          {[
                            { score: "1", pct: 3, color: "bg-red-400" },
                            { score: "2", pct: 8, color: "bg-orange-400" },
                            { score: "3", pct: 28, color: "bg-yellow-400" },
                            { score: "4", pct: 42, color: "bg-green-400" },
                            { score: "5", pct: 19, color: "bg-emerald-500" },
                          ].map((bar) => (
                            <div key={bar.score} className="flex-1 flex flex-col items-center gap-0.5">
                              <div className={`w-full ${bar.color} rounded-t-sm`} style={{ height: `${bar.pct * 1.1}px` }} />
                              <span className="text-[7px] text-muted-foreground">{bar.score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Competency Ratings */}
                      <div className="bg-white rounded-lg p-2.5 border border-border/40">
                        <p className="text-[9px] font-semibold text-foreground mb-2">Competency Ratings</p>
                        <div className="space-y-1.5">
                          {[
                            { name: "Collaboration", score: 4.4 },
                            { name: "Leadership", score: 4.3 },
                            { name: "Execution", score: 3.9 },
                            { name: "Communication", score: 3.7 },
                          ].map((c) => (
                            <div key={c.name} className="flex items-center gap-1.5">
                              <p className="text-[8px] text-muted-foreground w-[70px] shrink-0 truncate">{c.name}</p>
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${(c.score / 5) * 100}%` }} />
                              </div>
                              <span className="text-[8px] font-semibold text-foreground w-4 text-right tabular-nums">{c.score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Performance Ranking table */}
                    <div className="bg-white rounded-lg p-2.5 border border-border/40">
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-[9px]">⭐</span>
                        <p className="text-[9px] font-semibold text-foreground">Performance Ranking</p>
                      </div>
                      <div className="space-y-1">
                        {[
                          { rank: 1, name: "Alex Johnson", fn: "Engineering", rating: 4.7, tier: "Exceptional", tierColor: "text-emerald-700 bg-emerald-50" },
                          { rank: 2, name: "Maria Garcia", fn: "Product", rating: 4.2, tier: "Strong", tierColor: "text-green-700 bg-green-50" },
                          { rank: 3, name: "Chris Lee", fn: "Design", rating: 3.6, tier: "Solid", tierColor: "text-sky-700 bg-sky-50" },
                          { rank: 4, name: "Priya Nair", fn: "Engineering", rating: 2.8, tier: "Needs Dev", tierColor: "text-amber-700 bg-amber-50" },
                        ].map((emp) => (
                          <div key={emp.name} className="flex items-center gap-2 py-0.5">
                            <span className="text-[8px] text-muted-foreground w-3 shrink-0 font-mono">{emp.rank}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-medium text-foreground truncate">{emp.name}</p>
                            </div>
                            <span className="text-[8px] text-muted-foreground shrink-0">{emp.fn}</span>
                            <div className="w-10 h-1 bg-muted rounded-full overflow-hidden shrink-0">
                              <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(emp.rating / 5) * 100}%` }} />
                            </div>
                            <span className="text-[8px] font-semibold text-foreground tabular-nums shrink-0">{emp.rating}</span>
                            <span className={`px-1 py-0.5 rounded text-[7px] font-semibold shrink-0 ${emp.tierColor}`}>{emp.tier}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Completion by Department + Avg Rating by Department */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="bg-white rounded-lg p-2.5 border border-border/40">
                        <p className="text-[9px] font-semibold text-foreground mb-2">Completion by Dept</p>
                        <div className="space-y-1.5">
                          {[
                            { name: "Engineering", pct: 96 },
                            { name: "Product", pct: 88 },
                            { name: "Design", pct: 100 },
                            { name: "Marketing", pct: 75 },
                          ].map((d) => (
                            <div key={d.name} className="flex items-center gap-1.5">
                              <p className="text-[8px] text-muted-foreground w-[60px] shrink-0 truncate">{d.name}</p>
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.pct}%` }} />
                              </div>
                              <span className="text-[8px] font-semibold text-foreground w-6 text-right tabular-nums">{d.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-border/40">
                        <p className="text-[9px] font-semibold text-foreground mb-2">Avg Rating by Dept</p>
                        <div className="space-y-1.5">
                          {[
                            { name: "Engineering", rating: 4.3 },
                            { name: "Product", rating: 4.1 },
                            { name: "Design", rating: 3.8 },
                            { name: "Marketing", rating: 3.5 },
                          ].map((d) => (
                            <div key={d.name} className="flex items-center gap-1.5">
                              <p className="text-[8px] text-muted-foreground w-[60px] shrink-0 truncate">{d.name}</p>
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${(d.rating / 5) * 100}%` }} />
                              </div>
                              <span className="text-[8px] font-semibold text-foreground w-4 text-right tabular-nums">{d.rating}</span>
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
                <AnimatedCounter value={item.stat} className="text-3xl lg:text-4xl font-bold tracking-tight text-primary block" />
                <p className="text-base font-semibold text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.detail}</p>
                <p className="text-[10px] text-muted-foreground/60 italic">{item.source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Goals & Analytics — compact cards ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Goals, analytics, and everything in between
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto text-[17px]">
              Nami doesn&apos;t just handle reviews. It tracks goals, surfaces analytics, and keeps your whole performance stack connected.
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-3 gap-5">
            <ScrollReveal>
              <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm h-full card-hover">
                <div className="h-10 w-10 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-4">
                  <Flag className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Goals &amp; OKRs</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Create goals in 30 seconds from templates. Track status (On Track, At Risk, Achieved) in real time. Goals feed directly into reviews and analytics — no manual data entry.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={80}>
              <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm h-full card-hover">
                <div className="h-10 w-10 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-4">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Analytics &amp; Heatmaps</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Competency heatmaps, performance rankings, completion breakdowns — sliced by role, department, level, and tenure. See exactly where to invest, not just a pie chart.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={160}>
              <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm h-full card-hover">
                <div className="h-10 w-10 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Trends &amp; Reporting</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Cross-cycle trends show if your org is improving. Completion rates, average ratings, and goal attainment — all tracked over time so you know your investment in people is working.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Template Library ── */}
      <section id="templates" className="bg-[#f8f6f0] border-y border-border/40 py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5">
              Template Library
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              Don&apos;t build frameworks from scratch — use ours
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto text-[17px]">
              Pre-built by HR researchers. Import in one click. Customise to fit your org.
            </p>
          </ScrollReveal>

          {/* Value pills */}
          <ScrollReveal className="flex flex-wrap justify-center gap-3 mb-12">
            {[
              { icon: Clock, text: "Saves weeks of setup" },
              { icon: BookOpen, text: "Research-backed frameworks" },
              { icon: MousePointerClick, text: "One-click import" },
            ].map((pill) => (
              <span key={pill.text} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-border/60 text-xs font-medium text-foreground shadow-sm">
                <pill.icon className="h-3.5 w-3.5 text-primary" />
                {pill.text}
              </span>
            ))}
          </ScrollReveal>

          <ScrollReveal>
            <p className="text-center text-sm text-muted-foreground mb-4">
              8 frameworks included — Software Engineering, Data &amp; Analytics, Product Management, Design, and more
            </p>
          </ScrollReveal>

          {/* Matrix preview — Software Engineering */}
          <ScrollReveal>
            <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[15px] text-foreground">Software Engineering</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Career framework covering coding, architecture, and leadership skills across five seniority levels.</p>
                </div>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/[0.08] text-primary">
                  System Template
                </span>
              </div>

              {/* Matrix */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground w-[260px]">Competency</th>
                      {["Junior", "Mid", "Senior", "Staff", "Principal"].map((level) => (
                        <th key={level} className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground">{level}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Coding & Quality", desc: "Writing clean, maintainable, well-tested code", scores: [2, 3, 4, 5, 5] },
                      { name: "System Design", desc: "Designing scalable, reliable systems and APIs", scores: [2, 2, 3, 4, 5] },
                      { name: "Debugging & Problem Solving", desc: "Diagnosing and resolving complex technical issues", scores: [2, 3, 4, 5, 5] },
                      { name: "Delivery & Execution", desc: "Shipping quality work on time", scores: [2, 3, 4, 5, 4] },
                      { name: "Communication", desc: "Collaborating effectively across teams", scores: [2, 3, 3, 4, 4] },
                      { name: "Mentorship & Leadership", desc: "Growing others through guidance and teaching", scores: [2, 2, 3, 4, 5] },
                    ].map((comp) => (
                      <tr key={comp.name} className="border-b border-border/20 last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground text-[13px]">{comp.name}</p>
                          <p className="text-[11px] text-muted-foreground">{comp.desc}</p>
                        </td>
                        {comp.scores.map((score, i) => {
                          const colors: Record<number, string> = {
                            2: "bg-orange-100 text-orange-700 border-orange-200",
                            3: "bg-yellow-100 text-yellow-700 border-yellow-200",
                            4: "bg-green-100 text-green-700 border-green-200",
                            5: "bg-emerald-100 text-emerald-700 border-emerald-200",
                          };
                          return (
                            <td key={i} className="text-center px-3 py-3">
                              <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold border ${colors[score] || ""}`}>
                                {score}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Score descriptor example */}
              <div className="px-5 py-4 bg-[#faf9f6] border-t border-border/30">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Score Descriptors</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold border bg-green-100 text-green-700 border-green-200 mt-0.5 shrink-0">4</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">Coding &amp; Quality:</span> Champions code quality across the team by establishing review standards, introducing static analysis tooling, and refactoring legacy code. Writes code that others use as a reference.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold border bg-emerald-100 text-emerald-700 border-emerald-200 mt-0.5 shrink-0">5</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">Coding &amp; Quality:</span> Sets org-wide coding standards and quality benchmarks adopted across multiple teams. Designs testing strategies and CI/CD quality gates that measurably reduce production incidents.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Feature Spotlight: Reviews ── */}
      <section id="features" className="bg-white py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left: copy */}
            <ScrollReveal>
              <div className="lg:sticky lg:top-24">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                  Performance Reviews &amp; 360
                </span>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
                  Reviews that actually get completed — because they live in Slack
                </h2>
                <p className="mt-4 text-muted-foreground text-[17px] leading-relaxed">
                  Most teams struggle with 40–60% review completion. Nami fixes this by meeting people where they already work.
                </p>

                <ul className="mt-8 space-y-5">
                  {[
                    {
                      icon: MessageSquare,
                      title: "Slack DMs, not another form",
                      body: "Review requests arrive as Slack DMs. Your team responds right there — no new tab, no login, no context switch. Completion rates climb from ~40% to 95%+.",
                    },
                    {
                      icon: Shield,
                      title: "Airtight data visibility — nothing leaks early",
                      body: "Managers can\u2019t see upward feedback until they\u2019ve submitted their own review — and vice versa. Employees only see results after HR releases grades. Compliance-ready by design.",
                    },
                    {
                      icon: Star,
                      title: "9-box calibration built in",
                      body: "After collection, HR aligns grades across managers using the calibration grid before releasing results. No spreadsheets.",
                    },
                    {
                      icon: Grid3X3,
                      title: "Full reviews in a Slack modal",
                      body: "Competency ratings, expected scores, open-ended comments — all inside a Slack modal. Reviewers never open a browser.",
                    },
                  ].map((item) => (
                    <li key={item.title} className="flex gap-4">
                      <div className="h-9 w-9 rounded-xl bg-primary/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
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
                  <div className="bg-white border-b border-border/60 px-5 py-2.5 flex items-center gap-2">
                    <div className="h-5 w-5 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold">N</span>
                    </div>
                    <span className="text-[13px] font-bold text-foreground">Nami</span>
                    <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">APP</span>
                  </div>

                  {/* Conversation */}
                  <div className="p-5 space-y-5 bg-white">
                    {/* Nami → competency review with score descriptors */}
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Nami</span>
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">APP</span>
                          <span className="text-[11px] text-muted-foreground">10:32 AM</span>
                        </div>
                        <div className="border-l-[3px] border-l-primary pl-3 py-1 space-y-3">
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
                                <div key={btn.n} className={`px-3 py-1.5 rounded text-[10px] font-medium ${btn.n === 4 ? 'border border-primary bg-primary/10 text-primary font-semibold' : 'border border-border bg-white text-foreground hover:bg-muted/30'}`}>
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
                      <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Nami</span>
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">APP</span>
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

                {/* Slack Modal mockup */}
                <div className="mt-6 rounded-2xl border border-border/60 bg-white overflow-hidden shadow-2xl shadow-primary/10">
                  {/* Modal header */}
                  <div className="bg-white px-5 py-3 border-b border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground cursor-pointer hover:text-foreground">Cancel</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Manager Review</h3>
                    <button className="px-3 py-1 rounded-md bg-primary text-white text-[12px] font-semibold">
                      Submit
                    </button>
                  </div>

                  <div className="p-5 space-y-4 max-h-[320px] overflow-hidden relative">
                    {/* Header info */}
                    <div className="text-[13px] text-foreground space-y-0.5">
                      <p className="font-bold">Manager Review for Alex Kim</p>
                      <p className="text-muted-foreground text-[11px]">Level: Software Engineer — Senior (L4)</p>
                      <p className="text-muted-foreground text-[11px]">6 competencies to rate. 1 open-ended question.</p>
                    </div>
                    <div className="h-px bg-border/60" />

                    {/* Competency dropdowns */}
                    {[
                      { label: "Coding & Quality (Technical) - expected: 4/5", selected: "4 - Exceeds expectations" },
                      { label: "System Design (Technical) - expected: 3/5", selected: "4 - Exceeds expectations" },
                      { label: "Debugging & Problem Solving (Technical) - expected: 4/5", selected: null },
                    ].map((field) => (
                      <div key={field.label} className="space-y-1">
                        <label className="text-[12px] font-semibold text-foreground">{field.label}</label>
                        <div className={`px-3 py-2 rounded-md border text-[12px] flex items-center justify-between ${field.selected ? 'border-border bg-white text-foreground' : 'border-border/60 bg-muted/30 text-muted-foreground'}`}>
                          <span>{field.selected || "Select rating"}</span>
                          <ChevronRight className="h-3 w-3 rotate-90 text-muted-foreground" />
                        </div>
                      </div>
                    ))}

                    {/* Fade overlay */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                  </div>
                </div>
                <p className="text-center mt-4 text-sm text-muted-foreground/70">
                  Full reviews open as a Slack modal — no browser needed. Competencies, ratings, and comments in one form.
                </p>
              </div>
            </ScrollReveal>

          </div>
        </div>
      </section>

      {/* ── Feature Spotlight 3: Surveys & Pulse Checks ── */}
      <section id="surveys" className="bg-gradient-to-br from-[#f5f5f0] via-[#faf8f2] to-[#f3f2ed] py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left: copy */}
            <ScrollReveal>
              <div className="lg:sticky lg:top-24">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                  Surveys &amp; Pulse Checks
                </span>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
                  Real-time employee sentiment — without the annual survey
                </h2>
                <p className="mt-4 text-muted-foreground text-[17px] leading-relaxed">
                  Stop guessing how your team feels. Nami delivers pulse surveys, eNPS, and custom questionnaires straight to Slack — and collects responses in under a minute.
                </p>

                <ul className="mt-8 space-y-5">
                  {[
                    {
                      icon: Activity,
                      title: "Pulse surveys in Slack DMs",
                      body: "Quick temperature checks — 5–15 questions, under 2 minutes. Delivered where your team already works.",
                    },
                    {
                      icon: TrendingUp,
                      title: "eNPS — one number that tells you everything",
                      body: "0–10 Net Promoter Score with follow-up question. Track promoters, passives, and detractors over time.",
                    },
                    {
                      icon: ClipboardList,
                      title: "Custom surveys for anything",
                      body: "Rating scales, open-ended questions, single-select. Onboarding feedback, exit interviews, team retros — your call.",
                    },
                    {
                      icon: Shield,
                      title: "Anonymous and aggregated",
                      body: "Names are never shown. People answer honestly because they trust the process.",
                    },
                  ].map((item) => (
                    <li key={item.title} className="flex gap-4">
                      <div className="h-9 w-9 rounded-xl bg-primary/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            {/* Right: Slack DM mockup — pulse survey + eNPS */}
            <ScrollReveal scale>
              <div className="relative">
                <div className="absolute -inset-6 bg-primary/[0.07] blur-3xl rounded-full -z-10 pointer-events-none" />

                {/* Pulse survey DM */}
                <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-2xl shadow-primary/10">
                  <div className="bg-white border-b border-border/60 px-5 py-2.5 flex items-center gap-2">
                    <div className="h-5 w-5 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold">N</span>
                    </div>
                    <span className="text-[13px] font-bold text-foreground">Nami</span>
                    <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">APP</span>
                  </div>
                  <div className="p-5 space-y-5 bg-white">
                    {/* Nami → pulse survey intro */}
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Nami</span>
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">APP</span>
                          <span className="text-[11px] text-muted-foreground">9:00 AM</span>
                        </div>
                        <p className="text-[13px] text-foreground leading-relaxed mb-3">
                          Hey! You&apos;ve been invited to take the <span className="font-semibold">March Pulse Survey</span>. It&apos;s quick — 5 questions, ~1 min.
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-3">
                          <Shield className="h-3 w-3" /> Your responses are anonymous and aggregated.
                        </p>
                        {/* Question with left border */}
                        <div className="border-l-[3px] border-l-primary pl-3 py-1 mb-3">
                          <p className="text-[12px] font-semibold text-foreground mb-1">1/5: I feel supported by my manager</p>
                          <p className="text-[10px] text-muted-foreground italic">Rate from 1 (Strongly disagree) to 7 (Strongly agree)</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                            <div key={n} className={`px-3 py-1.5 rounded text-[11px] font-medium ${n === 6 ? 'border-2 border-primary bg-primary/10 text-primary' : 'border border-border bg-white text-foreground'}`}>
                              {n}
                            </div>
                          ))}
                        </div>
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
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">APP</span>
                          <span className="text-[11px] text-muted-foreground">9:00 AM</span>
                        </div>
                        <p className="text-[13px] text-foreground leading-relaxed">
                          Got it — <span className="font-semibold text-primary">6/7</span>. Next: <span className="font-semibold">I have the tools I need to do my job well</span>
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: '20%' }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium">1/5</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* eNPS mockup */}
                <div className="mt-6 rounded-2xl border border-border/60 bg-white overflow-hidden shadow-xl shadow-primary/10">
                  <div className="bg-white border-b border-border/60 px-5 py-2.5 flex items-center gap-2">
                    <div className="h-5 w-5 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold">N</span>
                    </div>
                    <span className="text-[13px] font-bold text-foreground">Nami</span>
                    <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">APP</span>
                  </div>
                  <div className="p-5 bg-white">
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Nami</span>
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">APP</span>
                          <span className="text-[11px] text-muted-foreground">9:05 AM</span>
                        </div>
                        <div className="border-l-[3px] border-l-emerald-500 pl-3 py-1 mb-3">
                          <p className="text-[12px] font-semibold text-foreground mb-1">eNPS Survey</p>
                          <p className="text-[11px] text-muted-foreground">On a scale of 0–10, how likely are you to recommend this company as a great place to work?</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <div key={n} className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-medium ${
                              n === 9 ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-700' : 'border border-border bg-white text-foreground'
                            }`}>
                              {n}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground">
                          <span>Not at all likely</span>
                          <span>Extremely likely</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-center mt-5 text-sm text-muted-foreground/70">
                  Pulse surveys and eNPS — answered in Slack in under 60 seconds.
                </p>
              </div>
            </ScrollReveal>

          </div>
        </div>
      </section>

      {/* ── Feature Spotlight 4: Wellbeing & Engagement ── */}
      <section className="bg-white py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left: Slack check-in mockup + manager alert */}
            <ScrollReveal scale>
              <div className="relative lg:sticky lg:top-24">
                <div className="absolute -inset-6 bg-primary/[0.06] blur-3xl rounded-full -z-10 pointer-events-none" />

                {/* Check-in DM */}
                <div className="rounded-2xl border border-border/60 bg-white overflow-hidden shadow-2xl shadow-primary/10">
                  <div className="bg-white border-b border-border/60 px-5 py-2.5 flex items-center gap-2">
                    <div className="h-5 w-5 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold">N</span>
                    </div>
                    <span className="text-[13px] font-bold text-foreground">Nami</span>
                    <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">APP</span>
                  </div>
                  <div className="p-5 space-y-5 bg-white">
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Nami</span>
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">APP</span>
                          <span className="text-[11px] text-muted-foreground">Monday 9:00 AM</span>
                        </div>
                        <p className="text-[13px] text-foreground leading-relaxed mb-3">
                          Hey Sarah! Quick bi-weekly check-in — how are you feeling about work right now?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { emoji: "😊", label: "Great", selected: false },
                            { emoji: "🙂", label: "Good", selected: false },
                            { emoji: "😐", label: "Okay", selected: true },
                            { emoji: "😟", label: "Not great", selected: false },
                            { emoji: "😞", label: "Struggling", selected: false },
                          ].map((opt) => (
                            <div key={opt.label} className={`px-3 py-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                              opt.selected ? 'border-2 border-amber-400 bg-amber-50 text-amber-800' : 'border border-border bg-white text-foreground'
                            }`}>
                              <span className="text-sm">{opt.emoji}</span> {opt.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Follow-up */}
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Nami</span>
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">APP</span>
                          <span className="text-[11px] text-muted-foreground">9:00 AM</span>
                        </div>
                        <p className="text-[13px] text-foreground leading-relaxed">
                          Thanks for sharing. Anything specific on your mind? <span className="text-muted-foreground">(optional — just type your reply)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manager alert */}
                <div className="mt-6 rounded-2xl border border-border/60 bg-white overflow-hidden shadow-xl shadow-primary/10">
                  <div className="bg-white border-b border-border/60 px-5 py-2.5 flex items-center gap-2">
                    <div className="h-5 w-5 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold">N</span>
                    </div>
                    <span className="text-[13px] font-bold text-foreground">Nami</span>
                    <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">APP</span>
                  </div>
                  <div className="p-5 bg-white">
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Nami</span>
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">APP</span>
                          <span className="text-[11px] text-muted-foreground">9:15 AM</span>
                        </div>
                        <div className="border-l-[3px] border-l-amber-400 pl-3 py-1">
                          <p className="text-[12px] font-semibold text-amber-800 flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3" />
                            Wellbeing alert — engagement dropping
                          </p>
                          <p className="text-[11px] text-amber-700 mt-1.5 leading-relaxed">
                            <span className="font-medium">Sarah Chen</span>&apos;s check-in score dropped from <span className="font-medium">4.2</span> to <span className="font-medium">2.8</span> over the last 3 check-ins. Consider checking in during your next 1:1.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Right: copy */}
            <ScrollReveal>
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                  Frictionless Check-ins
                </span>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
                  Set it once. Nami checks in on your team forever.
                </h2>
                <p className="mt-4 text-muted-foreground text-[17px] leading-relaxed">
                  Pick a group, pick a frequency, and you&apos;re done. Every two weeks (or weekly, or monthly) Nami sends a 30-second check-in straight to Slack. No forms, no reminders to send, no chasing. Your team taps one button and you see the results instantly.
                </p>

                {/* How it works mini-flow */}
                <div className="mt-6 flex items-center gap-3 flex-wrap">
                  {[
                    "Pick your people",
                    "Set the schedule",
                    "Nami handles the rest",
                  ].map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-medium text-foreground">{s}</span>
                      {i < 2 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  ))}
                </div>

                <ul className="mt-8 space-y-5">
                  {[
                    {
                      icon: Zap,
                      title: "30 seconds in Slack — that\u2019s the whole thing",
                      body: "One emoji tap and an optional comment. Response rates stay above 90% because it\u2019s effortless.",
                    },
                    {
                      icon: Clock,
                      title: "Runs on autopilot — weekly, bi-weekly, or monthly",
                      body: "Set the frequency once. Nami sends it, collects responses, and closes it. You never touch it again.",
                    },
                    {
                      icon: Heart,
                      title: "Spot burnout before it becomes a resignation",
                      body: "Track wellbeing scores over time. When sentiment drops across consecutive check-ins, you\u2019ll know weeks early.",
                    },
                    {
                      icon: Bell,
                      title: "Managers get alerts when scores drop",
                      body: "Significant score drops trigger a private Slack DM to the manager. The signal comes to you — no monitoring needed.",
                    },
                  ].map((item) => (
                    <li key={item.title} className="flex gap-4">
                      <div className="h-9 w-9 rounded-xl bg-primary/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
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
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">Up and running in minutes</h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto text-[17px]">
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
                    <h3 className="font-semibold text-base text-foreground">{item.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{item.description}</p>
                  </li>
                </ScrollReveal>
              ))}
            </ol>
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
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">Simple pricing. No surprises.</h2>
            <p className="mt-3 text-muted-foreground text-[17px]">Everything included in one plan. Or partner with us for a custom deal.</p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Pro plan */}
            <ScrollReveal>
              <div className="relative p-8 rounded-2xl border-2 border-primary bg-white shadow-xl shadow-primary/[0.15] h-full flex flex-col card-hover">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-white text-xs font-bold">
                  Most popular
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-foreground mb-1">Pro</h3>
                  <p className="text-5xl font-black text-foreground">$5<span className="text-lg font-normal text-muted-foreground">/user/mo</span></p>
                  <p className="text-[13px] text-muted-foreground mt-2">14-day free trial · No credit card · Cancel anytime</p>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-left mb-8 flex-1">
                  {[
                    "Unlimited review cycles",
                    "360° reviews via Slack",
                    "9-box calibration",
                    "Competency frameworks",
                    "Goal & OKR tracking",
                    "Pulse surveys & eNPS",
                    "Competency heatmaps",
                    "Performance rankings",
                    "Smart Slack reminders",
                    "Recurring check-ins",
                    "CSV team import",
                    "Trend analytics",
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-1.5 text-[13px] text-muted-foreground py-0.5">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                <Button className="w-full" size="lg" asChild>
                  <a href={addToSlackUrl}>
                    <Slack className="h-4 w-4 mr-2" />
                    Start free trial
                  </a>
                </Button>
              </div>
            </ScrollReveal>

            {/* Partner programme */}
            <ScrollReveal delay={80}>
              <div className="relative p-8 rounded-2xl border border-border/60 bg-gradient-to-br from-[#faf8f2] to-white h-full flex flex-col card-hover">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-foreground mb-1">Partners Programme</h3>
                  <p className="text-4xl font-black text-foreground">Let&apos;s talk</p>
                  <p className="text-[13px] text-muted-foreground mt-2">For early adopters who want to shape the product</p>
                </div>

                <div className="text-left mb-8 flex-1 space-y-4">
                  <p className="text-[15px] text-muted-foreground leading-relaxed">
                    Join a small group of launch partners shaping Nami from the ground up. Get early access, direct input on the roadmap, and a product built around your workflow.
                  </p>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">
                    We&apos;re looking for teams who care about performance management and want to be part of building something great.
                  </p>
                  <p className="text-[13px] text-muted-foreground/70 italic">
                    Limited spots available.
                  </p>
                </div>

                <Button variant="outline" className="w-full" size="lg" asChild>
                  <a href="mailto:hello@namihr.com">
                    <Send className="h-4 w-4 mr-2" />
                    Inquire about the programme
                  </a>
                </Button>
                <p className="text-center text-xs text-muted-foreground mt-3">hello@namihr.com</p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Roadmap callout ── */}
      <ScrollReveal>
        <div className="max-w-5xl mx-auto px-6 pb-16 -mt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-border/60 bg-gradient-to-r from-primary/[0.04] to-background p-6 sm:p-8">
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-bold text-foreground">Missing a feature that would make you switch?</h3>
              <p className="mt-1.5 text-[15px] text-muted-foreground">Check our public roadmap — or suggest it and we&apos;ll build it.</p>
            </div>
            <Button variant="outline" className="shrink-0 rounded-full px-6" asChild>
              <Link href="/roadmap">
                View Roadmap <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </ScrollReveal>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#faf8f2] via-background to-[#f5f5f0] py-20">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <ScrollReveal>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground tracking-tight max-w-2xl mx-auto leading-[1.1]">
              Ready to let Nami handle your{" "}
              <span className="text-primary">performance management?</span>
            </h2>
            <p className="mt-5 text-muted-foreground text-lg max-w-lg mx-auto">
              Add Nami to your Slack workspace in under a minute. She&apos;ll handle reviews, goals, surveys, and analytics — so you don&apos;t have to.
            </p>
            <div className="mt-10">
              <Button size="lg" className="h-13 px-8 text-base font-semibold btn-glow" asChild>
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
              <span className="text-lg font-bold text-foreground">Nami</span>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-muted-foreground/60 hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="text-muted-foreground/60 hover:text-foreground transition-colors">Terms</Link>
              <Link href="/support" className="text-muted-foreground/60 hover:text-foreground transition-colors">Support</Link>
              <Link href="/roadmap" className="text-muted-foreground/60 hover:text-foreground transition-colors">Roadmap</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
