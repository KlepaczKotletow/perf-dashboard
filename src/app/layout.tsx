import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nami — Performance Management in Slack",
    template: "%s — Nami",
  },
  description:
    "Modern performance management powered by Slack. Run 360° reviews, track competencies, set goals, and give continuous feedback — without leaving Slack.",
  applicationName: "Nami",
  keywords: [
    "performance management",
    "performance management Slack",
    "Slack performance reviews",
    "360 feedback Slack",
    "OKRs",
    "OKR tracking",
    "employee engagement",
    "pulse surveys",
    "competency framework",
    "9-box calibration",
    "Slack HR tools",
    "Lattice alternative",
    "15Five alternative",
    "Leapsome alternative",
    "Culture Amp alternative",
  ],
  authors: [{ name: "Nami" }],
  creator: "Nami",
  publisher: "Nami",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Nami",
    title: "Nami — Performance Management in Slack",
    description:
      "360° reviews, OKR tracking, pulse surveys, and continuous feedback — all inside Slack. Performance management your team will actually complete.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nami — Performance Management in Slack",
    description:
      "360° reviews, OKR tracking, pulse surveys, and continuous feedback — all inside Slack.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "Business Software",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
