import type { Metadata } from 'next'
import { getContentCalendar } from '@/actions/content'
import { getBroadcasts } from '@/actions/email'
import { ContentCalendar } from '@/components/admin/content-calendar'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export const metadata: Metadata = {
  title: 'Content Calendar - Admin',
}

export default async function CalendarPage() {
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const [calendarData, broadcasts] = await Promise.all([
    getContentCalendar(monthStart, monthEnd),
    getBroadcasts(),
  ])

  // Filter broadcasts for the current month using proper date boundaries
  const monthEndFull = format(endOfMonth(now), "yyyy-MM-dd'T'23:59:59")
  const monthBroadcasts = broadcasts.filter((b) => {
    const date = b.scheduled_for || b.sent_at || b.created_at
    if (!date) return false
    return date >= monthStart && date <= monthEndFull
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage your content schedule across all channels.
        </p>
      </div>
      <ContentCalendar
        initialBlogPosts={calendarData.blogPosts}
        initialSocialContent={calendarData.socialContent}
        initialBroadcasts={monthBroadcasts}
        initialMonth={now.getMonth() + 1}
        initialYear={now.getFullYear()}
      />
    </div>
  )
}
