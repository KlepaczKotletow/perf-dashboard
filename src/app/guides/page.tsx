import type { Metadata } from "next";
import {
  ArrowUpRight,
  BookOpen,
  CreditCard,
  SlidersHorizontal,
  Shield,
  Scale,
  Layers,
  CalendarClock,
  RefreshCw,
  ListChecks,
  Rocket,
  Bot,
  MessageCircle,
  FileText,
  ClipboardCheck,
  ArrowUp,
  Eye,
  Upload,
  Users,
  Settings,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { getAllArticles, getArticlesGroupedByCategory } from "@/lib/help-articles";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { CtaBand } from "@/components/marketing/cta-band";
import { Kicker } from "@/components/marketing/kicker";
import { GlowCard } from "@/components/marketing/glow-card";
import { JsonLd } from "@/components/marketing/json-ld";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
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

// Frontmatter `icon` values are PascalCase lucide names. Map them to real
// components for a server component (no dynamic import). Anything missing or
// unrecognised falls back to BookOpen so the tile never renders empty.
const ICONS: Record<string, LucideIcon> = {
  CreditCard,
  SlidersHorizontal,
  Shield,
  Scale,
  Layers,
  CalendarClock,
  RefreshCw,
  ListChecks,
  Rocket,
  Bot,
  MessageCircle,
  FileText,
  ClipboardCheck,
  ArrowUp,
  Eye,
  Upload,
  Users,
  Settings,
  HelpCircle,
};

function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? BookOpen;
}

// Stable anchor id per category so the overview tiles can deep-link into the
// matching section below.
function categoryId(category: string): string {
  return (
    "cat-" +
    category
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
}

// Human label for an audience token from frontmatter. The library only reads
// the `audience` array (some articles use a `roles` key the lib ignores, so
// audience is intentionally sparse — we render chips only when present).
const AUDIENCE_LABELS: Record<string, string> = {
  all: "Everyone",
  admin: "Admins",
  hr: "HR",
  manager: "Managers",
};

function audienceLabel(token: string): string {
  return AUDIENCE_LABELS[token] ?? token;
}

export default function GuidesIndexPage() {
  const grouped = getArticlesGroupedByCategory();
  const all = getAllArticles();
  const addToSlackUrl = getAddToSlackUrl("guides");

  // Per-category visual metadata derived from frontmatter:
  //  - icon: first article in the category that declares one (fallback BookOpen)
  //  - audiences: deduped union of every article's `audience`, in a stable order
  const AUDIENCE_ORDER = ["all", "admin", "hr", "manager"];
  const meta = grouped.map((group) => {
    const withIcon = group.articles.find((a) => a.icon);
    const audienceSet = new Set<string>();
    for (const a of group.articles) for (const aud of a.audience) audienceSet.add(aud);
    const audiences = AUDIENCE_ORDER.filter((t) => audienceSet.has(t)).concat(
      [...audienceSet].filter((t) => !AUDIENCE_ORDER.includes(t)),
    );
    return {
      category: group.category,
      id: categoryId(group.category),
      icon: iconFor(withIcon?.icon ?? ""),
      count: group.articles.length,
      audiences,
    };
  });

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
            <span className="font-serif-accent text-[hsl(var(--spotlight))]">done properly.</span>
          </>
        }
        lead={`${DESCRIPTION} ${all.length} guides, no fluff.`}
      />

      <main className="flex-1">
        {/* ── Category overview — surface each category's icon, guide count, and
            (where present) the audiences it's written for. Tiles deep-link into
            the matching section below. ── */}
        <section className="mx-auto max-w-6xl px-6 lg:px-10 pt-16 lg:pt-20">
          <ScrollReveal className="max-w-2xl">
            <Kicker className="mb-5">Browse by topic</Kicker>
            <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight text-foreground leading-[1.1]">
              {meta.length} topics, from your first cycle to{" "}
              <span className="font-serif-accent text-primary">year-end calibration.</span>
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={80} className="mt-10">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {meta.map((m) => {
                const Icon = m.icon;
                return (
                  <GlowCard
                    key={m.id}
                    href={`#${m.id}`}
                    ariaLabel={`Jump to ${m.category} guides`}
                    className="p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[15px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                          {m.category}
                        </h3>
                        <p className="mt-0.5 text-[13px] text-muted-foreground/70">
                          {m.count} {m.count === 1 ? "guide" : "guides"}
                        </p>
                        {m.audiences.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {m.audiences.map((aud) => (
                              <span
                                key={aud}
                                className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                              >
                                {audienceLabel(aud)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30 transition-all group-hover:-translate-y-0.5 group-hover:text-primary" />
                    </div>
                  </GlowCard>
                );
              })}
            </div>
          </ScrollReveal>
        </section>

        {/* ── Full guide index, grouped by category ── */}
        <div className="mx-auto max-w-6xl px-6 lg:px-10 pt-10 lg:pt-14">
          {grouped.map((group, i) => {
            const m = meta[i];
            const Icon = m.icon;
            return (
              <section
                key={group.category}
                id={m.id}
                className="grid scroll-mt-28 gap-x-12 gap-y-6 border-t border-border/60 py-12 lg:grid-cols-[16rem_minmax(0,1fr)]"
              >
                <div className="lg:sticky lg:top-28 lg:self-start">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/50">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                  </div>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                    {group.category}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground/70">
                    {group.articles.length} {group.articles.length === 1 ? "guide" : "guides"}
                  </p>
                  {m.audiences.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.audiences.map((aud) => (
                        <span
                          key={aud}
                          className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {audienceLabel(aud)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 border-t border-border/60 pt-6 sm:grid-cols-2 lg:border-t-0 lg:pt-0">
                  {group.articles.map((article) => {
                    const ArticleIcon = iconFor(article.icon);
                    return (
                      <GlowCard
                        key={article.slug}
                        href={`/guides/${article.slug}`}
                        ariaLabel={article.title}
                        className="h-full p-5"
                      >
                        <div className="flex h-full flex-col">
                          <div className="flex items-start justify-between gap-4">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary-foreground/80 ring-1 ring-inset ring-border/60">
                              <ArticleIcon className="h-[18px] w-[18px] text-primary/80" />
                            </div>
                            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30 transition-all group-hover:-translate-y-0.5 group-hover:text-primary" />
                          </div>
                          <h3 className="mt-4 text-[15px] font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
                            {article.title}
                          </h3>
                          {article.description ? (
                            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground/75">
                              {article.description}
                            </p>
                          ) : (
                            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground/50">
                              Read the guide &rarr;
                            </p>
                          )}
                        </div>
                      </GlowCard>
                    );
                  })}
                </div>
              </section>
            );
          })}

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
