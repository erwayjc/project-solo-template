// ---------------------------------------------------------------------------
// Tool Registry — imports all domain tools and provides discovery functions
// ---------------------------------------------------------------------------

import type { ToolDefinition } from '../types'

import { tools as siteTools } from './site'
import { tools as courseTools } from './course'
import { tools as emailTools } from './email'
import { tools as leadsTools } from './leads'
import { tools as contentTools } from './content'
import { tools as supportTools } from './support'
import { tools as agentsTools } from './agents'
import { tools as analyticsTools } from './analytics'
import { tools as productsTools } from './products'
import { tools as announcementsTools } from './announcements'
import { tools as mediaTools } from './media'
import { tools as pwaTools } from './pwa'
import { tools as mcpManagementTools } from './mcp-management'
import { tools as testimonialTools } from './testimonials'
import { tools as memoryTools } from './memory'
import { tools as customPagesTools } from './custom-pages'
import { tools as pageTemplateTools } from './page-templates'
import { tools as funnelTools } from './funnels'
import { tools as agentRunsTools } from './agent-runs'
import { tools as goalsTools } from './goals'
import { tools as schedulingTools } from './scheduling'
import { tools as introspectionTools } from './introspection'
import { tools as resendApiTools } from './resend-api'

/**
 * Flat array of every internal tool, ordered by domain.
 */
const allTools: ToolDefinition[] = [
  ...siteTools,
  ...courseTools,
  ...emailTools,
  ...leadsTools,
  ...contentTools,
  ...supportTools,
  ...agentsTools,
  ...analyticsTools,
  ...productsTools,
  ...announcementsTools,
  ...mediaTools,
  ...pwaTools,
  ...mcpManagementTools,
  ...testimonialTools,
  ...memoryTools,
  ...customPagesTools,
  ...pageTemplateTools,
  ...funnelTools,
  ...agentRunsTools,
  ...goalsTools,
  ...schedulingTools,
  ...introspectionTools,
  ...resendApiTools,
]

/**
 * Return all registered internal tools.
 */
export function getAllTools(): ToolDefinition[] {
  return allTools
}

/**
 * Find a single tool by its unique name.
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find((tool) => tool.name === name)
}
