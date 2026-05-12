import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

const DISALLOW_PATHS = ["/api/", "/auth/", "/dashboard/", "/onboarding/", "/setup/"];

// Explicit list of AI / answer-engine crawlers we welcome. The `*` rule below
// already permits them, but stating intent helps crawlers that look for their
// own user-agent first, and makes our stance auditable.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "DuckAssistBot",
  "YouBot",
  "Meta-ExternalAgent",
  "Bytespider",
  "Amazonbot",
  "cohere-ai",
  "Diffbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW_PATHS,
      },
      ...AI_CRAWLERS.map((ua) => ({
        userAgent: ua,
        allow: "/",
        disallow: DISALLOW_PATHS,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
