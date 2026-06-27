import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, Book, Mail, ArrowUpRight, Clock } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { CtaBand } from "@/components/marketing/cta-band";
import { Kicker } from "@/components/marketing/kicker";
import { GlowCard } from "@/components/marketing/glow-card";
import { Accordion } from "@/components/marketing/accordion";
import { JsonLd } from "@/components/marketing/json-ld";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { getAddToSlackUrl } from "@/lib/slack-cta";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with Nami — your Slack-native performance management tool. Quick-start commands, common questions, and direct email support at hello@namihr.com.",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Support — Nami",
    description:
      "Get help with Nami — quick-start commands, common questions, and direct email support.",
    url: "/support",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Support — Nami",
    description: "Get help with Nami — your Slack-native performance management tool.",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Support", item: `${SITE_URL}/support` },
  ],
};

// Single source of truth for the support FAQ. Rendered as an Accordion below
// AND emitted verbatim as FAQPage JSON-LD so AI search engines and Google can
// surface these answers directly in SERPs. If you reword a question or answer,
// update it here once — the rendered copy and the structured data stay in lock-
// step because both read from this array.
const FAQ_ITEMS = [
  {
    q: "How do I start a 360 review?",
    a: "Nami bot will message you directly in Slack when a review cycle begins. Follow the guided conversation to rate competencies and answer questions. You can also check your pending reviews in the Nami app Home Tab.",
  },
  {
    q: "Can feedback be anonymous?",
    a: "Yes. When giving feedback you can choose to make it anonymous. The recipient will see the feedback but not who sent it.",
  },
  {
    q: "Who can see the feedback and reviews?",
    a: "By default, managers and admins can see all feedback. Regular employees can only see feedback they have received or given. You can customise these permissions in your workspace settings.",
  },
  {
    q: "How do I access the dashboard?",
    a: "Click 'Sign in with Slack' on our homepage. You'll be authenticated through your Slack account and redirected to your workspace dashboard.",
  },
  {
    q: "Can I create custom review templates?",
    a: "Yes. Managers and admins can create custom templates with different questions, rating scales, and required fields. Go to Templates in your dashboard to create and manage templates.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

// Documentation links resolve to real /guides/<slug> pages (slugs verified
// against content/help/*.mdx via help-articles.ts). Only verified slugs are
// linked.
const DOC_LINKS = [
  { label: "Setting up your first review cycle", slug: "creating-a-cycle" },
  { label: "Creating custom templates", slug: "templates" },
  { label: "Understanding analytics", slug: "understanding-analytics" },
  { label: "Managing team roles", slug: "roles-permissions" },
];

export default function SupportPage() {
  const addToSlackUrl = getAddToSlackUrl("support");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />
      <SiteHeader ctaPurpose="support" />

      <Masthead
        kicker="Support"
        title={
          <>
            Help that{" "}
            <span className="font-serif-accent text-[hsl(var(--spotlight))]">
              meets you where you work.
            </span>
          </>
        }
        lead="Nami lives in Slack, and so does most of the help you'll need — a guided DM, a quick command, a link to the right playbook. When that isn't enough, a real person replies, usually within a day."
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-2 text-sm text-white/40">
            <Link href="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <span aria-hidden>/</span>
            <span className="text-white/70">Support</span>
          </nav>
        }
      />

      <main className="flex-1">
        {/* ── Getting started + Documentation ── */}
        <section className="mx-auto max-w-6xl px-6 pt-16 lg:px-10 lg:pt-20">
          <ScrollReveal className="max-w-2xl">
            <Kicker className="mb-5">Get going</Kicker>
            <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-4xl">
              Two ways in —{" "}
              <span className="font-serif-accent text-primary">Slack or the dashboard.</span>
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
              Most things start with a message from the Nami bot. The rest is in the guides —
              short, field-tested, and written by the team that builds the product.
            </p>
          </ScrollReveal>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <ScrollReveal>
              <GlowCard className="h-full p-7">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  Quick commands
                </h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">
                  Type a slash command in any Slack channel to act without leaving the
                  conversation.
                </p>
                <ul className="mt-5 space-y-3">
                  <li className="flex items-start gap-3">
                    <code className="shrink-0 rounded-md border border-border/60 bg-muted px-2 py-1 font-mono text-[13px] font-medium text-foreground">
                      /kudos
                    </code>
                    <span className="pt-1 text-[14px] leading-relaxed text-muted-foreground">
                      Give quick feedback to a teammate
                    </span>
                  </li>
                </ul>
              </GlowCard>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <GlowCard className="h-full p-7">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
                  <Book className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  Documentation
                </h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">
                  Detailed guides and tutorials for the moments that need more than a DM.
                </p>
                <ul className="mt-5 divide-y divide-border/50 border-t border-border/50">
                  {DOC_LINKS.map((doc) => (
                    <li key={doc.slug}>
                      <Link
                        href={`/guides/${doc.slug}`}
                        className="group flex items-center justify-between gap-4 py-3 text-[14.5px] font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {doc.label}
                        <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-0.5 text-muted-foreground/40 transition-all group-hover:translate-y-0 group-hover:text-primary" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/guides"
                  className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:text-primary/70"
                >
                  Browse all guides
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </GlowCard>
            </ScrollReveal>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mx-auto max-w-3xl px-6 pt-20 lg:pt-28">
          <ScrollReveal className="mb-10 max-w-xl">
            <Kicker className="mb-5">FAQ</Kicker>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-[15px] text-muted-foreground">
              Don&apos;t see yours? Email{" "}
              <a
                href="mailto:hello@namihr.com"
                className="text-primary underline-offset-2 hover:underline"
              >
                hello@namihr.com
              </a>
              .
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <Accordion items={FAQ_ITEMS} />
          </ScrollReveal>
        </section>

        {/* ── Contact support ── */}
        <section className="mx-auto max-w-3xl px-6 pt-16 lg:pt-20">
          <ScrollReveal>
            <GlowCard className="p-7 sm:p-9">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-md">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
                    <Mail className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Still stuck? Talk to a person.
                  </h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">
                    If you can&apos;t find the answer you&apos;re looking for, reach out. We typically
                    respond within 24 hours.
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground/70">
                    <Clock className="h-3.5 w-3.5" />
                    ~24h response · hello@namihr.com
                  </p>
                </div>
                <a
                  href="mailto:hello@namihr.com"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Mail className="h-4 w-4" />
                  Email support
                </a>
              </div>
            </GlowCard>
          </ScrollReveal>
        </section>

        {/* ── Closing CTA (dark moment) ── */}
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
          <ScrollReveal>
            <CtaBand
              href={addToSlackUrl}
              title="Not running Nami yet?"
              subtitle="Add it to your Slack workspace in under a minute. Free for teams of 10 or fewer — no credit card."
            />
          </ScrollReveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
