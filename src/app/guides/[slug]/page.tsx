import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { ArrowUpRight, ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { getAllArticles, getArticleBySlug } from "@/lib/help-articles";
import { publicMdxComponents, slugify } from "@/components/marketing/public-mdx-components";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { CtaBand } from "@/components/marketing/cta-band";
import { GlowCard } from "@/components/marketing/glow-card";
import { SectionToc, ReadingProgress } from "@/components/marketing/section-toc";
import { JsonLd } from "@/components/marketing/json-ld";
import { getAddToSlackUrl } from "@/lib/slack-cta";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/guides/${slug}` },
    openGraph: {
      title: `${article.title} — Nami`,
      description: article.description,
      url: `/guides/${slug}`,
      type: "article",
    },
    twitter: { card: "summary_large_image", title: article.title, description: article.description },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const { content } = await compileMDX({
    source: article.content,
    components: publicMdxComponents,
    options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
  });

  // Build the on-page TOC from the article's h2 headings. The id MUST match the
  // slugify() the MDX h2 renderer uses, or the scroll-spy links break.
  const toc = [...article.content.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => ({
    text: m[1].replace(/[*_`]/g, ""),
    id: slugify(m[1].replace(/[*_`]/g, "")),
  }));
  const tocItems = toc.map((h) => ({ id: h.id, label: h.text }));

  const words = article.content.trim().split(/\s+/).length;
  const readMins = Math.max(1, Math.round(words / 200));

  // Everything in this category, in publish order — drives both the
  // prev/next pager and the "more in category" cards.
  const categoryArticles = getAllArticles().filter((a) => a.category === article.category);
  const currentIndex = categoryArticles.findIndex((a) => a.slug === slug);
  const prevArticle = currentIndex > 0 ? categoryArticles[currentIndex - 1] : null;
  const nextArticle =
    currentIndex !== -1 && currentIndex < categoryArticles.length - 1
      ? categoryArticles[currentIndex + 1]
      : null;

  const related = categoryArticles.filter((a) => a.slug !== slug).slice(0, 4);

  const addToSlackUrl = getAddToSlackUrl("guide");

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: article.title,
    description: article.description,
    articleSection: article.category,
    inLanguage: "en-US",
    mainEntityOfPage: `${SITE_URL}/guides/${slug}`,
    author: { "@type": "Organization", name: "Nami", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Nami",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/nami-logo.svg` },
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
      { "@type": "ListItem", position: 3, name: article.title, item: `${SITE_URL}/guides/${slug}` },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      {/* Top-of-page reading-progress bar — client island. */}
      <ReadingProgress />

      <SiteHeader ctaPurpose="guide" />

      <Masthead
        kicker={article.category}
        title={article.title}
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-2 text-sm text-white/40">
            <Link href="/" className="transition-colors hover:text-white">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/guides" className="transition-colors hover:text-white">Guides</Link>
            <span aria-hidden>/</span>
            <span className="text-white/70">{article.category}</span>
          </nav>
        }
        lead={
          <>
            <p>{article.description}</p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
              <Clock className="h-3.5 w-3.5 text-[hsl(var(--spotlight))]" />
              {readMins} min read
            </p>
          </>
        }
      />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 lg:px-10 py-14 lg:py-20 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
          <article className="max-w-[704px]">
            {/* Editorial article body — warm prose styled by publicMdxComponents. */}
            <div className="text-pretty">{content}</div>

            {/* Prev / next within the same category — a quiet, editorial pager. */}
            {(prevArticle || nextArticle) && (
              <nav
                aria-label={`More ${article.category} guides`}
                className="mt-14 grid gap-3 border-t border-border/60 pt-8 sm:grid-cols-2"
              >
                {prevArticle ? (
                  <Link
                    href={`/guides/${prevArticle.slug}`}
                    className="group rounded-2xl border border-border/60 bg-card px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/30"
                  >
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                      <ArrowLeft className="h-3 w-3" /> Previous
                    </span>
                    <p className="mt-2 font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {prevArticle.title}
                    </p>
                  </Link>
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
                {nextArticle && (
                  <Link
                    href={`/guides/${nextArticle.slug}`}
                    className="group rounded-2xl border border-border/60 bg-card px-5 py-4 text-right transition-all hover:-translate-y-0.5 hover:border-primary/30 sm:col-start-2"
                  >
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                      Next <ArrowRight className="h-3 w-3" />
                    </span>
                    <p className="mt-2 font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {nextArticle.title}
                    </p>
                  </Link>
                )}
              </nav>
            )}

            {/* Closing CTA — the dark #1a1a2e moment with the canonical Slack button. */}
            <div className="mt-16">
              <CtaBand
                href={addToSlackUrl}
                title="Run this in Slack with Nami"
                subtitle="Reviews, goals, surveys, and calibration — in the DM thread your team already reads. Free for teams of 10 or fewer."
              />
            </div>

            {related.length > 0 && (
              <section className="mt-16">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
                  More in {article.category}
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {related.map((r) => (
                    <GlowCard key={r.slug} href={`/guides/${r.slug}`} ariaLabel={r.title} className="h-full p-5">
                      <div className="flex h-full flex-col">
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary/70">
                          {r.category}
                        </p>
                        <h3 className="mt-2 text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                          {r.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                          {r.description}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          Read guide
                          <ArrowUpRight className="h-3.5 w-3.5 translate-y-px transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </span>
                      </div>
                    </GlowCard>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-12">
              <Link
                href="/guides"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/70"
              >
                <ArrowLeft className="h-4 w-4" />
                All guides
              </Link>
            </div>
          </article>

          {/* Sticky scroll-spy TOC — client island, desktop sidebar only. */}
          {tocItems.length > 1 && (
            <aside className="hidden lg:block">
              <div className="sticky top-28">
                <SectionToc items={tocItems} />
              </div>
            </aside>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
