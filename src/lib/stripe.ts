import Stripe from "stripe";

/**
 * Throws a recognisable, generic error if STRIPE_SECRET_KEY is missing
 * so callers can return "Payments not configured" without leaking SDK
 * internals. The `code` is checked by /api/checkout.
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    const e = new Error("Payments not configured");
    (e as Error & { code?: string }).code = "stripe_not_configured";
    throw e;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-01-28.clover",
  });
}
