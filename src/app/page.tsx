import { Button } from "@/components/ui/button";
import { Slack, Zap, Shield, BarChart3, MessageSquare, Users, Star } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zhfvxfvmdlpdfgxrwtdn.supabase.co";
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
