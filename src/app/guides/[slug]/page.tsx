import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { Slack, ArrowUpRight, ArrowLeft } from "lucide-react";
import { getAllArticles, getArticleBySlug } from "@/lib/help-articles";
import { publicMdxComponents, slugify } from "@/components/marketing/public-mdx-components";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";
import { JsonLd } from "@/components/marketing/json-ld";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
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

  // Table of contents from the raw markdown h2s — matches the ids the MDX
  // h2 component generates via the same slugify().
  const toc = [...article.content.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => ({
    text: m[1].replace(/[*_`]/g, ""),
    id: slugify(m[1].replace(/[*_`]/g, "")),
  }));

  const words = article.content.trim().split(/\s+/).length;
  const readMins = Math.max(1, Math.round(words / 200));

  const related = getAllArticles()
    .filter((a) => a.category === article.category && a.slug !== slug)
    .slice(0, 4);

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
      <SiteHeader ctaPurpose="guide" />

      <Masthead
        kicker={article.category}
        title={article.title}
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-2 text-sm text-[#a39e90]">
            <Link href="/" className="transition-colors hover:text-[#faf8f2]">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/guides" className="transition-colors hover:text-[#faf8f2]">Guides</Link>
            <span aria-hidden>/</span>
            <span className="text-[#cfc9bd]">{article.category}</span>
          </nav>
        }
        lead={
          <>
            <p>{article.description}</p>
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.22em] text-[#a39e90]">
              {readMins} min read
            </p>
          </>
        }
      />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 lg:px-10 py-14 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-14">
          {/* Article */}
          <article className="max-w-[700px]">
            {content}

            {/* CTA panel */}
            <aside className="relative mt-16 overflow-hidden rounded-2xl bg-[oklch(0.175_0.035_264)] px-7 py-9 text-[#cfc9bd]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.3]"
                style={{
                  backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px)",
                  backgroundSize: "20px 20px",
                }}
              />
              <div className="relative">
                <h2 className="font-display text-2xl font-semibold text-[#faf8f2]">
                  Run this in Slack with Nami
                </h2>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed">
                  Reviews, goals, surveys, and calibration — in the DM thread your team already
                  reads. Free for teams of 10 or fewer.
                </p>
                <AddToSlackLink
                  href={addToSlackUrl}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#faf8f2] px-6 py-3 text-sm font-semibold text-[oklch(0.2_0.04_264)] transition-colors hover:bg-white"
                >
                  <Slack className="h-4 w-4" />
                  Add Nami to Slack
                </AddToSlackLink>
              </div>
            </aside>

            {/* Related */}
            {related.length > 0 && (
              <section className="mt-16">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground/40">
                  More in {article.category}
                </p>
                <ul className="mt-5 divide-y divide-foreground/10 border-y border-foreground/10">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/guides/${r.slug}`} className="group flex items-baseline justify-between gap-6 py-4">
                        <span className="font-display text-lg font-medium text-foreground transition-colors group-hover:text-primary">
                          {r.title}
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-1 text-foreground/30 transition-all group-hover:-translate-y-0 group-hover:text-primary" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-12">
              <Link
                href="/guides"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/70"
              >
                <ArrowLeft className="h-4 w-4" />
                All guides
              </Link>
            </div>
          </article>

          {/* TOC rail */}
          {toc.length > 1 && (
            <aside className="hidden lg:block">
              <div className="sticky top-28">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40">
                  On this page
                </p>
                <ul className="mt-4 space-y-1 border-l border-foreground/10">
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className="-ml-px block border-l-2 border-transparent py-1 pl-4 text-[13px] leading-snug text-foreground/55 transition-colors hover:border-[oklch(0.75_0.16_85)] hover:text-foreground"
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
