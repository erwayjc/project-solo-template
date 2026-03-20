/**
 * GitHub Releases API client for checking upstream template updates.
 * Uses the public API (no auth token needed for public repos).
 */

export interface ReleaseMetadata {
  migration_range?: [number, number]
  seed_updates?: string[]
  breaking?: boolean
  min_version?: string
}

export interface TemplateRelease {
  tag: string
  version: string
  name: string
  body: string
  published_at: string
  html_url: string
  metadata: ReleaseMetadata
}

// Simple in-memory cache to respect GitHub rate limits (60/hr unauthenticated)
let cachedReleases: TemplateRelease[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Parse YAML-like frontmatter from a GitHub release body.
 * Expects format:
 * ---
 * migration_range: [31, 33]
 * seed_updates: [agents, mcp_connections]
 * breaking: false
 * ---
 */
function parseReleaseMetadata(body: string): ReleaseMetadata {
  const metadata: ReleaseMetadata = {}
  const match = body.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return metadata

  const frontmatter = match[1]

  const rangeMatch = frontmatter.match(/migration_range:\s*\[(\d+),\s*(\d+)\]/)
  if (rangeMatch) {
    metadata.migration_range = [parseInt(rangeMatch[1]), parseInt(rangeMatch[2])]
  }

  const seedMatch = frontmatter.match(/seed_updates:\s*\[([^\]]*)\]/)
  if (seedMatch) {
    metadata.seed_updates = seedMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
  }

  const breakingMatch = frontmatter.match(/breaking:\s*(true|false)/)
  if (breakingMatch) {
    metadata.breaking = breakingMatch[1] === 'true'
  }

  const minMatch = frontmatter.match(/min_version:\s*"([^"]+)"/)
  if (minMatch) {
    metadata.min_version = minMatch[1]
  }

  return metadata
}

/**
 * Strip frontmatter from the release body, returning only the human-readable notes.
 */
export function getReleaseNotes(body: string): string {
  return body.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trim()
}

/**
 * Fetch releases from the template GitHub repo.
 */
export async function fetchReleases(repo?: string): Promise<TemplateRelease[]> {
  const now = Date.now()
  if (cachedReleases && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedReleases
  }

  const templateRepo = repo || process.env.NEXT_PUBLIC_TEMPLATE_REPO
  if (!templateRepo) {
    throw new Error('NEXT_PUBLIC_TEMPLATE_REPO is not configured')
  }

  const response = await fetch(
    `https://api.github.com/repos/${templateRepo}/releases`,
    {
      headers: { Accept: 'application/vnd.github.v3+json' },
      next: { revalidate: 300 }, // Next.js cache for 5 minutes
    }
  )

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Template repo "${templateRepo}" not found or has no releases`)
    }
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data = await response.json()

  const releases: TemplateRelease[] = data.map(
    (r: { tag_name: string; name: string; body: string; published_at: string; html_url: string }) => ({
      tag: r.tag_name,
      version: r.tag_name.replace(/^v/, ''),
      name: r.name || r.tag_name,
      body: r.body || '',
      published_at: r.published_at,
      html_url: r.html_url,
      metadata: parseReleaseMetadata(r.body || ''),
    })
  )

  cachedReleases = releases
  cacheTimestamp = now

  return releases
}

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b
 *   0 if a == b
 *   1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va < vb) return -1
    if (va > vb) return 1
  }
  return 0
}
