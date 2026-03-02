'use client'

import { useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * Returns a memoized Supabase browser client.
 * The client is created once and reused across re-renders.
 */
export function useSupabase(): SupabaseClient<Database> {
  const client = useMemo(() => createClient(), [])
  return client
}
