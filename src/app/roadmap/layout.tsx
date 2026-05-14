import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What's shipping next in Nami. Vote on upcoming features, suggest new ones, and see what's planned, in progress, and recently shipped.",
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: "Roadmap — Nami",
    description:
      "What's shipping next in Nami. Vote on features, suggest new ones, see what's planned.",
    url: "/roadmap",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Roadmap — Nami",
    description: "What's shipping next in Nami. Vote on features and suggest new ones.",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Roadmap", item: `${SITE_URL}/roadmap` },
  ],
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
