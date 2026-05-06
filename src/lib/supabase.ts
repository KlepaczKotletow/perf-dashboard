import { createBrowserClient } from '@supabase/ssr'

// Browser-callable code can't import the server `env` singleton (it validates
// server-only secrets like STRIPE_SECRET_KEY at module load and would crash in
// the client bundle). Validate the two NEXT_PUBLIC vars we need here, once at
// module load, so a misconfigured deploy fails fast at the first import
// instead of producing a confusing runtime null-reference error mid-request.
function requireBrowserEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[supabase] Missing required environment variable ${name}. ` +
        'Set it in your .env.local (dev) or Vercel project settings (prod).',
    )
  }
  return value
}

const SUPABASE_URL = requireBrowserEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_ANON_KEY = requireBrowserEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
