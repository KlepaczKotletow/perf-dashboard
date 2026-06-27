import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { CtaBand } from "@/components/marketing/cta-band";
import { JsonLd } from "@/components/marketing/json-ld";
import { Kicker } from "@/components/marketing/kicker";
import { GlowCard } from "@/components/marketing/glow-card";
import { Spotlight } from "@/components/marketing/spotlight";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { getAddToSlackUrl } from "@/lib/slack-cta";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

const DESCRIPTION =
  "Meet the team behind Nami — the Slack-native performance management tool. Why we built it, what we believe, and the founders behind 360° reviews, goals, and surveys that run inside Slack.";

export const metadata: Metadata = {
  title: "About",
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Nami — performance management, in the flow of work",
    description: DESCRIPTION,
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Nami",
    description: "The team and the thinking behind Slack-native performance management.",
  },
};

type Founder = {
  name: string;
  role: string;
  photo: string;
  bio: string;
  meta: { label: string; value: string }[];
  alumni: string[];
};

const FOUNDERS: Founder[] = [
  {
    name: "Filip Nowakowski",
    role: "Co-founder · Tech & Product",
    photo: "/team/filip-nowakowski.jpg",
    bio: "Filip leads product and engineering. He spent years scaling operations inside high-growth HR and fintech companies, where he saw first-hand how broken performance processes quietly drain teams.",
    meta: [
      { label: "Now", value: "Senior Ops Manager at Deel" },
      { label: "Before", value: "Junior Ops Manager at Revolut" },
      { label: "Studied", value: "MSc Innovation & Entrepreneurship, HEC Paris · BSc Accounting & Finance, Warwick" },
    ],
    alumni: ["HEC Paris", "University of Warwick"],
  },
  {
    name: "Michał Kugacki",
    role: "Co-founder · Strategy & Commercial",
    photo: "/team/michal-kugacki.jpg",
    bio: "Michał leads strategy and commercial. He comes from management consulting and corporate development, building growth and operating models for companies across Europe.",
    meta: [
      { label: "Now", value: "Strategy & Corp Dev at InPost" },
      { label: "Before", value: "Senior Associate at Boston Consulting Group" },
      { label: "Studied", value: "MSc Finance, HEC Paris · BSc Accounting & Finance, Warwick" },
    ],
    alumni: ["HEC Paris", "University of Warwick"],
  },
];

const OLD_WAY = [
  "Open another browser tab",
  "Log in all over again",
  "Hunt for the review cycle",
  "Fill out a long web form",
  "Chase everyone with reminders",
];

const VALUES: { title: string; body: string }[] = [
  {
    title: "Friction is the bottleneck",
    body: "Every extra tab, login, and form is a reason a review never gets finished. We obsess over removing them — the work happens where your team already is.",
  },
  {
    title: "One plan, fair pricing",
    body: "Every feature in a single $5/user plan. No four-figure minimums, no sales-led gauntlet — and free for teams of 10 or fewer.",
  },
  {
    title: "Privacy by default",
    body: "Strict visibility rules, anonymous surveys, and tenant-isolated data enforced at the database layer. Trust is part of the product.",
  },
];

export default function AboutPage() {
  const addToSlackUrl = getAddToSlackUrl("about");

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "About", item: `${SITE_URL}/about` },
    ],
  };

  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Nami",
    url: `${SITE_URL}/about`,
    description: DESCRIPTION,
    mainEntity: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Nami",
      url: SITE_URL,
      logo: `${SITE_URL}/nami-logo.svg`,
      email: "hello@namihr.com",
      sameAs: ["https://www.linkedin.com/company/namihr"],
      founder: FOUNDERS.map((f) => ({
        "@type": "Person",
        name: f.name,
        jobTitle: f.role.replace("Co-founder · ", "Co-founder, "),
        image: `${SITE_URL}${f.photo}`,
        alumniOf: f.alumni.map((name) => ({ "@type": "EducationalOrganization", name })),
      })),
    },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={aboutJsonLd} />
      <SiteHeader ctaPurpose="about" />

      <Masthead
        kicker="About Nami"
        title={
          <>
            Performance management belongs{" "}
            <span className="font-serif-accent text-[hsl(var(--spotlight))]">
              where work already happens
            </span>
          </>
        }
        lead="We're a two-person team rebuilding performance management around one idea: the best tool is the one your team will actually open. So we put reviews, goals, and surveys inside Slack."
      />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          {/* ── Story ── */}
          <section className="grid gap-x-12 gap-y-6 pt-16 sm:pt-20 lg:grid-cols-[10rem_1fr]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Kicker>Our story</Kicker>
            </div>
            <ScrollReveal className="max-w-2xl">
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl">
                Performance management is broken —{" "}
                <span className="font-serif-accent text-primary">not for lack of features.</span>
              </h2>
              <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
                <p>
                  Companies pay for review software, goal trackers, and survey tools, then watch
                  adoption collapse — because every action means another tab, another login, another
                  form. The work lives outside the workflow, so people simply don&apos;t do it.
                </p>
                <p>
                  Nami takes the opposite approach. 360° reviews, OKRs, pulse surveys, and wellbeing
                  check-ins all run from a single conversation in Slack, where your team already
                  spends its day. Managers and HR still get the full picture on the web dashboard;
                  everyone else just answers a DM.
                </p>
              </div>
              <blockquote className="mt-8 border-l-2 border-secondary pl-5 text-xl font-semibold leading-snug text-foreground">
                Friction — not features — is the real bottleneck.
              </blockquote>
            </ScrollReveal>
          </section>

          {/* ── Show, don't tell: the old way vs Nami (two GlowCards) ── */}
          <section className="mt-16 grid gap-4 sm:mt-20 sm:grid-cols-2">
            <ScrollReveal className="h-full">
              <GlowCard className="h-full p-7 sm:p-8">
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                  The old way
                </span>
                <ul className="mt-5 space-y-3">
                  {OLD_WAY.map((step) => (
                    <li key={step} className="flex items-center gap-3 text-[15px] text-muted-foreground">
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                      {step}
                    </li>
                  ))}
                </ul>
              </GlowCard>
            </ScrollReveal>

            {/* "In Nami" — small dark moment with a subtle Spotlight */}
            <ScrollReveal delay={120} className="h-full">
              <div className="relative h-full overflow-hidden rounded-2xl bg-ink-panel p-7 sm:p-8">
                <Spotlight variant="subtle" />
                <div className="relative">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
                    In Nami
                  </span>
                  <p className="mt-5 text-2xl font-bold leading-snug text-white">
                    One Slack DM.
                    <br />
                    Answer.{" "}
                    <span className="font-serif-accent text-[hsl(var(--spotlight))]">Done.</span>
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {["Reviews & 360° feedback", "Goals & OKRs", "Pulse surveys & eNPS", "Wellbeing check-ins"].map(
                      (item) => (
                        <li key={item} className="flex items-center gap-2.5 text-sm text-white/75">
                          <Check className="h-4 w-4 shrink-0 text-[hsl(var(--spotlight))]" />
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </section>

          {/* ── Costly-signal note for buyers ── */}
          <ScrollReveal className="mt-16 sm:mt-20">
            <p className="max-w-3xl border-l-2 border-primary/30 pl-5 text-[17px] leading-relaxed text-foreground">
              Running real reviews is how a company proves it takes its people seriously —{" "}
              <span className="font-serif-accent text-primary">cheap to send with Nami, impossible to fake.</span>{" "}
              When feedback costs a 30-second DM instead of a dreaded annual ritual, doing it
              consistently stops being a budget line and starts being a signal.
            </p>
          </ScrollReveal>

          {/* ── Founders (refined bio cards) ── */}
          <section className="mt-20 sm:mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <div>
                <Kicker className="mb-3">Meet the founders</Kicker>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Two operators,{" "}
                  <span className="font-serif-accent text-primary">one product.</span>
                </h2>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {FOUNDERS.map((f, i) => (
                <ScrollReveal key={f.name} delay={i * 120} className="h-full">
                  <GlowCard className="h-full p-7 sm:p-8">
                    <div className="flex items-start gap-5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.photo}
                        alt={f.name}
                        width={80}
                        height={80}
                        className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-border"
                      />
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold tracking-tight text-foreground">{f.name}</h3>
                        <p className="mt-1 text-sm font-semibold text-primary">{f.role}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {f.alumni.map((school) => (
                            <span
                              key={school}
                              className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                            >
                              {school}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">{f.bio}</p>

                    <dl className="mt-5 space-y-1.5 border-t border-border/50 pt-5">
                      {f.meta.map((m) => (
                        <div key={m.label} className="flex gap-3">
                          <dt className="w-14 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                            {m.label}
                          </dt>
                          <dd className="text-sm text-foreground/80">{m.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </GlowCard>
                </ScrollReveal>
              ))}
            </div>

            <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground/80">
              Eight years of friendship before a single line of code — complementary, not redundant.
              We shipped Nami&apos;s first version in months, without a cent of outside funding, and
              run the company the same way: lean and capital-efficient by default.
            </p>
          </section>

          {/* ── Values (big mono numerals) ── */}
          <section className="mt-20 sm:mt-24">
            <Kicker className="mb-3">What we believe</Kicker>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Three convictions,{" "}
              <span className="font-serif-accent text-primary">no slogans.</span>
            </h2>

            <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-3">
              {VALUES.map((v, i) => (
                <ScrollReveal key={v.title} delay={i * 100}>
                  <div className="flex flex-col">
                    <span className="font-mono text-5xl font-bold leading-none tabular-nums text-primary/25 sm:text-6xl">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">{v.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{v.body}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </section>

          <div className="py-20 sm:py-24">
            <CtaBand
              href={addToSlackUrl}
              title="See it in your own Slack"
              subtitle="Add Nami in about a minute. Free for teams of 10 or fewer, 14-day Pro trial — no credit card."
            />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
