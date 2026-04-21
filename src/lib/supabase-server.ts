import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

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

  const slackUserId = user.user_metadata?.slack_user_id
  if (!slackUserId) return null

  const supabase = await createServerSupabaseClient()

  // SECURITY: Look up the user by slack_user_id (from JWT, not editable by user).
  // Never trust app_user_id or workspace_id from user_metadata — those can be
  // modified by calling supabase.auth.updateUser().
  // Also filter out deactivated users — removed from Slack workspace = no dashboard access.
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
    slackUserId,
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
