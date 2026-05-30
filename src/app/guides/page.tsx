import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Slack } from "lucide-react";
import { getAllArticles, getArticlesGroupedByCategory } from "@/lib/help-articles";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { JsonLd } from "@/components/marketing/json-ld";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
import { Button } from "@/components/ui/button";
import { getAddToSlackUrl } from "@/lib/slack-cta";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

const DESCRIPTION =
  "Practical, field-tested guides to running performance reviews, OKRs, 360° feedback, calibration, and engagement surveys — built for teams that work in Slack.";

export const metadata: Metadata = {
  title: "Performance Management Guides",
  description: DESCRIPTION,
  keywords: [
    "performance review guide",
    "how to run 360 feedback",
    "OKR goal setting guide",
    "performance calibration",
    "eNPS best practices",
    "Slack performance management",
  ],
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Performance Management Guides — Nami",
    description: DESCRIPTION,
    url: "/guides",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Performance Management Guides — Nami",
    description: DESCRIPTION,
  },
};

export default function GuidesIndexPage() {
  const grouped = getArticlesGroupedByCategory();
  const all = getAllArticles();
  const addToSlackUrl = getAddToSlackUrl("guides");

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Nami performance management guides",
    itemListElement: all.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/guides/${a.slug}`,
      name: a.title,
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <SiteHeader ctaPurpose="guides" />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-[#fafaf5] via-[#f8f6f0] to-[#fefcf5] border-b border-border/40">
          <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16 sm:py-20">
            <p className="text-sm font-semibold text-primary mb-3">Guides &amp; playbooks</p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground max-w-3xl leading-[1.1]">
              How to run performance management your team actually finishes
            </h1>
            <p className="mt-5 text-lg text-muted-foreground/90 max-w-2xl leading-relaxed">
              {DESCRIPTION} Written by the team building{" "}
              <Link
                href="/"
                className="text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary/60"
              >
                Nami
              </Link>
              , the Slack-native performance platform.
            </p>
          </div>
        </section>

        {/* Article groups */}
        <section className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
          <div className="space-y-16">
            {grouped.map((group) => (
              <div key={group.category}>
                <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">
                  {group.category}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.articles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/guides/${article.slug}`}
                      className="group flex flex-col rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/[0.04] transition-all"
                    >
                      <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                        {article.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground/80 leading-relaxed line-clamp-3 flex-1">
                        {article.description}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Read guide
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-secondary/[0.06] border border-primary/10 px-8 py-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Put these playbooks to work in Slack
            </h2>
            <p className="mt-3 text-muted-foreground/90 max-w-xl mx-auto">
              Run your first review cycle in about five minutes. Free for teams of 10 or fewer,
              14-day Pro trial — no credit card.
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
