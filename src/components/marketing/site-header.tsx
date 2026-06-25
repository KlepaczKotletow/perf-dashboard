import Link from "next/link";
import { Slack, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
import { getAddToSlackUrl, getSignInUrl } from "@/lib/slack-cta";

// Shared marketing-site header for non-landing public pages (guides, compare,
// about). Links are grouped into hover/focus menus ("Product" and "Resources")
// to keep the bar uncluttered. Pure-CSS dropdowns (group-hover / focus-within)
// so this stays a server component. Every link funnels toward the Slack install.

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

export function SiteHeader({ ctaPurpose = "marketing" }: { ctaPurpose?: string }) {
  const addToSlackUrl = getAddToSlackUrl(ctaPurpose);
  const signInUrl = getSignInUrl();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#fafaf5]/85 border-b border-border/40">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Nami home">
          <span className="text-3xl font-black tracking-tight text-foreground">Nami</span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-3">
          <div className="hidden md:flex items-center gap-1">
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

          <a
            href={signInUrl}
            className="hidden px-2 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Sign in
          </a>
          <Button className="rounded-full px-5 h-9 text-[14px]" asChild>
            <AddToSlackLink href={addToSlackUrl}>
              <Slack className="h-4 w-4 mr-1.5" />
              Add to Slack
            </AddToSlackLink>
          </Button>
        </nav>
      </div>
    </header>
  );
}
