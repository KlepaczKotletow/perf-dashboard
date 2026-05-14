import Link from "next/link";
import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://namihr.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Nami protects your data: infrastructure, encryption, access control, tenant isolation, audit logging, subprocessors, and our compliance roadmap.",
  alternates: { canonical: "/security" },
  openGraph: {
    title: "Security — Nami",
    description:
      "How Nami protects your data: encryption, access control, tenant isolation, audit logging, subprocessors, and compliance roadmap.",
    url: "/security",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Security — Nami",
    description:
      "How Nami protects your data: encryption, access control, tenant isolation, audit logging.",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Security", item: `${SITE_URL}/security` },
  ],
};

export default function SecurityPage() {
  const effectiveDate = "April 18, 2026";

  return (
    <div className="min-h-screen bg-background py-16">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to home
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-2">Security</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: {effectiveDate}
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* ── Overview ─────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              1. Overview
            </h2>
            <p className="mb-3">
              Nami stores performance reviews, feedback, goals, and survey data
              on behalf of your organization. We take the confidentiality and
              integrity of that data seriously. This page describes, in concrete
              terms, how we protect it — what we do today, what infrastructure
              we rely on, and what is on our compliance roadmap.
            </p>
            <p>
              For how we collect and use personal data, see our{" "}
              <Link href="/privacy" className="text-primary underline">
                Privacy Policy
              </Link>
              . For contractual terms, see our{" "}
              <Link href="/terms" className="text-primary underline">
                Terms of Service
              </Link>
              .
            </p>
          </section>

          {/* ── Infrastructure ──────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              2. Infrastructure
            </h2>
            <p className="mb-3">
              Nami runs on SOC 2 Type II–attested infrastructure. We do not
              operate our own data centers; instead, we rely on established
              providers whose security programs are independently audited.
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <strong>Application hosting:</strong> Vercel, a SOC 2 Type II
                and ISO 27001–certified platform running on hyperscale cloud
                infrastructure
              </li>
              <li>
                <strong>Database and authentication:</strong> Supabase, a SOC 2
                Type II–attested platform running on AWS
              </li>
              <li>
                <strong>Underlying cloud:</strong> Amazon Web Services (SOC 2
                Type II, ISO 27001, ISO 27017, ISO 27018)
              </li>
            </ul>
            <p>
              Attestation reports from our infrastructure providers are
              available directly from them under NDA on request.
            </p>
          </section>

          {/* ── Encryption ──────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              3. Encryption
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>In transit:</strong> All traffic to and from Nami is
                encrypted with TLS 1.2 or higher. HTTP traffic is redirected to
                HTTPS.
              </li>
              <li>
                <strong>At rest:</strong> All Customer Data is encrypted using
                AES-256 at the storage layer, including database contents and
                automated backups.
              </li>
              <li>
                <strong>Keys:</strong> Encryption keys are managed by our
                infrastructure providers. We do not store or manage raw key
                material ourselves.
              </li>
            </ul>
          </section>

          {/* ── Authentication ──────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              4. Authentication
            </h2>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <strong>Slack OAuth 2.0:</strong> Users sign in exclusively
                through Slack. We never store user passwords.
              </li>
              <li>
                <strong>Multi-factor authentication:</strong> If your Slack
                workspace requires MFA, that requirement is inherited by Nami
                sign-in automatically.
              </li>
              <li>
                <strong>Sessions:</strong> Sessions are managed through
                short-lived, signed tokens issued by Supabase Auth and stored in
                HTTP-only, Secure cookies.
              </li>
              <li>
                <strong>Bot tokens:</strong> Slack bot tokens are stored
                server-side only and are never exposed to the browser.
              </li>
            </ul>
          </section>

          {/* ── Access control & tenant isolation ───────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              5. Access Control and Tenant Isolation
            </h2>
            <p className="mb-3">
              Each workspace&apos;s data is isolated at the database layer. A
              user from one workspace cannot read or modify data belonging to
              another workspace, regardless of the request path.
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <strong>Row-level security (RLS):</strong> PostgreSQL RLS
                policies are enforced on tables that hold Customer Data. Policy
                checks run inside the database engine, not in application code.
              </li>
              <li>
                <strong>Cross-tenant validation:</strong> Database triggers
                reject writes that would associate a record with a workspace the
                acting user does not belong to.
              </li>
              <li>
                <strong>Role-based access inside a workspace:</strong> Admin,
                HR, Manager, and Employee roles limit what each user can see and
                do. Grade releases, calibration data, and HR-only views are
                gated at the database layer.
              </li>
              <li>
                <strong>Principle of least privilege:</strong> Internal access
                to production systems is restricted to authorized personnel,
                scoped to the minimum needed for their role.
              </li>
            </ul>
          </section>

          {/* ── Audit logging ───────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              6. Audit Logging
            </h2>
            <p className="mb-3">
              Sensitive state changes are recorded to an in-database audit log
              and retained for the lifetime of the workspace. Logged events
              include:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Performance cycle status transitions</li>
              <li>Calibration grade changes and grade releases</li>
              <li>User role changes</li>
              <li>Review assignment changes</li>
            </ul>
            <p>
              Audit log access is restricted to Admin and HR roles within the
              workspace that owns the data.
            </p>
          </section>

          {/* ── Subprocessors ───────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              7. Subprocessors
            </h2>
            <p className="mb-3">
              We use the following subprocessors to deliver the Service. All are
              contractually obligated to process data only on our instructions
              and to maintain appropriate security controls.
            </p>
            <table className="w-full border-collapse text-sm mb-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-foreground">
                    Subprocessor
                  </th>
                  <th className="text-left py-2 pr-4 font-medium text-foreground">
                    Purpose
                  </th>
                  <th className="text-left py-2 font-medium text-foreground">
                    Region
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4">Supabase (on AWS)</td>
                  <td className="py-2 pr-4">Database, authentication</td>
                  <td className="py-2">United States</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Vercel</td>
                  <td className="py-2 pr-4">
                    Application hosting, performance monitoring
                  </td>
                  <td className="py-2">Global edge</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Slack (Salesforce)</td>
                  <td className="py-2 pr-4">
                    OAuth, bot messaging, review delivery
                  </td>
                  <td className="py-2">United States</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Stripe</td>
                  <td className="py-2 pr-4">Subscription billing</td>
                  <td className="py-2">United States</td>
                </tr>
              </tbody>
            </table>
            <p>
              We notify workspace administrators at least thirty (30) days
              before adding or replacing a subprocessor that processes Customer
              Data.
            </p>
          </section>

          {/* ── Data handling ───────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              8. Data Handling
            </h2>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <strong>Minimization:</strong> We collect only what is needed to
                deliver the Service — names, email addresses, Slack IDs, and the
                performance content users choose to submit. We do not collect IP
                addresses for profiling, device fingerprints, biometric data, or
                location data.
              </li>
              <li>
                <strong>Retention:</strong> Customer Data is retained for the
                life of your subscription, then purged from production within 30
                days of termination. Backups containing your data are retained
                for up to an additional 30 days before permanent deletion.
              </li>
              <li>
                <strong>Export:</strong> Workspace administrators can export
                review, feedback, goal, and survey data in CSV format directly
                from the dashboard.
              </li>
              <li>
                <strong>Deletion:</strong> Workspace administrators can request
                deletion of their workspace or of specific user records by
                emailing{" "}
                <a
                  href="mailto:hello@namihr.com"
                  className="text-primary underline"
                >
                  hello@namihr.com
                </a>
                .
              </li>
              <li>
                <strong>AI training:</strong> We do not use Customer Data to
                train AI or machine learning models without the workspace
                administrator&apos;s explicit prior written consent.
              </li>
            </ul>
          </section>

          {/* ── Compliance roadmap ──────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              9. Compliance Roadmap
            </h2>
            <p className="mb-3">
              We are transparent about where we are in our compliance journey.
              Below is an accurate picture of our current posture.
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <strong>Infrastructure attestations (today):</strong> Nami
                inherits SOC 2 Type II attestation from Supabase, Vercel, and
                AWS as subservice organizations. These attestations cover the
                hosting and data-storage layer of the Service.
              </li>
              <li>
                <strong>GDPR (today):</strong> A Data Processing Agreement
                covering Standard Contractual Clauses for international
                transfers is available to any customer on request via{" "}
                <a
                  href="mailto:hello@namihr.com"
                  className="text-primary underline"
                >
                  hello@namihr.com
                </a>
                .
              </li>
              <li>
                <strong>SOC 2 Type II (planned):</strong> An independent SOC 2
                Type II audit of Nami itself is on our{" "}
                <Link href="/roadmap" className="text-primary underline">
                  product roadmap
                </Link>
                . We will publish the attestation report here once the audit
                concludes.
              </li>
              <li>
                <strong>Third-party penetration testing (planned):</strong> We
                plan to commission an annual third-party penetration test and
                publish a summary letter on request.
              </li>
            </ul>
            <p>
              We do not currently claim HIPAA, PCI DSS, ISO 27001, or FedRAMP
              compliance. If your procurement process requires one of these and
              you want to discuss it, write to{" "}
              <a
                href="mailto:hello@namihr.com"
                className="text-primary underline"
              >
                hello@namihr.com
              </a>
              .
            </p>
          </section>

          {/* ── Incident response ──────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              10. Incident Response
            </h2>
            <p className="mb-3">
              In the event of a confirmed security incident that results in
              unauthorized access to, or disclosure of, Customer Data, we will:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Investigate the nature and scope of the incident promptly</li>
              <li>Contain and remediate the incident</li>
              <li>
                Notify affected workspace administrators without undue delay
                and, where GDPR applies, within seventy-two (72) hours of
                becoming aware of the incident
              </li>
              <li>
                Provide a description of the incident, the categories and
                approximate number of records affected, likely consequences, and
                the measures taken or proposed
              </li>
              <li>
                Cooperate with affected customers in their own notification and
                remediation efforts
              </li>
            </ul>
            <p>
              Failed login attempts, denied connection attempts, port scans, and
              other unsuccessful probes are not incidents for the purposes of
              this section.
            </p>
          </section>

          {/* ── Responsible disclosure ─────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              11. Responsible Disclosure
            </h2>
            <p className="mb-3">
              We welcome reports from security researchers. If you believe you
              have found a vulnerability in Nami, please email{" "}
              <a
                href="mailto:hello@namihr.com"
                className="text-primary underline"
              >
                hello@namihr.com
              </a>{" "}
              with a description of the issue and steps to reproduce.
            </p>
            <p className="mb-3">
              While reviewing our Service, please do not: access or modify data
              belonging to other customers; run automated scanners that generate
              significant load; perform denial-of-service testing; or publicly
              disclose the issue before we have had a reasonable opportunity to
              investigate and remediate.
            </p>
            <p>
              We will acknowledge valid reports, keep you updated on remediation
              progress, and credit researchers who wish to be credited.
            </p>
          </section>

          {/* ── Contact ─────────────────────────────────────────── */}
          <section className="border-t pt-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              Contact
            </h2>
            <ul className="space-y-1">
              <li>
                Security reports and questions:{" "}
                <a
                  href="mailto:hello@namihr.com"
                  className="text-primary underline"
                >
                  hello@namihr.com
                </a>
              </li>
              <li>
                Privacy and data requests:{" "}
                <a
                  href="mailto:hello@namihr.com"
                  className="text-primary underline"
                >
                  hello@namihr.com
                </a>
              </li>
              <li>
                DPAs and contracts:{" "}
                <a
                  href="mailto:hello@namihr.com"
                  className="text-primary underline"
                >
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
