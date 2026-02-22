import { Button } from "@/components/ui/button";
import { Slack, Zap, Shield, BarChart3, MessageSquare, Users, Star, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

export default function Home() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zhfvxfvmdlpdfgxrwtdn.supabase.co").replace(/\/+$/, '');
  const slackClientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
  const slackRedirectUri = `${supabaseUrl}/functions/v1/slack-oauth`;
  const addToSlackUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=app_mentions:read,chat:write,commands,im:history,im:read,im:write,users:read,users:read.email&redirect_uri=${encodeURIComponent(slackRedirectUri)}`;
  const signInWithSlackUrl = `${supabaseUrl}/functions/v1/dashboard-auth`;

  const heroFeatures = [
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
  ];

  const gridFeatures = [
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
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Header — dark, anchors into hero */}
      <header className="border-b border-white/[0.08] backdrop-blur-md bg-[oklch(0.11_0.014_30)]/92 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="font-semibold tracking-tight text-white">Perf</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="text-sm text-white/55 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <a
              href={signInWithSlackUrl}
              className="text-sm text-white/55 hover:text-white transition-colors"
            >
              Sign in
            </a>
            <Button size="sm" asChild>
              <a href={addToSlackUrl}>
                <Slack className="h-3.5 w-3.5 mr-1" />
                Add to Slack
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero — dark, two-column */}
      <section className="bg-[oklch(0.11_0.014_30)] px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 items-end">

            {/* Left: text content */}
            <div className="py-20 lg:py-24">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/[0.06] text-xs text-white/65 mb-8">
                <Slack className="h-3.5 w-3.5 text-primary" />
                Built for Slack-first teams
              </div>

              <h1 className="text-5xl sm:text-[60px] lg:text-[64px] font-bold tracking-tight text-white leading-[1.05]">
                Performance<br />
                reviews{" "}
                <span className="text-primary">people</span>
                <br />actually complete
              </h1>

              <p className="mt-6 text-lg text-white/55 leading-relaxed max-w-[420px]">
                Run 360 reviews, track competencies, and give continuous feedback —
                all from where your team already works.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-3 mt-10">
                <Button size="lg" className="h-12 px-7 text-sm font-semibold" asChild>
                  <a href={addToSlackUrl}>
                    <Slack className="h-4 w-4 mr-2" />
                    Add to Slack
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12 px-7 text-sm text-white/65 hover:text-white hover:bg-white/[0.08] border border-white/15"
                  asChild
                >
                  <a href={signInWithSlackUrl}>Sign in with Slack</a>
                </Button>
              </div>

              <p className="mt-8 text-xs text-white/30 tracking-wide">
                Free to start · No credit card required · Installs in 60 seconds
              </p>
            </div>

            {/* Right: mockup — desktop only, bleeds into next section */}
            <div className="hidden lg:block relative pt-10">
              {/* Coral ambient glow */}
              <div className="absolute -inset-6 bg-primary/[0.08] blur-3xl rounded-full -z-10 pointer-events-none" />

              {/* Browser frame — no bottom rounded corners, bleeds into How it Works */}
              <div className="rounded-t-2xl border border-white/[0.10] border-b-0 overflow-hidden shadow-2xl shadow-black/50">
                {/* Browser chrome — dark */}
                <div className="bg-[oklch(0.17_0.016_30)] border-b border-white/[0.08] px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-white/20" />
                    <div className="h-3 w-3 rounded-full bg-white/15" />
                    <div className="h-3 w-3 rounded-full bg-white/15" />
                  </div>
                  <div className="flex-1 bg-white/[0.06] rounded-md px-3 py-1 text-[11px] text-white/40 font-mono">
                    app.perf.team/dashboard/cycles
                  </div>
                </div>

                {/* App shell — light bg so existing mockup renders correctly */}
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

                    {/* Main content */}
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

                      {/* Progress bar */}
                      <div className="h-1.5 bg-muted rounded-full mb-6 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "73%" }} />
                      </div>

                      {/* Competency grid */}
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

                      {/* Review assignments */}
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
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* How it Works — light, breather after dark hero */}
      <section className="max-w-5xl mx-auto px-6 py-28">
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
          {/* Connector line — desktop only */}
          <div className="hidden lg:block absolute top-[38px] left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] h-px bg-primary/25" aria-hidden="true" />

          <ol className="grid sm:grid-cols-3 gap-8 lg:gap-12 relative">
            {[
              {
                step: "01",
                icon: Slack,
                title: "Add Perf to Slack",
                description: "Click 'Add to Slack' and authorize Perf in your workspace. Takes under 60 seconds.",
              },
              {
                step: "02",
                icon: Users,
                title: "Set up your team",
                description: "Perf syncs your Slack members automatically. Assign managers and define reporting lines.",
              },
              {
                step: "03",
                icon: BarChart3,
                title: "Launch your first cycle",
                description: "Pick a template, set a deadline, and Perf handles assignments, reminders, and collection.",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 120}>
                <li className="flex flex-col items-center text-center sm:items-start sm:text-left">
                  <div className="relative mb-5">
                    {/* Step number — coral at low opacity */}
                    <span className="absolute -top-3 -left-3 text-[56px] font-black leading-none text-primary/[0.12] select-none pointer-events-none">
                      {item.step}
                    </span>
                    <div className="h-12 w-12 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center relative z-10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-[15px] text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>
                </li>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Dashboard Mockup — mobile only (lg: it lives in hero right column) */}
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
            {/* Browser chrome */}
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

            {/* App shell */}
            <div className="flex h-[340px] sm:h-[400px] overflow-hidden">
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

              {/* Main content */}
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

      {/* Features — dark section, bold text layout */}
      <section className="bg-[oklch(0.13_0.014_30)] py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="mb-12">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.08] text-primary text-xs font-semibold mb-5">
              Everything you need
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Built for how teams actually work
            </h2>
          </ScrollReveal>

          {/* Two large hero features */}
          <div className="grid sm:grid-cols-2 gap-px bg-white/[0.06] rounded-2xl overflow-hidden mb-px">
            {heroFeatures.map((f) => (
              <ScrollReveal key={f.title}>
                <div className="bg-[oklch(0.13_0.014_30)] p-10">
                  <f.icon className="h-6 w-6 text-primary mb-6" />
                  <h3 className="text-2xl font-bold text-white mb-3">{f.title}</h3>
                  <p className="text-white/55 leading-relaxed">{f.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Four smaller features */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] rounded-b-2xl overflow-hidden">
            {gridFeatures.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 60}>
                <div className="bg-[oklch(0.13_0.014_30)] p-7">
                  <f.icon className="h-5 w-5 text-primary/70 mb-4" />
                  <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{f.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — dark */}
      <section className="bg-[oklch(0.11_0.014_30)] py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.08] text-primary text-xs font-semibold mb-5">
              What teams say
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
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
                <figure className="flex flex-col h-full p-7 rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                  <blockquote className="flex-1">
                    <span className="block text-5xl font-serif leading-none text-primary mb-5 select-none">&ldquo;</span>
                    <p className="text-[15px] leading-relaxed text-white/70">{t.quote}</p>
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 pt-5 border-t border-white/[0.08]">
                    <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {t.initial}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-white/45">{t.role} · {t.company}</p>
                    </div>
                  </figcaption>
                </figure>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip — medium dark */}
      <section className="bg-[oklch(0.16_0.016_30)] py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-10 text-center">
            {[
              { metric: "< 2 min", label: "Average time to complete a review via Slack" },
              { metric: "100%", label: "Workspace data isolation with row-level security" },
              { metric: "Real-time", label: "Analytics, calibration, and 9-box talent grids" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl font-black text-primary">{stat.metric}</p>
                <p className="mt-2 text-sm text-white/50 max-w-[200px] mx-auto">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — light, functional */}
      <section className="bg-background border-t border-border/30">
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
                <Link href="/pricing" className="mt-6 inline-flex items-center gap-1 text-[13px] text-primary font-semibold hover:text-primary/80 transition-colors">
                  See full pricing <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA — dark, bold */}
      <section className="bg-[oklch(0.11_0.014_30)] py-28">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <ScrollReveal>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight max-w-2xl mx-auto leading-[1.1]">
              Ready to make reviews{" "}
              <span className="text-primary">actually happen?</span>
            </h2>
            <p className="mt-5 text-white/55 text-lg max-w-md mx-auto">
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
            <p className="mt-6 text-xs text-white/30">No credit card. No setup fee. Cancel anytime.</p>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer — continuous dark band with CTA */}
      <footer className="bg-[oklch(0.11_0.014_30)] border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5 text-sm text-white/50">
              <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">P</span>
              </div>
              <span className="font-semibold text-white/70">Perf</span>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-white/35 hover:text-white/70 transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-white/35 hover:text-white/70 transition-colors">
                Terms
              </Link>
              <Link href="/support" className="text-white/35 hover:text-white/70 transition-colors">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
