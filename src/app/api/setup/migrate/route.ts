import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import postgres from 'postgres'
import fs from 'fs'
import path from 'path'

export async function POST() {
  // F1: Auth guard — only allow during initial setup or by admin
  const admin = createAdminClient()
  const { data: config } = await admin
    .from('site_config')
    .select('setup_complete')
    .eq('id', 1)
    .single()

  if (config?.setup_complete) {
    return NextResponse.json(
      { migrated: false, error: 'Setup is already complete' },
      { status: 403 }
    )
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return NextResponse.json(
      {
        migrated: false,
        error:
          'DATABASE_URL is not configured. Add it to your Vercel environment variables. Find it in Supabase Dashboard > Settings > Database > Connection String (Transaction Pooler).',
      },
      { status: 400 }
    )
  }

  // F8: Limit pool to single connection to prevent exhaustion
  const sql = postgres(databaseUrl, { ssl: 'require', max: 1 })

  try {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    let migrationsRun = 0
    let seeded = false

    // Wrap all migrations + seed in a transaction for atomicity (AC 15)
    await sql.begin(async (tx) => {
      for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file)
        const sqlContent = fs.readFileSync(filePath, 'utf-8')
        await tx.unsafe(sqlContent)
        migrationsRun++
      }

      // Run seed data
      const seedPath = path.join(process.cwd(), 'supabase', 'seed.sql')
      if (fs.existsSync(seedPath)) {
        const seedContent = fs.readFileSync(seedPath, 'utf-8')
        await tx.unsafe(seedContent)
        seeded = true
      }
    })

    return NextResponse.json({
      migrated: true,
      migrationsRun,
      seeded,
    })
  } catch (err) {
    // F9: Log full error server-side, return sanitized message to client
    console.error('Migration error:', err)
    return NextResponse.json(
      { migrated: false, error: 'Database migration failed. Check server logs for details.' },
      { status: 500 }
    )
  } finally {
    await sql.end()
  }
}
