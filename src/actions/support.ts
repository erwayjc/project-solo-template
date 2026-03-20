'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireAdmin } from '@/lib/auth/helpers'
import type { SupportTicket } from '@/types/database'
import type { Json } from '@/lib/supabase/types'

export async function createTicket(
  subject: string,
  message: string
): Promise<SupportTicket> {
  const { supabase, user } = await requireAuth()

  const initialMessages = [
    {
      role: 'customer',
      content: message,
      timestamp: new Date().toISOString(),
    },
  ]

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: user.id,
      subject,
      messages: initialMessages,
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create ticket: ${error.message}`)
  }

  return data as SupportTicket
}

export async function getTickets(filters?: {
  status?: string
  priority?: string
  limit?: number
  offset?: number
}): Promise<{ tickets: SupportTicket[]; count: number }> {
  const { supabase } = await requireAdmin()

  let query = supabase
    .from('support_tickets')
    .select('*', { count: 'exact' })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }

  query = query.order('created_at', { ascending: false })

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 50) - 1
    )
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch tickets: ${error.message}`)
  }

  return { tickets: data as SupportTicket[], count: count ?? 0 }
}

export async function respondToTicket(
  id: string,
  message: string
): Promise<SupportTicket> {
  // Uses requireAuth + manual profile check because the role determines message role
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  // Fetch the existing ticket
  const { data: ticket, error: fetchError } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !ticket) {
    throw new Error('Ticket not found')
  }

  // Determine role for the message
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const messageRole = profile?.role === 'admin' ? 'admin' : 'customer'

  // Append the new message
  const existingMessages = (ticket.messages as Record<string, unknown>[]) || []
  const updatedMessages = [
    ...existingMessages,
    {
      role: messageRole,
      content: message,
      timestamp: new Date().toISOString(),
    },
  ]

  const { data, error } = await supabase
    .from('support_tickets')
    .update({ messages: updatedMessages as unknown as Json })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to respond to ticket: ${error.message}`)
  }

  return data as SupportTicket
}

export async function resolveTicket(id: string): Promise<SupportTicket> {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('support_tickets')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to resolve ticket: ${error.message}`)
  }

  return data as SupportTicket
}

/**
 * Get tickets for the currently logged-in portal user.
 */
export async function getMyTickets(): Promise<SupportTicket[]> {
  const { supabase, user } = await requireAuth()

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch your tickets: ${error.message}`)
  }

  return data as SupportTicket[]
}
