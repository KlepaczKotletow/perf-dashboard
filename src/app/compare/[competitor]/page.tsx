import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, X, Minus, ChevronRight, ArrowDown, ArrowRight, Slack } from "lucide-react";
import { COMPARISONS, getComparison, type NamiStatus, type RivalStatus } from "@/lib/comparisons";
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
      `switch from ${c.name}`,
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

// A single comparison cell. The icon + treatment encode the status so the table
// shows real contrast instead of a wall of identical ticks: Nami wins read as
// confident brand checks; the competitor side honestly shows amber "limited" and
// grey "missing" where that's the reality.
function Cell({
  side,
  status,
  value,
}: {
  side: "nami" | "rival";
  status: NamiStatus | RivalStatus;
  value: string;
}) {
  let icon: React.ReactNode;
  let valueClass: string;

  if (status === "win") {
    icon = <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" strokeWidth={3} />;
    valueClass = "text-foreground font-medium";
  } else if (status === "yes") {
    icon =
      side === "nami" ? (
        <Check className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" strokeWidth={2.5} />
      ) : (
        <Check className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
      );
    valueClass = side === "nami" ? "text-foreground/90" : "text-muted-foreground/75";
  } else if (status === "limited") {
    icon = <Minus className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" strokeWidth={2.5} />;
    valueClass = "text-muted-foreground/80";
  } else {
    // "no"
    icon = <X className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" strokeWidth={2.5} />;
    valueClass = "text-muted-foreground/60";
  }

  return (
    <div className="flex items-start gap-2">
      {icon}
      <span className={`text-sm leading-snug ${valueClass}`}>{value}</span>
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
              The Slack-native {c.name} alternative
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
          {/* Why teams switch — pain → fix, leads the page */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">
              Why teams switch from {c.name}
            </h2>
            <p className="text-muted-foreground/90 leading-relaxed max-w-3xl">{c.positioning}</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {c.switchReasons.map((r, i) => (
                <div key={i} className="rounded-2xl border border-border/60 bg-card p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    With {c.name}
                  </p>
                  <div className="mt-2 flex items-start gap-2.5">
                    <X className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground/90 leading-relaxed">{r.pain}</p>
                  </div>
                  <div className="my-4 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border/60" />
                    <ArrowDown className="h-3.5 w-3.5 text-primary/50" />
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    With Nami
                  </p>
                  <div className="mt-2 flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" strokeWidth={2.75} />
                    <p className="text-sm font-medium text-foreground leading-relaxed">{r.fix}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Side by side — differentiated, Nami column emphasized */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">Side by side</h2>
            <div className="overflow-hidden rounded-2xl border border-border/60">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-4 py-3.5 w-[26%] bg-muted/30">
                      &nbsp;
                    </th>
                    <th className="text-left px-4 py-3.5 w-[37%] bg-primary/[0.06] border-x border-primary/10">
                      <span className="text-base font-bold text-primary">Nami</span>
                      <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wider text-primary/70 bg-primary/10 rounded-full px-2 py-0.5">
                        Recommended
                      </span>
                    </th>
                    <th className="text-left text-base font-bold text-foreground/70 px-4 py-3.5 w-[37%] bg-muted/30">
                      {c.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 1 ? "bg-muted/15" : "bg-background"}>
                      <td className="align-top px-4 py-3.5 text-sm font-medium text-foreground/70">
                        {row.label}
                      </td>
                      <td className="align-top px-4 py-3.5 bg-primary/[0.04] border-x border-primary/10">
                        <Cell side="nami" status={row.namiStatus} value={row.nami} />
                      </td>
                      <td className="align-top px-4 py-3.5">
                        <Cell side="rival" status={row.rivalStatus} value={row.rival} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground/60">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} /> Strength
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Minus className="h-3.5 w-3.5 text-amber-500" strokeWidth={2.5} /> Limited / gated
              </span>
              <span className="inline-flex items-center gap-1.5">
                <X className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={2.5} /> Not offered
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground/50">
              Reflects Nami&apos;s current feature set and {c.name}&apos;s publicly described
              capabilities. Vendor features and pricing change — verify specifics for your plan.
            </p>
          </section>

          {/* Honest fit — compact, for credibility */}
          <section className="rounded-2xl border border-border/60 bg-muted/20 px-7 py-6">
            <h2 className="text-base font-bold tracking-tight text-foreground mb-2">
              In fairness — when {c.name} is the better choice
            </h2>
            <p className="text-sm text-muted-foreground/85 leading-relaxed max-w-3xl">
              {c.betterFit}
            </p>
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
