import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "$5/user/month. Unlimited review cycles, 360° reviews, OKRs, surveys, calibration, and analytics. Free for teams of 10 or fewer. 14-day trial, no credit card.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing — Nami",
    description:
      "$5/user/month. Everything included. Free for teams of 10 or fewer. 14-day trial, no credit card.",
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Nami",
    description: "$5/user/month. Everything included. Free for teams of 10 or fewer.",
  },
};

const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Nami",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Performance Management",
  operatingSystem: "Web, Slack",
  description:
    "Performance management for teams in Slack. 360° reviews, OKR tracking, pulse surveys, competency frameworks, 9-box calibration, and analytics.",
  url: `${SITE_URL}/pricing`,
  brand: { "@type": "Brand", name: "Nami" },
  offers: [
    {
      "@type": "Offer",
      name: "Pro",
      price: "5.00",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "5.00",
        priceCurrency: "USD",
        unitText: "user/month",
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: 1,
          unitCode: "MON",
        },
      },
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/pricing`,
    },
    {
      "@type": "Offer",
      name: "Free for small teams",
      price: "0.00",
      priceCurrency: "USD",
      description: "Free indefinitely for teams of 10 or fewer.",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/pricing`,
    },
  ],
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {children}
    </>
  );
}
