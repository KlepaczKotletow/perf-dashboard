import { Spotlight } from "@/components/marketing/spotlight";
import { SlackCtaButton } from "@/components/marketing/slack-cta-button";

// Closing CTA — the dark #1a1a2e "moment" with the Spotlight beams and the
// canonical animated-border Slack button, reused across marketing pages.
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
    <div className="relative overflow-hidden rounded-3xl bg-ink-panel px-8 py-16 text-center">
      <Spotlight />
      <div className="relative">
        <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-md leading-relaxed text-white/60">{subtitle}</p>
        <div className="mt-8 flex justify-center">
          <SlackCtaButton href={href}>Add Nami to Slack</SlackCtaButton>
        </div>
      </div>
    </div>
  );
}
