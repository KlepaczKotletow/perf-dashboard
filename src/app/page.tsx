import { Button } from "@/components/ui/button";
import {
  Slack, BarChart3, Users, Star, Check, Target,
  ChevronRight, Bot, Send, ClipboardList, Lock, Globe,
} from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { MobileNav } from "@/components/landing/mobile-nav";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { FeatureTabs } from "@/components/landing/feature-tabs";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";

// addToSlackUrl points at a Supabase edge function that signs the OAuth
// state and 302s to Slack — keep dynamic so the link is always served
// from a request that can hit Supabase.
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

// Single source of truth for the FAQ — rendered as <details> in the section
// below AND emitted as FAQPage JSON-LD for search engines and answer engines.
const FAQ_ITEMS = [
  {
    q: "Where is my data stored and who can see it?",
    a: "Nami runs on Supabase (Postgres + authenticated APIs). Your workspace data is isolated per tenant and enforced at the database layer via row-level security. Only people inside your workspace see your data — we don't share or sell it. EU-region data residency is available on request.",
  },
  {
    q: "What if some of my team doesn't check Slack often?",
    a: "Everything Nami does in Slack also works on the web dashboard at namihr.com. Reviews, goals, and surveys can be completed either way — you can even mix modes within a single cycle. For people who genuinely don't use Slack, managers can run reviews entirely in the dashboard.",
  },
  {
    q: "Can we migrate from Lattice, Leapsome, or 15Five?",
    a: "Yes. We import teams via CSV (or directly from Slack), and competency frameworks can be imported from our library or pasted in from your existing ladder. For Partner Programme customers we'll help with the migration hands-on.",
  },
  {
    q: "How do you handle 360° and upward feedback privately?",
    a: "Strict visibility rules: managers can't see upward feedback until they've submitted their own review, and vice versa. Employees only see results after HR releases grades. Survey responses are anonymous and aggregated — names are never attached to answers.",
  },
  {
    q: "Can I customise the review templates and competency frameworks?",
    a: "Yes. All 8 career frameworks ship fully editable — rename competencies, tweak level descriptors, adjust rating scales (2–5, 1–5, 1–7, anything you want). Review templates work the same way. You can also build your own from scratch.",
  },
  {
    q: "What if we cancel — what happens to our data?",
    a: "You can export everything at any time — reviews, goals, ratings, survey responses — as CSV. On cancellation your data is retained for 30 days in case you come back, then permanently deleted. Audit logs stay available during that window.",
  },
  {
    q: "Do you support multiple Slack workspaces?",
    a: "One Nami workspace corresponds to one Slack workspace. If your company has multiple Slack workspaces (e.g. one per region or business unit), contact us — we support org-level structures for Partner Programme customers.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — 14 days, no credit card. For teams of 10 or fewer, Nami is free indefinitely.",
  },
];

// Structured data for crawlers and answer engines (ChatGPT, Claude, Perplexity,
// Google AI Overviews). Grouped into a single @graph so the entities cross-
// reference each other cleanly.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Nami",
      url: SITE_URL,
      logo: `${SITE_URL}/nami-logo.svg`,
      email: "hello@namihr.com",
      sameAs: ["https://www.linkedin.com/company/namihr"],
      description:
        "Performance management for teams that live in Slack. 360° reviews, OKRs, pulse surveys, and continuous feedback — without leaving Slack.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Nami",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Nami",
      description:
        "Performance management for teams that live in Slack. 360° reviews, OKR tracking, pulse surveys, competency frameworks, 9-box calibration, and analytics — all inside Slack, with a web dashboard for managers and HR.",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Performance Management",
      operatingSystem: "Web, Slack",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: [
        {
          "@type": "Offer",
          name: "Pro",
          price: "5.00",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "5.00",
            priceCurrency: "USD",
            unitText: "user/month",
          },
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/pricing`,
        },
        {
          "@type": "Offer",
          name: "Free for small teams",
          price: "0.00",
          priceCurrency: "USD",
          description: "Free indefinitely for teams of 10 or fewer.",
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/pricing`,
        },
      ],
      featureList: [
        "360° performance reviews via Slack",
        "Goal & OKR tracking with quarterly check-ins",
        "Pulse surveys & eNPS",
        "8 pre-built competency frameworks",
        "9-box calibration",
        "Performance analytics, rankings, and heatmaps",
        "Audit log",
        "Smart Slack reminders",
        "CSV team import",
      ],
    },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default async function Home() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, '');
  // The Add to Slack CTA goes through slack-reinstall on Supabase, which
  // signs the OAuth state with Supabase's OAUTH_STATE_SECRET and 302s to
  // slack.com/oauth/v2/authorize. Signing on Vercel would require a second
  // copy of OAUTH_STATE_SECRET that drifts from Supabase's — see the
  // comment block at the top of supabase/functions/slack-reinstall.
  const addToSlackUrl = `${supabaseUrl}/functions/v1/slack-reinstall?purpose=landing`;
  const signInWithSlackUrl = `${supabaseUrl}/functions/v1/dashboard-auth`;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* JSON-LD for crawlers and AI answer engines. Server-rendered, no
          client-side cost. */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Header + Hero (seamless) ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#fafaf5] via-[#f8f6f0] to-[#fefcf5]">

        {/* Sticky nav */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-[#fafaf5]/80">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[40px] font-black tracking-tight text-foreground">Nami</span>
            </Link>
            <div className="hidden lg:flex items-center gap-6">
              <a href="#features" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Reviews</a>
              <a href="#features" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Goals</a>
              <a href="#features" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Surveys</a>
              <a href="#pricing" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <Link href="/guides" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Guides</Link>
              <Link href="/compare" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Compare</Link>
              <Link href="/roadmap" className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors">Roadmap</Link>
              <a href={signInWithSlackUrl} className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors border border-border rounded-full px-5 py-2">Sign in</a>
              <Button className="rounded-full px-6 h-10 text-[15px]" asChild>
                <AddToSlackLink href={addToSlackUrl}>
                  <Slack className="h-4 w-4 mr-1.5" />
                  Add to Slack
                </AddToSlackLink>
              </Button>
            </div>
            <MobileNav signInUrl={signInWithSlackUrl} addToSlackUrl={addToSlackUrl} />
          </div>
        </header>

        {/* Hero — two-card Deel-style layout */}
        <div className="max-w-7xl mx-auto px-4 lg:px-10 pt-4 pb-4">
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
                    <AddToSlackLink href={addToSlackUrl}>
                      <Slack className="h-4 w-4 mr-2" />
                      Add to Slack — free
                    </AddToSlackLink>
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
                  No credit card · Installs in 60 seconds
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
                    namihr.com/dashboard/analytics
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

      <FeatureTabs />

      {/* ── See it in action — recorded walk-through of every key surface ── */}
      <section id="see-it" className="bg-white border-y border-border/40 py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5">
              See it in action
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-3">
              The actual product, recorded in 30 seconds.
            </h2>
            <p className="text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto">
              No mockups. Every screen below is a clip of the live app, captured from a seeded Acme Corp workspace.
            </p>
          </ScrollReveal>

          {/* Featured: Dashboard — gets the most real-estate */}
          <ScrollReveal className="mb-16 lg:mb-24">
            <figure className="rounded-2xl border border-border/60 overflow-hidden shadow-lg shadow-primary/[0.04] bg-white">
              <div className="bg-muted/80 border-b border-border/60 px-4 py-2 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                  <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                  <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                </div>
                <div className="flex-1 bg-background/70 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
                  namihr.com/dashboard
                </div>
                <figcaption className="text-xs font-semibold text-foreground hidden sm:block">
                  Dashboard <span className="text-muted-foreground font-normal ml-1">— at-a-glance workspace health</span>
                </figcaption>
              </div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                poster="/demo/01-dashboard.jpg"
                className="w-full h-auto block bg-[#fafaf9]"
              >
                {/* MP4 first so iOS Safari picks it up (it ignores some WebM variants). */}
                <source src="/demo/01-dashboard.mp4" type="video/mp4" />
                <source src="/demo/01-dashboard.webm" type="video/webm" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/demo/01-dashboard.gif"
                  alt="Animated walk-through of the Nami dashboard at namihr.com showing workspace health, review completion, and team activity at a glance."
                />
              </video>
            </figure>
          </ScrollReveal>

          {/*
            Supporting demos — full-width alternating "video on one side, copy
            on the other" rows (Stripe / Linear pattern). This buys each video
            ~60% of the section width, which keeps the dashboard text inside
            the recording legible. The 2×2 grid we had before squeezed each
            clip to ~600 px wide and the in-video text became too small.
          */}
          <div className="space-y-16 lg:space-y-24">
            {[
              {
                slug: "02-directory",
                title: "Your whole team, instantly filterable.",
                blurb: "28 people across 4 departments. Search by name, email or title; filter by status, department, or role. No paginated table to thumb through — every employee one keystroke away.",
                alt: "Nami directory view: filtering 28 employees across 4 departments by status, department, and role with instant search results.",
              },
              {
                slug: "03-reviews",
                title: "Every review, every cycle, in one place.",
                blurb: "Standard and upward reviews grouped per cycle, sorted by status. Pending reviews bubble to the top so managers know exactly where the bottleneck is.",
                alt: "Nami performance reviews screen: standard and upward 360° reviews grouped per cycle, with pending reviews surfaced at the top of the list.",
              },
              {
                slug: "04-cycles",
                title: "Quarterly cycles without the spreadsheet.",
                blurb: "Q1 completed, Q2 mid-flight. Self- and manager-completion bars on every cycle row tell you what's done and what's still waiting on someone.",
                alt: "Nami review-cycles screen: Q1 cycle completed, Q2 mid-flight, with self- and manager-completion progress bars on every cycle row.",
              },
              {
                slug: "05-audit",
                title: "Every sensitive change, on the record.",
                blurb: "Read-only history of calibrations, role changes, cycle launches, grade releases. Filter by action, actor, or date range when you need to answer \"who changed what, and when?\"",
                alt: "Nami audit log: read-only history of calibrations, role changes, cycle launches, and grade releases, filterable by action, actor, and date range.",
              },
            ].map((demo, i) => (
              <ScrollReveal key={demo.slug}>
                <div className={`grid lg:grid-cols-12 items-center gap-8 lg:gap-12 ${i % 2 === 1 ? "lg:[&>:first-child]:order-2" : ""}`}>
                  {/* Video tile — 7/12 width on lg */}
                  <figure className="lg:col-span-7 rounded-2xl border border-border/60 overflow-hidden shadow-sm bg-white">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="auto"
                      poster={`/demo/${demo.slug}.jpg`}
                      className="w-full h-auto block bg-[#fafaf9]"
                    >
                      <source src={`/demo/${demo.slug}.mp4`} type="video/mp4" />
                      <source src={`/demo/${demo.slug}.webm`} type="video/webm" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/demo/${demo.slug}.gif`} alt={demo.alt} />
                    </video>
                  </figure>
                  {/* Caption — 5/12 width on lg */}
                  <div className="lg:col-span-5">
                    <h3 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground mb-3">{demo.title}</h3>
                    <p className="text-base lg:text-lg text-muted-foreground leading-relaxed">{demo.blurb}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Template Library ── */}
      <section id="templates" className="bg-[#f8f6f0] border-y border-border/40 py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
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

          {/* All 8 frameworks — visible proof the library is real.
              Only Software Engineering has a matrix preview below, so only
              its chip gets the primary-pill button affordance (even though
              it's not interactive, the visual matches the preview it
              labels). The other 7 are rendered as plain dotted-border text
              labels — muted, no background fill, no border on the pill
              axis, lower opacity — so they clearly read as "items in the
              list" rather than "click to swap the preview below." The CTA
              under the chips tells the user to sign in to actually use
              any of them. */}
          <ScrollReveal className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2 mb-4">
            {[
              "Software Engineering",
              "Product Management",
              "Design",
              "Data & Analytics",
              "Sales",
              "Customer Success",
              "Marketing",
              "People & HR",
            ].map((name, i) =>
              i === 0 ? (
                <span
                  key={name}
                  aria-current="true"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border cursor-default select-none bg-primary/10 text-primary border-primary/30"
                >
                  <Check className="h-3 w-3" aria-hidden />
                  {name}
                </span>
              ) : (
                <span
                  key={name}
                  className="inline-flex items-center text-[12px] text-muted-foreground/70 cursor-default select-none"
                >
                  {name}
                </span>
              ),
            )}
          </ScrollReveal>
          <ScrollReveal className="text-center mb-10">
            <p className="text-[12px] text-muted-foreground">
              All 8 frameworks are included out of the box —
              <Link href="#hero" className="text-primary font-medium hover:underline ml-1">
                get started with Nami
              </Link>
              {" "}to use any of them.
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <p className="text-center text-[13px] text-muted-foreground mb-6">
              8 career frameworks, 30+ review &amp; goal templates — import one-click, customise anything.
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

              {/* Cell-level descriptor — what makes Nami's frameworks different */}
              <div className="px-5 py-4 bg-[#faf9f6] border-t border-border/30 flex items-start gap-3">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold border bg-green-100 text-green-700 border-green-200 shrink-0">4</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Coding &amp; Quality · Staff</p>
                  <p className="text-[13px] text-foreground leading-relaxed">
                    &ldquo;Champions code quality across the team — establishes review standards, introduces static-analysis tooling, and refactors legacy code. Writes code others use as a reference.&rdquo;
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Every cell in every framework has a descriptor like this — so reviews aren&apos;t guesswork.
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="bg-background py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
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

      {/* ── Roadmap callout — as trust signal BEFORE pricing, not between pricing and CTA ── */}
      <ScrollReveal>
        <div className="max-w-5xl mx-auto px-6 pb-8">
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

            {/* Partner programme — visually distinct from a priced plan */}
            <ScrollReveal delay={80}>
              <div className="relative p-8 rounded-2xl border border-border/60 bg-gradient-to-br from-[#faf8f2] to-white h-full flex flex-col card-hover">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider border border-amber-200">
                      <Star className="h-3 w-3" />
                      Applications open
                    </span>
                    <span className="text-[11px] text-muted-foreground">Limited spots</span>
                  </div>
                  <h3 className="text-2xl font-black text-foreground leading-tight">Partners Programme</h3>
                  <p className="text-[14px] text-muted-foreground mt-2 leading-relaxed">
                    For early adopters who want to shape the product &mdash; not just use it.
                  </p>
                </div>

                <div className="text-left mb-8 flex-1 space-y-4">
                  <ul className="space-y-3">
                    {[
                      "Direct line to the founders",
                      "Custom onboarding & data migration",
                      "Roadmap influence — build features with us",
                      "Founding partner pricing, locked in",
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2.5 text-[14px] text-foreground">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button variant="outline" className="w-full" size="lg" asChild>
                  <a href="mailto:hello@namihr.com">
                    <Send className="h-4 w-4 mr-2" />
                    Apply to the programme
                  </a>
                </Button>
                <p className="text-center text-xs text-muted-foreground mt-3">hello@namihr.com</p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Security & Compliance strip ── */}
      <section className="bg-white border-t border-border/30 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-8">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Built for HR, reviewed by IT
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Security and privacy, not an afterthought
            </h2>
          </ScrollReveal>
          <ScrollReveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: Lock,
                  title: "Encrypted in transit & at rest",
                  body: "TLS 1.2+ in transit, AES-256 at rest. Data isolated per workspace.",
                },
                {
                  icon: Users,
                  title: "Role-based access control",
                  body: "Employee / manager / HR / admin — enforced at the database layer, not just the UI.",
                },
                {
                  icon: ClipboardList,
                  title: "Audit logs",
                  body: "Every sensitive action logged: who did it, when, and from where. Exportable anytime.",
                },
                {
                  icon: Globe,
                  title: "GDPR-ready",
                  body: "Data export, delete-on-request, and EU-region data residency available.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border/60 bg-white p-5">
                  <div className="h-9 w-9 rounded-lg bg-primary/[0.08] flex items-center justify-center mb-3">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
            <p className="text-center mt-6 text-xs text-muted-foreground/80">
              EU-hosted on SOC 2 attested infrastructure · Anonymous survey responses · Strict upward-feedback visibility rules
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-[#faf9f6] border-t border-border/30 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5">
              FAQ
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Questions we get a lot</h2>
            <p className="mt-3 text-muted-foreground text-[15px]">Don&apos;t see yours? Email <a href="mailto:hello@namihr.com" className="text-primary underline-offset-2 hover:underline">hello@namihr.com</a>.</p>
          </ScrollReveal>

          <ScrollReveal>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-border/60 bg-white overflow-hidden"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                    <span className="text-[15px] font-semibold text-foreground">{item.q}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-5 pb-5 pt-1 text-[14px] text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
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
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground tracking-tight max-w-2xl mx-auto leading-[1.1]">
              Ready to let Nami handle your{" "}
              <span className="text-primary">performance management?</span>
            </h2>
            <p className="mt-5 text-muted-foreground text-lg max-w-lg mx-auto">
              Add Nami to your Slack workspace in under a minute. She&apos;ll handle reviews, goals, surveys, and analytics — so you don&apos;t have to.
            </p>
            <div className="mt-10">
              <Button size="lg" className="h-13 px-8 text-base font-semibold btn-glow" asChild>
                <AddToSlackLink href={addToSlackUrl}>
                  <Slack className="h-5 w-5 mr-2" />
                  Add to Slack — it&apos;s free
                </AddToSlackLink>
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
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <Link href="/guides" className="text-muted-foreground/60 hover:text-foreground transition-colors">Guides</Link>
              <Link href="/compare" className="text-muted-foreground/60 hover:text-foreground transition-colors">Compare</Link>
              <Link href="/privacy" className="text-muted-foreground/60 hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="text-muted-foreground/60 hover:text-foreground transition-colors">Terms</Link>
              <Link href="/security" className="text-muted-foreground/60 hover:text-foreground transition-colors">Security</Link>
              <Link href="/support" className="text-muted-foreground/60 hover:text-foreground transition-colors">Support</Link>
              <Link href="/roadmap" className="text-muted-foreground/60 hover:text-foreground transition-colors">Roadmap</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
