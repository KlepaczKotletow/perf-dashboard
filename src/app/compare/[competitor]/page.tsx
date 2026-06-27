import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, X, Minus, ArrowRight, ArrowUpRight, Slack } from "lucide-react";
import { COMPARISONS, getComparison, type NamiStatus, type RivalStatus } from "@/lib/comparisons";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { CtaBand } from "@/components/marketing/cta-band";
import { JsonLd } from "@/components/marketing/json-ld";
import { Kicker } from "@/components/marketing/kicker";
import { GlowCard } from "@/components/marketing/glow-card";
import { Accordion } from "@/components/marketing/accordion";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
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
    openGraph: { title: c.metaTitle, description: c.metaDescription, url: `/compare/${c.slug}`, type: "website" },
    twitter: { card: "summary_large_image", title: c.metaTitle, description: c.metaDescription },
  };
}

// Nami marks read as confident indigo; the competitor column stays muted grey
// (check / dash / x) so colour alone makes the stronger column obvious.
function NamiMark({ status }: { status: NamiStatus }) {
  if (status === "no") return <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" strokeWidth={2.5} />;
  return (
    <Check
      className={`mt-0.5 h-4 w-4 shrink-0 text-primary ${status === "win" ? "" : "opacity-60"}`}
      strokeWidth={status === "win" ? 3 : 2.25}
    />
  );
}
function RivalMark({ status }: { status: RivalStatus }) {
  if (status === "yes") return <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/45" strokeWidth={2} />;
  if (status === "limited") return <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/45" strokeWidth={2.5} />;
  return <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30" strokeWidth={2.5} />;
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

  // Headline tally for the comparison — counts the rows where Nami is a clear
  // differentiator. Derived from the data, never hardcoded.
  const namiWins = c.rows.filter((r) => r.namiStatus === "win").length;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${SITE_URL}/compare` },
      { "@type": "ListItem", position: 3, name: `Nami vs ${c.name}`, item: `${SITE_URL}/compare/${c.slug}` },
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />
      <SiteHeader ctaPurpose={`compare-${c.slug}`} />

      <Masthead
        kicker={`Comparison — Nami vs ${c.name}`}
        title={
          <>
            The Slack-native{" "}
            <span className="font-serif-accent text-[hsl(var(--spotlight))]">{c.name}</span> alternative
          </>
        }
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-2 text-sm text-white/40">
            <Link href="/" className="transition-colors hover:text-white">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/compare" className="transition-colors hover:text-white">Compare</Link>
            <span aria-hidden>/</span>
            <span className="text-white/70">Nami vs {c.name}</span>
          </nav>
        }
        lead={c.heroSummary}
        actions={
          <Button size="lg" className="h-12 rounded-full px-7 text-sm font-semibold btn-glow" asChild>
            <AddToSlackLink href={addToSlackUrl}>
              <Slack className="mr-2 h-4 w-4" />
              Add Nami to Slack
            </AddToSlackLink>
          </Button>
        }
      />

      <main className="flex-1">
        {/* ── Why teams switch — pain → fix, two-column cards ── */}
        <section className="border-b border-border/40 bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <ScrollReveal className="max-w-2xl">
              <Kicker className="mb-5">Why teams switch</Kicker>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-4xl lg:text-[44px]">
                What {c.name} makes hard,{" "}
                <span className="font-serif-accent text-primary">Nami makes lighter.</span>
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">{c.positioning}</p>
            </ScrollReveal>

            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {c.switchReasons.map((r, i) => (
                <ScrollReveal key={i} delay={(i % 2) * 80}>
                  <GlowCard className="h-full p-7">
                    <span className="block font-mono text-sm font-medium tabular-nums text-primary/25">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <div className="mt-5">
                      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/55">
                        With {c.name}
                      </p>
                      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{r.pain}</p>
                    </div>

                    <div className="my-5 flex items-center gap-3" aria-hidden>
                      <span className="h-px flex-1 bg-border/60" />
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/15">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                      <span className="h-px flex-1 bg-border/60" />
                    </div>

                    <div>
                      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-primary/80">
                        With Nami
                      </p>
                      <p className="mt-2.5 text-[15px] font-semibold leading-relaxed text-foreground">{r.fix}</p>
                    </div>
                  </GlowCard>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Side by side — the comparison table (centerpiece) ── */}
        <section className="border-b border-border/40 bg-[#faf9f6] py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <ScrollReveal className="max-w-2xl">
              <Kicker className="mb-5">Side by side</Kicker>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-4xl lg:text-[44px]">
                Nami vs {c.name},{" "}
                <span className="font-serif-accent text-primary">line by line.</span>
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
                {namiWins} of {c.rows.length} rows below are a clear win for Nami. Here is how the two
                stack up across the things a performance program actually leans on.
              </p>
            </ScrollReveal>

            {/* Legend — what the marks mean */}
            <ScrollReveal className="mt-8">
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" strokeWidth={3} />
                  <span>Nami advantage</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-muted-foreground/45" strokeWidth={2} />
                  <span>Has it</span>
                </li>
                <li className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-muted-foreground/45" strokeWidth={2.5} />
                  <span>Limited / caveat</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-muted-foreground/40" strokeWidth={2.5} />
                  <span>Not offered</span>
                </li>
              </ul>
            </ScrollReveal>

            {/* Desktop / tablet: real table with a sticky header. */}
            <ScrollReveal className="mt-8 hidden sm:block">
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
                <table className="w-full border-collapse">
                  <thead className="sticky top-16 z-10">
                    <tr>
                      <th className="w-[26%] bg-white/95 px-5 py-4 text-left align-bottom backdrop-blur" />
                      <th className="w-[37%] border-x border-primary/15 bg-primary/[0.06] px-5 py-4 text-left align-bottom backdrop-blur">
                        <span className="text-lg font-bold text-primary">Nami</span>
                        <span className="ml-2 inline-flex align-middle rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                          Recommended
                        </span>
                      </th>
                      <th className="w-[37%] bg-white/95 px-5 py-4 text-left align-bottom backdrop-blur">
                        <span className="text-lg font-bold text-foreground/60">{c.name}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.rows.map((row) => (
                      <tr key={row.label} className="border-t border-border/50">
                        <td className="px-5 py-4 align-top text-sm font-medium text-muted-foreground">{row.label}</td>
                        <td className="border-x border-primary/15 bg-primary/[0.035] px-5 py-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <NamiMark status={row.namiStatus} />
                            <span className="text-sm leading-snug text-foreground/90">{row.nami}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <RivalMark status={row.rivalStatus} />
                            <span className="text-sm leading-snug text-muted-foreground/80">{row.rival}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollReveal>

            {/* Mobile: stacked cards, one per row, so nothing gets cramped. */}
            <ScrollReveal className="mt-8 space-y-3 sm:hidden">
              {c.rows.map((row) => (
                <div key={row.label} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
                  <p className="border-b border-border/50 bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground">
                    {row.label}
                  </p>
                  <div className="border-b border-border/40 bg-primary/[0.035] px-4 py-3.5">
                    <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Nami
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                        Recommended
                      </span>
                    </p>
                    <div className="flex items-start gap-2.5">
                      <NamiMark status={row.namiStatus} />
                      <span className="text-sm leading-snug text-foreground/90">{row.nami}</span>
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      {c.name}
                    </p>
                    <div className="flex items-start gap-2.5">
                      <RivalMark status={row.rivalStatus} />
                      <span className="text-sm leading-snug text-muted-foreground/80">{row.rival}</span>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollReveal>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground/60">
              Reflects Nami&apos;s current feature set and {c.name}&apos;s publicly described
              capabilities. Vendor features and pricing change — verify specifics for your plan.
            </p>
          </div>
        </section>

        {/* ── Verdict + honest fit ── */}
        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-6 lg:px-10">
            <ScrollReveal>
              <blockquote className="border-l-2 border-primary/50 pl-6 sm:pl-8">
                <p className="text-2xl font-bold leading-[1.2] tracking-tight text-foreground sm:text-[1.85rem]">
                  Same outcomes {c.name} promises — reviews, goals, engagement — without the separate
                  login, the per-module invoice, or the rollout. It just{" "}
                  <span className="font-serif-accent text-primary">lives in Slack.</span>
                </p>
              </blockquote>
            </ScrollReveal>

            {/* Honest fit — credibility */}
            <ScrollReveal delay={100} className="mt-12">
              <GlowCard className="bg-muted/40 p-7 sm:p-8">
                <Kicker className="mb-3">In fairness</Kicker>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  When {c.name} is the better choice
                </h2>
                <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{c.betterFit}</p>
              </GlowCard>
            </ScrollReveal>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="border-y border-border/40 bg-[#faf9f6] py-20 lg:py-24">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <ScrollReveal className="mb-10 max-w-xl">
              <Kicker className="mb-5">FAQ</Kicker>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-4xl">
                {c.name} alternative — questions
              </h2>
              <p className="mt-3 text-[15px] text-muted-foreground">
                Don&apos;t see yours? Email{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline-offset-2 hover:underline">
                  hello@namihr.com
                </a>
                .
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <Accordion items={c.faqs.map((f) => ({ q: f.q, a: f.a }))} />
            </ScrollReveal>
          </div>
        </section>

        {/* ── Closing CTA (dark moment) ── */}
        <section className="bg-background py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <CtaBand
              href={addToSlackUrl}
              title="See Nami in your own Slack"
              subtitle="Install in about five minutes and run your first review cycle. Free for teams of 10 or fewer, 14-day Pro trial — no credit card."
            />
          </div>
        </section>

        {/* ── Other comparisons ── */}
        <section className="border-t border-border/30 bg-white py-16">
          <div className="mx-auto max-w-4xl px-6 lg:px-10">
            <Kicker className="mb-5">Compare with other tools</Kicker>
            <ul className="divide-y divide-border/60 border-y border-border/60">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/compare/${o.slug}`} className="group flex items-center justify-between gap-4 py-4">
                    <span className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                      Nami vs {o.name}
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-0.5 text-muted-foreground/30 transition-all group-hover:translate-y-0 group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
