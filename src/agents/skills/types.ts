// ---------------------------------------------------------------------------
// Skill System Type Definitions
// ---------------------------------------------------------------------------

/**
 * Parsed YAML frontmatter from a SKILL.md file.
 */
export interface SkillFrontmatter {
  /** Display name, e.g. "SEO Audit" */
  name: string

  /** Trigger description — used for relevance matching and agent context */
  description: string

  /** Agent slugs that can use this skill, or ['*'] for all agents */
  agents: string[]

  /** Categorization tags for budgeting and filtering */
  tags: string[]

  /** Who can activate the skill */
  invocation: 'user' | 'model' | 'both'
}

/**
 * A fully loaded skill definition from the filesystem.
 */
export interface SkillDefinition {
  /** Filesystem folder name, e.g. "seo-audit" */
  slug: string

  /** Parsed YAML frontmatter */
  frontmatter: SkillFrontmatter

  /** Markdown body content (everything after frontmatter) */
  body: string

  /** Character count of the body */
  bodySize: number

  /** Available reference file names (without loading content) */
  referenceFiles: string[]

  /** Absolute path to the skill folder */
  path: string
}

/**
 * Runtime context for skills within a single conversation turn.
 */
export interface SkillContext {
  /** Skills whose descriptions are in the system prompt catalog */
  availableSkills: SkillDefinition[]

  /** Skills whose full body has been injected into context */
  activeSkills: SkillDefinition[]

  /** Reference files loaded during this turn (keyed by "slug/filename") */
  loadedReferences: Map<string, string>
}
