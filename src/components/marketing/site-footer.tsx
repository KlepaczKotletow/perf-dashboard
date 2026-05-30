import Link from "next/link";

// Shared marketing-site footer. Doubles as an internal-linking surface: every
// page that renders it passes crawl equity to /guides and the /compare pages,
// which is how those new sections get discovered and indexed.

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
      { href: "/compare/lattice", label: "Nami vs Lattice" },
      { href: "/compare/15five", label: "Nami vs 15Five" },
      { href: "/compare/leapsome", label: "Nami vs Leapsome" },
      { href: "/compare/culture-amp", label: "Nami vs Culture Amp" },
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
    <footer className="bg-muted/40 border-t border-border mt-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <span className="text-xl font-black tracking-tight text-foreground">Nami</span>
            <p className="mt-3 text-sm text-muted-foreground/80 leading-relaxed max-w-[200px]">
              Performance management for teams that live in Slack.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-3">
                {col.heading}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-muted-foreground/60">
          <span>&copy; {new Date().getFullYear()} Nami</span>
          <a href="mailto:hello@namihr.com" className="hover:text-foreground transition-colors">
            hello@namihr.com
          </a>
        </div>
      </div>
    </footer>
  );
}
