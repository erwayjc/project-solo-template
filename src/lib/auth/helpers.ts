import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { User } from '@supabase/supabase-js'

/**
 * Verify the current request is authenticated.
 * Creates a fresh Supabase client, retrieves the user, and throws
 * if no valid session exists.
 *
 * @returns The Supabase client and authenticated user.
 */
export async function requireAuth(): Promise<{
  supabase: SupabaseClient<Database>
  user: User
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  return { supabase, user }
}

/**
 * Verify the current request is from an admin user.
 * Calls requireAuth, then checks the user's profile role.
 *
 * @returns The Supabase client, authenticated user, and profile with role.
 */
export async function requireAdmin(): Promise<{
  supabase: SupabaseClient<Database>
  user: User
  profile: { role: string }
}> {
  const { supabase, user } = await requireAuth()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  return { supabase, user, profile }
}
