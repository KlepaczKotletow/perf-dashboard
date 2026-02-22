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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">P</span>
            </div>
            <span className="font-semibold tracking-tight">Perf</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <a
              href={signInWithSlackUrl}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background text-xs text-muted-foreground mb-6">
            <Slack className="h-3.5 w-3.5" />
            Built for Slack-first teams
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-foreground leading-[1.1]">
            Performance reviews
            <br />
            <span className="text-primary">people actually complete</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Run 360 reviews, track competencies, and give continuous feedback
            -- all from where your team already works.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Button size="lg" className="h-11 px-6 text-sm" asChild>
              <a href={addToSlackUrl}>
                <Slack className="h-4 w-4 mr-2" />
                Add to Slack
              </a>
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-6 text-sm" asChild>
              <a href={signInWithSlackUrl}>
                Sign in with Slack
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <ScrollReveal className="text-center mb-14">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">How it works</p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Up and running in minutes</h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto text-[15px]">
            No lengthy onboarding. No training required. Just add Perf to Slack and you&apos;re set.
          </p>
        </ScrollReveal>

        <div className="relative">
          {/* Connector line — desktop only */}
          <div className="hidden lg:block absolute top-[38px] left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] h-px bg-border" aria-hidden="true" />

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
                    {/* Step number — decorative background */}
                    <span className="absolute -top-3 -left-3 text-[56px] font-black leading-none text-foreground/[0.04] select-none pointer-events-none">
                      {item.step}
                    </span>
                    <div className="h-12 w-12 rounded-xl bg-primary/[0.08] border border-primary/[0.12] flex items-center justify-center relative z-10">
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

      {/* Product Mockup */}
      <section className="max-w-5xl mx-auto px-6 pb-28">
        <ScrollReveal className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">The dashboard</p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Everything in one place</h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto text-[15px]">
            Track cycles, calibrate scores, and explore team performance — all from a clean, focused interface.
          </p>
        </ScrollReveal>

        {/* Browser frame */}
        <ScrollReveal scale className="relative">
          {/* Glow behind frame */}
          <div className="absolute inset-x-12 top-8 bottom-0 bg-primary/[0.06] blur-3xl rounded-full -z-10 pointer-events-none" />

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
                      <span className="text-primary-foreground text-[9px] font-bold">P</span>
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
        </ScrollReveal>
      </section>

      {/* Feature grid */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: MessageSquare,
              title: "Anytime feedback",
              description: "Give praise or constructive feedback with /feedback -- no forms, no friction.",
            },
            {
              icon: Star,
              title: "360 reviews",
              description: "Structured multi-rater reviews with competency ratings, built-in calibration, and deadlines.",
            },
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
              description: "Start reviews in Slack, finish on the web. Or do everything in Slack -- your choice.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group p-5 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-border hover:shadow-sm transition-all"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/[0.08] flex items-center justify-center mb-3">
                <feature.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">{feature.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <ScrollReveal className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">What teams say</p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Teams that switched don&apos;t go back</h2>
        </ScrollReveal>

        <div className="grid sm:grid-cols-3 gap-4">
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
              <figure className="group flex flex-col h-full p-6 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-border hover:shadow-sm transition-all duration-200">
                <blockquote className="flex-1">
                  <span className="block text-3xl font-serif leading-none text-primary/40 mb-3 select-none">&ldquo;</span>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{t.quote}</p>
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 pt-4 border-t border-border/50">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.role} · {t.company}</p>
                  </div>
                </figcaption>
              </figure>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Social proof / trust strip */}
      <section className="border-t border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Built for the way teams actually work
            </h2>
            <p className="mt-3 text-muted-foreground text-[15px]">
              From startups to scale-ups, Perf replaces spreadsheets and clunky HR tools with
              a performance system that lives in Slack and looks great on the web.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 mt-12">
            {[
              { metric: "< 2 min", label: "Average time to complete a review via Slack" },
              { metric: "100%", label: "Workspace data isolation with row-level security" },
              { metric: "Real-time", label: "Analytics, calibration, and 9-box talent grids" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-primary">{stat.metric}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="border-t border-border/50 bg-muted/20">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <ScrollReveal className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Pricing</p>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Simple, transparent pricing</h2>
            <p className="mt-3 text-muted-foreground text-[15px]">Start free. Upgrade when your team is ready.</p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Free tier */}
            <ScrollReveal delay={0}>
              <div className="flex flex-col h-full p-6 rounded-xl border border-border/60 bg-card">
                <p className="text-sm font-semibold text-foreground mb-1">Free</p>
                <p className="text-3xl font-bold text-foreground mb-1">$0</p>
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
              <div className="flex flex-col h-full p-6 rounded-xl border border-primary/30 bg-card shadow-sm shadow-primary/[0.06] relative">
                <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
                  Popular
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Pro</p>
                <p className="text-3xl font-bold text-foreground mb-1">$8<span className="text-base font-normal text-muted-foreground">/user/mo</span></p>
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
                <Link href="/pricing" className="mt-6 inline-flex items-center gap-1 text-[13px] text-primary font-medium hover:underline">
                  See full pricing <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50 bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Ready to upgrade your review process?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Add Perf to your Slack workspace in under a minute.
          </p>
          <Button size="lg" className="mt-6 h-11 px-6 text-sm" asChild>
            <a href={addToSlackUrl}>
              <Slack className="h-4 w-4 mr-2" />
              Add to Slack -- it&apos;s free
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-[10px] font-bold">P</span>
              </div>
              <span>&copy; {new Date().getFullYear()} Perf</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/support" className="text-muted-foreground hover:text-foreground transition-colors">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
