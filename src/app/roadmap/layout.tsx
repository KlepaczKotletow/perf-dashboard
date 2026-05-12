import type { Metadata } from "next";

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

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
