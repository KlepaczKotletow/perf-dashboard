import type { MetadataRoute } from "next";

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
  { path: "/roadmap", priority: 0.7, changeFrequency: "weekly", lastModified: "2026-05-06" },
  { path: "/security", priority: 0.6, changeFrequency: "monthly", lastModified: "2026-04-18" },
  { path: "/support", priority: 0.6, changeFrequency: "monthly", lastModified: "2026-04-22" },
  { path: "/privacy", priority: 0.5, changeFrequency: "yearly", lastModified: "2026-04-22" },
  { path: "/terms", priority: 0.5, changeFrequency: "yearly", lastModified: "2026-04-22" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency, lastModified }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(lastModified),
    priority,
    changeFrequency,
  }));
}
