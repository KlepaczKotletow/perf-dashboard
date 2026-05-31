import Link from "next/link";

// Editorial footer. Dark indigo ink to bookend the page against the masthead,
// a serif wordmark, amber section labels. Also the internal-linking surface —
// every page that renders it passes crawl equity to /guides and /compare.

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/roadmap", label: "Roadmap" },
      { href: "/security", label: "Security" },
      { href: "/support", label: "Support" },
    ],
  },
  {
    heading: "Compare",
    links: [
      { href: "/compare/lattice", label: "vs Lattice" },
      { href: "/compare/15five", label: "vs 15Five" },
      { href: "/compare/leapsome", label: "vs Leapsome" },
      { href: "/compare/culture-amp", label: "vs Culture Amp" },
    ],
  },
  {
    heading: "Guides",
    links: [
      { href: "/guides", label: "All guides" },
      { href: "/guides/goal-setting-okrs", label: "OKR goal setting" },
      { href: "/guides/running-calibration", label: "Running calibration" },
      { href: "/guides/enps-best-practices", label: "eNPS best practices" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-28 bg-[oklch(0.175_0.035_264)] text-[#cfc9bd]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 lg:px-10 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <span className="font-display text-3xl font-semibold tracking-tight text-[#faf8f2]">
              Nami
            </span>
            <p className="mt-4 max-w-[220px] text-sm leading-relaxed text-[#b4ae9f]">
              Performance management that lives where your team already works —
              <span className="text-[oklch(0.82_0.14_85)]"> Slack.</span>
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading} className="md:col-span-1">
              <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[oklch(0.78_0.13_85)]">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#cfc9bd] transition-colors hover:text-[#faf8f2]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-[#9a9484] sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {new Date().getFullYear()} Nami</span>
          <a
            href="mailto:hello@namihr.com"
            className="transition-colors hover:text-[#faf8f2]"
          >
            hello@namihr.com
          </a>
        </div>
      </div>
    </footer>
  );
}
