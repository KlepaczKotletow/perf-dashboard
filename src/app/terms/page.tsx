import Link from "next/link";
import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Nami, the modern performance management platform powered by Slack.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service — Nami",
    description:
      "Terms of Service for Nami, the modern performance management platform powered by Slack.",
    url: "/terms",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — Nami",
    description: "Terms of Service for Nami.",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Terms of Service", item: `${SITE_URL}/terms` },
  ],
};

export default function TermsPage() {
  const effectiveDate = "March 27, 2026";

  return (
    <div className="min-h-screen bg-background py-16">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to home
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Effective date: {effectiveDate}
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* ── 1 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
            <p className="mb-3">
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you
              (&quot;Customer,&quot; &quot;you,&quot; or &quot;your&quot;) and Nami (&quot;Company,&quot;
              &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing your access to and use of the
              Nami platform, including the web application, Slack integration, APIs, and all related
              services (collectively, the &quot;Service&quot;).
            </p>
            <p className="mb-3">
              By creating an account, installing our Slack application, or otherwise accessing the
              Service, you acknowledge that you have read, understood, and agree to be bound by these
              Terms. If you are accepting these Terms on behalf of a company, organization, or other
              legal entity, you represent and warrant that you have the authority to bind that entity
              to these Terms, in which case &quot;you&quot; and &quot;your&quot; refer to that entity.
            </p>
            <p>
              If you do not agree to these Terms, you must not access or use the Service.
            </p>
          </section>

          {/* ── 2 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p className="mb-3">
              Nami is a cloud-based performance management platform that integrates with Slack. The
              Service enables organizations to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Conduct 360-degree performance reviews and calibration</li>
              <li>Run pulse surveys and eNPS measurement</li>
              <li>Manage competency frameworks and career levels</li>
              <li>Set, track, and align goals and OKRs</li>
              <li>Facilitate continuous peer-to-peer feedback</li>
              <li>Generate performance analytics, reports, and data exports</li>
              <li>Deliver review prompts and reminders via Slack direct messages</li>
            </ul>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any
              time, with or without notice. We shall not be liable to you or any third party for any
              modification, suspension, or discontinuance of the Service.
            </p>
          </section>

          {/* ── 3 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Accounts and Access</h2>
            <p className="mb-3">
              Access to the Service is authenticated through your Slack workspace using Slack&apos;s
              OAuth 2.0 protocol. The individual who installs the Nami Slack application and completes
              the subscription setup becomes the initial workspace administrator
              (&quot;Admin&quot;). Admins may assign roles (Admin, HR, Manager, Employee) to other
              workspace members.
            </p>
            <p className="mb-3">
              You are solely responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Maintaining the security of your Slack workspace and all associated credentials</li>
              <li>All activities that occur within your workspace on the Service</li>
              <li>Ensuring that only authorized individuals have access to your workspace</li>
              <li>Promptly notifying us of any unauthorized access or security breach</li>
            </ul>
            <p>
              We are not responsible for any loss or damage arising from your failure to comply with
              the above obligations, including any unauthorized access resulting from compromised Slack
              workspace credentials.
            </p>
          </section>

          {/* ── 4 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Subscriptions, Billing, and Payment</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.1 Subscription Plans</h3>
            <p className="mb-3">
              The Service is offered on a per-user, subscription basis with monthly or annual billing
              cycles. Plan tiers (Free, Starter, Professional, Enterprise) differ in user capacity,
              features, and support levels. Current pricing and plan details are available on our
              pricing page and may be updated from time to time.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.2 Payment Processing</h3>
            <p className="mb-3">
              All payment processing is handled by Stripe, Inc. (&quot;Stripe&quot;). By subscribing,
              you agree to Stripe&apos;s{" "}
              <a href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Terms of Service
              </a>
              . We do not store credit card numbers or bank account details on our servers.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.3 Automatic Renewal</h3>
            <p className="mb-3">
              Subscriptions automatically renew at the end of each billing period unless cancelled
              before the renewal date. You may cancel at any time through the billing settings in your
              dashboard or via the Stripe customer portal.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.4 Seat Counts</h3>
            <p className="mb-3">
              Your subscription fee is based on the number of active users in your workspace. You are
              responsible for managing your user count within the limits of your selected plan.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.5 Refunds</h3>
            <p className="mb-3">
              All fees are non-refundable except where required by applicable law. Refund requests may
              be submitted to{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>{" "}
              and will be reviewed on a case-by-case basis at our sole discretion.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.6 Price Changes</h3>
            <p>
              We may change our pricing at any time. Price changes for existing subscriptions will take
              effect at the start of the next billing period following at least thirty (30) days&apos;
              notice. Your continued use of the Service after a price change constitutes acceptance of
              the new pricing.
            </p>
          </section>

          {/* ── 5 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Customer Data and Ownership</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.1 Your Data</h3>
            <p className="mb-3">
              You retain all rights, title, and interest in and to all data, content, and information
              that you or your users submit to the Service (&quot;Customer Data&quot;). We claim no
              ownership over Customer Data.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.2 License to Us</h3>
            <p className="mb-3">
              You grant us a limited, non-exclusive, worldwide license to use, process, store, and
              transmit Customer Data solely to the extent necessary to provide, maintain, and improve
              the Service, and as otherwise described in our{" "}
              <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.3 What We Will Not Do</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>We will never sell, rent, or trade your Customer Data to third parties</li>
              <li>We will never use your Customer Data for advertising or marketing purposes</li>
              <li>We will never share identifiable Customer Data with other customers</li>
              <li>We will never use your Customer Data to train machine learning models without your
                explicit written consent</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.4 Aggregated and Anonymized Data</h3>
            <p className="mb-3">
              We may create aggregated, anonymized, or de-identified data derived from Customer Data
              (&quot;Aggregated Data&quot;) that cannot reasonably be used to identify you or any
              individual. We may use Aggregated Data for any lawful business purpose, including product
              improvement, benchmarking, and research.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.5 Data Isolation</h3>
            <p className="mb-3">
              Each workspace&apos;s data is logically isolated using database-level row-level security
              policies and cross-tenant validation. Customer Data from one workspace is never
              accessible to users of another workspace.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.6 Customer Responsibility for Data</h3>
            <p className="mb-3">
              You are solely responsible for the accuracy, quality, legality, and appropriateness of
              all Customer Data submitted to the Service. This includes ensuring that performance
              reviews, feedback, survey responses, and any other data entered by your users comply
              with applicable employment laws, anti-discrimination laws, and your own internal
              policies.
            </p>
            <p className="mb-3">
              We have no obligation to review, validate, or moderate Customer Data for compliance
              with any law, regulation, or internal policy. The Service is a tool that facilitates
              your performance management processes — all HR decisions, employment actions, and
              personnel judgments made using information from the Service are your sole
              responsibility.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.7 Data Sensitivity</h3>
            <p className="mb-3">
              The Service is designed to store workplace performance data such as review ratings,
              feedback, goals, and competency assessments. The Service is not designed to store or
              process highly sensitive personal data, including but not limited to: government-issued
              identification numbers, financial account information, health or medical records,
              biometric data, racial or ethnic origin, political opinions, religious beliefs, sexual
              orientation, or criminal history.
            </p>
            <p>
              If you or your users choose to include such information in free-text fields (such as
              review comments or feedback messages), you do so at your own risk and assume full
              responsibility for compliance with applicable data protection laws, including obtaining
              any necessary consents. We disclaim all liability for the storage, processing, or
              potential exposure of sensitive personal data that you voluntarily submit to the
              Service.
            </p>
          </section>

          {/* ── 6 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to, and will not permit any user under your account to:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Use the Service for any purpose that is unlawful or prohibited by these Terms</li>
              <li>Attempt to gain unauthorized access to another organization&apos;s workspace or data</li>
              <li>Interfere with, disrupt, or place an unreasonable burden on the Service or its
                infrastructure</li>
              <li>Reverse engineer, decompile, disassemble, or attempt to discover the source code of
                the Service</li>
              <li>Resell, sublicense, or redistribute the Service without prior written consent</li>
              <li>Use the Service to store or transmit malicious code, viruses, or harmful data</li>
              <li>Use the Service to harass, abuse, or harm another person or to collect personally
                identifiable information about users without their consent</li>
              <li>Use automated scripts, bots, or scrapers to access the Service except through our
                published APIs</li>
              <li>Circumvent any security measures, access controls, or usage limits of the Service</li>
            </ul>
            <p>
              We reserve the right to investigate and take appropriate action against anyone who, in
              our sole discretion, violates this section, including without limitation, removing
              content, suspending or terminating the offending user&apos;s account, and reporting such
              activity to law enforcement authorities.
            </p>
          </section>

          {/* ── 7 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Intellectual Property</h2>
            <p className="mb-3">
              The Service and its original content (excluding Customer Data), features, functionality,
              design, code, documentation, trademarks, logos, and all related intellectual property
              are and will remain the exclusive property of Nami and its licensors. The Service is
              protected by copyright, trademark, and other laws.
            </p>
            <p>
              These Terms do not grant you any right, title, or interest in the Service, the Nami
              name, the Nami logo, or any other intellectual property owned by us, except for the
              limited right to use the Service in accordance with these Terms.
            </p>
          </section>

          {/* ── 8 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Third-Party Services</h2>
            <p className="mb-3">
              The Service integrates with and relies upon third-party services, including but not
              limited to Slack (for authentication and messaging), Stripe (for payment processing),
              and cloud infrastructure providers (for hosting and storage). Your use of these
              third-party services is subject to their respective terms and privacy policies.
            </p>
            <p>
              We are not responsible for the availability, accuracy, or content of third-party
              services. We do not endorse and are not liable for any damage or loss caused by your
              reliance on or use of any third-party services. If a third-party service becomes
              unavailable or changes its terms in a way that affects our ability to deliver the
              Service, we shall not be liable for any resulting disruption or limitation.
            </p>
          </section>

          {/* ── 9 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Service Availability and Support</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">9.1 Uptime</h3>
            <p className="mb-3">
              We use commercially reasonable efforts to make the Service available, but we do not
              guarantee uninterrupted, error-free, or secure access. The Service is provided on an
              &quot;as available&quot; basis. We may perform scheduled maintenance, deploy updates, or
              experience unplanned outages that temporarily affect availability.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">9.2 No Guarantee of Results</h3>
            <p className="mb-3">
              The Service is a tool to facilitate performance management processes. We do not guarantee
              any specific outcomes, improvements in employee performance, or business results from
              your use of the Service. All performance management decisions remain your sole
              responsibility.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">9.3 Support</h3>
            <p>
              Support is provided via email at{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
              Response times and support levels vary by subscription plan. Enterprise customers may
              negotiate dedicated support and service level agreements (&quot;SLA&quot;) under a
              separate agreement.
            </p>
          </section>

          {/* ── 10 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Disclaimer of Warranties</h2>
            <p className="mb-3 uppercase font-medium text-foreground">
              To the maximum extent permitted by applicable law:
            </p>
            <p className="mb-3">
              The Service is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties
              of any kind, whether express, implied, statutory, or otherwise, including but not limited
              to implied warranties of merchantability, fitness for a particular purpose,
              non-infringement, title, accuracy, availability, and any warranties arising out of
              course of dealing or usage of trade.
            </p>
            <p className="mb-3">
              Without limiting the foregoing, we do not warrant that:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>The Service will meet your specific requirements or expectations</li>
              <li>The Service will be uninterrupted, timely, secure, or error-free</li>
              <li>The results obtained from the Service will be accurate, reliable, or complete</li>
              <li>Any errors or defects in the Service will be corrected within a specific timeframe</li>
              <li>The Service will be compatible with any particular hardware, software, or network
                configuration</li>
            </ul>
            <p>
              You acknowledge that bugs, errors, and unexpected behavior may occur in software
              products and that such occurrences do not constitute a breach of these Terms. You use
              the Service at your own risk.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.1 No Guarantee Against Data Loss</h3>
            <p>
              We do not guarantee that Customer Data will not be subject to inadvertent damage,
              corruption, loss, or removal. While we maintain industry-standard backup procedures, we
              are not liable for any loss of or damage to Customer Data arising from system failures,
              security incidents, third-party infrastructure outages, or any other cause. You are
              solely responsible for maintaining independent backups of your critical data. We
              strongly recommend that you regularly export your data using the export features
              provided in the Service.
            </p>
          </section>

          {/* ── 11 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Limitation of Liability</h2>
            <p className="mb-3 uppercase font-medium text-foreground">
              To the maximum extent permitted by applicable law:
            </p>
            <p className="mb-3">
              In no event shall Nami, its officers, directors, employees, agents, partners, suppliers,
              or licensors be liable for any indirect, incidental, special, consequential, exemplary,
              or punitive damages, including but not limited to damages for loss of profits, goodwill,
              revenue, data, business opportunities, use, or other intangible losses, arising out of
              or in connection with:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Your access to, use of, or inability to use the Service</li>
              <li>Any conduct or content of any third party on or related to the Service</li>
              <li>Any content obtained from or through the Service</li>
              <li>Unauthorized access, use, or alteration of your transmissions or data</li>
              <li>Any bugs, errors, viruses, or other harmful components in the Service</li>
              <li>Service interruptions, downtime, or data loss, whether planned or unplanned</li>
              <li>Any decisions made or actions taken based on information provided by the Service</li>
              <li>Loss of or damage to Customer Data, regardless of cause</li>
            </ul>
            <p className="mb-3">
              Our total aggregate liability for all claims arising out of or relating to these Terms
              or the Service shall not exceed the greater of: (a) the total amount you paid to us in
              the twelve (12) months immediately preceding the event giving rise to the claim, or (b)
              one hundred US dollars ($100).
            </p>
            <p className="mb-3">
              These limitations apply regardless of the legal theory upon which the claim is based,
              whether in contract, tort (including negligence), strict liability, or otherwise, even
              if we have been advised of the possibility of such damages.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.1 Exceptions</h3>
            <p className="mb-3">
              Nothing in these Terms shall limit or exclude liability for: (a) death or personal
              injury caused by negligence; (b) fraud or fraudulent misrepresentation; (c) any
              liability that cannot be lawfully limited or excluded; or (d) willful misconduct or
              gross negligence on our part.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.2 Security Incident Liability</h3>
            <p className="mb-3">
              In the event of a confirmed security incident resulting from our failure to maintain
              commercially reasonable security measures, our aggregate liability for claims arising
              from that incident shall not exceed the greater of: (a) the total amount you paid to
              us in the twenty-four (24) months immediately preceding the incident, or (b) two
              hundred US dollars ($200). This elevated cap applies only to direct damages caused by
              our breach of our security obligations and does not expand the exclusion of
              consequential damages set forth above.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.3 Time Limitation on Claims</h3>
            <p>
              You agree that any claim arising out of or related to these Terms or the Service must
              be filed within one (1) year after the cause of action accrues or the claim is
              discovered (whichever is later). Any claim filed after this one-year period is
              permanently barred. This limitation applies to the fullest extent permitted by
              applicable law.
            </p>
          </section>

          {/* ── 12 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless Nami, its officers, directors,
              employees, agents, and licensors from and against any and all claims, damages,
              obligations, losses, liabilities, costs, and expenses (including reasonable
              attorneys&apos; fees) arising from: (a) your use of and access to the Service; (b)
              your violation of these Terms; (c) your violation of any third-party right, including
              any intellectual property, privacy, or contractual right; (d) your Customer Data; or
              (e) any claim that your Customer Data caused damage to a third party. This defense and
              indemnification obligation will survive the termination of these Terms and your use of
              the Service.
            </p>
          </section>

          {/* ── 13 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">13. Termination</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">13.1 By You</h3>
            <p className="mb-3">
              You may cancel your subscription at any time through the billing settings in your
              dashboard or by contacting us. Upon cancellation, you will retain access to the Service
              until the end of your current paid billing period. No refund will be issued for the
              remaining portion of a billing period.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">13.2 By Us</h3>
            <p className="mb-3">
              We may suspend or terminate your access to the Service immediately, without prior notice
              or liability, for any reason, including but not limited to: (a) breach of these Terms;
              (b) non-payment of fees; (c) requests by law enforcement or government agencies; (d)
              extended periods of inactivity; or (e) unexpected technical or security issues.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">13.3 Effect of Termination</h3>
            <p className="mb-3">
              Upon termination, your right to use the Service ceases immediately. We will retain your
              Customer Data for thirty (30) days following termination to allow you to request an
              export. After this retention period, we will permanently and irreversibly delete your
              Customer Data from our systems.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">13.4 Survival</h3>
            <p>
              Sections 5 (Customer Data), 7 (Intellectual Property), 10 (Disclaimer of Warranties),
              11 (Limitation of Liability), 12 (Indemnification), 14 (Governing Law), 15 (Dispute
              Resolution), and 17 (General Provisions) shall survive any termination or expiration
              of these Terms.
            </p>
          </section>

          {/* ── 14 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">14. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State
              of Delaware, United States, without regard to its conflict of law principles. Any legal
              action or proceeding arising under these Terms shall be brought exclusively in the
              federal or state courts located in Delaware, and you consent to the personal jurisdiction
              of such courts.
            </p>
          </section>

          {/* ── 15 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">15. Dispute Resolution</h2>
            <p className="mb-3">
              Before filing any legal claim, you agree to attempt to resolve the dispute informally by
              contacting us at{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
              We will attempt to resolve the dispute informally within sixty (60) days. If we cannot
              resolve the dispute informally, either party may proceed with formal legal action as
              described in Section 14.
            </p>
            <p>
              For Enterprise customers, disputes may be subject to binding arbitration under the rules
              of the American Arbitration Association, if agreed upon in a separate Enterprise
              agreement.
            </p>
          </section>

          {/* ── 16 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">16. Changes to Terms</h2>
            <p className="mb-3">
              We reserve the right to modify these Terms at any time. If we make material changes, we
              will notify you by email or through a prominent notice within the Service at least
              thirty (30) days before the changes take effect. The &quot;Effective date&quot; at the
              top of this page indicates when these Terms were last revised.
            </p>
            <p>
              Your continued use of the Service after the effective date of any changes constitutes
              your acceptance of the revised Terms. If you do not agree with the revised Terms, you
              must stop using the Service and cancel your subscription.
            </p>
          </section>

          {/* ── 17 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">17. General Provisions</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.1 Entire Agreement</h3>
            <p className="mb-3">
              These Terms, together with the Privacy Policy and any order forms or Enterprise
              agreements, constitute the entire agreement between you and Nami regarding the Service
              and supersede all prior agreements, understandings, and communications.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.2 Severability</h3>
            <p className="mb-3">
              If any provision of these Terms is found to be unenforceable or invalid, that provision
              will be limited or eliminated to the minimum extent necessary, and the remaining
              provisions will remain in full force and effect.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.3 Waiver</h3>
            <p className="mb-3">
              No waiver of any term of these Terms shall be deemed a further or continuing waiver of
              such term or any other term. Our failure to enforce any right or provision of these
              Terms shall not constitute a waiver of that right or provision.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.4 Assignment</h3>
            <p className="mb-3">
              You may not assign or transfer these Terms or any rights granted hereunder without our
              prior written consent. We may assign these Terms without restriction, including in
              connection with a merger, acquisition, or sale of assets.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.5 Force Majeure</h3>
            <p>
              We shall not be liable for any failure or delay in performing our obligations where such
              failure or delay results from events beyond our reasonable control, including but not
              limited to natural disasters, war, terrorism, pandemics, epidemics, labor disputes,
              government actions, sanctions, embargoes, power failures, internet or
              telecommunications failures, cyberattacks (including distributed denial-of-service
              attacks, ransomware, or other malicious activity by third parties), security incidents
              affecting our third-party infrastructure providers (including but not limited to AWS,
              Supabase, Vercel, Slack, or Stripe), changes in applicable law or regulation, or any
              other event of similar nature or force. If a force majeure event continues for more
              than ninety (90) consecutive days, either party may terminate these Terms upon written
              notice.
            </p>
          </section>

          {/* ── Contact ───────────────────────────────────────── */}
          <section className="border-t pt-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">Contact Us</h2>
            <p className="mb-2">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <ul className="space-y-1">
              <li>
                Email:{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>
              </li>
              <li>
                Support:{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
