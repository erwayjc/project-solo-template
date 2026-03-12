// ---------------------------------------------------------------------------
// Progressive Context Loading — load_skill_reference tool
// ---------------------------------------------------------------------------

import fs from 'fs'
import path from 'path'
import type { ToolDefinition, ToolResult } from '@/mcp/types'
import type { SkillContext } from './types'

/** Max reference file size (50KB) */
const MAX_REFERENCE_SIZE = 50 * 1024

/**
 * Create the `load_skill_reference` tool for on-demand reference loading.
 * The tool is registered dynamically for agents that have skills assigned.
 */
export function createLoadSkillReferenceTool(
  skillContext: SkillContext
): ToolDefinition {
  return {
    name: 'load_skill_reference',
    description:
      'Load a detailed reference document for a skill. Use this to access deeper guidance when the skill summary is not sufficient. Available references are listed in the skill catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        skill_slug: {
          type: 'string',
          description: 'The slug of the skill (e.g., "seo-audit")',
        },
        reference_name: {
          type: 'string',
          description: 'The reference file name without extension (e.g., "advanced-seo")',
        },
      },
      required: ['skill_slug', 'reference_name'],
    },
    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const skillSlug = params.skill_slug as string
      const referenceName = params.reference_name as string

      // Check cache first
      const cacheKey = `${skillSlug}/${referenceName}`
      const cached = skillContext.loadedReferences.get(cacheKey)
      if (cached) {
        return { success: true, data: cached }
      }

      // Validate skill exists and is available
      const skill = skillContext.availableSkills.find(
        (s) => s.slug === skillSlug
      )
      if (!skill) {
        return {
          success: false,
          error: `Skill "${skillSlug}" is not available. Available skills: ${skillContext.availableSkills.map((s) => s.slug).join(', ')}`,
        }
      }

      // Validate reference exists
      if (!skill.referenceFiles.includes(referenceName)) {
        return {
          success: false,
          error: `Reference "${referenceName}" not found for skill "${skillSlug}". Available references: ${skill.referenceFiles.join(', ') || 'none'}`,
        }
      }

      // Read the file
      const refPath = path.join(skill.path, 'references', `${referenceName}.md`)

      try {
        const stat = fs.statSync(refPath)
        if (stat.size > MAX_REFERENCE_SIZE) {
          return {
            success: false,
            error: `Reference file exceeds maximum size of ${MAX_REFERENCE_SIZE / 1024}KB`,
          }
        }

        const content = fs.readFileSync(refPath, 'utf-8')

        // Cache for this conversation turn
        skillContext.loadedReferences.set(cacheKey, content)

        return { success: true, data: content }
      } catch (err) {
        return {
          success: false,
          error: `Failed to load reference: ${err instanceof Error ? err.message : 'unknown error'}`,
        }
      }
    },
  }
}
