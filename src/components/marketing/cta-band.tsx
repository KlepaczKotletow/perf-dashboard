import { Slack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";

// Closing CTA — the landing page's dark #1a1a2e card with the glow orb and the
// btn-glow primary button, reused across marketing/content pages.
export function CtaBand({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#1a1a2e] px-8 py-14 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 right-0 h-72 w-72 rounded-full bg-gradient-to-bl from-primary/25 to-transparent blur-3xl animate-orb-drift"
      />
      <div className="relative">
        <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-md leading-relaxed text-white/60">{subtitle}</p>
        <div className="mt-7 flex justify-center">
          <Button size="lg" className="h-12 rounded-full px-7 text-sm font-semibold btn-glow" asChild>
            <AddToSlackLink href={href}>
              <Slack className="mr-2 h-4 w-4" />
              Add Nami to Slack
            </AddToSlackLink>
          </Button>
        </div>
      </div>
    </div>
  );
}
