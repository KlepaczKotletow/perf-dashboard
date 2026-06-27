import { Button } from "@/components/ui/button";
import {
  Slack, BarChart3, Users, Star, Check, Target,
  ChevronRight, Bot, Send, ClipboardList, Lock, Globe,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { FloatingNav } from "@/components/marketing/floating-nav";
import { FeatureBento } from "@/components/landing/feature-bento";
import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Spotlight } from "@/components/marketing/spotlight";
import { Kicker } from "@/components/marketing/kicker";
import { StatFigure } from "@/components/marketing/stat-figure";
import { GlowCard } from "@/components/marketing/glow-card";
import { Marquee } from "@/components/marketing/marquee";
import { SlackCtaButton } from "@/components/marketing/slack-cta-button";
import { Accordion } from "@/components/marketing/accordion";

// addToSlackUrl points at a Supabase edge function that signs the OAuth
// state and 302s to Slack — keep dynamic so the link is always served
// from a request that can hit Supabase.
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

// Single source of truth for the FAQ — rendered as an Accordion in the section
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

// Honest "capabilities ticker" — every item is a real, shipped feature (no
// fake customer logos; we don't claim a live Marketplace listing).
const CAPABILITY_TICKER = [
  "360° reviews", "OKR & goal tracking", "Pulse surveys", "eNPS",
  "9-box calibration", "8 career frameworks", "Competency heatmaps",
  "Recurring check-ins", "Performance rankings", "Audit log",
  "CSV team import", "Web dashboard", "Slack-native",
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
    <div className="min-h-screen bg-background">

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

      <FloatingNav ctaPurpose="landing" />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/30">

        {/* Aceternity-style light hero texture: faint diagonal hairlines + amber accent dots */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-diagonal-lines [mask-image:radial-gradient(ellipse_75%_70%_at_50%_25%,#000,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute left-[8%] top-[40%] h-1.5 w-1.5 rounded-full bg-secondary/70" />
        <div aria-hidden className="pointer-events-none absolute right-[11%] top-[22%] h-1 w-1 rounded-full bg-secondary/60" />
        <div aria-hidden className="pointer-events-none absolute left-[46%] bottom-[14%] h-1 w-1 rounded-full bg-secondary/50" />

        {/* Hero — two-card layout (kept). Left dark "moment" with copy; right
            light card with the founder-loved dashboard mockup. */}
        <div className="relative max-w-7xl mx-auto px-4 lg:px-10 pt-4 pb-4">
          <div className="grid lg:grid-cols-2 gap-3 min-h-[520px] lg:min-h-[580px]">

            {/* Left card — dark moment with the provocative headline */}
            <div className="relative rounded-3xl bg-ink-panel overflow-hidden p-8 sm:p-10 lg:p-12 flex flex-col justify-between">
              <Spotlight />

              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-card/5 text-xs text-white/70 mb-7">
                  <Bot className="h-3.5 w-3.5 text-[hsl(var(--spotlight))]" />
                  360° reviews · OKRs · pulse — without leaving Slack
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[60px] font-bold tracking-tight text-white leading-[1.05]">
                  Reviews your team{" "}
                  <span className="font-serif-accent text-[hsl(var(--spotlight))]">forgets to dread.</span>
                </h1>

                <p className="mt-6 text-lg text-white/60 leading-relaxed max-w-[480px]">
                  Nami runs reviews, goals, surveys, and check-ins from inside Slack —
                  answered in a DM between two messages from the people you actually
                  work with. When taking part stops feeling like homework, completion
                  stops being your problem.
                </p>
              </div>

              <div className="relative mt-8">
                <div className="flex flex-col sm:flex-row items-start gap-3">
                  <SlackCtaButton href={addToSlackUrl}>Add to Slack — free</SlackCtaButton>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-12 px-7 text-sm text-white/60 hover:text-white hover:bg-card/10 border border-white/15 rounded-full"
                    asChild
                  >
                    <a href={signInWithSlackUrl}>Sign in with Slack</a>
                  </Button>
                </div>
                <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/35 tracking-wide">
                  <span>No credit card · Installs in 60 seconds</span>
                  <span className="hidden sm:inline text-white/15">|</span>
                  <span className="text-white/45">Reviews your team will actually complete — ~95% vs the 40–60% norm.</span>
                </p>
              </div>
            </div>

            {/* Right card — light, holds the kept dashboard mockup with a faint
                cool-blue glow behind it so it pops against the dark card. */}
            <div className="relative rounded-3xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-secondary/[0.06] overflow-hidden flex items-stretch">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 left-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-[hsl(var(--spotlight)/0.22)] blur-3xl"
              />
              <DashboardMockup className="relative m-3 w-full" />
            </div>

          </div>
        </div>

        {/* Capabilities ticker — honest infinite marquee of real features */}
        <div className="max-w-7xl mx-auto px-4 lg:px-10 pb-6">
          <Marquee className="py-2" duration="52s">
            {CAPABILITY_TICKER.map((cap) => (
              <span
                key={cap}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-sm font-medium text-muted-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                {cap}
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ── The reframe — friction, not features ── */}
      <section className="bg-card border-y border-border/40 py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
            <ScrollReveal>
              <Kicker className="mb-6">The reframe</Kicker>
              <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-foreground leading-[1.08]">
                Your last performance tool didn&apos;t fail.{" "}
                <span className="font-serif-accent text-primary">It just asked too much.</span>
              </h2>
              <p className="mt-6 text-[17px] leading-relaxed text-muted-foreground max-w-xl">
                Companies buy review software, goal trackers, and survey tools — then
                watch adoption collapse. Not because the features are wrong, but because
                every action means another tab, another login, another form nobody opens.
                The work lives outside the workflow, so people simply don&apos;t do it.
              </p>
              <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground max-w-xl">
                Nami takes the opposite bet. The smallest thing that still works — one
                question, in the place your team already is — beats the most
                comprehensive system nobody finishes.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <GlowCard className="p-7">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">The old way</p>
                    <ul className="mt-4 space-y-2.5 text-[13.5px] text-muted-foreground">
                      {["Open another tab", "Log in again", "Hunt for the cycle", "Fill a long web form", "Chase everyone for weeks"].map((x) => (
                        <li key={x} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-primary/80">In Nami</p>
                    <ul className="mt-4 space-y-2.5 text-[13.5px] text-foreground">
                      {["A Slack DM arrives", "Answer in the thread", "It logs itself", "Done in 30 seconds", "Nami chases, not you"].map((x) => (
                        <li key={x} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </GlowCard>
            </ScrollReveal>
          </div>

          {/* Research-backed stats — honest proof, demoted below the promise */}
          <ScrollReveal className="mt-16 lg:mt-20 border-t border-border/50 pt-12">
            <p className="text-center font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-10">
              Why this matters — backed by research, not vibes
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
              {[
                { value: "23%", label: "higher profitability", sub: "at companies with engaged employees", source: "Gallup, 2024" },
                { value: "4.2×", label: "more likely to outperform", sub: "competitors, with robust performance management", source: "McKinsey" },
                { value: "$438B", label: "lost to disengagement", sub: "in global productivity annually", source: "Gallup, 2024" },
                { value: "51%", label: "lower turnover", sub: "at organisations with high engagement", source: "Gallup, 2024" },
              ].map((item) => (
                <StatFigure key={item.value} {...item} className="text-center" />
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Feature bento — every card shows real Nami UI ── */}
      <FeatureBento />

      {/* ── See it in action — recorded walk-through of every key surface ── */}
      <section id="see-it" className="bg-card border-y border-border/40 py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-12 max-w-2xl mx-auto">
            <Kicker className="mb-5 justify-center">See it in action</Kicker>
            <h2 className="text-3xl lg:text-[44px] font-bold tracking-tight text-foreground mb-3 leading-[1.08]">
              The actual product —{" "}
              <span className="font-serif-accent text-primary">not a mockup in sight.</span>
            </h2>
            <p className="text-base lg:text-lg text-muted-foreground">
              Every screen below is a clip of the live app, captured in a seeded Acme Corp
              workspace — real UI, real data, the whole tour in about two minutes.
            </p>
          </ScrollReveal>

          {/* Featured: Dashboard — gets the most real-estate */}
          <ScrollReveal className="mb-16 lg:mb-24">
            <figure className="rounded-2xl border border-border/60 overflow-hidden shadow-lg shadow-primary/[0.04] bg-card">
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
            the recording legible.
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
                  <figure className="lg:col-span-7 rounded-2xl border border-border/60 overflow-hidden shadow-sm bg-card">
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
      <section id="templates" className="bg-muted/40 border-b border-border/40 py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-10 max-w-2xl mx-auto">
            <Kicker className="mb-5 justify-center">Template Library</Kicker>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-foreground leading-[1.08]">
              Don&apos;t build frameworks from scratch —{" "}
              <span className="font-serif-accent text-primary">use ours.</span>
            </h2>
            <p className="mt-3 text-muted-foreground text-[17px]">
              Pre-built by HR researchers. Import in one click. Customise to fit your org.
            </p>
          </ScrollReveal>

          {/* All 8 frameworks as a marquee — visible proof the library is real */}
          <ScrollReveal className="mb-10">
            <Marquee duration="50s">
              {[
                "Software Engineering", "Product Management", "Design", "Data & Analytics",
                "Sales", "Customer Success", "Marketing", "People & HR",
              ].map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium text-foreground"
                >
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  {name}
                </span>
              ))}
            </Marquee>
            <p className="mt-5 text-center text-[12px] text-muted-foreground">
              All 8 frameworks are included out of the box —
              <Link href="#templates" className="text-primary font-medium hover:underline ml-1">
                get started with Nami
              </Link>{" "}
              to use any of them. 30+ review &amp; goal templates too.
            </p>
          </ScrollReveal>

          {/* Matrix preview — Software Engineering */}
          <ScrollReveal>
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
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
              <div className="px-5 py-4 bg-muted/40 border-t border-border/30 flex items-start gap-3">
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

      {/* ── Heartbeat moment (dark) — annual verdict → ambient ritual ── */}
      <section className="relative overflow-hidden bg-ink-panel py-20 lg:py-28">
        <Spotlight />
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <ScrollReveal>
            <Kicker onDark className="mb-6 justify-center">A different shape of feedback</Kicker>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.08] max-w-3xl mx-auto">
              A heartbeat,{" "}
              <span className="font-serif-accent text-[hsl(var(--spotlight))]">not a verdict.</span>
            </h2>
            <p className="mt-5 text-lg text-white/60 leading-relaxed max-w-xl mx-auto">
              The dreaded annual review is a high-stakes, once-a-year judgment. Nami turns
              the same data into a quiet, frequent rhythm your team barely notices — so
              good work gets seen as it happens, not eulogised twelve months later.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={120} className="mt-12">
            <svg viewBox="0 0 1200 120" className="w-full h-20 sm:h-24" preserveAspectRatio="none" aria-hidden>
              <path
                className="pulse-line"
                d="M0,60 H260 l18,-34 l16,68 l16,-58 l14,24 H560 l18,-34 l16,68 l16,-58 l14,24 H860 l18,-34 l16,68 l16,-58 l14,24 H1200"
                fill="none"
                stroke="hsl(var(--spotlight))"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ScrollReveal>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="bg-background py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-14 max-w-xl mx-auto">
            <Kicker className="mb-5 justify-center">How it works</Kicker>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-foreground leading-[1.08]">Up and running in minutes</h2>
            <p className="mt-3 text-muted-foreground text-[17px]">
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
                      <div className="h-14 w-14 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center">
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

      {/* ── Roadmap callout — trust signal BEFORE pricing ── */}
      <ScrollReveal>
        <div className="max-w-5xl mx-auto px-6 pb-8">
          <GlowCard className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 sm:p-8">
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-bold text-foreground">Missing a feature that would make you switch?</h3>
              <p className="mt-1.5 text-[15px] text-muted-foreground">Check our public roadmap — or suggest it and we&apos;ll build it.</p>
            </div>
            <Button variant="outline" className="shrink-0 rounded-full px-6" asChild>
              <Link href="/roadmap">
                View Roadmap <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </GlowCard>
        </div>
      </ScrollReveal>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-background border-t border-border/30">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <ScrollReveal className="text-center mb-12 max-w-xl mx-auto">
            <Kicker className="mb-5 justify-center">Pricing</Kicker>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-foreground leading-[1.08]">Less performance management. More performance.</h2>
            <p className="mt-3 text-muted-foreground text-[17px]">One plan, one price. Free for teams of 10 or fewer — or partner with us for a custom deal.</p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
            {/* Pro plan — elevated with animated border */}
            <ScrollReveal className="h-full">
              <div className="animated-border h-full rounded-2xl">
                <div className="relative flex h-full flex-col rounded-2xl border border-primary/20 bg-card p-8 shadow-xl shadow-primary/[0.12]">
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

                  <SlackCtaButton href={addToSlackUrl} animated={false} className="w-full">Start free trial</SlackCtaButton>
                </div>
              </div>
            </ScrollReveal>

            {/* Partner programme — visually distinct from a priced plan */}
            <ScrollReveal delay={80} className="h-full">
              <GlowCard className="h-full bg-gradient-to-br from-[#faf8f2] to-white p-8">
                <div className="flex h-full flex-col">
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

                  <Button variant="outline" className="w-full rounded-full" size="lg" asChild>
                    <a href="mailto:hello@namihr.com">
                      <Send className="h-4 w-4 mr-2" />
                      Apply to the programme
                    </a>
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-3">hello@namihr.com</p>
                </div>
              </GlowCard>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Security & Compliance strip ── */}
      <section className="bg-card border-t border-border/30 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-8 max-w-xl mx-auto">
            <Kicker className="mb-3 justify-center">Built for HR, reviewed by IT</Kicker>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
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
                <GlowCard key={item.title} className="p-5">
                  <div className="h-9 w-9 rounded-lg bg-primary/[0.08] flex items-center justify-center mb-3">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">{item.body}</p>
                </GlowCard>
              ))}
            </div>
            <p className="text-center mt-6 text-xs text-muted-foreground/80">
              EU-hosted on SOC 2 attested infrastructure · Anonymous survey responses · Strict upward-feedback visibility rules
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-muted/40 border-t border-border/30 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10 max-w-xl mx-auto">
            <Kicker className="mb-5 justify-center">FAQ</Kicker>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Questions we get a lot</h2>
            <p className="mt-3 text-muted-foreground text-[15px]">Don&apos;t see yours? Email <a href="mailto:hello@namihr.com" className="text-primary underline-offset-2 hover:underline">hello@namihr.com</a>.</p>
          </ScrollReveal>

          <ScrollReveal>
            <Accordion items={FAQ_ITEMS} />
          </ScrollReveal>
        </div>
      </section>

      {/* ── Closing CTA (dark moment) ── */}
      <section className="bg-background py-16">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-3xl bg-ink-panel px-8 py-16 text-center sm:py-20">
            <Spotlight />
            <div className="relative">
              <ScrollReveal>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight max-w-2xl mx-auto leading-[1.08]">
                  Give your team the review{" "}
                  <span className="font-serif-accent text-[hsl(var(--spotlight))]">they forget to dread.</span>
                </h2>
                <p className="mt-5 text-white/60 text-lg max-w-lg mx-auto leading-relaxed">
                  Add Nami to your Slack workspace in under a minute. Free for teams of 10
                  or fewer, 14-day Pro trial — no credit card.
                </p>
                <div className="mt-9 flex justify-center">
                  <SlackCtaButton href={addToSlackUrl}>Add to Slack — it&apos;s free</SlackCtaButton>
                </div>
                <p className="mt-6 text-xs text-white/35">No credit card. No setup fee. Cancel anytime.</p>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
