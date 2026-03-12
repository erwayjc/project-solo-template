// ---------------------------------------------------------------------------
// Skill Loader — discovers and parses SKILL.md files from the filesystem
// ---------------------------------------------------------------------------

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { SkillDefinition, SkillFrontmatter } from './types'

/** Max SKILL.md file size (256KB) */
const MAX_SKILL_FILE_SIZE = 256 * 1024

/** Max total skills loaded */
const MAX_SKILLS = 50

/** Cached skill definitions (loaded once per process) */
let cachedSkills: SkillDefinition[] | null = null

/**
 * Resolve the skills directory. Defaults to `skills/` at the project root.
 */
function getSkillsDir(): string {
  return path.resolve(process.cwd(), 'skills')
}

/**
 * Load all skills from the `skills/` directory.
 * Results are cached module-level — subsequent calls return the cached array.
 * Call `clearSkillsCache()` to force a reload.
 */
export function loadSkills(): SkillDefinition[] {
  if (cachedSkills) return cachedSkills

  const skillsDir = getSkillsDir()

  if (!fs.existsSync(skillsDir)) {
    cachedSkills = []
    return cachedSkills
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
  const skills: SkillDefinition[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (skills.length >= MAX_SKILLS) {
      console.warn(`[Skills] Maximum skill count (${MAX_SKILLS}) reached, skipping remaining`)
      break
    }

    const skillDir = path.join(skillsDir, entry.name)
    const skillFile = path.join(skillDir, 'SKILL.md')

    if (!fs.existsSync(skillFile)) continue

    const stat = fs.statSync(skillFile)
    if (stat.size > MAX_SKILL_FILE_SIZE) {
      console.warn(`[Skills] Skipping "${entry.name}": SKILL.md exceeds ${MAX_SKILL_FILE_SIZE / 1024}KB`)
      continue
    }

    try {
      const raw = fs.readFileSync(skillFile, 'utf-8')
      const { data, content } = matter(raw)

      const frontmatter = parseFrontmatter(data, entry.name)
      if (!frontmatter) continue

      // Enumerate reference files (names only)
      const refsDir = path.join(skillDir, 'references')
      let referenceFiles: string[] = []
      if (fs.existsSync(refsDir)) {
        referenceFiles = fs
          .readdirSync(refsDir)
          .filter((f) => f.endsWith('.md'))
          .map((f) => f.replace(/\.md$/, ''))
      }

      skills.push({
        slug: entry.name,
        frontmatter,
        body: content.trim(),
        bodySize: content.trim().length,
        referenceFiles,
        path: skillDir,
      })
    } catch (err) {
      console.warn(`[Skills] Failed to parse "${entry.name}":`, err)
    }
  }

  cachedSkills = skills
  return cachedSkills
}

/**
 * Get skills available to a specific agent (filtered by slug).
 */
export function getSkillsForAgent(agentSlug: string): SkillDefinition[] {
  const all = loadSkills()
  return all.filter(
    (s) =>
      s.frontmatter.agents.includes('*') ||
      s.frontmatter.agents.includes(agentSlug)
  )
}

/**
 * Clear the cached skills to force a reload on next access.
 */
export function clearSkillsCache(): void {
  cachedSkills = null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFrontmatter(
  data: Record<string, unknown>,
  slug: string
): SkillFrontmatter | null {
  if (!data.name || typeof data.name !== 'string') {
    console.warn(`[Skills] "${slug}": missing or invalid "name" in frontmatter`)
    return null
  }

  if (!data.description || typeof data.description !== 'string') {
    console.warn(`[Skills] "${slug}": missing or invalid "description" in frontmatter`)
    return null
  }

  const agents = Array.isArray(data.agents)
    ? (data.agents as string[])
    : ['*']

  const tags = Array.isArray(data.tags)
    ? (data.tags as string[])
    : []

  const invocation =
    data.invocation === 'user' || data.invocation === 'model'
      ? data.invocation
      : 'both'

  return {
    name: data.name,
    description: data.description,
    agents,
    tags,
    invocation,
  }
}
