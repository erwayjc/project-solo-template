import type { Database } from '@/lib/supabase/types'

// Convenience type alias for all public tables
type Tables = Database['public']['Tables']

// ── Row types (what you get back from a SELECT) ──
export type Profile = Tables['profiles']['Row']
export type SiteConfig = Tables['site_config']['Row']
export type Product = Tables['products']['Row']
export type Purchase = Tables['purchases']['Row']
export type Module = Tables['modules']['Row']
export type Lesson = Tables['lessons']['Row']
export type LessonProgress = Tables['lesson_progress']['Row']
export type Lead = Tables['leads']['Row']
export type Page = Tables['pages']['Row']
export type EmailSequence = Tables['email_sequences']['Row']
export type EmailSequenceStep = Tables['email_sequence_steps']['Row']
export type EmailSend = Tables['email_sends']['Row']
export type Broadcast = Tables['broadcasts']['Row']
export type SequenceEnrollment = Tables['sequence_enrollments']['Row']
export type BlogPost = Tables['blog_posts']['Row']
export type ContentQueue = Tables['content_queue']['Row']
export type SupportTicket = Tables['support_tickets']['Row']
export type Agent = Tables['agents']['Row']
export type AgentConversation = Tables['agent_conversations']['Row']
export type McpConnection = Tables['mcp_connections']['Row']
export type Announcement = Tables['announcements']['Row']
export type Media = Tables['media']['Row']

// ── Insert types (what you pass to an INSERT) ──
export type ProfileInsert = Tables['profiles']['Insert']
export type ProductInsert = Tables['products']['Insert']
export type PurchaseInsert = Tables['purchases']['Insert']
export type ModuleInsert = Tables['modules']['Insert']
export type LessonInsert = Tables['lessons']['Insert']
export type LeadInsert = Tables['leads']['Insert']
export type PageInsert = Tables['pages']['Insert']
export type BlogPostInsert = Tables['blog_posts']['Insert']
export type ContentQueueInsert = Tables['content_queue']['Insert']
export type SupportTicketInsert = Tables['support_tickets']['Insert']
export type AgentInsert = Tables['agents']['Insert']

// ── Update types (what you pass to an UPDATE) ──
export type ProfileUpdate = Tables['profiles']['Update']
export type SiteConfigUpdate = Tables['site_config']['Update']
export type ProductUpdate = Tables['products']['Update']
export type ModuleUpdate = Tables['modules']['Update']
export type LessonUpdate = Tables['lessons']['Update']
export type BlogPostUpdate = Tables['blog_posts']['Update']
export type AgentUpdate = Tables['agents']['Update']

// Re-export the Database type itself
export type { Database }
