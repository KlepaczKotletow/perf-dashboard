import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/help-articles";
import { COMPARISONS } from "@/lib/comparisons";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

// Per-route `lastModified` reflects when *content* last changed, not when the
// build ran. Bump these when you make meaningful content edits to a page; a
// uniform `new Date()` would give Google identical signals for every URL and
// dilute the value of the sitemap.
const PUBLIC_ROUTES: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  lastModified: string;
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly", lastModified: "2026-05-12" },
  { path: "/pricing", priority: 0.9, changeFrequency: "weekly", lastModified: "2026-05-12" },
  { path: "/compare", priority: 0.8, changeFrequency: "weekly", lastModified: "2026-05-30" },
  { path: "/guides", priority: 0.8, changeFrequency: "weekly", lastModified: "2026-05-30" },
  { path: "/roadmap", priority: 0.7, changeFrequency: "weekly", lastModified: "2026-05-06" },
  { path: "/security", priority: 0.6, changeFrequency: "monthly", lastModified: "2026-04-18" },
  { path: "/support", priority: 0.6, changeFrequency: "monthly", lastModified: "2026-04-22" },
  { path: "/privacy", priority: 0.5, changeFrequency: "yearly", lastModified: "2026-04-22" },
  { path: "/terms", priority: 0.5, changeFrequency: "yearly", lastModified: "2026-04-22" },
];

// Mirrored content. These were published as public pages on 2026-05-30; bump if
// you substantially revise the underlying guide article or comparison data.
const GUIDES_PUBLISHED = "2026-05-30";
const COMPARE_PUBLISHED = "2026-05-30";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map(
    ({ path, priority, changeFrequency, lastModified }) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(lastModified),
      priority,
      changeFrequency,
    })
  );

  const compareEntries: MetadataRoute.Sitemap = COMPARISONS.map((c) => ({
    url: `${SITE_URL}/compare/${c.slug}`,
    lastModified: new Date(COMPARE_PUBLISHED),
    priority: 0.7,
    changeFrequency: "monthly",
  }));

  const guideEntries: MetadataRoute.Sitemap = getAllArticles().map((a) => ({
    url: `${SITE_URL}/guides/${a.slug}`,
    lastModified: new Date(GUIDES_PUBLISHED),
    priority: 0.6,
    changeFrequency: "monthly",
  }));

  return [...staticEntries, ...compareEntries, ...guideEntries];
}
