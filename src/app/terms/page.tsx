import Link from "next/link";
import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Nami, the Slack-native performance management platform. Covers your subscription, acceptable use, customer data, warranties, liability, dispute resolution, and more.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service — Nami",
    description:
      "Terms of Service for Nami, the Slack-native performance management platform.",
    url: "/terms",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — Nami",
    description: "Terms of Service for Nami.",
  },
};

export default function TermsPage() {
  const effectiveDate = "May 23, 2026";

  return (
    <div className="min-h-screen bg-background py-16">
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-6">
          <Link href={SITE_URL} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
          {/* ── Summary box ──────────────────────────────────── */}
          <section className="rounded-xl border border-border bg-muted/30 p-5">
            <p className="text-foreground font-medium mb-2">Plain-English summary</p>
            <p className="mb-2">
              This is a binding legal contract. The plain-English summary below is provided as a
              reading aid only and is not itself the contract; the numbered sections below are.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nami is a tool that helps you run performance reviews, surveys, goals, and
                feedback inside Slack. You own your data, we process it on your behalf.</li>
              <li>You pay per user per month via Stripe. There is a 14-day free trial. You can
                cancel any time and your data is exportable as CSV from the dashboard.</li>
              <li>We do not sell your data and we don&apos;t train AI models on it. We do not
                make employment decisions for you; you do.</li>
              <li>Our liability is capped. You agree to disputes being resolved in Delaware
                courts (or, if you elect, in JAMS arbitration on an individual basis).</li>
              <li>You cannot use Nami to break the law, harass people, or attack our systems.</li>
            </ul>
          </section>

          {/* ── 1 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
            <p className="mb-3">
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement
              between you (&quot;Customer,&quot; &quot;you,&quot; or &quot;your&quot;) and Nami
              (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), governing
              your access to and use of the Nami platform, including the web application, the
              Slack integration, the API endpoints used by the dashboard and Slack, and all
              related services (collectively, the &quot;Service&quot;).
            </p>
            <p className="mb-3">
              By creating an account, installing our Slack application, clicking &quot;I
              agree,&quot; or otherwise accessing the Service, you acknowledge that you have read,
              understood, and agree to be bound by these Terms and by our{" "}
              <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>. If
              you are accepting these Terms on behalf of a company, organization, or other legal
              entity, you represent and warrant that you have the authority to bind that entity,
              in which case &quot;you&quot; and &quot;your&quot; refer to that entity.
            </p>
            <p>
              If you do not agree to these Terms, you must not access or use the Service. The
              individual installing the Service represents and warrants that they are authorized
              by their organization to do so.
            </p>
          </section>

          {/* ── 2 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of the Service</h2>
            <p className="mb-3">
              Nami is a cloud-based performance management platform that integrates with Slack.
              The Service enables organizations to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Run 360-degree performance review cycles and 9-box calibration</li>
              <li>Run pulse surveys, 360 surveys, and eNPS measurement</li>
              <li>Manage competency frameworks, job families, and career levels</li>
              <li>Set, track, and align goals and OKRs</li>
              <li>Facilitate continuous peer-to-peer feedback (including kudos and optional
                anonymous feedback)</li>
              <li>Generate performance analytics, ranking, and competency heatmaps</li>
              <li>Export reviews, goals, and analytics data as CSV</li>
              <li>Deliver review prompts, survey questions, kudos, and reminders via Slack direct
                messages and slash commands</li>
            </ul>
            <p className="mb-3">
              The Service is a software tool. It does not provide professional, legal, HR
              consulting, psychological, medical, or other regulated advice, and it does not make
              employment decisions on your behalf (see Section 7).
            </p>
            <p>
              We may, at any time and in our sole discretion, modify, add, suspend, or discontinue
              any feature or portion of the Service. We will use commercially reasonable efforts
              to give advance notice of material adverse changes to existing functionality, but no
              such notice is required for security fixes, urgent maintenance, or beta features.
            </p>
          </section>

          {/* ── 3 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Accounts and Access</h2>
            <p className="mb-3">
              Access to the Service is authenticated through your Slack workspace using
              Slack&apos;s OAuth 2.0 protocol. The individual who installs the Nami Slack
              application becomes the initial workspace administrator (&quot;Admin&quot;). Admins
              may grant and revoke role assignments (Admin, HR, Manager, Employee) for other
              workspace members.
            </p>
            <p className="mb-2">You are solely responsible for:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Maintaining the security of your Slack workspace and any credentials used to
                access the Service</li>
              <li>All activity that occurs within your workspace on the Service, whether
                authorized by you or not</li>
              <li>Configuring user roles and ensuring only appropriate individuals have Admin or
                HR access</li>
              <li>Promptly notifying us of any unauthorized access, suspected compromise, or
                security incident affecting your account at{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline">
                  hello@namihr.com
                </a></li>
              <li>Ensuring that any third party you authorize to act on your behalf complies with
                these Terms</li>
            </ul>
            <p>
              We are not responsible for any loss or damage arising from your failure to comply
              with the above obligations, including unauthorized access resulting from compromised
              Slack credentials, misconfigured Slack permissions, or role assignments made by your
              Admin.
            </p>
          </section>

          {/* ── 4 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Subscriptions, Trial, Billing, and Payment</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.1 Subscription Plan</h3>
            <p className="mb-3">
              The Service is offered on a per-active-user, monthly-billed subscription basis at
              the prices listed on our{" "}
              <Link href="/pricing" className="text-primary underline">pricing page</Link>.
              Enterprise customers may negotiate alternative pricing, payment terms, and service
              levels under a separate written agreement.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.2 Free Trial</h3>
            <p className="mb-3">
              We may offer a free trial of the Service for a limited period (currently fourteen
              (14) days). The trial begins when you start the trial through Stripe or our
              dashboard. Unless you cancel before the trial ends, your subscription will
              automatically begin at the end of the trial and you will be charged at the
              then-current price for the number of active users in your workspace. We may modify,
              shorten, or discontinue the free trial at any time without notice. Free trials are
              available once per workspace; we reserve the right to deny a trial if we suspect
              abuse.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.3 Payment Processing</h3>
            <p className="mb-3">
              Payment is processed by Stripe, Inc. (&quot;Stripe&quot;). By subscribing, you also
              agree to be bound by Stripe&apos;s{" "}
              <a
                href="https://stripe.com/legal"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Terms of Service
              </a>
              . We do not see, store, or process card numbers or bank account details on our
              servers.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.4 Automatic Renewal</h3>
            <p className="mb-3">
              Subscriptions automatically renew at the end of each billing period at the
              then-current price for the active user count in your workspace, unless cancelled
              before the renewal date. You may cancel at any time from your dashboard billing
              settings or through the Stripe customer portal. Cancellation takes effect at the end
              of the current paid billing period; no partial-period refunds are issued.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.5 Seat Counts and True-Up</h3>
            <p className="mb-3">
              Your subscription fee is based on the number of active users in your workspace
              during the billing period. We use Slack&apos;s directory and your role assignments
              to compute active users; deactivated Slack users and Slack guests are excluded.
              Adding or removing users mid-cycle may result in proration as configured in Stripe.
              You are responsible for managing seat counts and for any charges resulting from
              users you or your Admin chose to grant access to.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.6 Taxes</h3>
            <p className="mb-3">
              Prices are exclusive of taxes, levies, duties, and similar governmental assessments,
              including value-added, sales, use, or withholding taxes that can be assessed by any
              jurisdiction (collectively, &quot;Taxes&quot;). You are responsible for paying all
              Taxes associated with your subscription, except for taxes based on our net income.
              Where we are required to collect Taxes, they will be added to your invoice.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.7 Late Payment and Suspension</h3>
            <p className="mb-3">
              If a payment is declined or remains unpaid, we may suspend or terminate your access
              to the Service after providing reasonable notice. Suspension does not relieve you of
              any obligation to pay amounts owed. We may charge interest on overdue balances at
              the lower of one and one-half percent (1.5%) per month or the maximum rate permitted
              by applicable law, plus reasonable collection costs.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.8 Refunds</h3>
            <p className="mb-3">
              All fees are non-refundable except where required by applicable law. Refund requests
              may be submitted to{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>{" "}
              and will be reviewed on a case-by-case basis at our sole discretion.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">4.9 Price Changes</h3>
            <p>
              We may change our pricing at any time. Price changes for existing subscriptions will
              take effect at the start of the next billing period following at least thirty (30)
              days&apos; notice to the Admin email on file. Your continued use of the Service
              after the price change takes effect constitutes acceptance of the new pricing. If
              you do not accept a price change, your sole remedy is to cancel before the change
              takes effect.
            </p>
          </section>

          {/* ── 5 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Customer Data and Ownership</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.1 Your Data</h3>
            <p className="mb-3">
              You retain all rights, title, and interest in and to all data, content, and
              information you or your users submit to the Service (&quot;Customer Data&quot;). We
              claim no ownership over Customer Data.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.2 License to Us</h3>
            <p className="mb-3">
              You grant us a limited, non-exclusive, worldwide, royalty-free license to host,
              copy, transmit, display, store, process, and use Customer Data solely to (a) provide
              and improve the Service for you, (b) prevent or address abuse, fraud, or security
              issues, (c) comply with law, and (d) carry out the purposes described in our{" "}
              <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>. This
              license terminates when Customer Data is deleted under Section 12.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.3 What We Will Not Do</h3>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>We will never sell, rent, lease, or trade Customer Data to third parties</li>
              <li>We will never use Customer Data for advertising or marketing purposes</li>
              <li>We will never share identifiable Customer Data with other customers</li>
              <li>We will never use Customer Data to train artificial intelligence or
                machine-learning models without your explicit prior written consent. The Service
                does not currently include AI features that process Customer Data.</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.4 Aggregated and De-Identified Data</h3>
            <p className="mb-3">
              We may create aggregated, anonymized, or de-identified data derived from Customer
              Data (&quot;Aggregated Data&quot;) that cannot reasonably be used to identify you,
              your organization, or any individual. We may use Aggregated Data for any lawful
              business purpose, including product improvement, benchmarking, security research,
              and industry reporting.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.5 Tenant Isolation</h3>
            <p className="mb-3">
              Each workspace&apos;s Customer Data is isolated at the database layer using
              row-level security policies and cross-tenant validation triggers. Customer Data from
              one workspace is not accessible to users of another workspace.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.6 Customer Responsibility for Data and Decisions</h3>
            <p className="mb-3">
              You are solely responsible for the accuracy, quality, legality, and appropriateness
              of all Customer Data submitted to the Service, and for the lawful basis on which
              that data is collected from your employees. This includes ensuring that performance
              reviews, ratings, calibration grades, feedback, survey responses, and any other
              data entered by your users comply with applicable employment laws,
              anti-discrimination laws, works-council and employee-representation requirements,
              data-protection laws, and your own internal policies.
            </p>
            <p>
              We have no obligation to review, validate, or moderate Customer Data for compliance
              with any law, regulation, or internal policy. The Service is a tool that facilitates
              your performance management processes — all HR decisions, employment actions,
              compensation decisions, promotion decisions, performance-improvement plans,
              terminations, and personnel judgments made using information from the Service are
              your sole responsibility.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">5.7 Data Sensitivity</h3>
            <p className="mb-3">
              The Service is designed to store workplace performance information such as review
              ratings, written comments, goals, and competency assessments. The Service is{" "}
              <strong>not designed</strong> to store or process highly sensitive personal data,
              including but not limited to: government-issued identification numbers, financial
              account information, health or medical records, genetic data, biometric data,
              precise geolocation, racial or ethnic origin, political opinions, religious beliefs,
              sexual orientation, sex life, trade-union membership, or criminal-history
              information.
            </p>
            <p>
              If you or your users choose to include any such information in free-text fields
              (such as review comments, feedback messages, or goal descriptions), you do so at
              your own risk and assume full responsibility for compliance with applicable
              data-protection, employment, and anti-discrimination laws, including obtaining any
              necessary consents and lawful bases. We disclaim all liability for the storage,
              processing, or potential exposure of sensitive data that you voluntarily submit to
              the Service.
            </p>
          </section>

          {/* ── 6 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to, and will not permit any user under your account to:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Use the Service for any purpose that is unlawful, fraudulent, or prohibited by
                these Terms</li>
              <li>Attempt to gain unauthorized access to another organization&apos;s workspace,
                data, or accounts</li>
              <li>Interfere with, disrupt, probe, or place an unreasonable burden on the Service,
                its infrastructure, or its underlying network (including, without limitation,
                denial-of-service attacks, distributed denial-of-service attacks, or sustained
                automated request floods)</li>
              <li>Reverse engineer, decompile, disassemble, or attempt to discover the source
                code, object code, or underlying structure of the Service, except to the extent
                applicable law expressly prohibits such restriction</li>
              <li>Resell, sublicense, white-label, or redistribute the Service or use it to
                provide a competing or substantially similar service, except with our prior
                written consent</li>
              <li>Use the Service to store or transmit malicious code, viruses, ransomware,
                worms, trojans, or other harmful data</li>
              <li>Use the Service to harass, threaten, defame, discriminate against, or harm
                another person, or to retaliate against any individual for protected workplace
                activity</li>
              <li>Use the Service to collect personally identifiable information about users
                without their consent, or in a manner that violates applicable employment or
                data-protection laws</li>
              <li>Use automated scripts, bots, scrapers, or crawlers to access the Service except
                through our documented integrations</li>
              <li>Circumvent any security measure, access control, rate limit, or usage limit of
                the Service</li>
              <li>Send unsolicited messages, spam, or commercial solicitations through the Nami
                bot, or use the Nami bot to send messages that violate the Slack API Terms of
                Service or your own Slack workspace policies</li>
              <li>Misrepresent the identity of any user, including anonymous-feedback authors,
                survey respondents, or kudos senders</li>
              <li>Submit content that is obscene, harassing, defamatory, or that infringes any
                intellectual property right of a third party</li>
            </ul>
            <p>
              We reserve the right (but have no obligation) to investigate and take appropriate
              action against any user who, in our sole discretion, violates this section,
              including without limitation removing content, suspending or terminating accounts,
              and cooperating with law enforcement.
            </p>
          </section>

          {/* ── 7 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              7. HR and Employment Disclaimer
            </h2>
            <p className="mb-3">
              <strong>The Service is a software tool.</strong> Information presented in the
              Service — including review responses, ratings, calibration grades, ranking tiers,
              competency heatmaps, eNPS scores, pulse-survey results, goal progress, and analytics
              — is provided for your decision-makers to consider in their own judgment.
            </p>
            <p className="mb-3">
              You are the employer or the agent of the employer with respect to your workforce
              and are the decision-maker for all employment actions, including hiring, promotion,
              compensation, discipline, performance-improvement, retention, and termination
              decisions. We are not your agent, advisor, or co-employer. We do not make, recommend,
              ratify, or take responsibility for any employment decision.
            </p>
            <p className="mb-3">
              You acknowledge and agree that:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>The Service does not perform solely automated decision-making about
                individuals as defined under the GDPR or comparable laws</li>
              <li>You are solely responsible for ensuring your use of the Service — and any
                employment decisions you make using information from the Service — complies with
                applicable anti-discrimination laws, equal-employment-opportunity laws,
                disability-accommodation laws, wage-and-hour laws, works-council and
                employee-representation laws, whistleblower-protection laws, and data-protection
                laws in every jurisdiction where you operate</li>
              <li>You are solely responsible for the design, validity, fairness, and bias of any
                competency framework, rating scale, calibration policy, or analytics
                interpretation you apply</li>
              <li>You will not represent that any feature of the Service is endorsed, validated,
                or approved by Nami for any particular employment-decision use case</li>
            </ul>
            <p>
              Without limiting Section 11 (Limitation of Liability), we disclaim all liability for
              employment decisions you make and for claims by your employees, former employees,
              applicants, or third parties arising from those decisions.
            </p>
          </section>

          {/* ── 8 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Intellectual Property and Feedback</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.1 Our Intellectual Property</h3>
            <p className="mb-3">
              The Service and its original content (excluding Customer Data), features,
              functionality, design, code, documentation, the Nami name, the Nami logo,
              trademarks, service marks, trade dress, and all related intellectual property are
              and will remain the exclusive property of Nami and its licensors. The Service is
              protected by copyright, trademark, trade-secret, and other laws.
            </p>
            <p className="mb-3">
              These Terms do not grant you any right, title, or interest in the Service or our
              intellectual property other than the limited, non-exclusive, non-transferable,
              non-sublicensable right to use the Service in accordance with these Terms.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.2 Feedback License</h3>
            <p className="mb-3">
              If you, your users, or any third party submit ideas, suggestions, feature requests,
              bug reports, roadmap votes, or other feedback about the Service to us
              (&quot;Feedback&quot;), you grant us a perpetual, irrevocable, worldwide,
              royalty-free, sublicensable, fully transferable license to use, reproduce,
              distribute, modify, create derivative works from, and otherwise exploit such
              Feedback for any purpose, without obligation to you. Feedback is not Customer Data
              and is not subject to confidentiality.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">8.3 Publicity</h3>
            <p>
              We may identify you as a customer of the Service and use your name and logo on our
              website and marketing materials. You may opt out of this by emailing{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>
              . Any case studies, quotes, or testimonials beyond name-and-logo use require your
              prior consent.
            </p>
          </section>

          {/* ── 9 ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Third-Party Services and Beta Features</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">9.1 Third-Party Services</h3>
            <p className="mb-3">
              The Service integrates with and relies upon third-party services, including without
              limitation Slack (for authentication and messaging), Stripe (for payment
              processing), Supabase and Vercel (for hosting and infrastructure), and Google (for
              advertising conversion measurement on our marketing pages). Your use of these
              third-party services is subject to their respective terms and privacy policies.
            </p>
            <p className="mb-3">
              We are not responsible for the availability, accuracy, security, or content of
              third-party services. If a third-party service becomes unavailable, deprecated, or
              changes its terms or APIs in a way that affects the Service, we shall not be liable
              for any resulting disruption or limitation, and we may modify or remove affected
              functionality without notice.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">9.2 Beta Features</h3>
            <p>
              We may make pre-release, beta, alpha, preview, evaluation, or experimental features
              (&quot;Beta Features&quot;) available from time to time. Beta Features are clearly
              identified or otherwise designated. Beta Features are provided{" "}
              <strong>&quot;AS IS&quot;</strong> for evaluation only, may not function as
              intended, may be modified or withdrawn at any time, are excluded from any service
              level commitment, and may be subject to additional terms. We disclaim all
              liability arising out of your use of Beta Features and recommend you not use Beta
              Features with critical workflows.
            </p>
          </section>

          {/* ── 10 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Service Availability, Support, and Disclaimer of Warranties</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.1 Availability</h3>
            <p className="mb-3">
              We use commercially reasonable efforts to make the Service available, but we do not
              guarantee uninterrupted, error-free, secure, or timely access. The Service is
              provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. We may perform
              scheduled maintenance, deploy updates, suspend the Service for security reasons, or
              experience unplanned outages. We do not offer a contractual service-level commitment
              under these Terms; enterprise customers may negotiate a separate SLA.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.2 Support</h3>
            <p className="mb-3">
              Support is provided via email at{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>{" "}
              during normal business hours. Response times are not guaranteed and vary by inquiry.
              Enterprise customers may negotiate dedicated support under a separate agreement.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.3 No Guarantee of Results</h3>
            <p className="mb-3">
              We do not guarantee any specific outcomes, improvements in employee performance,
              employee engagement, retention, productivity, or business results from your use of
              the Service. All performance management decisions and outcomes remain your sole
              responsibility.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.4 Disclaimer of Warranties</h3>
            <p className="mb-3 uppercase font-medium text-foreground">
              To the maximum extent permitted by applicable law:
            </p>
            <p className="mb-3">
              The Service is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without
              warranties of any kind, whether express, implied, statutory, or otherwise,
              including, without limitation, the implied warranties of merchantability, fitness
              for a particular purpose, non-infringement, title, accuracy, availability,
              uninterrupted use, and any warranties arising out of course of dealing, course of
              performance, or trade usage.
            </p>
            <p className="mb-2">Without limiting the foregoing, we do not warrant that:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>The Service will meet your specific requirements or expectations</li>
              <li>The Service will be uninterrupted, timely, secure, or error-free</li>
              <li>Results obtained from the Service will be accurate, complete, reliable, or
                suitable for any particular purpose, including any HR or employment-related
                purpose</li>
              <li>Defects in the Service will be corrected within any specific timeframe</li>
              <li>The Service will be compatible with any particular hardware, software, browser,
                or network configuration</li>
            </ul>
            <p>
              You acknowledge that bugs, errors, and unexpected behaviour occur in software
              products and that their occurrence does not constitute a breach of these Terms. You
              use the Service at your own risk.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">10.5 No Guarantee Against Data Loss</h3>
            <p>
              We do not guarantee that Customer Data will not be subject to inadvertent damage,
              corruption, loss, deletion, modification, or unavailability. While we maintain
              industry-standard backup procedures with our infrastructure providers, we are not
              liable for any loss of or damage to Customer Data arising from system failures,
              security incidents, third-party infrastructure outages, mistaken deletions by your
              users, or any other cause. You are solely responsible for maintaining independent
              backups of any Customer Data you consider critical. The Service includes CSV-export
              features for reviews, goals, and analytics; we strongly recommend you use them.
            </p>
          </section>

          {/* ── 11 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Limitation of Liability</h2>
            <p className="mb-3 uppercase font-medium text-foreground">
              To the maximum extent permitted by applicable law:
            </p>
            <p className="mb-3">
              In no event shall Nami, its officers, directors, shareholders, employees, agents,
              contractors, partners, suppliers, or licensors be liable for any indirect,
              incidental, special, consequential, exemplary, or punitive damages, including but
              not limited to damages for loss of profits, goodwill, reputation, revenue, data,
              business opportunities, use, anticipated savings, or other intangible losses,
              arising out of or in connection with:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Your access to, use of, or inability to use the Service</li>
              <li>Any conduct or content of any third party on or related to the Service</li>
              <li>Any content obtained from or through the Service</li>
              <li>Unauthorized access to, use of, or alteration of your transmissions or
                Customer Data</li>
              <li>Any bug, error, vulnerability, virus, or other harmful component in the Service</li>
              <li>Service interruptions, downtime, latency, or data loss, whether planned or
                unplanned</li>
              <li>Any HR, employment, or personnel decision made or action taken based on
                information from the Service</li>
              <li>Loss of or damage to Customer Data, regardless of cause</li>
              <li>Reliance on Beta Features</li>
            </ul>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.1 Aggregate Liability Cap</h3>
            <p className="mb-3">
              Our total aggregate liability for all claims arising out of or relating to these
              Terms or the Service shall not exceed the greater of: (a) the total amount you paid
              to us in the twelve (12) months immediately preceding the event giving rise to the
              claim, or (b) one hundred U.S. dollars ($100 USD).
            </p>
            <p className="mb-3">
              These limitations apply regardless of the legal theory upon which the claim is
              based — whether in contract, tort (including negligence), strict liability,
              statutory liability, breach of warranty, or otherwise — and even if we have been
              advised of the possibility of such damages, and even if a limited remedy provided
              for herein is found to have failed of its essential purpose.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.2 Exceptions</h3>
            <p className="mb-3">
              Nothing in these Terms shall limit or exclude liability for: (a) death or personal
              injury caused by negligence; (b) fraud or fraudulent misrepresentation; (c) any
              liability that cannot lawfully be limited or excluded; or (d) a party&apos;s
              indemnification obligations under Section 13.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.3 Security Incident Liability</h3>
            <p className="mb-3">
              In the event of a confirmed security incident resulting from our failure to
              maintain commercially reasonable security measures, our aggregate liability for
              claims arising from that incident shall not exceed the greater of: (a) the total
              amount you paid to us in the twenty-four (24) months immediately preceding the
              incident, or (b) two hundred U.S. dollars ($200 USD). This elevated cap applies
              only to direct damages caused by our breach of our security obligations and does
              not modify the exclusion of consequential damages set forth above.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.4 Time Limitation on Claims</h3>
            <p className="mb-3">
              You agree that any claim arising out of or related to these Terms or the Service
              must be filed within one (1) year after the cause of action accrues or, if later,
              within one (1) year after you discover or reasonably should have discovered the
              facts giving rise to the claim. Any claim filed after this one-year period is
              permanently barred. This limitation applies to the fullest extent permitted by
              applicable law.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">11.5 Allocation of Risk</h3>
            <p>
              You acknowledge that the pricing of the Service reflects the allocation of risk set
              forth in these Terms, including the disclaimers of warranties and the limitations
              of liability. The limitations and exclusions in this Section 11 and in Section 10
              are an essential basis of the bargain between you and us.
            </p>
          </section>

          {/* ── 12 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Indemnification</h2>
            <p className="mb-3">
              You agree to defend, indemnify, and hold harmless Nami, its officers, directors,
              shareholders, employees, agents, contractors, partners, suppliers, and licensors
              from and against any and all third-party claims, demands, damages, obligations,
              losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees
              and court costs) arising from or related to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Your access to or use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party right, including any intellectual property,
                privacy, publicity, contractual, or employment right</li>
              <li>Your Customer Data, including any claim that your Customer Data infringes any
                right of a third party</li>
              <li>Any employment decision, personnel action, or HR claim made by you, your
                employees, former employees, applicants, contractors, or any third party,
                including claims of discrimination, retaliation, harassment, wrongful
                termination, defamation, or breach of contract</li>
              <li>Your violation of applicable law, including employment, data-protection,
                anti-discrimination, and works-council laws</li>
            </ul>
            <p>
              We will promptly notify you of any claim subject to indemnification and you will
              control the defense and settlement, provided that you will not settle any claim
              that imposes liability or admission of fault on us without our prior written
              consent. We may participate in the defense with counsel of our choosing at our own
              expense. This obligation survives termination of these Terms and your use of the
              Service.
            </p>
          </section>

          {/* ── 13 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">13. Confidentiality</h2>
            <p className="mb-3">
              Each party may disclose to the other party non-public information that is identified
              as confidential or that should reasonably be understood to be confidential
              (&quot;Confidential Information&quot;). Customer Data is your Confidential
              Information; the Service&apos;s non-public features, performance characteristics,
              pricing, and roadmap are our Confidential Information.
            </p>
            <p className="mb-3">
              The receiving party will: (a) use Confidential Information only to fulfil its
              obligations and exercise its rights under these Terms; (b) protect Confidential
              Information using at least the same degree of care it uses to protect its own
              confidential information of like importance, but no less than reasonable care; and
              (c) not disclose Confidential Information to any third party except to its
              employees, contractors, agents, and advisors who have a need to know and who are
              bound by written confidentiality obligations at least as protective as these Terms.
            </p>
            <p>
              Confidential Information does not include information that is: (i) publicly available
              through no fault of the receiving party; (ii) lawfully received from a third party
              without restriction; (iii) independently developed without use of Confidential
              Information; or (iv) required to be disclosed by law or legal process, provided the
              receiving party gives prompt notice where legally permitted.
            </p>
          </section>

          {/* ── 14 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">14. Termination</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">14.1 By You</h3>
            <p className="mb-3">
              You may cancel your subscription at any time through the dashboard billing settings
              or the Stripe customer portal. You will retain access to the Service until the end
              of your current paid billing period. No refund is issued for the remaining portion
              of the period.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">14.2 Suspension</h3>
            <p className="mb-3">
              We may suspend your access to the Service, in whole or in part, immediately and
              without prior notice if we reasonably believe: (a) your account or use of the
              Service poses a security, fraud, or compliance risk; (b) you are in material breach
              of these Terms; (c) your account is significantly past due; or (d) suspension is
              required by law or legal process. We will use commercially reasonable efforts to
              notify you of the reason for suspension and to restore access promptly once the
              cause is resolved.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">14.3 Termination by Us</h3>
            <p className="mb-3">
              We may terminate your access to the Service, in whole or in part, immediately and
              without liability if: (a) you materially breach these Terms and fail to cure within
              fifteen (15) days of written notice; (b) you fail to pay amounts when due and do not
              cure within fifteen (15) days of notice; (c) we discontinue the Service or any part
              of it; (d) we are required to do so by law or legal process; or (e) we reasonably
              determine continued provision of the Service would pose a security risk to other
              customers or to our infrastructure.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">14.4 Effect of Termination</h3>
            <p className="mb-3">
              Upon termination or expiration: (a) your right to use the Service ceases
              immediately; (b) we will retain Customer Data for thirty (30) days to allow you to
              request an export or reactivate; (c) after that grace period, we will permanently
              and irreversibly delete Customer Data from our production systems, subject to
              residual copies in backups deleted within an additional thirty (30) days as
              described in our Privacy Policy; and (d) all fees owed through the effective date
              of termination remain due.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">14.5 Survival</h3>
            <p>
              Sections 4 (to the extent of unpaid amounts), 5 (Customer Data), 6 (Acceptable
              Use), 7 (HR Disclaimer), 8 (Intellectual Property and Feedback), 10.4–10.5
              (Disclaimers), 11 (Limitation of Liability), 12 (Indemnification), 13
              (Confidentiality), 15 (Governing Law), 16 (Dispute Resolution), and 17 (General
              Provisions) survive any termination or expiration of these Terms.
            </p>
          </section>

          {/* ── 15 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">15. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              State of Delaware, United States, without regard to its conflict-of-laws principles.
              The United Nations Convention on Contracts for the International Sale of Goods does
              not apply. Subject to Section 16, any legal action or proceeding arising under these
              Terms shall be brought exclusively in the federal or state courts located in
              Delaware, and each party consents to the personal jurisdiction of such courts and
              waives any objection to venue.
            </p>
          </section>

          {/* ── 16 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">16. Dispute Resolution</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">16.1 Informal Resolution</h3>
            <p className="mb-3">
              Before filing any legal claim, you agree to attempt to resolve the dispute
              informally by contacting us at{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>{" "}
              and providing a written description of the claim and the relief sought. We will
              attempt in good faith to resolve the dispute within sixty (60) days. If we cannot,
              either party may proceed.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">16.2 Binding Arbitration (Optional Election)</h3>
            <p className="mb-3">
              You and Nami may, by mutual written agreement, submit any dispute, claim, or
              controversy arising out of or relating to these Terms or the Service to binding
              individual arbitration administered by JAMS in accordance with its applicable
              rules. The arbitration will be conducted in English in Wilmington, Delaware, or
              another location both parties agree to. Judgment on the arbitration award may be
              entered in any court of competent jurisdiction. The arbitrator may award only the
              relief that would be available in court under applicable law.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">16.3 Class-Action Waiver</h3>
            <p className="mb-3 uppercase font-medium text-foreground">
              To the maximum extent permitted by applicable law:
            </p>
            <p className="mb-3">
              You and Nami agree that any dispute resolution proceeding will be conducted only on
              an individual basis and not as a plaintiff or class member in any purported class,
              consolidated, or representative action. The arbitrator (if any) and any court may
              not consolidate more than one person&apos;s claims or preside over any form of
              representative or class proceeding. You and Nami expressly waive any right to a
              trial by jury.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">16.4 Equitable Relief</h3>
            <p>
              Notwithstanding the foregoing, either party may bring an action in any court of
              competent jurisdiction for injunctive or other equitable relief to protect its
              intellectual property rights or Confidential Information, without first complying
              with the informal-resolution or arbitration provisions of this Section.
            </p>
          </section>

          {/* ── 17 ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">17. General Provisions</h2>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.1 Entire Agreement</h3>
            <p className="mb-3">
              These Terms, together with the{" "}
              <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>, any
              Data Processing Agreement, any order form, and any signed Enterprise agreement,
              constitute the entire agreement between you and Nami regarding the Service and
              supersede all prior agreements, understandings, and communications. In the event of
              a conflict between these Terms and a signed Enterprise agreement, the Enterprise
              agreement controls.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.2 Severability</h3>
            <p className="mb-3">
              If any provision of these Terms is found to be unenforceable or invalid by a court
              of competent jurisdiction, that provision will be limited or eliminated to the
              minimum extent necessary so that the remaining provisions remain in full force and
              effect.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.3 Waiver</h3>
            <p className="mb-3">
              No waiver of any term of these Terms shall be deemed a further or continuing waiver
              of such term or any other term. Our failure to enforce any right or provision shall
              not constitute a waiver of that right or provision.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.4 Assignment</h3>
            <p className="mb-3">
              You may not assign or transfer these Terms or any rights or obligations under them
              without our prior written consent. Any attempted assignment in violation of this
              section is void. We may assign these Terms without restriction, including in
              connection with a merger, acquisition, financing, reorganization, or sale of
              assets.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.5 Notices</h3>
            <p className="mb-3">
              Notices to you may be sent by email to the Admin email associated with your
              workspace or via a prominent notice within the Service, and shall be deemed
              received when sent. Notices to us must be sent by email to{" "}
              <a href="mailto:hello@namihr.com" className="text-primary underline">hello@namihr.com</a>.
              You are responsible for keeping your Admin email current.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.6 Force Majeure</h3>
            <p className="mb-3">
              We shall not be liable for any failure or delay in performing our obligations where
              such failure or delay results from events beyond our reasonable control, including
              but not limited to natural disasters, fire, flood, severe weather, war, terrorism,
              civil unrest, pandemics or epidemics, public-health emergencies, labour disputes,
              government actions, sanctions, embargoes, export-control restrictions, power
              failures, internet or telecommunications failures, cyberattacks (including
              distributed denial-of-service attacks, ransomware, supply-chain attacks, or other
              malicious activity by third parties), security incidents affecting our third-party
              infrastructure providers (including but not limited to AWS, Supabase, Vercel,
              Slack, Stripe, or Google), changes in applicable law or regulation, or any other
              event of similar nature or force. If a force-majeure event continues for more than
              ninety (90) consecutive days and materially prevents performance, either party may
              terminate these Terms upon written notice.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.7 Export Controls and Sanctions</h3>
            <p className="mb-3">
              You represent and warrant that you are not, and are not acting on behalf of, any
              person or entity that is: (a) located in, organized under the laws of, or
              ordinarily resident in any country or territory subject to comprehensive U.S.,
              U.K., E.U., or U.N. sanctions; or (b) listed on any U.S. or other applicable
              sanctions or denied-persons list (including the U.S. Treasury Department&apos;s
              Specially Designated Nationals list). You will not use the Service in violation of
              U.S. or other applicable export-control or sanctions laws and will not permit any
              user to do so.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.8 No Third-Party Beneficiaries</h3>
            <p className="mb-3">
              These Terms are for the sole benefit of you and Nami and do not create any rights
              in any third party, except that our affiliates, officers, directors, employees,
              suppliers, and licensors are intended beneficiaries of the disclaimers, limitations
              of liability, and indemnification provisions.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.9 Independent Contractors</h3>
            <p className="mb-3">
              The parties are independent contractors. Nothing in these Terms creates an agency,
              partnership, joint venture, employment, fiduciary, or franchise relationship
              between the parties.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.10 U.S. Government End-Users</h3>
            <p className="mb-3">
              The Service is &quot;commercial computer software,&quot; as that term is defined at
              48 C.F.R. § 2.101. Use, duplication, and disclosure of the Service by or on behalf
              of the U.S. government is subject solely to the terms of this Agreement, in
              accordance with 48 C.F.R. § 12.212 and 48 C.F.R. § 227.7202.
            </p>

            <h3 className="font-medium text-foreground mt-4 mb-2">17.11 Changes to Terms</h3>
            <p>
              We reserve the right to modify these Terms at any time. If we make material
              changes, we will notify you by email to the Admin email on file or by a prominent
              notice within the Service at least thirty (30) days before the changes take effect.
              The &quot;Effective date&quot; at the top of this page indicates when these Terms
              were last revised. Your continued use of the Service after the effective date
              constitutes acceptance of the revised Terms. If you do not agree to the revised
              Terms, you must stop using the Service and cancel your subscription before they
              take effect.
            </p>
          </section>

          {/* ── Contact ───────────────────────────────────────── */}
          <section className="border-t pt-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">Contact Us</h2>
            <p className="mb-2">
              Questions about these Terms? Get in touch:
            </p>
            <ul className="space-y-1">
              <li>
                General, support, legal, and billing:{" "}
                <a href="mailto:hello@namihr.com" className="text-primary underline">
                  hello@namihr.com
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
