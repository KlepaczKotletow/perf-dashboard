import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { CtaBand } from "@/components/marketing/cta-band";
import { JsonLd } from "@/components/marketing/json-ld";
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
            <span className="text-primary text-shimmer">where work already happens</span>
          </>
        }
        lead="We're a two-person team rebuilding performance management around one idea: the best tool is the one your team will actually open. So we put reviews, goals, and surveys inside Slack."
      />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          {/* ── Story ── */}
          <section className="grid gap-x-12 gap-y-6 pt-16 sm:pt-20 lg:grid-cols-[10rem_1fr]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Our story
              </span>
            </div>
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Performance management is broken — and not for lack of features.
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
            </div>
          </section>

          {/* ── Show, don't tell: the old way vs Nami ── */}
          <section className="mt-16 grid gap-4 sm:mt-20 sm:grid-cols-2">
            <div className="rounded-2xl bg-muted/50 p-7 sm:p-8">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
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
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-[#1a1a2e] p-7 sm:p-8">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-12 right-0 h-56 w-56 rounded-full bg-gradient-to-bl from-primary/25 to-transparent blur-3xl animate-orb-drift"
              />
              <div className="relative">
                <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                  In Nami
                </span>
                <p className="mt-5 text-2xl font-bold leading-snug text-white">
                  One Slack DM.
                  <br />
                  Answer. Done.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {["Reviews & 360° feedback", "Goals & OKRs", "Pulse surveys & eNPS", "Wellbeing check-ins"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm text-white/75">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </section>

          {/* ── Founders ── */}
          <section className="mt-20 sm:mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Meet the founders</h2>
              <span className="text-sm text-muted-foreground/70">Two operators · one product</span>
            </div>

            <div className="mt-6 divide-y divide-border border-t border-border">
              {FOUNDERS.map((f) => (
                <div key={f.name} className="grid gap-6 py-10 sm:grid-cols-[auto_1fr] sm:gap-9">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.photo}
                    alt={f.name}
                    width={128}
                    height={128}
                    className="h-28 w-28 rounded-2xl object-cover ring-1 ring-border"
                  />
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">{f.name}</h3>
                    <span aria-hidden className="mt-2 block h-0.5 w-9 rounded-full bg-secondary" />
                    <p className="mt-2.5 text-sm font-semibold text-primary">{f.role}</p>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                      {f.bio}
                    </p>
                    <dl className="mt-5 space-y-1.5">
                      {f.meta.map((m) => (
                        <div key={m.label} className="flex gap-3">
                          <dt className="w-14 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                            {m.label}
                          </dt>
                          <dd className="text-sm text-foreground/80">{m.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground/80">
              Eight years of friendship before a single line of code — complementary, not redundant.
              We shipped Nami&apos;s first version in months, without a cent of outside funding, and
              run the company the same way: lean and capital-efficient by default.
            </p>
          </section>

          {/* ── Values ── */}
          <section className="mt-20 sm:mt-24">
            <h2 className="text-2xl font-bold tracking-tight">What we believe</h2>
            <div className="mt-6 divide-y divide-border border-t border-border">
              {VALUES.map((v, i) => (
                <div key={v.title} className="grid gap-3 py-8 sm:grid-cols-[5rem_1fr] sm:gap-8">
                  <span className="text-4xl font-bold tabular-nums leading-none text-secondary sm:text-5xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground">{v.title}</h3>
                    <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                      {v.body}
                    </p>
                  </div>
                </div>
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
