import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, X, ChevronRight, Slack, ArrowRight } from "lucide-react";
import { COMPARISONS, getComparison } from "@/lib/comparisons";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { JsonLd } from "@/components/marketing/json-ld";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
import { Button } from "@/components/ui/button";
import { getAddToSlackUrl } from "@/lib/slack-cta";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>;
}): Promise<Metadata> {
  const { competitor } = await params;
  const c = getComparison(competitor);
  if (!c) return {};

  return {
    title: c.metaTitle,
    description: c.metaDescription,
    keywords: [
      `${c.name} alternative`,
      `${c.name} alternative Slack`,
      `Nami vs ${c.name}`,
      `${c.name} vs Nami`,
      "Slack performance management",
    ],
    alternates: { canonical: `/compare/${c.slug}` },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url: `/compare/${c.slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: c.metaTitle,
      description: c.metaDescription,
    },
  };
}

// A cell value that reads as a positive renders with a check; "not a current
// feature" style values render with a muted X. Everything else is plain text.
function renderCell(value: string) {
  const negative = /^not |^no\b|^—/i.test(value.trim());
  return (
    <div className="flex items-start gap-2">
      {negative ? (
        <X className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
      ) : (
        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      )}
      <span className="text-sm text-foreground/90 leading-snug">{value}</span>
    </div>
  );
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const { competitor } = await params;
  const c = getComparison(competitor);
  if (!c) notFound();

  const addToSlackUrl = getAddToSlackUrl(`compare-${c.slug}`);
  const others = COMPARISONS.filter((x) => x.slug !== c.slug);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${SITE_URL}/compare` },
      {
        "@type": "ListItem",
        position: 3,
        name: `Nami vs ${c.name}`,
        item: `${SITE_URL}/compare/${c.slug}`,
      },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />
      <SiteHeader ctaPurpose={`compare-${c.slug}`} />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-[#fafaf5] via-[#f8f6f0] to-[#fefcf5] border-b border-border/40">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16 sm:py-20">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground/60 mb-6 flex-wrap">
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href="/compare" className="hover:text-foreground transition-colors">
                Compare
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground/70 font-medium">Nami vs {c.name}</span>
            </nav>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground max-w-3xl leading-[1.1]">
              Nami vs {c.name}
            </h1>
            <p className="mt-5 text-lg text-muted-foreground/90 max-w-2xl leading-relaxed">
              {c.heroSummary}
            </p>
            <div className="mt-7">
              <Button className="rounded-full px-7 h-12 text-base" asChild>
                <AddToSlackLink href={addToSlackUrl}>
                  <Slack className="h-5 w-5 mr-2" />
                  Add Nami to Slack
                </AddToSlackLink>
              </Button>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16 space-y-16">
          {/* Positioning */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">
              What {c.name} is known for
            </h2>
            <p className="text-muted-foreground/90 leading-relaxed max-w-3xl">{c.positioning}</p>
          </section>

          {/* Comparison table */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">
              Side by side
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border/60">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-4 py-3 w-[28%]">
                      &nbsp;
                    </th>
                    <th className="text-left text-sm font-bold text-primary px-4 py-3 w-[36%]">
                      Nami
                    </th>
                    <th className="text-left text-sm font-bold text-foreground/80 px-4 py-3 w-[36%]">
                      {c.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.attributes.map((attr, i) => (
                    <tr
                      key={attr.label}
                      className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <td className="align-top px-4 py-3 text-sm font-medium text-foreground/70">
                        {attr.label}
                      </td>
                      <td className="align-top px-4 py-3">{renderCell(attr.nami)}</td>
                      <td className="align-top px-4 py-3">{renderCell(attr.competitor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground/50">
              Comparison reflects Nami&apos;s current feature set and {c.name}&apos;s publicly
              described capabilities. Vendor features and pricing change — verify specifics for your
              plan.
            </p>
          </section>

          {/* Why teams pick Nami */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">
              Why teams pick Nami over {c.name}
            </h2>
            <ul className="space-y-4 max-w-3xl">
              {c.namiEdge.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-foreground/90 leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Honest: when the competitor is the better fit */}
          <section className="rounded-2xl border border-border/60 bg-muted/20 px-7 py-8">
            <h2 className="text-xl font-bold tracking-tight text-foreground mb-3">
              When {c.name} is the better choice
            </h2>
            <p className="text-muted-foreground/90 leading-relaxed max-w-3xl">{c.betterFit}</p>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">
              {c.name} alternative — FAQ
            </h2>
            <div className="space-y-4 max-w-3xl">
              {c.faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-border/60 bg-card px-5 py-4"
                >
                  <summary className="cursor-pointer list-none font-semibold text-foreground flex items-center justify-between gap-4">
                    {f.q}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-open:rotate-90 transition-transform shrink-0" />
                  </summary>
                  <p className="mt-3 text-muted-foreground/90 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-3xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-secondary/[0.06] border border-primary/10 px-8 py-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              See Nami in your own Slack
            </h2>
            <p className="mt-3 text-muted-foreground/90 max-w-xl mx-auto">
              Install in about five minutes and run your first review cycle. Free for teams of 10 or
              fewer, 14-day Pro trial — no credit card.
            </p>
            <div className="mt-6 flex justify-center">
              <Button className="rounded-full px-7 h-12 text-base" asChild>
                <AddToSlackLink href={addToSlackUrl}>
                  <Slack className="h-5 w-5 mr-2" />
                  Add Nami to Slack
                </AddToSlackLink>
              </Button>
            </div>
          </section>

          {/* Other comparisons */}
          <section>
            <h2 className="text-lg font-bold tracking-tight text-foreground mb-4">
              Compare Nami with other tools
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {others.map((o) => (
                <Link
                  key={o.slug}
                  href={`/compare/${o.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 hover:border-primary/40 transition-colors"
                >
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    Nami vs {o.name}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
