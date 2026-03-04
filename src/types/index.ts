// ── App-level types (not database rows) ──

/**
 * A section within a JSON-driven landing page.
 * Stored in the `pages.sections` JSONB column.
 */
export interface PageSection {
  type: string
  headline?: string
  body?: string
  cta?: {
    text: string
    url: string
  }
  image?: string
  order: number
}

/**
 * Brand color palette stored in `site_config.brand_colors`.
 * Injected as CSS custom properties by the BrandThemeProvider.
 */
export interface BrandColors {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
}

/**
 * A single message in an agent conversation.
 * Stored in the `agent_conversations.messages` JSONB array.
 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  tool_calls?: ToolCallResult[]
}

/**
 * Result of a tool call executed by an agent.
 */
export interface ToolCallResult {
  name: string
  input: Record<string, unknown>
  output: unknown
  status: 'pending' | 'completed' | 'error'
}

/**
 * Represents a step in the setup wizard flow.
 */
export interface SetupWizardStep {
  id: string
  title: string
  status: 'pending' | 'complete' | 'error'
  data?: Record<string, unknown>
}

/**
 * Result of a health check for a connected service.
 */
export interface HealthCheckResult {
  service: string
  status: 'connected' | 'error' | 'pending' | 'not_configured'
  message?: string
}

/**
 * Aggregated dashboard metrics shown on the admin overview page.
 */
export interface DashboardMetrics {
  revenue: {
    total: number
    thisMonth: number
    lastMonth: number
    currency: string
  }
  leads: {
    total: number
    thisWeek: number
    conversionRate: number
  }
  customers: {
    total: number
    active: number
  }
  emailStats: {
    totalSent: number
    openRate: number
    clickRate: number
  }
  contentStats: {
    blogPosts: number
    socialQueued: number
    socialPublished: number
  }
  supportStats: {
    open: number
    aiHandled: number
    avgResponseTime: number
  }
}

/**
 * Support ticket message stored in the `support_tickets.messages` JSONB array.
 */
export interface TicketMessage {
  role: 'customer' | 'admin' | 'ai'
  content: string
  timestamp: string
}

/**
 * SEO metadata stored on pages and blog posts.
 */
export interface SeoMetadata {
  title?: string
  description?: string
  og_image?: string
  keywords?: string
}

/**
 * Non-derivable onboarding state stored in `site_config.onboarding_checklist` JSONB.
 */
export interface OnboardingChecklist {
  explored_admin?: boolean
  guide_dismissed?: boolean
  first_post_celebrated?: boolean
  first_checklist_celebrated?: boolean
}

/**
 * Full onboarding progress (derived + stored).
 */
export interface OnboardingProgress {
  quickWins: {
    explored_admin: boolean
    created_first_post: boolean
    edited_homepage: boolean
  }
  powerUps: {
    payments_connected: boolean
    email_connected: boolean
    ai_connected: boolean
    social_connected: boolean
  }
  personalization: {
    brand_customized: boolean
    context_configured: boolean
  }
  guide_dismissed: boolean
  celebration_flags: {
    first_post_celebrated: boolean
    first_checklist_celebrated: boolean
  }
}

/**
 * Social links stored in `site_config.social_links`.
 */
export interface SocialLinks {
  twitter?: string
  linkedin?: string
  instagram?: string
  facebook?: string
  tiktok?: string
  youtube?: string
  github?: string
  website?: string
}

// Re-export all database types for convenience
export type {
  Profile,
  SiteConfig,
  Product,
  Purchase,
  Module,
  Lesson,
  LessonProgress,
  Lead,
  Page,
  EmailSequence,
  EmailSequenceStep,
  EmailSend,
  Broadcast,
  SequenceEnrollment,
  BlogPost,
  ContentQueue,
  SupportTicket,
  Agent,
  AgentConversation,
  McpConnection,
  Announcement,
  Media,
  Database,
} from './database'
