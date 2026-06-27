import { cn } from "@/lib/utils";

// Dual-beam spotlight for dark "moments" (Aceternity "Spotlight New"), pure
// CSS. Two large, low-alpha radial gradients (cool indigo + warm amber) that
// drift slowly behind the content. Drop into any `relative` dark container —
// it replaces the single static glow orb with something with more depth.
//
// `variant`:
//   "moment"  — full hero/CTA card (default)
//   "subtle"  — quieter, for secondary dark bands
export function Spotlight({
  variant = "moment",
  className,
}: {
  variant?: "moment" | "subtle";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* faint grid texture, masked to fade at the edges */}
      <div className="absolute inset-0 bg-grid-ink mask-radial-faded opacity-60" />
      <div
        className={cn(
          "spotlight-beam spotlight-beam-1",
          variant === "moment"
            ? "-left-24 -top-1/3 h-[560px] w-[560px]"
            : "-left-16 -top-1/4 h-[360px] w-[360px] opacity-70",
        )}
      />
      <div
        className={cn(
          "spotlight-beam spotlight-beam-2",
          variant === "moment"
            ? "-bottom-1/3 -right-20 h-[460px] w-[460px]"
            : "-bottom-1/4 -right-12 h-[300px] w-[300px] opacity-60",
        )}
      />
    </div>
  );
}
