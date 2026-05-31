import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, X, Minus, ArrowRight, ArrowUpRight, Slack } from "lucide-react";
import { COMPARISONS, getComparison, type NamiStatus, type RivalStatus } from "@/lib/comparisons";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { JsonLd } from "@/components/marketing/json-ld";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
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

// Nami marks read as confident indigo; the competitor column stays monochrome
// grey (check / dash / x) so colour alone makes the stronger column obvious —
// no candy tints, no wall of identical ticks.
function NamiMark({ status }: { status: NamiStatus }) {
  if (status === "no") return <X className="mt-0.5 h-4 w-4 shrink-0 text-foreground/30" strokeWidth={2.5} />;
  return (
    <Check
      className={`mt-0.5 h-4 w-4 shrink-0 text-primary ${status === "win" ? "" : "opacity-70"}`}
      strokeWidth={status === "win" ? 3 : 2.25}
    />
  );
}
function RivalMark({ status }: { status: RivalStatus }) {
  if (status === "yes") return <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" strokeWidth={2} />;
  if (status === "limited") return <Minus className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" strokeWidth={2.5} />;
  return <X className="mt-0.5 h-4 w-4 shrink-0 text-foreground/25" strokeWidth={2.5} />;
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
            The Slack-native <span className="italic text-[oklch(0.84_0.13_85)]">{c.name}</span> alternative
          </>
        }
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-2 text-sm text-[#a39e90]">
            <Link href="/" className="transition-colors hover:text-[#faf8f2]">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/compare" className="transition-colors hover:text-[#faf8f2]">Compare</Link>
            <span aria-hidden>/</span>
            <span className="text-[#cfc9bd]">Nami vs {c.name}</span>
          </nav>
        }
        lead={c.heroSummary}
        actions={
          <AddToSlackLink
            href={addToSlackUrl}
            className="inline-flex items-center gap-2 rounded-full bg-[#faf8f2] px-6 py-3 text-sm font-semibold text-[oklch(0.2_0.04_264)] transition-colors hover:bg-white"
          >
            <Slack className="h-4 w-4" />
            Add Nami to Slack
          </AddToSlackLink>
        }
      />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 lg:px-10 py-16">
          {/* Why teams switch — numbered editorial entries */}
          <section>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[oklch(0.7_0.14_85)]">
              Why teams switch
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-foreground">
              What {c.name} makes hard, Nami makes effortless
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground/85">{c.positioning}</p>

            <ol className="mt-10 border-t border-foreground/10">
              {c.switchReasons.map((r, i) => (
                <li
                  key={i}
                  className="grid gap-x-8 gap-y-3 border-b border-foreground/10 py-9 sm:grid-cols-[auto_minmax(0,1fr)]"
                >
                  <span className="font-display text-5xl font-semibold leading-none text-foreground/[0.12]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="leading-relaxed text-muted-foreground/85">
                      <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/40">
                        With {c.name}
                      </span>
                      {r.pain}
                    </p>
                    <p className="mt-4 flex gap-3 font-display text-lg leading-relaxed text-foreground">
                      <ArrowRight className="mt-1.5 h-4 w-4 shrink-0 text-[oklch(0.7_0.14_85)]" />
                      <span>{r.fix}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Side by side */}
          <section className="mt-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[oklch(0.7_0.14_85)]">
              Side by side
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.01em] text-foreground">
              Nami vs {c.name}, line by line
            </h2>

            <div className="mt-8 overflow-hidden rounded-2xl border border-foreground/10">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-[26%] px-4 py-4 text-left align-bottom" />
                    <th className="w-[37%] border-x border-primary/15 bg-primary/[0.05] px-4 py-4 text-left align-bottom">
                      <span className="font-display text-lg font-semibold text-primary">Nami</span>
                      <span className="ml-2 align-middle rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">
                        Recommended
                      </span>
                    </th>
                    <th className="w-[37%] px-4 py-4 text-left align-bottom">
                      <span className="font-display text-lg font-semibold text-foreground/65">{c.name}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map((row) => (
                    <tr key={row.label} className="border-t border-foreground/[0.07]">
                      <td className="px-4 py-4 align-top text-sm font-medium text-foreground/60">{row.label}</td>
                      <td className="border-x border-primary/15 bg-primary/[0.035] px-4 py-4 align-top">
                        <div className="flex items-start gap-2">
                          <NamiMark status={row.namiStatus} />
                          <span className="text-sm leading-snug text-foreground/90">{row.nami}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-start gap-2">
                          <RivalMark status={row.rivalStatus} />
                          <span className="text-sm leading-snug text-muted-foreground/75">{row.rival}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground/50">
              Reflects Nami&apos;s current feature set and {c.name}&apos;s publicly described
              capabilities. Vendor features and pricing change — verify specifics for your plan.
            </p>
          </section>

          {/* Verdict pull-quote */}
          <blockquote className="mt-20 border-l-2 border-[oklch(0.75_0.16_85)] pl-6">
            <p className="font-display text-2xl font-medium italic leading-snug text-foreground sm:text-[1.7rem]">
              Same outcomes {c.name} promises — reviews, goals, engagement — without the separate
              login, the per-module invoice, or the rollout. It just lives in Slack.
            </p>
          </blockquote>

          {/* Honest fit */}
          <section className="mt-16 rounded-2xl bg-muted/40 px-7 py-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/40">In fairness</p>
            <h2 className="mt-2 font-display text-lg font-semibold text-foreground">
              When {c.name} is the better choice
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground/85">{c.betterFit}</p>
          </section>

          {/* FAQ */}
          <section className="mt-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[oklch(0.7_0.14_85)]">FAQ</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.01em] text-foreground">
              {c.name} alternative — questions
            </h2>
            <div className="mt-8 border-t border-foreground/10">
              {c.faqs.map((f) => (
                <details key={f.q} className="group border-b border-foreground/10 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-medium text-foreground">
                    {f.q}
                    <span className="shrink-0 text-foreground/30 transition-transform group-open:rotate-45">
                      <Plus />
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground/85">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* CTA — full-bleed dark */}
        <section className="relative overflow-hidden bg-[oklch(0.175_0.035_264)] text-[#cfc9bd]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.3]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative mx-auto max-w-4xl px-6 lg:px-10 py-20 text-center">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold leading-tight text-[#faf8f2] sm:text-4xl">
              See Nami in your own Slack
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed">
              Install in about five minutes and run your first review cycle. Free for teams of 10
              or fewer, 14-day Pro trial — no credit card.
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

        {/* Other comparisons */}
        <section className="mx-auto max-w-4xl px-6 lg:px-10 py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-foreground/40">
            Compare with other tools
          </p>
          <ul className="mt-5 divide-y divide-foreground/10 border-y border-foreground/10">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/compare/${o.slug}`} className="group flex items-center justify-between gap-4 py-4">
                  <span className="font-display text-lg font-medium text-foreground transition-colors group-hover:text-primary">
                    Nami vs {o.name}
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-0.5 text-foreground/25 transition-all group-hover:translate-y-0 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

// Small inline plus icon for the FAQ toggle (rotates to ×).
function Plus() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
