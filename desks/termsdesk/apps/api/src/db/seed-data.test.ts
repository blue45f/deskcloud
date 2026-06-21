import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { hashPassword, randomUUID, verifyPassword } from '../common/crypto'

import { DatabaseService } from './database.service'
import { organizations, users } from './schema'
import { runSeed } from './seed-data'

import type { AppConfig } from '../config'

const baseConfig = (dir: string): AppConfig => ({
  mode: 'self-hosted',
  port: 0,
  webOrigin: 'http://localhost',
  databaseUrl: null,
  pgliteDir: dir,
  jwtSecret: 'test',
  seedAdminEmail: 'admin@example.com',
  seedAdminPassword: 'expected-password',
  publicCacheTtl: 60,
  allowSignup: true,
  googleClientId: null,
  allowDemo: true,
  inquiryAllowedOrigins: [],
})

describe('runSeed admin account reconciliation', () => {
  let dir: string
  let dbs: DatabaseService

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-seed-'))
    dbs = new DatabaseService(baseConfig(dir))
    await dbs.onModuleInit()
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('updates the existing seed admin password, role, provider, and org instead of duplicating it', async () => {
    const staleOrgId = randomUUID()
    const seedOrgId = randomUUID()
    await dbs.db.insert(organizations).values([
      { id: seedOrgId, name: 'Seed Org', slug: 'seed-org' },
      { id: staleOrgId, name: 'Stale Org', slug: 'stale-org' },
    ])
    await dbs.db.insert(users).values({
      id: randomUUID(),
      orgId: staleOrgId,
      email: 'admin@example.com',
      name: 'Admin',
      role: 'viewer',
      provider: 'google',
      passwordHash: hashPassword('old-password'),
    })

    const result = await runSeed(dbs, baseConfig(dir), { demo: false })

    expect(result).toMatchObject({ seeded: false, orgId: seedOrgId, adminUpdated: true })
    const rows = await dbs.db.select().from(users).where(eq(users.email, 'admin@example.com'))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ orgId: seedOrgId, role: 'owner', provider: 'password' })
    expect(verifyPassword('expected-password', rows[0]!.passwordHash!)).toBe(true)

    const [{ count }] = await dbs.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.email, 'admin@example.com'))
    expect(Number(count)).toBe(1)
  })
})
