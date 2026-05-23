import Link from "next/link";
import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Nami, the Slack-native performance management platform. How we collect, use, protect, and handle your data — including data residency, retention, subprocessors, and your rights under GDPR, UK GDPR, CCPA/CPRA, and similar laws.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy — Nami",
    description:
      "How Nami collects, uses, protects, and handles your data — including retention, residency, subprocessors, and your GDPR / CCPA rights.",
    url: "/privacy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy — Nami",
    description: "How Nami collects, uses, protects, and handles your data.",
  },
};

export default function PrivacyPolicyPage() {
  const effectiveDate = "May 23, 2026";

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
              Nami (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is the
              Slack-native performance management platform available at{" "}
              <a href={SITE_URL} className="text-primary underline">namihr.com</a>. This Privacy Policy
              explains how we collect, use, disclose, and safeguard information when you or your
              organization use the Nami web application, our Slack integration, our public website,
              and any related services (collectively, the &quot;Service&quot;).
            </p>
            <p className="mb-3">
              By using the Service, you consent to the data practices described in this Privacy
              Policy. If you do not agree with the practices described herein, you must not use the
              Service.
            </p>
            <p>
              This Privacy Policy should be read together with our{" "}
              <Link href="/terms" className="text-primary underline">Terms of Service</Link> and our{" "}
              <Link href="/security" className="text-primary underline">Security overview</Link>.
            </p>
          </section>

          {/* ── 2 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              2. Controller, Processor, and Roles
            </h2>
            <p className="mb-3">
              For data submitted to the Service through your Slack workspace (such as performance
              reviews, feedback, goals, survey responses, and directory information), your
              organization is the <strong>data controller</strong> and Nami acts as the{" "}
              <strong>data processor</strong> processing that information solely on your
              instructions and as described in this Privacy Policy and our Data Processing
              Agreement.
            </p>
            <p className="mb-3">
              Because performance reviews, ratings, calibration grades, and feedback messages relate
              to employment, your organization (as the employer) is the controller responsible for
              determining the lawful basis for processing, providing transparency to its employees,
              and responding to employee data-subject requests in the first instance. Nami will
              support you in fulfilling those obligations.
            </p>
            <p>
              For information collected directly by Nami in our role as a business — for example,
              billing contact details, marketing-website analytics, or correspondence sent to{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>{" "}
              — Nami acts as an independent controller.
            </p>
          </section>

          {/* ── 3 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Information We Collect</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">3.1 Information from Slack</h3>
            <p className="mb-2">
              When you install the Nami Slack application or sign in with Slack, Slack provides us
              with the following information through the OAuth 2.0 authorization flow:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Slack workspace ID, name, and domain</li>
              <li>Slack user IDs, display names, real names, and email addresses</li>
              <li>Limited profile information such as job title, time zone, and avatar URL</li>
              <li>Bot and user access tokens necessary to operate the Nami bot</li>
              <li>Workspace channel list (channel ID, name, and visibility), so that admins can
                pick channels for announcements or kudos</li>
            </ul>
            <p className="mb-2">
              We request the following Slack OAuth scopes. We have aligned this list with the exact
              scopes implemented in our codebase so it is accurate, not aspirational.
            </p>

            <h4 className="font-medium text-foreground mt-3 mb-2 text-[13px]">
              Bot-token scopes
            </h4>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">app_mentions:read</code> —
                receive events when someone @-mentions the Nami bot
              </li>
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">channels:read</code> — list
                public channels so admins can pick one for announcements or kudos. We do not read
                channel messages.
              </li>
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">chat:write</code> — send
                review prompts, survey questions, kudos posts, and reminders as the Nami bot
              </li>
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">commands</code> — register
                and handle Nami&apos;s slash commands (e.g.{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">/kudos</code>)
              </li>
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">im:history</code> /{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">im:read</code> /{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">im:write</code> — open,
                read, and send messages in direct-message conversations between the user and the
                Nami bot. Used exclusively to deliver review/survey prompts and accept the
                user&apos;s replies. We do not read DMs between two human users.
              </li>
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">reactions:read</code> —
                detect emoji reactions on Nami&apos;s own messages (used for one-tap survey
                responses)
              </li>
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">team:read</code> — retrieve
                workspace name, icon, and domain so we can display them in the dashboard
              </li>
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">users:read</code> /{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">users:read.email</code> —
                read the directory of workspace members (name, email, title, avatar, deactivated
                status) to build the org directory and assign reviews
              </li>
            </ul>

            <h4 className="font-medium text-foreground mt-3 mb-2 text-[13px]">
              User-token scopes (sign-in only)
            </h4>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">identity.basic</code> —
                confirm the signing-in user&apos;s Slack identity and workspace
              </li>
              <li>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">identity.email</code> —
                retrieve the signing-in user&apos;s email address to match them to a directory entry
              </li>
            </ul>
            <p className="mb-3">
              We do not request, read, or store the content of your workspace&apos;s public
              channels, private channels, group messages, or direct messages between human users.
              The only Slack messages we read are those sent to the Nami bot in a direct-message
              conversation, as part of the review or feedback workflow.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">3.2 Information You Provide Through the Service</h3>
            <p className="mb-2">
              Through your use of the Service, you and your workspace members may submit the
              following types of information, all of which constitute Customer Data:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Performance review data:</strong> competency ratings, written comments,
                overall ratings, calibration grades, and 9-box positions, including private
                calibration notes visible only to HR and Admins</li>
              <li><strong>Survey responses:</strong> answers to 360 surveys, pulse surveys, and
                eNPS scores, including responses you choose to submit anonymously</li>
              <li><strong>Continuous feedback:</strong> peer-to-peer kudos, private feedback, and
                anonymous feedback messages</li>
              <li><strong>Goals and OKRs:</strong> goal titles, descriptions, metrics, key results,
                progress updates, status, and goal-level audit entries</li>
              <li><strong>Organizational data:</strong> reporting structures, departments,
                functions, job families, career levels, and competency frameworks</li>
              <li><strong>Workspace configuration:</strong> company name, logo URL, rating scale
                preferences, template configurations, and onboarding choices</li>
              <li><strong>Audit-log entries:</strong> records of cycle status transitions,
                calibration grade changes, grade releases, user role changes, and review assignment
                changes</li>
              <li><strong>Billing contact information:</strong> the admin email associated with
                your Stripe subscription</li>
              <li><strong>Roadmap voting and suggestions:</strong> if you use the public roadmap
                page, we store a random browser identifier for vote deduplication, and any feature
                suggestion text or optional email you submit</li>
            </ul>
            <p className="mb-3">
              The Service is not intended to store special categories of data, including data
              concerning health, racial or ethnic origin, political opinions, religious beliefs,
              trade union membership, genetic data, biometric data, sex life, sexual orientation,
              criminal convictions, government-issued identifiers, or financial account numbers. If
              your users choose to type such information into free-text fields, you do so at your
              own risk and assume responsibility under applicable law.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">3.3 Information Collected Automatically</h3>
            <p className="mb-2">
              When you access the Service we automatically collect limited technical information:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <strong>Authentication state:</strong> session tokens and cookies issued by Supabase
                Auth to keep you signed in
              </li>
              <li>
                <strong>Application logs:</strong> server-side request logs containing timestamps,
                request paths, response status codes, error messages, workspace and user
                identifiers, and minimal context needed to diagnose issues. Logs are retained for
                up to 30 days unless required for security investigation.
              </li>
              <li>
                <strong>Performance metrics:</strong> Core Web Vitals and page-load timing collected
                by Vercel Speed Insights (no personal identifiers; sampled)
              </li>
              <li>
                <strong>Site analytics:</strong> page-view counts and referrer information collected
                by Vercel Analytics. Vercel Analytics is cookieless by design and does not build
                cross-site profiles or track individual users.
              </li>
              <li>
                <strong>Conversion tracking on marketing pages:</strong> our public marketing pages
                (homepage, pricing, roadmap) load Google Ads gtag.js (account ID{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">AW-18179782629</code>) so we
                can measure which advertising campaigns drive sign-ups. This loads on the marketing
                surface only; it does not run on the authenticated dashboard. You can opt out of
                Google&apos;s personalized advertising via{" "}
                <a
                  href="https://adssettings.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Google Ads Settings
                </a>{" "}
                or by using a browser tracking-protection setting.
              </li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">3.4 Information We Do Not Collect</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>We do not use third-party behavioural analytics (no Meta Pixel, no TikTok pixel,
                no LinkedIn Insight Tag, no Mixpanel, Amplitude, Segment, PostHog, FullStory, or
                Hotjar)</li>
              <li>We do not collect IP addresses for profiling or for building user-level
                behavioural records</li>
              <li>We do not collect biometric data, precise geolocation, or device fingerprints</li>
              <li>We do not read messages from your Slack channels, private channels, or direct
                messages between human users</li>
              <li>We do not accept file uploads. Avatars are URLs supplied by Slack; CSV team
                imports are parsed in your browser and only the parsed rows are submitted</li>
            </ul>
          </section>

          {/* ── 4 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. How We Use Information</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.1 To Provide and Operate the Service</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Authenticate users and manage workspace access via Slack OAuth</li>
              <li>Store and display reviews, feedback, goals, and survey data</li>
              <li>Generate analytics dashboards, competency heatmaps, and ranking reports</li>
              <li>Deliver review prompts, survey questions, kudos posts, and reminders via Slack
                direct messages and slash commands</li>
              <li>Process subscription payments through Stripe</li>
              <li>Enable CSV exports for reviews, goals, and analytics</li>
              <li>Enforce role-based access control (Admin, HR, Manager, Employee)</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.2 To Maintain, Secure, and Improve the Service</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Monitor application health, performance, and error rates</li>
              <li>Detect, investigate, and respond to abuse, fraud, or security incidents</li>
              <li>Debug and fix issues reported by customers or surfaced by our logs</li>
              <li>Analyze aggregated and de-identified usage patterns to improve features and
                inform our product roadmap</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.3 To Communicate With You</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Respond to support, sales, billing, privacy, and security inquiries</li>
              <li>Send transactional notices about your account, our terms, or material changes to
                our subprocessor list</li>
              <li>Send billing communications via Stripe</li>
              <li>Reply to feature suggestions submitted through the public roadmap page</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.4 To Meet Legal Obligations</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Comply with applicable laws, regulations, court orders, valid legal process, and
                lawful requests from public authorities</li>
              <li>Enforce our Terms of Service, prevent abuse, and protect the rights, property,
                and safety of Nami, our customers, and third parties</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.5 How We Do Not Use Your Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>We never sell, rent, lease, or trade Customer Data or personal information to
                any third party, for any reason, under any circumstances</li>
              <li>We never use Customer Data for advertising, behavioral retargeting, or marketing
                to your employees</li>
              <li>We never share identifiable Customer Data with other Nami customers</li>
              <li>We never use Customer Data to train artificial intelligence or machine-learning
                models without the workspace administrator&apos;s explicit prior written consent.
                The Service does not currently include any AI features that process Customer Data.</li>
              <li>We never make employment decisions on your behalf. The Service is a tool that
                presents information for your decision-makers to use</li>
            </ul>
          </section>

          {/* ── 5 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              5. Legal Bases for Processing (EEA, UK, Switzerland)
            </h2>
            <p className="mb-3">
              Where the GDPR, UK GDPR, or Swiss FADP applies, we rely on the following legal bases:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Performance of a contract</strong> — to deliver the Service to your
                organization under our Terms of Service</li>
              <li><strong>Legitimate interests</strong> — to secure the Service, prevent fraud,
                operate billing and support, communicate about the Service, and improve features
                in ways consistent with users&apos; reasonable expectations</li>
              <li><strong>Legal obligation</strong> — to comply with tax, accounting, and legal
                requests</li>
              <li><strong>Consent</strong> — where required, for example, for non-essential
                cookies on our marketing pages where consent is mandatory; you can withdraw consent
                at any time without affecting prior lawful processing</li>
            </ul>
          </section>

          {/* ── 6 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Sharing and Disclosure</h2>
            <p className="mb-3">
              We do not sell personal information. We share information only in the limited
              circumstances described below.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">6.1 Subprocessors</h3>
            <p className="mb-2">
              We share information with the following third-party service providers
              (&quot;subprocessors&quot;) who perform services on our behalf. Each is contractually
              bound to protect your information and may only use it to provide their services to us.
            </p>
            <table className="w-full border-collapse text-sm mb-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-foreground">Subprocessor</th>
                  <th className="text-left py-2 pr-4 font-medium text-foreground">Purpose</th>
                  <th className="text-left py-2 pr-4 font-medium text-foreground">Region</th>
                  <th className="text-left py-2 font-medium text-foreground">Data shared</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4">Supabase (on AWS)</td>
                  <td className="py-2 pr-4">Database hosting, authentication, edge functions</td>
                  <td className="py-2 pr-4">European Union (eu-west-1, Ireland)</td>
                  <td className="py-2">All Customer Data (encrypted at rest)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Vercel</td>
                  <td className="py-2 pr-4">Application hosting, edge delivery, web analytics,
                    performance monitoring</td>
                  <td className="py-2 pr-4">Global edge; control plane in the United States</td>
                  <td className="py-2">Request metadata, anonymized analytics, server logs</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Slack (Salesforce)</td>
                  <td className="py-2 pr-4">OAuth, bot messaging, slash commands, modal delivery</td>
                  <td className="py-2 pr-4">United States</td>
                  <td className="py-2">Slack user IDs, bot tokens, DM content with the Nami bot,
                    review/survey prompt text</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Stripe</td>
                  <td className="py-2 pr-4">Subscription billing, payment method storage, invoice
                    delivery</td>
                  <td className="py-2 pr-4">United States, with regional data centers</td>
                  <td className="py-2">Billing email, subscription plan, seat count, payment
                    status. We do not see or store card numbers.</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Google (Google Ads)</td>
                  <td className="py-2 pr-4">Advertising conversion measurement on marketing pages
                    only (not on the authenticated dashboard)</td>
                  <td className="py-2 pr-4">United States</td>
                  <td className="py-2">Browser identifiers, page URL, IP address as required by
                    Google&apos;s tag</td>
                </tr>
              </tbody>
            </table>

            <h3 className="font-medium text-foreground mt-4 mb-2">6.2 Subprocessor Changes</h3>
            <p className="mb-3">
              We will maintain the subprocessor list above. If we add or replace a subprocessor
              that processes Customer Data, we will notify workspace administrators at least
              thirty (30) days before the new subprocessor begins processing Customer Data, via
              email to the workspace admin and an update to this page. You may object to a
              proposed subprocessor by terminating your subscription before that subprocessor
              begins processing your data; no other remedy is available for subprocessor changes
              unless agreed in a separate enterprise contract.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">6.3 Within Your Workspace</h3>
            <p className="mb-3">
              By design, the Service shares information within your workspace according to role.
              Admins and HR users can view org-wide review and calibration data; managers can view
              their direct reports&apos; data; employees see what is shared with them. Anonymous
              survey responses and anonymous feedback are aggregated; we do not surface the
              identity of the anonymous author in the dashboard or audit log. You are responsible
              for configuring roles appropriately and for the appropriateness of intra-workspace
              data flows.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">6.4 Legal and Safety Disclosures</h3>
            <p className="mb-3">
              We may disclose information if we believe in good faith that disclosure is required
              by law or is necessary to: (a) comply with a legal obligation, court order, subpoena,
              or other legal process; (b) protect and defend our rights, property, or operations;
              (c) prevent or investigate fraud, abuse, or security incidents; (d) protect the
              personal safety of users or the public; or (e) respond to a lawful government
              request. Where permitted, we will use commercially reasonable efforts to notify the
              affected workspace administrator before disclosing Customer Data in response to a
              legal request.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">6.5 Business Transfers</h3>
            <p>
              In connection with a merger, acquisition, financing, reorganization, bankruptcy,
              receivership, sale of all or substantially all of our assets, or transition of
              service to another provider, information may be transferred to the acquirer or
              successor. We will notify workspace administrators via email or a prominent in-app
              notice before any such transfer that would change how personal information is
              processed, and will require any acquirer to honor the commitments in this Privacy
              Policy or seek your consent to changes.
            </p>
          </section>

          {/* ── 7 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Data Security</h2>
            <p className="mb-3">
              We implement administrative, technical, and organizational measures designed to
              protect Customer Data. A more detailed description is available on our{" "}
              <Link href="/security" className="text-primary underline">Security page</Link>. In
              summary:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Encryption at rest:</strong> AES-256 at the storage layer for database
                contents and automated backups</li>
              <li><strong>Encryption in transit:</strong> TLS 1.2 or higher for all traffic; HTTP
                is redirected to HTTPS</li>
              <li><strong>Tenant isolation:</strong> PostgreSQL row-level security policies and
                cross-tenant validation triggers enforced inside the database engine</li>
              <li><strong>Authentication:</strong> Slack OAuth 2.0; no Nami-issued passwords; MFA
                inherited from your Slack workspace</li>
              <li><strong>Access controls:</strong> role-based access inside the workspace; least
                privilege for internal access to production systems</li>
              <li><strong>Audit log:</strong> sensitive state changes are recorded to an in-database
                audit log scoped to your workspace</li>
            </ul>
            <p>
              No method of electronic transmission or storage is one hundred percent secure. We
              cannot guarantee absolute security. You are responsible for using strong Slack
              workspace controls (MFA, SSO where available, session length, idle timeout) and for
              promptly notifying us if you suspect compromise of your account.
            </p>
          </section>

          {/* ── 8 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Data Retention</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.1 Active Workspaces</h3>
            <p className="mb-3">
              We retain Customer Data for as long as your workspace is active and you maintain a
              subscription or free trial. Reviews, feedback, goals, surveys, and audit-log entries
              are stored for the life of the workspace so historical performance information
              remains available to authorized users.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.2 After Termination</h3>
            <p className="mb-3">
              Upon cancellation or termination, we retain Customer Data for thirty (30) days to
              allow you to request an export or reactivate your subscription. After this thirty
              (30) day grace period, Customer Data will be permanently and irreversibly deleted
              from our production systems, except for the limited information described in
              sections 8.4 and 8.5.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.3 Backups</h3>
            <p className="mb-3">
              Automated backups taken for disaster recovery purposes are retained for up to thirty
              (30) additional days from the date the backup was taken, then permanently deleted by
              our infrastructure provider&apos;s rolling deletion schedule.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.4 Application Logs</h3>
            <p className="mb-3">
              Server-side request and error logs that may incidentally contain identifiers
              (workspace ID, user ID, request path) are retained for up to thirty (30) days for
              operations and security purposes, then deleted on a rolling basis.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.5 Billing and Compliance Records</h3>
            <p>
              We retain billing records, contracts, tax-related documents, and other records
              required by applicable law (such as anti-fraud, tax, accounting, or anti-money
              laundering laws) for the period required by those laws, typically up to seven (7)
              years.
            </p>
          </section>

          {/* ── 9 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              9. International Data Transfers
            </h2>
            <p className="mb-3">
              Our primary database is hosted in the European Union (Ireland) on Supabase
              infrastructure running on AWS. Some of our subprocessors — including Vercel, Slack,
              Stripe, and Google — operate globally and may process limited categories of personal
              information in the United States or other jurisdictions.
            </p>
            <p className="mb-3">
              Where we transfer personal information of EEA, UK, or Swiss residents outside the
              EEA, UK, or Switzerland, we rely on the European Commission&apos;s Standard
              Contractual Clauses (and the UK International Data Transfer Addendum or Swiss
              equivalents, where applicable) as the transfer mechanism. Copies of the relevant
              clauses are available on request via{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
            </p>
            <p>
              Some destination countries may have data-protection laws that differ from those in
              your country. We use Standard Contractual Clauses and supplementary technical
              measures (such as encryption in transit and at rest) intended to provide a level of
              protection essentially equivalent to that required under EU law.
            </p>
          </section>

          {/* ── 10 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              10. Your Rights
            </h2>
            <p className="mb-3">
              Depending on where you live, you may have the rights described below regarding your
              personal information. Because your organization is the controller of Customer Data
              processed in the Service, we will typically forward employee-level requests to your
              workspace administrator and support them in fulfilling the request.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.1 General Rights</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Access:</strong> request a copy of the personal information we hold
                about you</li>
              <li><strong>Correction:</strong> request correction of inaccurate or incomplete
                personal information</li>
              <li><strong>Deletion:</strong> request deletion, subject to our legal retention
                obligations</li>
              <li><strong>Export:</strong> export reviews, goals, and analytics data in CSV format
                from the dashboard, or request a broader export via email</li>
              <li><strong>Withdraw consent:</strong> withdraw consent at any time by uninstalling
                the Nami Slack application or cancelling your subscription, without affecting the
                lawfulness of processing carried out before withdrawal</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.2 EEA, UK, and Swiss Residents</h3>
            <p className="mb-3">
              If you are in the EEA, UK, or Switzerland, you have additional rights under the GDPR,
              UK GDPR, and Swiss FADP, including: the right to restrict processing, the right to
              object to processing based on legitimate interests, the right to data portability,
              the right not to be subject to a decision based solely on automated processing
              (Nami does not make solely-automated decisions about individuals), and the right to
              lodge a complaint with your local data protection authority.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.3 California Residents (CCPA / CPRA)</h3>
            <p className="mb-2">
              If you are a California resident, you have the following rights under the California
              Consumer Privacy Act, as amended by the California Privacy Rights Act:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Right to know:</strong> what personal information we collect, the
                sources, purposes, and categories of third parties with whom we share it</li>
              <li><strong>Right to delete:</strong> request deletion of personal information,
                subject to legal exceptions</li>
              <li><strong>Right to correct:</strong> request correction of inaccurate personal
                information</li>
              <li><strong>Right to non-discrimination:</strong> we will not discriminate against
                you for exercising your privacy rights</li>
              <li><strong>Right to opt out of sale or sharing:</strong> we do not sell personal
                information and have never sold personal information in the prior 12 months. We do
                not &quot;share&quot; personal information for cross-context behavioral advertising
                as that term is defined under the CPRA.</li>
              <li><strong>Sensitive Personal Information (SPI):</strong> we do not knowingly
                collect SPI from California residents. If your users voluntarily submit SPI into
                free-text fields, we use it only as necessary to provide the Service and not for
                inferring characteristics, and we do not use or disclose it for purposes other
                than those permitted under Cal. Civ. Code § 1798.121(a).</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.4 Other Jurisdictions</h3>
            <p className="mb-3">
              Residents of jurisdictions with comparable laws — including Brazil (LGPD), Canada
              (PIPEDA and Quebec Law 25), Australia (Privacy Act), and certain U.S. states
              including Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), and
              Texas (TDPSA) — may exercise rights similar to those described above by contacting
              us at{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.5 Exercising Your Rights</h3>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
              We will respond within thirty (30) days, or within the period required by the
              applicable law (we may extend this period where permitted, with notice). We may ask
              you to verify your identity before processing your request. If you submit a request
              about personal information that your employer controls, we may need to direct you to
              your employer or coordinate with them. You may also designate an authorized agent
              to act on your behalf as permitted by applicable law.
            </p>
          </section>

          {/* ── 11 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Cookies and Tracking</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.1 Strictly Necessary Cookies</h3>
            <p className="mb-3">
              The authenticated dashboard uses only strictly necessary cookies required for
              sign-in, session management, and security. These cookies are essential to provide
              the Service and cannot be disabled while using the dashboard.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.2 Marketing-Page Cookies</h3>
            <p className="mb-3">
              Our public marketing pages may set cookies associated with Vercel Analytics
              (cookieless by design), Vercel Speed Insights, and Google Ads conversion tracking,
              as described in section 3.3. Where required by law, we will collect consent before
              loading non-essential cookies.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.3 Do Not Track</h3>
            <p className="mb-3">
              Our Service does not respond to Do Not Track (DNT) signals, because there is no
              industry consensus on how DNT should be interpreted. We honor Global Privacy
              Control (GPC) signals where required by applicable law.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.4 No Cross-Site Profiling</h3>
            <p>
              We do not participate in advertising networks that build cross-site behavioral
              profiles of our users. The only third-party tag we load is Google Ads conversion
              tracking, and only on our public marketing pages.
            </p>
          </section>

          {/* ── 12 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Children&apos;s Privacy</h2>
            <p>
              The Service is intended for use by businesses and is not directed to children. We
              do not knowingly collect personal information from individuals under sixteen (16)
              years of age (or the higher age required by your local law). If you believe a child
              has provided personal information to us, please contact{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>
              {" "}and we will take steps to delete it.
            </p>
          </section>

          {/* ── 13 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">13. Data Processing Agreement</h2>
            <p>
              For customers who require a Data Processing Agreement (DPA) — for GDPR, UK GDPR,
              Swiss FADP, LGPD, or comparable requirements — we offer a standard DPA incorporating
              the European Commission&apos;s Standard Contractual Clauses and the UK International
              Data Transfer Addendum where relevant. To request a DPA, contact{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
              Enterprise customers may negotiate custom data processing terms as part of an
              enterprise agreement.
            </p>
          </section>

          {/* ── 14 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">14. Changes to This Privacy Policy</h2>
            <p className="mb-3">
              We may update this Privacy Policy from time to time. If we make material changes —
              for example, the addition of a new subprocessor that processes Customer Data, a new
              category of data collected, or a new permitted use — we will notify workspace
              administrators by email or through a prominent notice within the Service at least
              thirty (30) days before the changes take effect. Non-material clarifications may be
              made without advance notice.
            </p>
            <p>
              The &quot;Effective date&quot; at the top of this page indicates when this Privacy
              Policy was last revised. Continued use of the Service after the effective date of
              any changes constitutes acceptance of the revised Policy.
            </p>
          </section>

          {/* ── Contact ───────────────────────────────────────── */}
          <section className="border-t pt-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">Contact Us</h2>
            <p className="mb-3">
              For privacy questions, data-subject requests, DPA requests, or to escalate a concern
              that we have not addressed, please contact:
            </p>
            <ul className="space-y-1">
              <li>
                Privacy, security, and legal inquiries:{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline">
                  hello@namihr.com
                </a>
              </li>
              <li>
                General support:{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline">
                  hello@namihr.com
                </a>
              </li>
            </ul>
            <p className="mt-3">
              If you are not satisfied with our response, you may have the right to lodge a
              complaint with your local data protection authority.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
