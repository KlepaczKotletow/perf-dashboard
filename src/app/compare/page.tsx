import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Slack } from "lucide-react";
import { COMPARISONS } from "@/lib/comparisons";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { JsonLd } from "@/components/marketing/json-ld";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
import { Button } from "@/components/ui/button";
import { getAddToSlackUrl } from "@/lib/slack-cta";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

const DESCRIPTION =
  "How Nami compares to Lattice, 15Five, Leapsome, and Culture Amp — honest, side-by-side breakdowns of features, pricing, and fit for Slack-first teams.";

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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <SiteHeader ctaPurpose="compare" />

      <main className="flex-1">
        <section className="bg-gradient-to-br from-[#fafaf5] via-[#f8f6f0] to-[#fefcf5] border-b border-border/40">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16 sm:py-20">
            <p className="text-sm font-semibold text-primary mb-3">Compare</p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground max-w-3xl leading-[1.1]">
              How Nami compares to the other performance tools
            </h1>
            <p className="mt-5 text-lg text-muted-foreground/90 max-w-2xl leading-relaxed">
              {DESCRIPTION}
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 lg:px-10 py-16">
          <div className="grid gap-5 sm:grid-cols-2">
            {COMPARISONS.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="group flex flex-col rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/[0.04] transition-all"
              >
                <h2 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                  Nami vs {c.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground/85 leading-relaxed flex-1">
                  {c.heroSummary}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read the comparison
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-16 rounded-3xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-secondary/[0.06] border border-primary/10 px-8 py-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              The fastest way to decide is to try it
            </h2>
            <p className="mt-3 text-muted-foreground/90 max-w-xl mx-auto">
              Add Nami to Slack in about five minutes. Free for teams of 10 or fewer, 14-day Pro
              trial — no credit card.
            </p>
            <div className="mt-6 flex justify-center">
              <Button className="rounded-full px-7 h-12 text-base" asChild>
                <AddToSlackLink href={addToSlackUrl}>
                  <Slack className="h-5 w-5 mr-2" />
                  Add Nami to Slack
                </AddToSlackLink>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
