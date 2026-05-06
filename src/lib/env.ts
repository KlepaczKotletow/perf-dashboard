/**
 * Typed, validated access to process.env.
 *
 * Before: every call site scattered `process.env.X!` with non-null
 * assertions, crashing at the first request that needed the missing var.
 * Now required env is validated once at module load and surfaces a
 * clear error up front instead of a random `Cannot read properties of
 * undefined` halfway through a request.
 *
 * Zero-dep by design: the app doesn't currently use zod and adding a
 * dependency for a dozen string reads isn't worth the package churn.
 * Switch to zod if we pick it up for other reasons.
 */

type EnvShape = {
  // Public (browser-visible) ---------------------------------------------
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_SLACK_CLIENT_ID: string | undefined;
  NEXT_PUBLIC_SITE_URL: string | undefined;

  // Server-only ----------------------------------------------------------
  SUPABASE_SERVICE_ROLE_KEY: string | undefined;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string | undefined;
  SEAT_SYNC_SECRET: string;
  DASHBOARD_URL: string | undefined;
  CRON_SECRET: string | undefined;
};

function required(name: keyof EnvShape): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `[env] Missing required environment variable ${String(name)}. ` +
        `Add it to your .env.local (dev) or Vercel project settings (prod) and restart.`,
    );
  }
  return value;
}

function optional(name: keyof EnvShape): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Lazily-validated env singleton. Required vars throw on first access if
 * missing; optional vars return undefined. Edge-runtime code that reads
 * `env` at module scope will fail loudly at cold-start instead of at
 * first user request.
 */
export const env: EnvShape = {
  NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  NEXT_PUBLIC_SLACK_CLIENT_ID: optional("NEXT_PUBLIC_SLACK_CLIENT_ID"),
  NEXT_PUBLIC_SITE_URL: optional("NEXT_PUBLIC_SITE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: optional("SUPABASE_SERVICE_ROLE_KEY"),
  STRIPE_SECRET_KEY: required("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET"),
  SEAT_SYNC_SECRET: required("SEAT_SYNC_SECRET"),
  DASHBOARD_URL: optional("DASHBOARD_URL"),
  CRON_SECRET: optional("CRON_SECRET"),
};
