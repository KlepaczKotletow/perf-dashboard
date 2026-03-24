import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { getAllArticles, getArticleBySlug } from "@/lib/help-articles";
import { helpMdxComponents } from "@/components/help/mdx-components";
import { RoleTag } from "@/components/help/role-tag";

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
  });

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {article.audience.map((role) => (
            <RoleTag key={role} role={role} />
          ))}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
          {article.title}
        </h1>
        <p className="text-lg text-muted-foreground">{article.description}</p>
        <hr className="mt-6 border-border" />
      </header>

      <article className="prose-custom">{content}</article>
    </div>
  );
}
