import { Children, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Seamless infinite marquee (Aceternity "Infinite Moving Cards"), pure CSS.
// Duplicates the track once and animates translateX(-50%); pauses on hover;
// edges fade via a mask. Use for the testimonial / proof strip.
export function Marquee({
  children,
  className,
  duration = "46s",
  direction = "left",
  gap = "1.25rem",
}: {
  children: ReactNode;
  className?: string;
  duration?: string;
  direction?: "left" | "right";
  gap?: string;
}) {
  const items = Children.toArray(children);

  return (
    <div className={cn("marquee-mask relative w-full overflow-hidden", className)}>
      <ul
        className="marquee-track"
        data-direction={direction}
        style={
          {
            "--marquee-duration": duration,
            "--marquee-gap": gap,
          } as CSSProperties
        }
      >
        {[0, 1].map((copy) =>
          items.map((child, i) => (
            <li key={`${copy}-${i}`} className="shrink-0" aria-hidden={copy === 1 || undefined}>
              {child}
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
