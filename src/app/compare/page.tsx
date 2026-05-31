import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Slack } from "lucide-react";
import { COMPARISONS } from "@/lib/comparisons";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { JsonLd } from "@/components/marketing/json-ld";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
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
            How Nami stacks up against <span className="italic text-[oklch(0.84_0.13_85)]">the incumbents</span>
          </>
        }
        lead={DESCRIPTION}
      />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 lg:px-10 py-8">
          <ul className="divide-y divide-foreground/10">
            {COMPARISONS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/compare/${c.slug}`}
                  className="group grid gap-x-8 gap-y-2 py-8 sm:grid-cols-[14rem_minmax(0,1fr)_auto] sm:items-baseline"
                >
                  <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
                    Nami vs {c.name}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground/80">{c.heroSummary}</p>
                  <ArrowUpRight className="hidden h-5 w-5 shrink-0 translate-y-0.5 text-foreground/25 transition-all group-hover:translate-y-0 group-hover:text-primary sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA — full-bleed dark */}
        <section className="relative mt-8 overflow-hidden bg-[oklch(0.175_0.035_264)] text-[#cfc9bd]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.3]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative mx-auto max-w-4xl px-6 lg:px-10 py-20 text-center">
            <h2 className="mx-auto max-w-xl font-display text-3xl font-semibold leading-tight text-[#faf8f2] sm:text-4xl">
              The fastest comparison is your own Slack
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed">
              Add Nami in about five minutes. Free for teams of 10 or fewer, 14-day Pro trial — no
              credit card.
            </p>
            <AddToSlackLink
              href={addToSlackUrl}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#faf8f2] px-7 py-3.5 text-sm font-semibold text-[oklch(0.2_0.04_264)] transition-colors hover:bg-white"
            >
              <Slack className="h-4 w-4" />
              Add Nami to Slack
            </AddToSlackLink>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
