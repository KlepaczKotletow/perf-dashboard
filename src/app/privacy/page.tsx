import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Nami",
  description: "Privacy Policy for Nami. Learn how we collect, use, protect, and handle your data.",
};

export default function PrivacyPolicyPage() {
  const effectiveDate = "March 27, 2026";

  return (
    <div className="min-h-screen bg-background py-16">
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to home
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Effective date: {effectiveDate}
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* ── 1 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Introduction</h2>
            <p className="mb-3">
              Nami (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is
              committed to protecting the privacy and security of your information. This Privacy
              Policy explains how we collect, use, disclose, and safeguard your information when you
              use the Nami platform, including our web application, Slack integration, and all related
              services (collectively, the &quot;Service&quot;).
            </p>
            <p className="mb-3">
              By using the Service, you consent to the data practices described in this Privacy
              Policy. If you do not agree with the practices described herein, you should not use the
              Service.
            </p>
            <p>
              This Privacy Policy should be read in conjunction with our{" "}
              <Link href="/terms" className="text-primary underline">Terms of Service</Link>.
            </p>
          </section>

          {/* ── 2 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Information We Collect</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">2.1 Information from Slack</h3>
            <p className="mb-2">
              When you install the Nami Slack application, we receive the following information from
              your Slack workspace through the OAuth 2.0 authorization flow:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Slack workspace ID and workspace name</li>
              <li>Slack user IDs, display names, and email addresses</li>
              <li>Profile information such as job titles and avatar URLs</li>
              <li>Bot access tokens necessary to send messages on behalf of the Nami bot</li>
            </ul>
            <p className="mb-3">
              We request the following Slack OAuth scopes:{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">app_mentions:read</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">chat:write</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">commands</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">im:history</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">im:read</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">im:write</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">users:read</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">users:read.email</code>.
            </p>
            <p>
              We do not read the content of your Slack channels, group messages, or direct messages
              beyond those sent directly to the Nami bot as part of the review and feedback workflow.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">2.2 Information You Provide</h3>
            <p className="mb-2">
              Through your use of the Service, you and your workspace members may submit:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Performance review data:</strong> Competency ratings, written comments,
                overall ratings, and calibration grades</li>
              <li><strong>Survey responses:</strong> Answers to 360 surveys, pulse surveys, and eNPS
                scores</li>
              <li><strong>Feedback:</strong> Continuous peer-to-peer feedback messages, including
                praise, constructive feedback, and anonymous feedback</li>
              <li><strong>Goals and OKRs:</strong> Goal titles, descriptions, metrics, progress
                updates, and tracking status</li>
              <li><strong>Organizational data:</strong> Reporting structures, departments, job
                families, career levels, and competency frameworks</li>
              <li><strong>Workspace configuration:</strong> Company name, logo, rating scale
                preferences, and template configurations</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">2.3 Information Collected Automatically</h3>
            <p className="mb-2">
              When you access the Service, we automatically collect limited technical information:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Performance metrics:</strong> Page load times, Core Web Vitals, and
                interaction timing via Vercel Speed Insights (anonymized, no personal data)</li>
              <li><strong>Authentication data:</strong> Session tokens and cookies necessary to
                maintain your authenticated session</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">2.4 Information We Do NOT Collect</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>We do not use tracking cookies, advertising pixels, or behavioral analytics tools
                (no Google Analytics, no Meta Pixel, no ad trackers)</li>
              <li>We do not collect IP addresses for profiling or tracking purposes</li>
              <li>We do not access or read your general Slack messages, channels, or files</li>
              <li>We do not collect biometric data, geolocation data, or device fingerprints</li>
            </ul>
          </section>

          {/* ── 3 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <p className="mb-2">
              We use the information we collect for the following purposes:
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">3.1 To Provide and Operate the Service</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Authenticate users and manage workspace access via Slack OAuth</li>
              <li>Store and display performance reviews, feedback, goals, and survey data</li>
              <li>Generate analytics dashboards, competency heatmaps, and reports</li>
              <li>Deliver review prompts, reminders, and notifications via Slack direct messages</li>
              <li>Process subscription payments through Stripe</li>
              <li>Enable data exports (CSV) for your reporting needs</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">3.2 To Maintain and Improve the Service</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Monitor performance and fix bugs</li>
              <li>Analyze aggregated, anonymized usage patterns to improve features</li>
              <li>Ensure the security and integrity of the platform</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">3.3 To Communicate with You</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Respond to support inquiries</li>
              <li>Send important notices about your account or changes to our terms</li>
              <li>Provide billing-related communications via Stripe</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">3.4 How We Do NOT Use Your Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>We never sell, rent, lease, or trade your personal information or Customer Data to
                any third party, for any reason, under any circumstances</li>
              <li>We never use your data for targeted advertising or marketing</li>
              <li>We never share your identifiable data with other Nami customers</li>
              <li>We never use your Customer Data to train artificial intelligence or machine learning
                models without your explicit prior written consent</li>
              <li>We never profile individual users for purposes unrelated to the Service</li>
            </ul>
          </section>

          {/* ── 4 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Data Sharing and Disclosure</h2>
            <p className="mb-3">
              We do not sell your personal information. We may share your information only in the
              following limited circumstances:
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.1 Service Providers</h3>
            <p className="mb-2">
              We share information with third-party service providers who perform services on our
              behalf. These providers are contractually obligated to protect your information and may
              only use it to provide their services to us:
            </p>
            <table className="w-full border-collapse text-sm mb-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-foreground">Provider</th>
                  <th className="text-left py-2 pr-4 font-medium text-foreground">Purpose</th>
                  <th className="text-left py-2 font-medium text-foreground">Data Shared</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4">Slack (Salesforce)</td>
                  <td className="py-2 pr-4">Authentication, bot messaging</td>
                  <td className="py-2">User IDs, bot tokens, DM content for reviews</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Stripe</td>
                  <td className="py-2 pr-4">Payment processing</td>
                  <td className="py-2">Email address, subscription plan, payment status</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Supabase (AWS)</td>
                  <td className="py-2 pr-4">Database hosting, authentication</td>
                  <td className="py-2">All Customer Data (encrypted at rest)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Vercel</td>
                  <td className="py-2 pr-4">Application hosting, performance monitoring</td>
                  <td className="py-2">Anonymized performance metrics only</td>
                </tr>
              </tbody>
            </table>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.2 Subprocessor Changes</h3>
            <p className="mb-3">
              We will maintain an up-to-date list of our subprocessors (third-party service providers
              who process Customer Data on our behalf) in this Privacy Policy. If we add or replace a
              subprocessor that processes Customer Data, we will notify workspace administrators via
              email at least thirty (30) days before the new subprocessor begins processing Customer
              Data. If you object to a new subprocessor, you may terminate your subscription before
              the subprocessor begins processing your data.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.3 Legal Requirements</h3>
            <p className="mb-3">
              We may disclose your information if required to do so by law or in good faith belief
              that such action is necessary to: (a) comply with a legal obligation, court order, or
              legal process; (b) protect and defend our rights or property; (c) prevent fraud or
              abuse of the Service; or (d) protect the personal safety of users or the public.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.4 Business Transfers</h3>
            <p>
              In the event of a merger, acquisition, reorganization, bankruptcy, or sale of all or a
              portion of our assets, your information may be transferred as part of that transaction.
              We will notify you via email or a prominent notice on the Service before your
              information becomes subject to a different privacy policy.
            </p>
          </section>

          {/* ── 5 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Security</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.1 Technical Safeguards</h3>
            <p className="mb-2">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Encryption at rest:</strong> All data is encrypted using AES-256 encryption
                via our infrastructure provider (AWS)</li>
              <li><strong>Encryption in transit:</strong> All data transmission uses TLS 1.2 or higher</li>
              <li><strong>Tenant isolation:</strong> Each workspace&apos;s data is isolated at the
                database level using row-level security (RLS) policies and cross-tenant validation
                triggers. Users from one workspace cannot access data belonging to another
                workspace</li>
              <li><strong>Authentication:</strong> Access is managed through Slack OAuth 2.0.
                JWT-based session tokens are used for request authentication. We do not store
                passwords</li>
              <li><strong>Access controls:</strong> Role-based access control (Admin, HR, Manager,
                Employee) limits data visibility within each workspace</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.2 Organizational Safeguards</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Access to production systems is restricted to authorized personnel only</li>
              <li>We follow the principle of least privilege for internal access</li>
              <li>We conduct regular security reviews of our codebase and infrastructure</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.3 Limitations</h3>
            <p className="mb-3">
              While we strive to protect your information, no method of electronic transmission or
              storage is 100% secure. We cannot guarantee absolute security of your data. You
              acknowledge that the nature of the data stored in the Service (workplace performance
              assessments, feedback, and goals) does not include highly sensitive categories such as
              financial account numbers, government IDs, health records, or biometric data.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.4 Security Incident Response</h3>
            <p className="mb-3">
              In the event of a confirmed security incident that results in unauthorized access to,
              or disclosure of, Customer Data, we will:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Promptly investigate the nature and scope of the incident</li>
              <li>Take reasonable steps to contain and remediate the incident</li>
              <li>Notify affected workspace administrators without undue delay and, where required by
                GDPR, within seventy-two (72) hours of becoming aware of the incident</li>
              <li>Provide a description of the nature of the incident, the categories and approximate
                number of records affected, the likely consequences, and the measures taken or
                proposed to address the incident</li>
              <li>Notify relevant data protection authorities and other regulators as required by
                applicable law</li>
              <li>Cooperate with affected customers in their own notification and remediation efforts</li>
            </ul>
            <p>
              A security incident does not include unsuccessful attempts such as port scans, denied
              service attacks that do not result in a breach, unsuccessful login attempts, or similar
              events that do not compromise the confidentiality, integrity, or availability of
              Customer Data.
            </p>
          </section>

          {/* ── 6 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Retention</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">6.1 Active Accounts</h3>
            <p className="mb-3">
              We retain your Customer Data for as long as your account is active and you maintain an
              active subscription. Data is stored and accessible throughout the duration of your
              use of the Service.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">6.2 After Termination</h3>
            <p className="mb-3">
              Upon cancellation or termination of your subscription, we retain your Customer Data for
              thirty (30) days to allow you to request an export or reactivate your account. After
              this 30-day grace period, your Customer Data will be permanently and irreversibly
              deleted from our production systems.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">6.3 Backup Retention</h3>
            <p className="mb-3">
              Automated backups that may contain your data are retained for a limited period (up to
              30 additional days) for disaster recovery purposes and are then permanently deleted.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">6.4 Legal Requirements</h3>
            <p>
              We may retain certain information for longer periods where required by law, regulation,
              or legitimate business interests (such as resolving disputes or enforcing our
              agreements).
            </p>
          </section>

          {/* ── 7 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Cookies and Tracking</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">7.1 Essential Cookies Only</h3>
            <p className="mb-3">
              We use only strictly necessary cookies required for the Service to function. These
              include authentication session cookies managed by Supabase. These cookies are essential
              for maintaining your logged-in state and cannot be disabled while using the Service.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">7.2 No Tracking Cookies</h3>
            <p>
              We do not use advertising cookies, third-party tracking cookies, social media tracking
              pixels, or any form of cross-site tracking. We do not participate in ad networks or
              cookie-based retargeting. We do not build behavioral profiles of our users.
            </p>
          </section>

          {/* ── 8 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Your Rights</h2>
            <p className="mb-3">
              Depending on your location, you may have the following rights regarding your personal
              information:
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.1 General Rights (All Users)</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete personal
                data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data, subject to our
                legal retention obligations</li>
              <li><strong>Export:</strong> Export your data in a portable, machine-readable format
                (CSV) through the Service dashboard</li>
              <li><strong>Withdraw consent:</strong> Withdraw consent at any time by uninstalling the
                Slack application. This will not affect the lawfulness of processing based on consent
                before its withdrawal</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.2 European Economic Area (EEA) and UK Residents</h3>
            <p className="mb-3">
              If you are a resident of the EEA or UK, you have additional rights under the General
              Data Protection Regulation (GDPR) and UK GDPR, including:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Legal basis for processing:</strong> We process your data on the basis of
                contractual necessity (to provide the Service you subscribed to) and legitimate
                interest (to maintain and improve the Service)</li>
              <li><strong>Right to restrict processing:</strong> You may request we limit how we use
                your data in certain circumstances</li>
              <li><strong>Right to object:</strong> You may object to processing based on legitimate
                interests</li>
              <li><strong>Right to data portability:</strong> You may request your data in a
                structured, commonly used, machine-readable format</li>
              <li><strong>Right to lodge a complaint:</strong> You have the right to lodge a complaint
                with your local data protection authority</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.3 California Residents (CCPA/CPRA)</h3>
            <p className="mb-3">
              If you are a California resident, the California Consumer Privacy Act (CCPA) and
              California Privacy Rights Act (CPRA) provide you with additional rights:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Right to know:</strong> You have the right to know what personal information
                we collect, use, and disclose</li>
              <li><strong>Right to delete:</strong> You can request we delete your personal
                information</li>
              <li><strong>Right to non-discrimination:</strong> We will not discriminate against you
                for exercising your privacy rights</li>
              <li><strong>Sale of personal information:</strong> We do not sell your personal
                information and have never sold personal information. We do not share personal
                information for cross-context behavioral advertising</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.4 Exercising Your Rights</h3>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
              We will respond to your request within thirty (30) days. We may ask you to verify your
              identity before processing your request. Workspace administrators may also exercise
              rights on behalf of their organization&apos;s users.
            </p>
          </section>

          {/* ── 9 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. International Data Transfers</h2>
            <p className="mb-3">
              Your information may be transferred to and processed in countries other than your
              country of residence, including the United States, where our infrastructure providers
              operate. These countries may have data protection laws that differ from those in your
              country.
            </p>
            <p>
              Where we transfer data outside the EEA or UK, we rely on appropriate safeguards such
              as Standard Contractual Clauses (SCCs) approved by the European Commission, or other
              legally recognized transfer mechanisms to ensure your data is protected in accordance
              with applicable law.
            </p>
          </section>

          {/* ── 10 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to individuals under the age of 16, and we do not knowingly
              collect personal information from children under 16. If we become aware that we have
              collected personal information from a child under 16, we will take immediate steps to
              delete that information. If you believe we have collected information from a child under
              16, please contact us at{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
            </p>
          </section>

          {/* ── 11 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Data Processing Agreement</h2>
            <p>
              For customers who require a Data Processing Agreement (DPA) for GDPR compliance or
              other regulatory requirements, we offer a standard DPA that covers our obligations as a
              data processor. To request a DPA, contact us at{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
              Enterprise customers may negotiate custom data processing terms as part of their
              Enterprise agreement.
            </p>
          </section>

          {/* ── 12 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Changes to This Privacy Policy</h2>
            <p className="mb-3">
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              technology, legal requirements, or other factors. If we make material changes, we will
              notify you by email or through a prominent notice within the Service at least thirty
              (30) days before the changes take effect.
            </p>
            <p>
              The &quot;Effective date&quot; at the top of this page indicates when this Privacy
              Policy was last revised. Your continued use of the Service after any changes to this
              Privacy Policy constitutes your acceptance of the updated policy.
            </p>
          </section>

          {/* ── Contact ───────────────────────────────────────── */}
          <section className="border-t pt-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">Contact Us</h2>
            <p className="mb-3">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our
              data practices, please contact us:
            </p>
            <ul className="space-y-1">
              <li>
                Privacy inquiries:{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>
              </li>
              <li>
                Legal inquiries:{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>
              </li>
              <li>
                General support:{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
