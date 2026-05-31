import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getAllArticles, getArticlesGroupedByCategory } from "@/lib/help-articles";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { CtaBand } from "@/components/marketing/cta-band";
import { JsonLd } from "@/components/marketing/json-ld";
import { getAddToSlackUrl } from "@/lib/slack-cta";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

const DESCRIPTION =
  "Field-tested playbooks for running performance reviews, OKRs, 360° feedback, calibration, and engagement surveys — from the team building Nami.";

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <SiteHeader ctaPurpose="guides" />

      <Masthead
        kicker="Guides & Playbooks"
        title={
          <>
            Performance management,{" "}
            <span className="text-primary text-shimmer">done properly.</span>
          </>
        }
        lead={`${DESCRIPTION} ${all.length} guides, no fluff.`}
      />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 lg:px-10 pt-12">
          {grouped.map((group, i) => (
            <section
              key={group.category}
              className="grid gap-x-12 gap-y-6 border-t border-border/60 py-12 lg:grid-cols-[15rem_minmax(0,1fr)]"
            >
              <div className="lg:sticky lg:top-28 lg:self-start">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {group.category}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  {group.articles.length} {group.articles.length === 1 ? "guide" : "guides"}
                </p>
              </div>

              <ul className="divide-y divide-border/60 border-t border-border/60 lg:border-t-0">
                {group.articles.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/guides/${article.slug}`}
                      className="group flex items-start justify-between gap-6 py-5"
                    >
                      <div>
                        <h3 className="text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
                          {article.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground/75">
                          {article.description}
                        </p>
                      </div>
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 translate-y-0.5 text-muted-foreground/30 transition-all group-hover:translate-y-0 group-hover:text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="border-t border-border/60 py-16">
            <CtaBand
              href={addToSlackUrl}
              title="Stop reading about reviews. Start running them."
              subtitle="Your first cycle takes about five minutes to launch. Free for teams of 10 or fewer — no credit card."
            />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
