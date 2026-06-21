import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

import { MIGRATIONS } from './migrations'

async function applyMigrations(client: PGlite): Promise<void> {
  for (const migration of MIGRATIONS) await client.exec(migration.sql)
}

async function publicIndexNames(client: PGlite): Promise<string[]> {
  const res = await client.query<{ indexname: string }>(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY indexname
  `)

  return res.rows.map((row) => row.indexname)
}

describe('MIGRATIONS (PGlite)', () => {
  it('applies idempotently and keeps operational indexes present', async () => {
    const client = await PGlite.create()

    await applyMigrations(client)
    await applyMigrations(client)

    const indexes = await publicIndexNames(client)

    expect(indexes).toEqual(
      expect.arrayContaining([
        'tenants_slug_uq',
        'tenants_pk_uq',
        'tenants_skhash_uq',
        'members_tenant_email_uq',
        'idx_members_tenant',
        'usage_tenant_period_metric_uq',
        'idx_usage_tenant_period',
        'subscriptions_tenant_uq',
        'idx_subscriptions_tenant',
        'idx_inquiries_app',
        'idx_inquiries_app_created',
        'idx_inquiries_app_status_created',
        'daily_visits_app_day_uq',
        'idx_daily_visits_app',
      ])
    )
  })

  it('keeps migration names unique', () => {
    const names = MIGRATIONS.map((migration) => migration.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
