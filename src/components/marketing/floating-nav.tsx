"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NavMenus } from "@/components/marketing/nav-menus";
import { SlackCtaButton } from "@/components/marketing/slack-cta-button";
import { MobileNav } from "@/components/landing/mobile-nav";
import { getAddToSlackUrl, getSignInUrl } from "@/lib/slack-cta";

// Floating, scroll-aware navbar (Aceternity "Resizable Navbar"). At the top it's
// a full-width transparent bar; after a small scroll it collapses into a
// centered rounded-full pill with blur + shadow (matching the reference). Used
// site-wide so every marketing page shares the same chrome.
export function FloatingNav({ ctaPurpose = "marketing" }: { ctaPurpose?: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const addToSlackUrl = getAddToSlackUrl(ctaPurpose);
  const signInUrl = getSignInUrl();

  return (
    <header className="sticky top-0 z-50 flex justify-center px-4">
      <div
        className={cn(
          "grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4 transition-all duration-300 ease-out",
          scrolled
            ? "mt-3 max-w-5xl rounded-full border border-border/60 bg-background/80 px-3 py-2 pl-5 shadow-lg shadow-black/[0.06] backdrop-blur-md supports-[backdrop-filter]:bg-background/70"
            : "mt-0 max-w-7xl border border-transparent px-2 py-4 sm:px-6 lg:px-10",
        )}
      >
        <Link href="/" className="col-start-1 flex shrink-0 items-center gap-2 justify-self-start" aria-label="Nami home">
          <span
            className={cn(
              "font-black tracking-tight text-foreground transition-all duration-300",
              scrolled ? "text-xl" : "text-2xl lg:text-[28px]",
            )}
          >
            Nami
          </span>
        </Link>

        <nav className="col-start-2 hidden justify-self-center md:flex">
          <NavMenus />
        </nav>

        <div className="col-start-3 flex shrink-0 items-center gap-2 justify-self-end sm:gap-3">
          <a
            href={signInUrl}
            className="hidden text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground lg:inline"
          >
            Sign in
          </a>
          <a
            href="mailto:hello@namihr.com?subject=Nami%20demo"
            className="hidden h-10 items-center rounded-full border border-border/70 px-4 text-[14px] font-medium text-foreground transition-colors hover:bg-accent md:inline-flex"
          >
            Book a demo
          </a>
          <span className="hidden sm:inline">
            <SlackCtaButton href={addToSlackUrl} size="md" animated={false}>
              Add to Slack
            </SlackCtaButton>
          </span>
          <div className="md:hidden">
            <MobileNav signInUrl={signInUrl} addToSlackUrl={addToSlackUrl} />
          </div>
        </div>
      </div>
    </header>
  );
}
