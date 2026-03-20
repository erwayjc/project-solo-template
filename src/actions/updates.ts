'use server'

import { requireAdmin } from '@/lib/auth/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchReleases, compareSemver } from '@/lib/updates/github'
import type { TemplateRelease } from '@/lib/updates/github'
import type { Json } from '@/lib/supabase/types'
import fs from 'fs'
import path from 'path'
import postgres from 'postgres'

// ── Types ──

export interface UpdateCheckResult {
  currentVersion: string
  deployedCodeVersion: string
  latestVersion: string
  hasUpdate: boolean
  releases: TemplateRelease[]
  pendingMigrationCount: number
  seedUpdates: string[]
  hasBreaking: boolean
  lastMigrationNumber: number
}

export interface UpdateHistoryEntry {
  version: string
  applied_at: string
  migrations_run: number
  seed_updates: string[]
  status: 'success' | 'partial' | 'failed'
  error?: string
}

// ── Actions ──

/**
 * Check for available upstream template updates.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const { supabase } = await requireAdmin()

  // Read current version from database
  const { data: config } = await supabase
    .from('site_config')
    .select('template_version, last_migration_number')
    .eq('id', 1)
    .single()

  const currentVersion = config?.template_version || '0.0.0'
  const lastMigrationNumber = config?.last_migration_number || 0

  // Read deployed code version from version.json on disk
  let deployedCodeVersion = currentVersion
  const versionPath = path.join(process.cwd(), 'version.json')
  if (fs.existsSync(versionPath)) {
    try {
      const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'))
      deployedCodeVersion = versionData.version || currentVersion
    } catch {
      // Fall back to DB version
    }
  }

  // Fetch releases from GitHub
  let releases: TemplateRelease[] = []
  try {
    releases = await fetchReleases()
  } catch {
    // If GitHub is unreachable, return current state with no updates
    return {
      currentVersion,
      deployedCodeVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releases: [],
      pendingMigrationCount: 0,
      seedUpdates: [],
      hasBreaking: false,
      lastMigrationNumber,
    }
  }

  // Filter to releases newer than current version
  const newerReleases = releases.filter(
    (r) => compareSemver(r.version, currentVersion) > 0
  )

  const latestVersion =
    newerReleases.length > 0 ? newerReleases[0].version : currentVersion

  // Aggregate metadata from all newer releases
  let pendingMigrationCount = 0
  const seedUpdates = new Set<string>()
  let hasBreaking = false

  for (const release of newerReleases) {
    if (release.metadata.migration_range) {
      const [start, end] = release.metadata.migration_range
      pendingMigrationCount += end - start + 1
    }
    if (release.metadata.seed_updates) {
      release.metadata.seed_updates.forEach((s) => seedUpdates.add(s))
    }
    if (release.metadata.breaking) {
      hasBreaking = true
    }
  }

  // Update the update_available flag
  const hasUpdate = newerReleases.length > 0
  await supabase
    .from('site_config')
    .update({ update_available: hasUpdate })
    .eq('id', 1)

  return {
    currentVersion,
    deployedCodeVersion,
    latestVersion,
    hasUpdate,
    releases: newerReleases,
    pendingMigrationCount,
    seedUpdates: Array.from(seedUpdates),
    hasBreaking,
    lastMigrationNumber,
  }
}

/**
 * Apply pending database migrations that are on disk but not yet applied.
 * Must be called AFTER code has been redeployed (so new migration files are on disk).
 */
export async function applyMigrations(): Promise<{
  success: boolean
  migrationsRun: number
  error?: string
}> {
  await requireAdmin()

  const admin = createAdminClient()

  // Get current migration level
  const { data: config } = await admin
    .from('site_config')
    .select('template_version, last_migration_number, update_history')
    .eq('id', 1)
    .single()

  const lastMigrationNumber = config?.last_migration_number || 0

  // Read migration files from disk
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  if (!fs.existsSync(migrationsDir)) {
    return { success: false, migrationsRun: 0, error: 'Migrations directory not found' }
  }

  const allMigrations = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  // Find migrations with numbers greater than lastMigrationNumber
  const pendingMigrations = allMigrations.filter((f) => {
    const numMatch = f.match(/^(\d+)/)
    if (!numMatch) return false
    return parseInt(numMatch[1]) > lastMigrationNumber
  })

  if (pendingMigrations.length === 0) {
    return { success: true, migrationsRun: 0 }
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!databaseUrl) {
    return { success: false, migrationsRun: 0, error: 'DATABASE_URL is not configured' }
  }

  const sql = postgres(databaseUrl, { ssl: 'require', max: 1 })

  try {
    let migrationsRun = 0

    await sql.begin(async (tx) => {
      for (const file of pendingMigrations) {
        const filePath = path.join(migrationsDir, file)
        const sqlContent = fs.readFileSync(filePath, 'utf-8')
        await tx.unsafe(sqlContent)
        migrationsRun++
      }
    })

    // Update tracking
    const newMigrationNumber = allMigrations.length
    const history = (config?.update_history as unknown as UpdateHistoryEntry[]) || []
    const entry: UpdateHistoryEntry = {
      version: config?.template_version || '0.0.0',
      applied_at: new Date().toISOString(),
      migrations_run: migrationsRun,
      seed_updates: [],
      status: 'success',
    }
    const updatedHistory = [...history, entry].slice(-50)

    await admin
      .from('site_config')
      .update({
        last_migration_number: newMigrationNumber,
        update_history: updatedHistory as unknown as Json,
      })
      .eq('id', 1)

    return { success: true, migrationsRun }
  } catch (err) {
    console.error('Migration update error:', err)
    return {
      success: false,
      migrationsRun: 0,
      error: err instanceof Error ? err.message : 'Migration failed',
    }
  } finally {
    await sql.end()
  }
}

/**
 * Apply seed data updates for system-managed records.
 * Only updates rows where is_system = true, preserving student customizations.
 */
export async function applySeedUpdates(
  tables: string[]
): Promise<{
  success: boolean
  tablesUpdated: string[]
  error?: string
}> {
  await requireAdmin()

  const admin = createAdminClient()
  const tablesUpdated: string[] = []

  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!databaseUrl) {
    return { success: false, tablesUpdated: [], error: 'DATABASE_URL is not configured' }
  }

  try {
    // Re-run seed.sql sections for requested tables
    // The seed uses ON CONFLICT DO NOTHING for most tables,
    // but for system agents we need to update existing records
    const seedPath = path.join(process.cwd(), 'supabase', 'seed.sql')
    if (!fs.existsSync(seedPath)) {
      return { success: false, tablesUpdated: [], error: 'seed.sql not found' }
    }

    const sql = postgres(databaseUrl, { ssl: 'require', max: 1 })

    try {
      if (tables.includes('agents')) {
        // Update system agents only — preserving is_active and student-created agents
        const seedContent = fs.readFileSync(seedPath, 'utf-8')
        const agentSection = extractSeedSection(seedContent, 'agents')
        if (agentSection) {
          await sql.unsafe(agentSection)
          tablesUpdated.push('agents')
        }
      }

      if (tables.includes('mcp_connections')) {
        const seedContent = fs.readFileSync(seedPath, 'utf-8')
        const mcpSection = extractSeedSection(seedContent, 'mcp_connections')
        if (mcpSection) {
          await sql.unsafe(mcpSection)
          tablesUpdated.push('mcp_connections')
        }
      }
    } finally {
      await sql.end()
    }

    // Record in update history
    const { data: config } = await admin
      .from('site_config')
      .select('update_history')
      .eq('id', 1)
      .single()

    const history = (config?.update_history as unknown as UpdateHistoryEntry[]) || []
    const entry: UpdateHistoryEntry = {
      version: 'seed-update',
      applied_at: new Date().toISOString(),
      migrations_run: 0,
      seed_updates: tablesUpdated,
      status: 'success',
    }
    const updatedHistory = [...history, entry].slice(-50)

    await admin
      .from('site_config')
      .update({ update_history: updatedHistory as unknown as Json })
      .eq('id', 1)

    return { success: true, tablesUpdated }
  } catch (err) {
    console.error('Seed update error:', err)
    return {
      success: false,
      tablesUpdated,
      error: err instanceof Error ? err.message : 'Seed update failed',
    }
  }
}

/**
 * Called after admin confirms they've redeployed via Railway.
 * Reads the new version.json from disk to verify the code version changed.
 */
export async function markCodeRedeployed(): Promise<{
  success: boolean
  newVersion?: string
  newMigrationCount?: number
  error?: string
}> {
  await requireAdmin()

  const versionPath = path.join(process.cwd(), 'version.json')
  if (!fs.existsSync(versionPath)) {
    return { success: false, error: 'version.json not found — code may not have been redeployed yet' }
  }

  try {
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'))
    return {
      success: true,
      newVersion: versionData.version,
      newMigrationCount: versionData.migration_count,
    }
  } catch {
    return { success: false, error: 'Failed to read version.json' }
  }
}

/**
 * Finalize an update: set the template_version and clear the update_available flag.
 */
export async function finalizeUpdate(version: string): Promise<{ success: boolean }> {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('site_config')
    .update({
      template_version: version,
      update_available: false,
    })
    .eq('id', 1)

  if (error) {
    throw new Error(`Failed to finalize update: ${error.message}`)
  }

  return { success: true }
}

/**
 * Get the update history from site_config.
 */
export async function getUpdateHistory(): Promise<UpdateHistoryEntry[]> {
  const { supabase } = await requireAdmin()

  const { data: config } = await supabase
    .from('site_config')
    .select('update_history')
    .eq('id', 1)
    .single()

  return (config?.update_history as unknown as UpdateHistoryEntry[]) || []
}

// ── Helpers ──

/**
 * Extract a section of seed.sql for a specific table.
 * Looks for comment headers like "-- Agents" or "-- agents" and extracts
 * until the next section header or end of file.
 */
function extractSeedSection(seedSql: string, tableName: string): string | null {
  // Look for section delimiters: lines starting with "-- ----" followed by a comment with the table name
  const lines = seedSql.split('\n')
  let capturing = false
  let sectionLines: string[] = []
  const tablePattern = new RegExp(`^--\\s*${tableName}`, 'i')
  const sectionDivider = /^-- -{3,}/

  for (let i = 0; i < lines.length; i++) {
    if (tablePattern.test(lines[i])) {
      capturing = true
      continue
    }

    if (capturing) {
      // Stop at the next section divider (but not the one right after our header)
      if (sectionDivider.test(lines[i]) && sectionLines.length > 0) {
        // Check if the next non-empty line is a new section header
        const nextLine = lines[i + 1]?.trim()
        if (nextLine && nextLine.startsWith('--') && !nextLine.startsWith('-- -')) {
          break
        }
      }

      sectionLines.push(lines[i])
    }
  }

  const result = sectionLines.join('\n').trim()
  return result || null
}
