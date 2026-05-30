import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { ChevronRight, ArrowRight, Slack } from "lucide-react";
import { getAllArticles, getArticleBySlug } from "@/lib/help-articles";
import { publicMdxComponents } from "@/components/marketing/public-mdx-components";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { JsonLd } from "@/components/marketing/json-ld";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
import { Button } from "@/components/ui/button";
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
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
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

  const related = getAllArticles()
    .filter((a) => a.category === article.category && a.slug !== slug)
    .slice(0, 3);

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
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: `${SITE_URL}/guides/${slug}`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <SiteHeader ctaPurpose="guide" />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground/60 mb-8 flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/guides" className="hover:text-foreground transition-colors">
              Guides
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground/70 font-medium">{article.category}</span>
          </nav>

          {/* Header */}
          <header className="mb-10">
            <p className="text-sm font-semibold text-primary mb-2">{article.category}</p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-4 leading-tight">
              {article.title}
            </h1>
            <p className="text-lg text-muted-foreground/85 leading-relaxed">
              {article.description}
            </p>
            <div className="mt-8 h-px bg-gradient-to-r from-border via-border/60 to-transparent" />
          </header>

          {/* Body */}
          <article className="prose-custom">{content}</article>

          {/* Inline CTA */}
          <div className="mt-14 rounded-2xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-secondary/[0.06] border border-primary/10 px-7 py-8">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Run this in Slack with Nami
            </h2>
            <p className="mt-2 text-sm text-muted-foreground/90 max-w-lg">
              Nami brings reviews, goals, surveys, and calibration into Slack so your team actually
              completes them. Free for teams of 10 or fewer.
            </p>
            <div className="mt-5">
              <Button className="rounded-full px-6 h-11" asChild>
                <AddToSlackLink href={addToSlackUrl}>
                  <Slack className="h-4 w-4 mr-2" />
                  Add Nami to Slack
                </AddToSlackLink>
              </Button>
            </div>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-14">
              <h2 className="text-lg font-bold tracking-tight text-foreground mb-4">
                More on {article.category}
              </h2>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/guides/${r.slug}`}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card px-4 py-3 hover:border-primary/40 transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {r.title}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-12">
            <Link
              href="/guides"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              All guides
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
