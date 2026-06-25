import Link from "next/link";
import { Slack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
import { getAddToSlackUrl, getSignInUrl } from "@/lib/slack-cta";

// Shared marketing-site header for non-landing public pages (guides, compare).
// The landing page (src/app/page.tsx) keeps its own bespoke hero nav; this is
// the lighter, consistent chrome for content pages. Every link funnels toward
// the Slack install so content traffic converts.
export function SiteHeader({ ctaPurpose = "marketing" }: { ctaPurpose?: string }) {
  const addToSlackUrl = getAddToSlackUrl(ctaPurpose);
  const signInUrl = getSignInUrl();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#fafaf5]/85 border-b border-border/40">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Nami home">
          <span className="text-3xl font-black tracking-tight text-foreground">Nami</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href="/guides"
            className="hidden sm:inline text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Guides
          </Link>
          <Link
            href="/pricing"
            className="hidden sm:inline text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/roadmap"
            className="hidden md:inline text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Roadmap
          </Link>
          <Link
            href="/about"
            className="hidden md:inline text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
          <a
            href={signInUrl}
            className="hidden sm:inline text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
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
