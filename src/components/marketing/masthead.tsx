import type { ReactNode } from "react";

// The signature editorial masthead for marketing/content pages. A deep indigo
// ink band (echoes the landing hero) with a Fraunces serif headline, an amber
// small-caps kicker, and a faint dot-grid texture — deliberately NOT a gradient
// wash. Sits full-bleed under the cream header so it reads as a magazine cover.
export function Masthead({
  kicker,
  title,
  lead,
  breadcrumb,
  actions,
  align = "left",
}: {
  kicker?: string;
  title: ReactNode;
  lead?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <header className="relative isolate overflow-hidden bg-[oklch(0.175_0.035_264)] text-[#f4f1e8]">
      {/* dot-grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* faint warm glow anchored bottom-left, kept very subtle */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "oklch(0.75 0.16 85)" }}
      />
      <div
        className={`relative mx-auto max-w-5xl px-6 lg:px-10 pt-12 pb-16 sm:pt-16 sm:pb-20 ${
          align === "center" ? "text-center" : ""
        }`}
      >
        {breadcrumb && <div className="mb-7">{breadcrumb}</div>}
        {kicker && (
          <p
            className={`font-mono text-[11px] uppercase tracking-[0.28em] text-[oklch(0.82_0.14_85)] ${
              align === "center" ? "" : ""
            } mb-5`}
          >
            {kicker}
          </p>
        )}
        <h1
          className={`font-display font-semibold text-[2.6rem] leading-[1.04] tracking-[-0.015em] text-[#faf8f2] sm:text-6xl ${
            align === "center" ? "mx-auto max-w-3xl" : "max-w-3xl"
          }`}
        >
          {title}
        </h1>
        {lead && (
          <div
            className={`mt-6 text-lg leading-relaxed text-[#cfc9bd] sm:text-xl ${
              align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"
            }`}
          >
            {lead}
          </div>
        )}
        {actions && <div className={`mt-9 ${align === "center" ? "flex justify-center" : ""}`}>{actions}</div>}
      </div>
      {/* hairline foot */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
    </header>
  );
}
