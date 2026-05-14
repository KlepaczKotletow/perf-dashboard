import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Book, Mail, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with Nami — your Slack-native performance management tool. Quick-start commands, common questions, and direct email support at hello@namihr.com.",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Support — Nami",
    description:
      "Get help with Nami — quick-start commands, common questions, and direct email support.",
    url: "/support",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Support — Nami",
    description: "Get help with Nami — your Slack-native performance management tool.",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Support", item: `${SITE_URL}/support` },
  ],
};

// Mirrors the visible FAQ below so AI search engines and Google can surface
// these answers directly in SERPs.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I start a 360 review?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Nami bot will message you directly in Slack when a review cycle begins. Follow the guided conversation to rate competencies and answer questions. You can also check your pending reviews in the Nami app Home Tab.",
      },
    },
    {
      "@type": "Question",
      name: "Can feedback be anonymous?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Yes. When giving feedback you can choose to make it anonymous. The recipient will see the feedback but not who sent it.",
      },
    },
    {
      "@type": "Question",
      name: "Who can see the feedback and reviews?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "By default, managers and admins can see all feedback. Regular employees can only see feedback they have received or given. You can customise these permissions in your workspace settings.",
      },
    },
    {
      "@type": "Question",
      name: "How do I access the dashboard?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Click 'Sign in with Slack' on our homepage. You'll be authenticated through your Slack account and redirected to your workspace dashboard.",
      },
    },
    {
      "@type": "Question",
      name: "Can I create custom review templates?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Yes. Managers and admins can create custom templates with different questions, rating scales, and required fields. Go to Templates in your dashboard to create and manage templates.",
      },
    },
  ],
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
            Support & Help
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Get help with Nami
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-12">
          <Card>
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Learn how to use Nami</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Quick Commands</h4>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li><code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">/kudos</code> - Give quick feedback to a teammate</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Book className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle>Documentation</CardTitle>
              <CardDescription>Detailed guides and tutorials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>• Setting up your first review cycle</li>
                <li>• Creating custom templates</li>
                <li>• Understanding analytics</li>
                <li>• Managing team roles</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                How do I start a 360 review?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Nami bot will message you directly in Slack when a review cycle begins.
                Follow the guided conversation to rate competencies and answer questions.
                You can also check your pending reviews in the Nami app Home Tab.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                Can feedback be anonymous?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Yes! When giving feedback, you can choose to make it anonymous. 
                The recipient will see the feedback but not who sent it.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                Who can see the feedback and reviews?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                By default, managers and admins can see all feedback. Regular employees 
                can only see feedback they&apos;ve received or given. You can customize these 
                permissions in your workspace settings.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                How do I access the dashboard?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Click &quot;Sign in with Slack&quot; on our homepage. You&apos;ll be authenticated 
                through your Slack account and redirected to your workspace dashboard.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                Can I create custom review templates?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Yes! Managers and admins can create custom templates with different 
                questions, rating scales, and required fields. Go to Templates in 
                your dashboard to create and manage templates.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Mail className="h-8 w-8 text-purple-600 mb-2" />
            <CardTitle>Contact Support</CardTitle>
            <CardDescription>Need more help? We&apos;re here for you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              If you can&apos;t find the answer you&apos;re looking for, reach out to our support team. 
              We typically respond within 24 hours.
            </p>
            <div className="flex gap-4">
              <Button asChild>
                <a href="mailto:hello@namihr.com">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Support
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
