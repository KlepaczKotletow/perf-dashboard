import type { Metadata } from "next";
import { Zap, Tag, ShieldCheck } from "lucide-react";
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
  now: string;
  before: string;
  studied: string;
  alumni: string[];
};

const FOUNDERS: Founder[] = [
  {
    name: "Filip Nowakowski",
    role: "Co-founder · Tech & Product",
    photo: "/team/filip-nowakowski.jpg",
    bio: "Filip leads product and engineering. He spent years scaling operations inside high-growth HR and fintech companies, where he saw first-hand how broken performance processes quietly drain teams.",
    now: "Senior Ops Manager at Deel",
    before: "Junior Ops Manager at Revolut",
    studied: "MSc Innovation & Entrepreneurship, HEC Paris · BSc Accounting & Finance, Warwick",
    alumni: ["HEC Paris", "University of Warwick"],
  },
  {
    name: "Michał Kugacki",
    role: "Co-founder · Strategy & Commercial",
    photo: "/team/michal-kugacki.jpg",
    bio: "Michał leads strategy and commercial. He comes from management consulting and corporate development, building growth and operating models for companies across Europe.",
    now: "Strategy & Corp Dev at InPost",
    before: "Senior Associate at Boston Consulting Group",
    studied: "MSc Finance, HEC Paris · BSc Accounting & Finance, Warwick",
    alumni: ["HEC Paris", "University of Warwick"],
  },
];

const VALUES: { icon: typeof Zap; title: string; body: string }[] = [
  {
    icon: Zap,
    title: "Friction is the bottleneck",
    body: "Every extra tab, login, and form is a reason a review never gets finished. We obsess over removing them — the work happens where your team already is.",
  },
  {
    icon: Tag,
    title: "One plan, fair pricing",
    body: "Every feature in a single $5/user plan. No four-figure minimums, no sales-led gauntlet — and free for teams of 10 or fewer.",
  },
  {
    icon: ShieldCheck,
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
        lead="Nami began with a simple frustration: even the best performance tools still make people leave their workflow to use them. We're building the alternative — reviews, goals, and surveys that run inside Slack, so teams actually complete them."
      />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 lg:px-10 pt-12 sm:pt-14">
          {/* Story */}
          <section className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight">Why we built Nami</h2>
            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
              <p>
                Performance management is broken — and not for lack of features. Companies pay for
                review software, goal trackers, and survey tools, then watch adoption collapse
                because every action means another tab, another login, another form. The work lives
                outside the workflow, so people simply don&apos;t do it.
              </p>
              <p>
                Nami takes the opposite approach. 360° reviews, OKRs, pulse surveys, and wellbeing
                check-ins all run from a single conversation in Slack — where your team already
                spends its day. Managers and HR still get the full picture on the web dashboard;
                everyone else just answers a DM.
              </p>
              <p>
                It installs in about a minute, includes every feature for $5 a user, and is free for
                teams of 10 or fewer — built for the mid-market the incumbents priced out.
              </p>
            </div>
          </section>

          {/* Founders */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">Meet the founders</h2>
            <p className="mt-2 text-muted-foreground">
              Two operators, two sides of the problem, one product.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {FOUNDERS.map((f) => (
                <div
                  key={f.name}
                  className="rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-8"
                >
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.photo}
                      alt={f.name}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-full object-cover ring-1 ring-border"
                    />
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-foreground">{f.name}</h3>
                      <p className="text-sm font-medium text-primary">{f.role}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">{f.bio}</p>
                  <dl className="mt-6 space-y-2 text-sm">
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 font-semibold text-foreground/70">Now</dt>
                      <dd className="text-muted-foreground">{f.now}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 font-semibold text-foreground/70">Before</dt>
                      <dd className="text-muted-foreground">{f.before}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 font-semibold text-foreground/70">Studied</dt>
                      <dd className="text-muted-foreground">{f.studied}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground/80">
              Eight years of friendship before a single line of code — complementary, not redundant.
              We shipped Nami&apos;s first version in months, without a cent of outside funding, and
              we run the company the same way: lean and capital-efficient by default.
            </p>
          </section>

          {/* Values */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">What we believe</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {VALUES.map((v) => {
                const Icon = v.icon;
                return (
                  <div
                    key={v.title}
                    className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-bold tracking-tight text-foreground">{v.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="py-16">
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
