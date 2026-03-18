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

  const workspaceId = user.user_metadata?.workspace_id
  const appUserId = user.user_metadata?.app_user_id

  const supabase = await createServerSupabaseClient()

  // Fetch role and workspace settings in parallel — both only depend on user
  const [dbUserRes, wsDataRes] = await Promise.all([
    appUserId
      ? supabase.from('users').select('role').eq('id', appUserId).single()
      : Promise.resolve({ data: null }),
    workspaceId
      ? supabase
          .from("workspaces")
          .select("use_departments, use_career_framework, onboarding_completed")
          .eq("id", workspaceId)
          .single()
      : Promise.resolve({ data: null }),
  ])

  // Use DB role if available (more authoritative than user_metadata)
  const role = dbUserRes.data?.role || user.user_metadata?.role || 'user'
  const wsData = wsDataRes.data

  return {
    userId: user.id,
    email: user.email,
    workspaceId,
    workspaceName: user.user_metadata?.workspace_name,
    name: user.user_metadata?.name,
    role,
    slackUserId: user.user_metadata?.slack_user_id,
    appUserId,
    useDepartments: wsData?.use_departments ?? true,
    useCareerFramework: wsData?.use_career_framework ?? true,
    onboardingCompleted: wsData?.onboarding_completed ?? true,
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
