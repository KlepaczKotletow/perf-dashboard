import type { ReactNode } from "react";

// Hero/masthead for marketing/content pages — matches the landing page exactly:
// a #1a1a2e dark-navy rounded-3xl card with the animated primary-glow orb, on the
// warm cream page gradient. Manrope headline; pass an accent <span> with
// `text-primary text-shimmer` for the highlighted word.
export function Masthead({
  kicker,
  title,
  lead,
  breadcrumb,
  actions,
}: {
  kicker?: string;
  title: ReactNode;
  lead?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="bg-gradient-to-br from-[#fafaf5] via-[#f8f6f0] to-[#fefcf5]">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 pt-8 pb-2 sm:pt-10">
        <div className="relative overflow-hidden rounded-3xl bg-[#1a1a2e] px-7 py-12 sm:px-12 sm:py-16">
          {/* soft primary glow orb — same as the landing hero */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 right-0 h-[320px] w-[320px] rounded-full bg-gradient-to-bl from-primary/25 to-transparent blur-3xl animate-orb-drift"
          />
          <div className="relative">
            {breadcrumb && <div className="mb-6">{breadcrumb}</div>}
            {kicker && (
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                {kicker}
              </span>
            )}
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
            {lead && (
              <div className="mt-5 max-w-2xl text-lg leading-relaxed text-white/60">{lead}</div>
            )}
            {actions && <div className="mt-8">{actions}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
