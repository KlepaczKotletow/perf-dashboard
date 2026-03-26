import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { getAllArticles, getArticleBySlug } from "@/lib/help-articles";
import { helpMdxComponents } from "@/components/help/mdx-components";
import { RoleTag } from "@/components/help/role-tag";
import { ChevronRight } from "lucide-react";

export async function generateStaticParams() {
  const articles = getAllArticles();
  return articles.map((a) => ({ slug: a.slug }));
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const { content } = await compileMDX({
    source: article.content,
    components: helpMdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
      },
    },
  });

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground/60 mb-6">
        <span>Help Center</span>
        <ChevronRight className="h-3 w-3" />
        <span>{article.category}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground/70 font-medium truncate max-w-[200px]">
          {article.title}
        </span>
      </nav>

      {/* Article header */}
      <header className="mb-8">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {article.audience.map((role) => (
            <RoleTag key={role} role={role} />
          ))}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
          {article.title}
        </h1>
        <p className="text-base text-muted-foreground/80 leading-relaxed">
          {article.description}
        </p>
        <div className="mt-6 h-px bg-gradient-to-r from-border via-border/60 to-transparent" />
      </header>

      {/* Article content */}
      <article className="prose-custom">{content}</article>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-border/40">
        <p className="text-xs text-muted-foreground/40">
          {article.category} &middot; {article.title}
        </p>
      </footer>
    </div>
  );
}
