'use client'

import { useState, useMemo, useCallback } from 'react'
import { CalendarView } from '@/components/data/calendar-view'
import { ContentApprovalModal } from '@/components/admin/content-approval-modal'
import { useRealtime } from '@/hooks/use-realtime'
import { getContentCalendar } from '@/actions/content'
import { getBroadcasts } from '@/actions/email'
import { cn } from '@/lib/utils/cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import type { BlogPost, ContentQueue, Broadcast } from '@/types/database'

type CalendarItemType = 'blog' | 'social' | 'broadcast'

interface CalendarContentItem {
  id: string
  type: CalendarItemType
  title: string
  date: string
  status: string
  raw: BlogPost | ContentQueue | Broadcast
}

const STATUS_COLORS: Record<string, string> = {
  'blog-published': '#3b82f6',
  'blog-draft': '#93c5fd',
  'social-approved': '#22c55e',
  'social-draft': '#eab308',
  'social-published': '#16a34a',
  'social-failed': '#ef4444',
  'broadcast-sent': '#a855f7',
  'broadcast-scheduled': '#c084fc',
  'broadcast-draft': '#d8b4fe',
}

interface ContentCalendarProps {
  initialBlogPosts: BlogPost[]
  initialSocialContent: ContentQueue[]
  initialBroadcasts: Broadcast[]
  initialMonth: number
  initialYear: number
}

export function ContentCalendar({
  initialBlogPosts,
  initialSocialContent,
  initialBroadcasts,
  initialMonth,
  initialYear,
}: ContentCalendarProps) {
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [blogPosts, setBlogPosts] = useState(initialBlogPosts)
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts)
  const [selectedItem, setSelectedItem] = useState<CalendarContentItem | null>(
    null
  )
  const [filter, setFilter] = useState<CalendarItemType | 'all'>('all')
  const [loading, setLoading] = useState(false)

  // Realtime updates for content_queue
  const { data: socialContent } = useRealtime<ContentQueue>({
    table: 'content_queue',
    initialData: initialSocialContent,
  })

  // Map all items to calendar format
  const calendarItems = useMemo(() => {
    const items: CalendarContentItem[] = []

    if (filter === 'all' || filter === 'blog') {
      for (const post of blogPosts) {
        const date = post.published_at || post.created_at
        if (!date) continue
        items.push({
          id: `blog-${post.id}`,
          type: 'blog',
          title: post.title,
          date,
          status: post.status,
          raw: post,
        })
      }
    }

    if (filter === 'all' || filter === 'social') {
      for (const item of socialContent) {
        const date = item.scheduled_for || item.created_at
        if (!date) continue
        items.push({
          id: `social-${item.id}`,
          type: 'social',
          title: item.content.slice(0, 50) + (item.content.length > 50 ? '...' : ''),
          date,
          status: item.status,
          raw: item,
        })
      }
    }

    if (filter === 'all' || filter === 'broadcast') {
      for (const bc of broadcasts) {
        const date = bc.scheduled_for || bc.sent_at || bc.created_at
        if (!date) continue
        items.push({
          id: `broadcast-${bc.id}`,
          type: 'broadcast',
          title: bc.subject,
          date,
          status: bc.status,
          raw: bc,
        })
      }
    }

    return items
  }, [blogPosts, socialContent, broadcasts, filter])

  // Convert to CalendarView format
  const viewItems = useMemo(
    () =>
      calendarItems.map((item) => ({
        id: item.id,
        title: item.title,
        date: item.date,
        color: STATUS_COLORS[`${item.type}-${item.status}`] ?? '#6b7280',
      })),
    [calendarItems]
  )

  const handleDateClick = useCallback(
    (dateStr: string) => {
      // Find items for this date
      const dayItems = calendarItems.filter(
        (i) => i.date.slice(0, 10) === dateStr
      )
      if (dayItems.length === 1) {
        setSelectedItem(dayItems[0])
      }
    },
    [calendarItems]
  )

  const navigateMonth = useCallback(
    async (direction: -1 | 1) => {
      setLoading(true)
      let newMonth = month + direction
      let newYear = year
      if (newMonth < 1) {
        newMonth = 12
        newYear--
      } else if (newMonth > 12) {
        newMonth = 1
        newYear++
      }

      const date = new Date(newYear, newMonth - 1, 1)
      const start = format(startOfMonth(date), 'yyyy-MM-dd')
      const end = format(endOfMonth(date), 'yyyy-MM-dd')

      try {
        const [calData, bcData] = await Promise.all([
          getContentCalendar(start, end),
          getBroadcasts(),
        ])
        setBlogPosts(calData.blogPosts)
        setBroadcasts(
          bcData.filter((b) => {
            const d = b.scheduled_for || b.sent_at || b.created_at
            if (!d) return false
            return d >= start && d <= end + 'T23:59:59'
          })
        )
      } catch (err) {
        console.error('Failed to load calendar data:', err)
      }

      setMonth(newMonth)
      setYear(newYear)
      setLoading(false)
    },
    [month, year]
  )

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            disabled={loading}
            className="rounded-md border p-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigateMonth(1)}
            disabled={loading}
            className="rounded-md border p-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {(['all', 'blog', 'social', 'broadcast'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="hidden items-center gap-3 text-xs text-gray-500 md:flex">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            Blog
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Social
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
            Draft
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
            Broadcast
          </span>
        </div>
      </div>

      {/* Calendar */}
      <CalendarView
        items={viewItems}
        month={month}
        year={year}
        onDateClick={handleDateClick}
      />

      {/* Approval Modal */}
      {selectedItem && selectedItem.type === 'social' && (
        <ContentApprovalModal
          item={selectedItem.raw as ContentQueue}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
