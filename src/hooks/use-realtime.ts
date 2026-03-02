'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSupabase } from './use-supabase'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface UseRealtimeOptions<T> {
  table: string
  filter?: string
  filterColumn?: string
  filterValue?: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  initialData?: T[]
}

interface UseRealtimeReturn<T> {
  data: T[]
  isConnected: boolean
  error: string | null
}

/**
 * Generic Supabase Realtime subscription hook.
 * Subscribes to Postgres changes on a table and keeps data in sync.
 * Cleans up the subscription automatically on unmount.
 */
export function useRealtime<T extends Record<string, unknown>>({
  table,
  filter,
  filterColumn,
  filterValue,
  event = '*',
  initialData = [],
}: UseRealtimeOptions<T>): UseRealtimeReturn<T> {
  const supabase = useSupabase()
  const [data, setData] = useState<T[]>(initialData)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<T>) => {
      const { eventType } = payload

      if (eventType === 'INSERT') {
        const newRecord = payload.new as T
        setData((prev) => [...prev, newRecord])
      } else if (eventType === 'UPDATE') {
        const updated = payload.new as T
        setData((prev) =>
          prev.map((item) =>
            (item as Record<string, unknown>).id ===
            (updated as Record<string, unknown>).id
              ? updated
              : item
          )
        )
      } else if (eventType === 'DELETE') {
        const deleted = payload.old as Partial<T>
        setData((prev) =>
          prev.filter(
            (item) =>
              (item as Record<string, unknown>).id !==
              (deleted as Record<string, unknown>).id
          )
        )
      }
    },
    []
  )

  useEffect(() => {
    // Build the channel filter
    const channelName = `realtime:${table}:${filterColumn || 'all'}:${filterValue || 'all'}`

    // Build subscription config
    const subscriptionFilter: Record<string, unknown> = {
      event,
      schema: 'public',
      table,
    }

    if (filter) {
      subscriptionFilter.filter = filter
    } else if (filterColumn && filterValue) {
      subscriptionFilter.filter = `${filterColumn}=eq.${filterValue}`
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        subscriptionFilter as never,
        handleChange as never
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          setError(null)
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false)
          setError('Realtime connection error')
        } else if (status === 'CLOSED') {
          setIsConnected(false)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, table, filter, filterColumn, filterValue, event, handleChange])

  return { data, isConnected, error }
}
