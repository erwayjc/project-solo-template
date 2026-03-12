// ---------------------------------------------------------------------------
// Skill Prompt Budgeting — prevents context overflow from too many skills
// ---------------------------------------------------------------------------

import type { SkillDefinition } from './types'

/** Maximum character budget for skill prompt content */
export const SKILL_PROMPT_BUDGET = 15_000

/** Approximate characters per catalog entry (name + description) */
const CATALOG_ENTRY_OVERHEAD = 200

export interface BudgetResult {
  /** Skills that fit within the budget */
  included: SkillDefinition[]
  /** Skills that were trimmed due to budget constraints */
  trimmed: SkillDefinition[]
  /** Total characters used */
  totalChars: number
}

/**
 * Apply prompt budgeting to a set of skills, prioritizing by relevance.
 *
 * Priority tiers:
 * 1. Explicitly requested (user invoked via /slug or name)
 * 2. Topic match (keyword overlap with user message)
 * 3. Remaining (alphabetical)
 *
 * Within tiers, sorted by body size ascending to maximize count.
 */
export function budgetSkills(
  skills: SkillDefinition[],
  userMessage: string,
  activeSkillSlugs: string[]
): BudgetResult {
  if (skills.length === 0) {
    return { included: [], trimmed: [], totalChars: 0 }
  }

  // Tokenize user message for topic matching
  const messageTokens = new Set(
    userMessage
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
  )

  // Score and tier each skill
  const scored = skills.map((skill) => {
    const isExplicit = activeSkillSlugs.includes(skill.slug)
    const topicScore = isExplicit
      ? Infinity
      : computeTopicScore(skill, messageTokens)

    return { skill, isExplicit, topicScore }
  })

  // Sort: explicit first, then by topic score descending, then by body size ascending
  scored.sort((a, b) => {
    if (a.isExplicit !== b.isExplicit) return a.isExplicit ? -1 : 1
    if (a.topicScore !== b.topicScore) return b.topicScore - a.topicScore
    return a.skill.bodySize - b.skill.bodySize
  })

  const included: SkillDefinition[] = []
  const trimmed: SkillDefinition[] = []
  let totalChars = 0

  for (const { skill, isExplicit } of scored) {
    // Active skills contribute their full body; others just the catalog entry
    const cost = isExplicit
      ? skill.bodySize + CATALOG_ENTRY_OVERHEAD
      : CATALOG_ENTRY_OVERHEAD

    if (totalChars + cost <= SKILL_PROMPT_BUDGET) {
      included.push(skill)
      totalChars += cost
    } else {
      trimmed.push(skill)
    }
  }

  return { included, trimmed, totalChars }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple keyword overlap scoring between a skill and the user message.
 */
function computeTopicScore(
  skill: SkillDefinition,
  messageTokens: Set<string>
): number {
  const skillTokens = [
    ...skill.frontmatter.description.toLowerCase().split(/\s+/),
    ...skill.frontmatter.tags.map((t) => t.toLowerCase()),
    ...skill.frontmatter.name.toLowerCase().split(/\s+/),
  ].filter((t) => t.length > 2)

  let score = 0
  for (const token of skillTokens) {
    if (messageTokens.has(token)) score++
  }
  return score
}
