import type { ReactNode } from "react";
import { Spotlight } from "@/components/marketing/spotlight";
import { Kicker } from "@/components/marketing/kicker";

// Hero/masthead for marketing/content pages — a dark #1a1a2e "moment" on the
// warm cream canvas, upgraded with the dual-beam Spotlight + grid texture and
// an editorial mono kicker. Pass an accent <span className="font-serif-accent
// text-[hsl(var(--spotlight))]"> inside `title` for the highlighted phrase.
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
    <section className="relative overflow-hidden bg-gradient-to-br from-[#fafaf5] via-[#f8f6f0] to-[#fefcf5]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-diagonal-lines [mask-image:radial-gradient(ellipse_80%_80%_at_50%_30%,#000,transparent)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 pt-8 pb-2 sm:pt-10 lg:px-10">
        <div className="relative overflow-hidden rounded-3xl bg-ink-panel px-7 py-14 sm:px-12 sm:py-20">
          <Spotlight />
          <div className="relative">
            {breadcrumb && <div className="mb-6">{breadcrumb}</div>}
            {kicker && (
              <div className="mb-6">
                <Kicker onDark>{kicker}</Kicker>
              </div>
            )}
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.3rem]">
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
