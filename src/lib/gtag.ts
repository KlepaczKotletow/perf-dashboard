// Thin wrapper around Google Ads gtag.js (loaded in src/app/layout.tsx).
//
// gtag.js is loaded with strategy="afterInteractive", so `window.gtag` may not
// exist yet on very early hydration or during SSR. Every helper here is a
// no-op when the global isn't there — safe to call from any onClick / effect
// without guarding at the call site.
//
// Why the Subscribe label lives in an env var:
//   The conversion ID (AW-18179782629) is fine to ship in source — it's
//   already in the page HTML. But conversion *labels* are per-action and we
//   want to be able to add more (install-complete, paid-conversion, etc.)
//   without redeploying. Set NEXT_PUBLIC_GADS_CONVERSION_SUBSCRIBE in Vercel
//   env to the full `send_to` value, e.g. "AW-18179782629/abcDEF123xyz".

const GOOGLE_ADS_ID = "AW-18179782629";

type GtagFn = (
  command: "event" | "config" | "set" | "js" | "consent",
  // The second argument shape varies by command. We accept anything here and
  // let Google's runtime do the validation — TS-narrowing every command is
  // more noise than it's worth for a 30-line wrapper.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

const isBrowser = typeof window !== "undefined";

/**
 * Fire a Google Ads conversion. `sendTo` is the full "AW-XXX/LABEL" string
 * that Google generates when you create the conversion action.
 *
 * Usage:
 *   conversion(process.env.NEXT_PUBLIC_GADS_CONVERSION_SUBSCRIBE);
 *
 * If `sendTo` is undefined or empty, this is a no-op — safe for environments
 * where the env var isn't set yet (preview deploys, local dev).
 */
export function conversion(
  sendTo: string | undefined,
  params?: { value?: number; currency?: string; transactionId?: string }
): void {
  if (!isBrowser || !sendTo || !window.gtag) return;
  window.gtag("event", "conversion", {
    send_to: sendTo,
    ...(params?.value !== undefined ? { value: params.value } : {}),
    ...(params?.currency ? { currency: params.currency } : {}),
    ...(params?.transactionId ? { transaction_id: params.transactionId } : {}),
  });
}

/**
 * Generic event for non-conversion tracking (e.g., scroll milestones, video
 * plays). Use `conversion()` instead when the event is a tracked goal.
 */
export function event(
  name: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!isBrowser || !window.gtag) return;
  window.gtag("event", name, params ?? {});
}

/** Exported for code that needs the raw ID (rare). */
export const ADS_ID = GOOGLE_ADS_ID;
