import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  audience: string[];
  order: number;
  icon: string;
}

export interface HelpArticleWithContent extends HelpArticle {
  content: string;
}

const CATEGORY_ORDER: string[] = [
  "Getting Started",
  "Cycles",
  "Reviews",
  "Goals",
  "Team Management",
  "Surveys",
  "Competencies",
  "Calibration",
  "Analytics",
  "Admin & Billing",
  "Troubleshooting",
];

const CONTENT_DIR = path.join(process.cwd(), "content", "help");

function getMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getMdxFiles(fullPath));
    } else if (entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }

  return files;
}

export function getAllArticles(): HelpArticle[] {
  const files = getMdxFiles(CONTENT_DIR);

  const articles = files.map((filePath) => {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    const slug = path.basename(filePath, ".mdx");

    return {
      slug,
      title: data.title ?? "",
      description: data.description ?? "",
      category: data.category ?? "",
      audience: data.audience ?? [],
      order: data.order ?? 99,
      icon: data.icon ?? "",
    } satisfies HelpArticle;
  });

  return articles.sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    const orderA = catA === -1 ? CATEGORY_ORDER.length : catA;
    const orderB = catB === -1 ? CATEGORY_ORDER.length : catB;

    if (orderA !== orderB) return orderA - orderB;
    return a.order - b.order;
  });
}

export function getArticleBySlug(slug: string): HelpArticleWithContent | null {
  const files = getMdxFiles(CONTENT_DIR);
  const filePath = files.find(
    (f) => path.basename(f, ".mdx") === slug
  );

  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? "",
    description: data.description ?? "",
    category: data.category ?? "",
    audience: data.audience ?? [],
    order: data.order ?? 99,
    icon: data.icon ?? "",
    content,
  };
}

export function getArticlesGroupedByCategory(): {
  category: string;
  articles: HelpArticle[];
}[] {
  const articles = getAllArticles();
  const grouped = new Map<string, HelpArticle[]>();

  for (const article of articles) {
    const list = grouped.get(article.category) ?? [];
    list.push(article);
    grouped.set(article.category, list);
  }

  // Return in category order
  const result: { category: string; articles: HelpArticle[] }[] = [];

  for (const cat of CATEGORY_ORDER) {
    const items = grouped.get(cat);
    if (items && items.length > 0) {
      result.push({ category: cat, articles: items });
    }
  }

  // Append any categories not in the predefined order
  for (const [cat, items] of grouped) {
    if (!CATEGORY_ORDER.includes(cat)) {
      result.push({ category: cat, articles: items });
    }
  }

  return result;
}
