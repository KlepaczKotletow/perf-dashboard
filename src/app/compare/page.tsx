import type { Metadata } from "next";
import { ArrowUpRight, Check } from "lucide-react";
import { COMPARISONS } from "@/lib/comparisons";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { CtaBand } from "@/components/marketing/cta-band";
import { JsonLd } from "@/components/marketing/json-ld";
import { Kicker } from "@/components/marketing/kicker";
import { GlowCard } from "@/components/marketing/glow-card";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { getAddToSlackUrl } from "@/lib/slack-cta";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

const DESCRIPTION =
  "Honest, side-by-side breakdowns of how Nami compares to Lattice, 15Five, Leapsome, and Culture Amp — features, pricing, and fit for Slack-first teams.";

export const metadata: Metadata = {
  title: "Compare Nami to Lattice, 15Five, Leapsome & Culture Amp",
  description: DESCRIPTION,
  keywords: [
    "performance management comparison",
    "Lattice alternative",
    "15Five alternative",
    "Leapsome alternative",
    "Culture Amp alternative",
    "Slack performance management",
  ],
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Compare Nami to Lattice, 15Five, Leapsome & Culture Amp",
    description: DESCRIPTION,
    url: "/compare",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Compare Nami — Lattice, 15Five, Leapsome, Culture Amp",
    description: DESCRIPTION,
  },
};

export default function CompareIndexPage() {
  const addToSlackUrl = getAddToSlackUrl("compare");

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${SITE_URL}/compare` },
    ],
  };
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Nami vs other performance management tools",
    itemListElement: COMPARISONS.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/compare/${c.slug}`,
      name: `Nami vs ${c.name}`,
    })),
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <SiteHeader ctaPurpose="compare" />

      <Masthead
        kicker="Compare"
        title={
          <>
            The deliberately small{" "}
            <span className="font-serif-accent text-[hsl(var(--spotlight))]">performance tool.</span>
          </>
        }
        lead={DESCRIPTION}
      />

      <main className="flex-1">
        {/* ── The reframe — lightness as the feature, not the gap ── */}
        <section className="bg-background py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <ScrollReveal>
              <Kicker className="mb-5">Why we read smaller</Kicker>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-4xl">
                Every tool below does more than Nami.{" "}
                <span className="font-serif-accent text-primary">That&apos;s the point.</span>
              </h2>
              <p className="mt-6 text-[17px] leading-relaxed text-muted-foreground">
                Lattice, 15Five, Leapsome, and Culture Amp are broad, capable suites. We
                didn&apos;t set out to out-feature them — we set out to be the one
                performance tool your team actually finishes. Reviews, OKRs, surveys, and
                calibration, run inside the Slack your people already have open, at one
                price. Less surface area to learn is not the compromise. It&apos;s the
                whole bet.
              </p>
              <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
                So these pages are honest. Each one leads with why teams switch, keeps a
                straight section on when the incumbent is the better fit, and flags
                competitor specifics as &ldquo;verify for your plan&rdquo; — because vendor
                features and pricing change.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Comparison cards — one per competitor ── */}
        <section className="border-y border-border/40 bg-[#faf9f6] py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <ScrollReveal className="mb-10 max-w-2xl">
              <Kicker className="mb-5">Side by side</Kicker>
              <p className="text-[17px] leading-relaxed text-muted-foreground">
                Pick the tool your team is weighing. Each breakdown covers where employees
                actually do the work, what&apos;s included, pricing, and the honest
                trade-offs.
              </p>
            </ScrollReveal>

            <div className="grid gap-5 sm:grid-cols-2">
              {COMPARISONS.map((c, i) => (
                <ScrollReveal key={c.slug} delay={i * 80}>
                  <GlowCard
                    href={`/compare/${c.slug}`}
                    ariaLabel={`Compare Nami vs ${c.name}`}
                    className="h-full p-7"
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                          Nami vs {c.name}
                        </h2>
                        <ArrowUpRight className="h-5 w-5 shrink-0 translate-y-1 text-muted-foreground/30 transition-all group-hover:translate-y-0 group-hover:text-primary" />
                      </div>
                      <p className="mt-3 flex-1 text-[14.5px] leading-relaxed text-muted-foreground">
                        {c.heroSummary}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-primary/80">
                        See the breakdown
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </GlowCard>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why teams switch — at a glance ──
            Honest strip: each row surfaces a real differentiator pulled from
            the first "win" comparison row in COMPARISONS, so nothing here is
            invented — it mirrors the per-competitor pages. */}
        <section className="bg-background py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-10">
            <ScrollReveal className="mb-10 max-w-2xl">
              <Kicker className="mb-5">Why teams switch — at a glance</Kicker>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-4xl">
                The same answer,{" "}
                <span className="font-serif-accent text-primary">four different tools.</span>
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
                Whichever incumbent a team is leaving, the move is the same: bring the work
                into Slack so it actually gets done. Here&apos;s where Nami leads in each
                head-to-head.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                {COMPARISONS.map((c) => {
                  const lead = c.rows.find((r) => r.namiStatus === "win") ?? c.rows[0];
                  return (
                    <div
                      key={c.slug}
                      className="grid gap-x-6 gap-y-1 border-b border-border/40 px-5 py-5 last:border-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-baseline"
                    >
                      <p className="text-[15px] font-semibold text-foreground">
                        vs {c.name}
                      </p>
                      <p className="flex items-start gap-2 text-[14px] leading-relaxed text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>
                          <span className="font-medium text-foreground">{lead.label}:</span>{" "}
                          {lead.nami}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[12px] text-muted-foreground/80">
                One row per comparison — see each page for the full feature, pricing, and
                fit breakdown.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Closing CTA (dark moment) ── */}
        <div className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
          <CtaBand
            href={addToSlackUrl}
            title="The fastest comparison is your own Slack"
            subtitle="Add Nami in about five minutes. Free for teams of 10 or fewer, 14-day Pro trial — no credit card."
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
