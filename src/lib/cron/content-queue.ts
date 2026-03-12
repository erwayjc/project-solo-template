import { createAdminClient } from '@/lib/supabase/admin'

export async function processContentQueue(): Promise<{ published: number; failed: number }> {
  const token = process.env.BUFFER_ACCESS_TOKEN
  if (!token) {
    return { published: 0, failed: 0 }
  }

  const admin = createAdminClient()
  let published = 0
  let failed = 0

  const { data: items, error: fetchError } = await admin
    .from('content_queue')
    .select('*')
    .eq('status', 'approved')
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)

  if (fetchError) {
    throw new Error(`Failed to fetch content: ${fetchError.message}`)
  }

  if (!items || items.length === 0) {
    return { published: 0, failed: 0 }
  }

  for (const item of items) {
    try {
      const body = new URLSearchParams({ text: item.content })
      if (item.scheduled_for) {
        body.set('scheduled_at', item.scheduled_for)
      }
      const profileIds = process.env.BUFFER_PROFILE_IDS
      if (profileIds) {
        for (const pid of profileIds.split(',')) {
          body.append('profile_ids[]', pid.trim())
        }
      }

      const res = await fetch(
        'https://api.bufferapp.com/1/updates/create.json',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${token}`,
          },
          body,
        }
      )

      const result = await res.json()

      if (res.ok) {
        await admin
          .from('content_queue')
          .update({
            status: 'published',
            buffer_id: result.updates?.[0]?.id || null,
          })
          .eq('id', item.id)
        published++
      } else {
        await admin
          .from('content_queue')
          .update({ status: 'failed' })
          .eq('id', item.id)
        failed++
      }
    } catch (err) {
      console.error(`Failed to publish content ${item.id}:`, err)
      await admin
        .from('content_queue')
        .update({ status: 'failed' })
        .eq('id', item.id)
      failed++
    }
  }

  return { published, failed }
}
