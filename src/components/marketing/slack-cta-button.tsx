import { Slack } from "lucide-react";
import type { ReactNode } from "react";
import { AddToSlackLink } from "@/components/landing/add-to-slack-link";
import { cn } from "@/lib/utils";

// The canonical primary CTA across the marketing site. Wraps the conversion-
// tracked AddToSlackLink in the animated conic-gradient border (Aceternity
// "Moving Border") + btn-glow. One component so every "Add to Slack" looks and
// behaves identically and keeps its Google Ads conversion wiring.
export function SlackCtaButton({
  href,
  children = "Add to Slack — free",
  size = "lg",
  animated = true,
  className,
}: {
  href: string;
  children?: ReactNode;
  size?: "md" | "lg";
  animated?: boolean;
  className?: string;
}) {
  const sizing = size === "lg" ? "h-12 px-7 text-sm" : "h-10 px-5 text-sm";

  return (
    <span className={cn("inline-flex rounded-full", animated && "animated-border")}>
      <AddToSlackLink
        href={href}
        className={cn(
          "btn-glow inline-flex items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90",
          sizing,
          className,
        )}
      >
        <Slack className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {children}
      </AddToSlackLink>
    </span>
  );
}
