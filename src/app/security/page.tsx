import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Masthead } from "@/components/marketing/masthead";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Nami protects your data: infrastructure, encryption, tenant isolation, access control, secure development, backups, vulnerability management, audit logging, subprocessors, and incident response. An honest, current snapshot — not a marketing one.",
  alternates: { canonical: "/security" },
  openGraph: {
    title: "Security — Nami",
    description:
      "How Nami protects your data: encryption, tenant isolation, secure development, backups, vulnerability management, audit logging, and incident response.",
    url: "/security",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Security — Nami",
    description:
      "How Nami protects your data: encryption, tenant isolation, backups, audit logging, and incident response.",
  },
};

export default function SecurityPage() {
  const effectiveDate = "May 23, 2026";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader ctaPurpose="security" />
      <Masthead
        kicker="Security"
        title={
          <>
            Security,{" "}
            <span className="font-serif-accent text-[hsl(var(--spotlight))]">honestly stated.</span>
          </>
        }
        lead="How Nami protects your data — infrastructure, encryption, tenant isolation, access control, backups, and incident response. An honest, current snapshot, not a marketing one."
      />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="mb-10 text-sm text-muted-foreground">Last updated: {effectiveDate}</p>
          <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* ── Overview ─────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              1. Overview
            </h2>
            <p className="mb-3">
              Nami stores performance reviews, calibration grades, feedback,
              goals, and survey data on behalf of your organization. We take
              the confidentiality, integrity, and availability of that data
              seriously. This page is a deliberately honest description of what
              we do today, what infrastructure we rely on, and what is still on
              our roadmap. We will not claim certifications we do not have.
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
              We do not operate our own data centers. Nami runs on third-party
              cloud infrastructure whose security programs are independently
              audited. Each provider&apos;s certifications cover the layer of
              the stack that provider runs; certifications of subservice
              organizations are not certifications of Nami itself.
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <strong>Application hosting and edge delivery:</strong> Vercel
                — independently audited under SOC 2 Type II and ISO 27001
              </li>
              <li>
                <strong>Database, authentication, and edge functions:</strong>{" "}
                Supabase, running on Amazon Web Services — Supabase is
                independently audited under SOC 2 Type II
              </li>
              <li>
                <strong>Underlying cloud:</strong> Amazon Web Services — SOC 1,
                SOC 2 Type II, SOC 3, ISO 27001, ISO 27017, ISO 27018, PCI DSS,
                and many other attestations
              </li>
            </ul>
            <p>
              Attestation reports from these providers are available directly
              from them, generally under NDA.
            </p>
          </section>

          {/* ── Data residency ──────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              3. Data Residency
            </h2>
            <p className="mb-3">
              Our primary database is hosted in the <strong>European Union</strong>{" "}
              (Ireland, AWS region <code className="text-xs bg-muted px-1 py-0.5 rounded">eu-west-1</code>).
              All Customer Data — reviews, ratings, calibration grades,
              feedback, goals, surveys, audit log entries, and workspace
              configuration — lives there.
            </p>
            <p>
              Our application and edge functions run on Vercel and Supabase
              edge networks that may terminate TLS at points of presence around
              the world for performance. Customer Data is only processed in
              memory at those edge points for the duration of the request;
              persistent storage is the EU database described above.
              Subprocessors such as Slack, Stripe, and Google process limited
              categories of data in the United States or other jurisdictions
              as described in our{" "}
              <Link href="/privacy" className="text-primary underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          {/* ── Encryption ──────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              4. Encryption
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>In transit:</strong> All traffic to and from Nami is
                encrypted with TLS 1.2 or higher. HTTP traffic is redirected
                to HTTPS. HSTS is enabled on our production hostnames.
              </li>
              <li>
                <strong>At rest:</strong> All Customer Data is encrypted using
                AES-256 at the storage layer, including database contents and
                automated backups.
              </li>
              <li>
                <strong>Secrets:</strong> Application secrets (OAuth client
                secrets, signing keys, third-party API keys) are stored in
                managed-secret stores provided by Vercel and Supabase and are
                injected as environment variables. Secrets are never committed
                to source control.
              </li>
              <li>
                <strong>Keys:</strong> Encryption-key material is managed by
                our infrastructure providers (AWS KMS, Vercel, and Supabase).
                We do not store or manage raw key material ourselves.
              </li>
            </ul>
          </section>

          {/* ── Authentication ──────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              5. Authentication
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Slack OAuth 2.0:</strong> Users sign in exclusively
                through Slack. We do not store user passwords.
              </li>
              <li>
                <strong>Multi-factor authentication:</strong> If your Slack
                workspace requires MFA or SSO, that requirement is inherited
                by Nami sign-in automatically.
              </li>
              <li>
                <strong>Sessions:</strong> Sessions are managed through
                short-lived, signed tokens issued by Supabase Auth and stored
                in HTTP-only, Secure, SameSite cookies.
              </li>
              <li>
                <strong>OAuth state:</strong> OAuth state parameters are signed
                with an HMAC secret and verified on the callback to prevent
                cross-site-request-forgery attacks against the install flow.
              </li>
              <li>
                <strong>Slack bot tokens:</strong> Slack bot tokens have a
                12-hour TTL and are auto-rotated by our refresh routine. Tokens
                are stored server-side only and are never exposed to the
                browser.
              </li>
              <li>
                <strong>Webhook signature verification:</strong> Slack events,
                interactivity, slash commands, and Stripe webhooks are
                cryptographically verified using HMAC signatures with
                constant-time comparison before any side-effect.
              </li>
            </ul>
          </section>

          {/* ── Access control & tenant isolation ───────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              6. Access Control and Tenant Isolation
            </h2>
            <p className="mb-3">
              Each workspace&apos;s data is isolated at the database layer. A
              user from one workspace cannot read or modify data belonging to
              another workspace, regardless of the request path.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Row-level security (RLS):</strong> PostgreSQL RLS
                policies are enforced on tables that hold Customer Data. Policy
                checks run inside the database engine, not in application code.
              </li>
              <li>
                <strong>Cross-tenant validation triggers:</strong> Database
                triggers reject writes that would associate a record with a
                workspace the acting user does not belong to.
              </li>
              <li>
                <strong>Role-based access inside a workspace:</strong> Admin,
                HR, Manager, and Employee roles limit what each user can see
                and do. Grade releases, calibration data, private calibration
                notes, and HR-only views are gated at the database layer.
              </li>
              <li>
                <strong>Anonymous responses:</strong> Anonymous survey and
                feedback authors are stored as a workspace-scoped pseudonym;
                authorship is not surfaced in the dashboard or audit log.
              </li>
              <li>
                <strong>Principle of least privilege:</strong> Internal access
                to production systems is restricted to authorized personnel and
                scoped to the minimum needed for their role. Access requires
                SSO and MFA.
              </li>
            </ul>
          </section>

          {/* ── Audit logging ───────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              7. Audit Logging
            </h2>
            <p className="mb-3">
              Sensitive state changes are recorded to an in-database audit log
              and retained for the lifetime of the workspace. Logged events
              include:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Performance cycle status transitions (launched, closed,
                released)</li>
              <li>Calibration grade changes, grade reasons, and grade releases</li>
              <li>User role changes (Admin, HR, Manager, Employee
                assignments)</li>
              <li>Review assignment changes (assigned, reassigned, removed)</li>
              <li>Goal lifecycle events (created, updated status, archived)</li>
            </ul>
            <p>
              Audit log access is restricted to Admin and HR roles within the
              workspace that owns the data. Audit log entries are append-only
              by application logic; they are not exposed through any general
              data-export endpoint.
            </p>
          </section>

          {/* ── Backups & DR ────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              8. Backups and Disaster Recovery
            </h2>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <strong>Continuous backups:</strong> Our database provider runs
                continuous point-in-time recovery and daily snapshots. We do
                not store backups outside the managed provider.
              </li>
              <li>
                <strong>Backup retention:</strong> Backups are retained for up
                to thirty (30) days, then deleted on a rolling basis. Backup
                contents are encrypted at rest with AES-256.
              </li>
              <li>
                <strong>Recovery objectives (target, not contractual):</strong>{" "}
                Recovery point objective (RPO) of up to one (1) hour; recovery
                time objective (RTO) of up to twenty-four (24) hours for the
                application tier. Enterprise customers may negotiate stricter
                contractual targets in a separate agreement.
              </li>
              <li>
                <strong>Multi-region failover:</strong> The application tier
                runs on Vercel&apos;s global edge with automatic failover. The
                database tier runs in a single region; cross-region failover
                is on our roadmap.
              </li>
              <li>
                <strong>Backup testing:</strong> Restore is tested periodically
                against non-production environments to validate that backups
                are usable.
              </li>
            </ul>
          </section>

          {/* ── Secure development ──────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              9. Secure Development
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Code review:</strong> Every change to the production
                codebase goes through pull-request review before merge.
              </li>
              <li>
                <strong>Static analysis:</strong> TypeScript strict-mode type
                checking, ESLint, and CI-level test suites run on every pull
                request.
              </li>
              <li>
                <strong>Dependency monitoring:</strong> We use automated
                dependency scanning to alert us to security advisories in
                third-party packages, and we patch high- and critical-severity
                advisories on an expedited cadence.
              </li>
              <li>
                <strong>Secret-scanning:</strong> Source control is scanned for
                accidentally-committed credentials. Detected secrets are
                rotated immediately.
              </li>
              <li>
                <strong>Tenant-isolation test coverage:</strong> Cross-tenant
                isolation invariants — that workspace A cannot read or write
                workspace B&apos;s data — are covered by automated tests
                exercised against the database.
              </li>
              <li>
                <strong>Production deploys:</strong> Production deploys are
                triggered by merges to the main branch and ship through Vercel
                with automatic rollback support.
              </li>
            </ul>
          </section>

          {/* ── Vulnerability management ────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              10. Vulnerability Management
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Patch cadence:</strong> Critical vulnerabilities in
                production dependencies are patched within seven (7) days of a
                fix becoming available; high-severity within thirty (30) days;
                medium and lower on the normal release cadence.
              </li>
              <li>
                <strong>Penetration testing:</strong> Independent third-party
                penetration testing is on our roadmap (see Section 13). The
                summary letter will be available to customers on request.
              </li>
              <li>
                <strong>Responsible disclosure:</strong> We welcome reports
                from security researchers — see Section 14.
              </li>
            </ul>
          </section>

          {/* ── Logging & monitoring ────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              11. Logging and Monitoring
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Application logs:</strong> Structured request and
                error logs are emitted by the application and edge functions,
                retained for up to thirty (30) days, and available to
                engineering for incident response.
              </li>
              <li>
                <strong>Database logs:</strong> Database query, connection, and
                error logs are retained by Supabase per its standard
                retention policy and surfaced through its dashboard.
              </li>
              <li>
                <strong>Error alerting:</strong> Unhandled errors and unusual
                rate-of-failure patterns are surfaced via dashboard alerts and
                routed to engineering on call.
              </li>
              <li>
                <strong>OAuth-install health probe:</strong> A dedicated probe
                routinely signs and verifies an OAuth state token to confirm
                the install flow is healthy end to end.
              </li>
            </ul>
          </section>

          {/* ── Organisational ──────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              12. Organisational Security
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Endpoint security:</strong> Workstations used to
                develop and operate the Service have full-disk encryption,
                screen-lock policies, and current operating-system patches.
              </li>
              <li>
                <strong>SSO + MFA:</strong> Administrative access to our
                infrastructure providers requires SSO and multi-factor
                authentication.
              </li>
              <li>
                <strong>Least privilege:</strong> Access to production data
                and infrastructure is granted on a need-to-know basis and
                revoked when no longer needed.
              </li>
              <li>
                <strong>Confidentiality:</strong> Personnel with access to
                Customer Data are bound by written confidentiality
                obligations.
              </li>
              <li>
                <strong>Incident drills:</strong> Internal incident-response
                runbooks are reviewed periodically.
              </li>
            </ul>
          </section>

          {/* ── Compliance roadmap ──────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              13. Compliance Roadmap
            </h2>
            <p className="mb-3">
              We are transparent about where we are in our compliance journey.
              The list below distinguishes what is in place today from what is
              planned.
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>
                <strong>Infrastructure attestations (today):</strong> Supabase,
                Vercel, and AWS are independently audited under SOC 2 Type II
                and other frameworks. Their attestations cover the hosting,
                authentication, and storage layers of the Service. They do
                not, however, attest to Nami itself.
              </li>
              <li>
                <strong>GDPR / UK GDPR / Swiss FADP (today):</strong> A Data
                Processing Agreement covering Standard Contractual Clauses for
                international transfers (and the UK International Data Transfer
                Addendum where relevant) is available to any customer on
                request via{" "}
                <a
                  href="mailto:hello@namihr.com"
                  className="text-primary underline"
                >
                  hello@namihr.com
                </a>
                . Our primary database resides in the European Union.
              </li>
              <li>
                <strong>SOC 2 Type II for Nami itself (planned):</strong> An
                independent SOC 2 Type II audit of Nami is on our{" "}
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
              <li>
                <strong>ISO 27001 / HIPAA / PCI DSS / FedRAMP:</strong> We do
                not currently claim ISO 27001, HIPAA, PCI DSS, or FedRAMP
                certification. If your procurement process requires one of
                these and you want to discuss it, write to{" "}
                <a
                  href="mailto:hello@namihr.com"
                  className="text-primary underline"
                >
                  hello@namihr.com
                </a>
                .
              </li>
            </ul>
          </section>

          {/* ── Responsible disclosure ─────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              14. Responsible Disclosure
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
              with a description of the issue, the steps to reproduce, and any
              proof-of-concept material.
            </p>
            <p className="mb-3">
              While testing, please do not: access or modify data belonging to
              other customers; run automated scanners that generate significant
              load; perform denial-of-service testing; social-engineer our
              personnel or vendors; or publicly disclose the issue before we
              have had a reasonable opportunity to investigate and remediate
              (we ask for ninety (90) days).
            </p>
            <p>
              We will acknowledge valid reports within five (5) business days,
              keep you updated on remediation progress, and credit researchers
              who wish to be credited. We do not currently operate a paid bug
              bounty.
            </p>
          </section>

          {/* ── Incident response ──────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              15. Incident Response
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
                and, where GDPR or comparable laws apply, within seventy-two
                (72) hours of becoming aware of the incident
              </li>
              <li>
                Provide a description of the incident, the categories and
                approximate number of records affected, the likely
                consequences, and the measures taken or proposed
              </li>
              <li>
                Notify relevant data-protection authorities and other
                regulators where required by applicable law
              </li>
              <li>
                Cooperate with affected customers in their own notification and
                remediation efforts
              </li>
            </ul>
            <p>
              For the avoidance of doubt, the following are not security
              incidents requiring notification under this Section: failed login
              attempts, denied connection attempts, port scans, automated probe
              traffic, and other unsuccessful probes that do not compromise the
              confidentiality, integrity, or availability of Customer Data.
            </p>
          </section>

          {/* ── Customer-side responsibilities ──────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              16. Your Side of the Shared-Responsibility Model
            </h2>
            <p className="mb-3">
              Security is a shared responsibility. The controls described
              above are the controls we operate. You are responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Configuring strong controls in Slack itself, including MFA,
                SSO where available, session length, and idle timeout
              </li>
              <li>
                Granting Admin and HR roles in Nami only to people who need
                them, and revoking them promptly when responsibilities change
              </li>
              <li>
                Promptly deactivating Slack users when employees leave so they
                lose Nami access automatically</li>
              <li>
                Reporting suspected compromise of your account or any unusual
                activity to{" "}
                <a
                  href="mailto:hello@namihr.com"
                  className="text-primary underline"
                >
                  hello@namihr.com
                </a>{" "}
                without delay
              </li>
              <li>
                Maintaining your own backups of any Customer Data you consider
                critical, using the CSV-export features in the dashboard
              </li>
              <li>
                Ensuring your use of the Service and any data your users
                submit complies with the laws of the jurisdictions where you
                operate
              </li>
            </ul>
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
                DPAs and procurement contracts:{" "}
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
      </main>
      <SiteFooter />
    </div>
  );
}
