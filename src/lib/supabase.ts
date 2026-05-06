import { createBrowserClient } from '@supabase/ssr'

// Browser-callable code can't import the server `env` singleton (it validates
// server-only secrets like STRIPE_SECRET_KEY at module load and would crash in
// the client bundle). Validate the two NEXT_PUBLIC vars we need here, once at
// module load, so a misconfigured deploy fails fast at the first import
// instead of producing a confusing runtime null-reference error mid-request.
//
// Literal `process.env.NEXT_PUBLIC_*` reads are required: Next.js inlines
// these at build time only when the property name is a string literal.
// Indirect access (process.env[name]) leaves the value undefined in the
// client bundle even when it's set in the build environment — this caused a
// production dashboard outage when a previous version of this file used a
// `requireBrowserEnv(name)` helper. The IIFE below preserves narrowing so
// the destructured consts are typed `string`, not `string | undefined`.
const [SUPABASE_URL, SUPABASE_ANON_KEY] = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url) {
    throw new Error(
      '[supabase] Missing required environment variable NEXT_PUBLIC_SUPABASE_URL. ' +
        'Set it in your .env.local (dev) or Vercel project settings (prod).',
    )
  }
  if (!key) {
    throw new Error(
      '[supabase] Missing required environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Set it in your .env.local (dev) or Vercel project settings (prod).',
    )
  }
  return [url, key] as const
})()

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
