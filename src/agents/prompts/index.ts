// ---------------------------------------------------------------------------
// Prompt Registry — maps agent slugs to their prompt builder functions
// ---------------------------------------------------------------------------
//
// Agents with prompt files here get their rich, code-maintained system prompts
// at runtime. Agents without an entry fall back to the DB system_prompt field.
// ---------------------------------------------------------------------------

import { buildSystemPrompt as devAgent } from './dev-agent'
import { buildSystemPrompt as contentDirector } from './content-director'
import { buildSystemPrompt as emailCopywriter } from './email-copywriter'
import { buildSystemPrompt as salesStrategist } from './sales-strategist'
import { buildSystemPrompt as customerSuccess } from './customer-success'
import { buildSystemPrompt as supportAgent } from './support-agent'

type PromptBuilder = (masterContext: string) => string

const promptRegistry: Record<string, PromptBuilder> = {
  'dev-agent': devAgent,
  'content-director': contentDirector,
  'email-copywriter': emailCopywriter,
  'sales-strategist': salesStrategist,
  'customer-success': customerSuccess,
  'support-agent': supportAgent,
}

/**
 * Get the prompt builder for an agent by slug.
 * Returns undefined if no prompt file exists for the slug (custom/user agents).
 */
export function getPromptBuilder(slug: string): PromptBuilder | undefined {
  return promptRegistry[slug]
}
