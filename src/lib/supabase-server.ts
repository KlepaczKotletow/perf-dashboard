import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { env } from "@/lib/env"

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export async function getUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const getUserWorkspace = cache(async () => {
  const user = await getUser()
  if (!user) return null

  const supabase = await createServerSupabaseClient()

  // SECURITY: Resolve slack_user_id via the get_my_slack_user_id() RPC, which
  // reads raw_app_meta_data (service-role-writable only). Reading
  // user_metadata.slack_user_id directly is a cross-tenant data leak — any
  // authenticated user can call supabase.auth.updateUser({ data: ... }) to
  // overwrite their own user_metadata and pivot to another workspace's RLS
  // scope. raw_app_meta_data can only be set by the auth admin SDK.
  const { data: slackUserId } = await supabase.rpc('get_my_slack_user_id')
  if (!slackUserId) return null

  // Look up the public.users row by the safe slack_user_id. Filter out
  // deactivated users (removed from Slack workspace = no dashboard access).
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, workspace_id, role, slack_name, department, employee_status')
    .eq('slack_user_id', slackUserId)
    .neq('employee_status', 'deactivated')
    .single()

  if (!dbUser) return null

  // Now fetch workspace settings and check for direct reports in parallel
  const [{ data: wsData }, { count: directReportCount }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("team_name, onboarding_completed, rating_scale, logo_url, requires_reinstall")
      .eq("id", dbUser.workspace_id)
      .single(),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("manager_id", dbUser.id)
      .eq("workspace_id", dbUser.workspace_id),
  ])

  return {
    userId: user.id,
    email: user.email,
    workspaceId: dbUser.workspace_id,
    workspaceName: wsData?.team_name || user.user_metadata?.workspace_name,
    name: dbUser.slack_name || user.user_metadata?.name,
    role: dbUser.role || 'user',
    slackUserId: slackUserId as string,
    appUserId: dbUser.id,
    hasDirectReports: (directReportCount ?? 0) > 0,
    onboardingCompleted: wsData?.onboarding_completed ?? true,
    ratingScale: wsData?.rating_scale as { min: number; max: number; labels: Record<string, string> } | null,
    logoUrl: (wsData as any)?.logo_url as string | null,
    requiresReinstall: ((wsData as any)?.requires_reinstall ?? false) as boolean,
  }
})

/**
 * Get the workspace_id for the current user.
 * Returns null if not authenticated.
 */
export async function getWorkspaceId(): Promise<string | null> {
  const workspace = await getUserWorkspace()
  return workspace?.workspaceId || null
}

/**
 * Service-role client. Bypasses RLS — call sites are responsible for
 * scoping queries by tenant identifier (workspace_id / stripe_subscription_id).
 * Never expose to the browser; only use in route handlers and server actions.
 */
export function createServiceRoleClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service-role operations");
  }
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
