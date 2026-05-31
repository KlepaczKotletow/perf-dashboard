import Link from "next/link";

// Marketing-site footer — light, matching the landing page footer palette
// (bg-muted/40, Manrope, muted links). Also the internal-linking surface:
// passes crawl equity to /guides and /compare from every page.

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
    <footer className="mt-24 border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 md:col-span-2">
            <span className="text-xl font-bold tracking-tight text-foreground">Nami</span>
            <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-muted-foreground/80">
              Performance management for teams that live in Slack.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground/70 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {new Date().getFullYear()} Nami</span>
          <div className="flex items-center gap-6">
            <a
              href="https://www.linkedin.com/company/namihr"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              LinkedIn
            </a>
            <a href="mailto:hello@namihr.com" className="transition-colors hover:text-foreground">
              hello@namihr.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
