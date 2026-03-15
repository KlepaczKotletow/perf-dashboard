import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

export async function getUserWorkspace() {
  const user = await getUser()
  if (!user) return null
  
  const workspaceId = user.user_metadata?.workspace_id
  const appUserId = user.user_metadata?.app_user_id
  
  // If we have an app_user_id, fetch the actual role from the users table
  // (more secure than relying on user_metadata which could be stale)
  let role = user.user_metadata?.role || 'user'
  const supabase = await createServerSupabaseClient()
  if (appUserId) {
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', appUserId)
      .single()
    if (dbUser?.role) {
      role = dbUser.role
    }
  }

  const { data: wsData } = await supabase
    .from("workspaces")
    .select("use_departments, use_career_framework, onboarding_completed")
    .eq("id", workspaceId)
    .single();

  const useDepartments = wsData?.use_departments ?? true;
  const useCareerFramework = wsData?.use_career_framework ?? true;
  const onboardingCompleted = wsData?.onboarding_completed ?? true;

  return {
    userId: user.id,
    email: user.email,
    workspaceId,
    workspaceName: user.user_metadata?.workspace_name,
    name: user.user_metadata?.name,
    role,
    slackUserId: user.user_metadata?.slack_user_id,
    appUserId,
    useDepartments,
    useCareerFramework,
    onboardingCompleted,
  }
}

/**
 * Get the workspace_id for the current user. 
 * Returns null if not authenticated.
 */
export async function getWorkspaceId(): Promise<string | null> {
  const workspace = await getUserWorkspace()
  return workspace?.workspaceId || null
}
