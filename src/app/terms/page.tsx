import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background py-16">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to home
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-8">
          Terms of Service
        </h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                By accessing or using Perf (&quot;the Service&quot;), you agree to be bound
                by these Terms of Service. If you are using the Service on behalf
                of an organization, you represent that you have authority to bind
                that organization to these terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Description of Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                Perf is a performance management platform that integrates with
                Slack. The Service allows organizations to conduct 360-degree
                reviews, give continuous feedback, manage competency frameworks,
                and track performance analytics.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Subscriptions and Billing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                The Service is offered on a per-user, per-month subscription
                basis. By subscribing, you agree to pay the fees associated with
                your selected plan. Subscriptions automatically renew unless
                cancelled before the end of the billing period.
              </p>
              <p>
                Seat counts are determined by the number of unique users who
                interact with the Service within a billing period. You may manage
                your subscription through the billing settings in your dashboard
                or via the Stripe customer portal.
              </p>
              <p>
                Refunds are handled on a case-by-case basis. Contact
                support@getperf.com for refund requests.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. User Accounts and Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                Access to the Service is managed through your Slack workspace.
                The person who installs the Slack app and completes payment
                becomes the workspace administrator. Administrators can assign
                roles (Admin, HR, Employee) to other members. Manager status is determined by having direct reports.
              </p>
              <p>
                You are responsible for maintaining the security of your Slack
                workspace and for all activity that occurs through your account.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Data Ownership and Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                You retain ownership of all data you submit to the Service. We
                process your data solely to provide and improve the Service, as
                described in our{" "}
                <Link href="/privacy" className="text-primary underline">
                  Privacy Policy
                </Link>
                .
              </p>
              <p>
                Each workspace&apos;s data is isolated using row-level security
                and cross-tenant validation. We will not access, use, or share
                your data except as necessary to operate the Service or as
                required by law.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Acceptable Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the Service for any unlawful purpose</li>
                <li>
                  Attempt to access another organization&apos;s data
                </li>
                <li>Reverse engineer or decompile any part of the Service</li>
                <li>
                  Resell or redistribute the Service without written permission
                </li>
                <li>Interfere with the Service&apos;s infrastructure</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Service Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                We strive to maintain high availability but do not guarantee
                uninterrupted access. We may perform maintenance or updates that
                temporarily affect availability. We will provide reasonable
                notice of planned downtime when possible.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                You may cancel your subscription at any time through the billing
                settings. Upon cancellation, you will retain access until the end
                of your current billing period. We may terminate or suspend
                access for violation of these terms.
              </p>
              <p>
                Upon termination, your data will be retained for 30 days to
                allow for export, after which it will be permanently deleted.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                To the maximum extent permitted by law, Perf shall not be liable
                for any indirect, incidental, special, consequential, or
                punitive damages arising out of or relating to your use of the
                Service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                We may update these terms from time to time. We will notify you
                of material changes via email or through the Service. Continued
                use after changes constitutes acceptance of the new terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                For questions about these terms, contact us at{" "}
                <a
                  href="mailto:legal@getperf.com"
                  className="text-primary underline"
                >
                  legal@getperf.com
                </a>
              </p>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Last updated: February 2026
          </p>
        </div>
      </div>
    </div>
  );
}
