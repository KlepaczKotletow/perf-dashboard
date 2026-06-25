import Link from "next/link";
import { ChevronDown } from "lucide-react";

// Shared grouped nav for the marketing site — "Product" and "Resources"
// hover/focus dropdown menus, used by both the landing-page header and the
// shared SiteHeader so the bar stays uncluttered and consistent everywhere.
// Pure-CSS dropdowns (group-hover / focus-within), so this stays a server
// component. Renders the menu cluster only; callers add Sign in + the CTA.

const MENUS: { label: string; links: { href: string; label: string; desc: string }[] }[] = [
  {
    label: "Product",
    links: [
      { href: "/pricing", label: "Pricing", desc: "One plan, and the free tier" },
      { href: "/roadmap", label: "Roadmap", desc: "What we're building next" },
      { href: "/security", label: "Security", desc: "Data, privacy & hosting" },
      { href: "/support", label: "Support", desc: "Get help, fast" },
    ],
  },
  {
    label: "Resources",
    links: [
      { href: "/guides", label: "Guides", desc: "Performance playbooks" },
      { href: "/compare", label: "Compare", desc: "Nami vs the incumbents" },
      { href: "/about", label: "About", desc: "The team & the story" },
    ],
  },
];

export function NavMenus() {
  return (
    <div className="hidden items-center gap-1 md:flex">
      {MENUS.map((menu) => (
        <div key={menu.label} className="group relative">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground group-focus-within:text-foreground"
          >
            {menu.label}
            <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180" />
          </button>
          {/* pt-2 bridges the gap so the panel doesn't close mid-hover */}
          <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="w-64 rounded-2xl border border-border bg-popover/95 p-1.5 shadow-lg shadow-black/[0.06] backdrop-blur-md">
              {menu.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-xl px-3 py-2 transition-colors hover:bg-accent"
                >
                  <span className="block text-sm font-medium text-foreground">{link.label}</span>
                  <span className="block text-xs text-muted-foreground/70">{link.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
