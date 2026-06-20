import { hashSecretKey } from '@changelogdesk/shared'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { ChangelogService } from './changelog.service'

import type { Database, DatabaseService } from '../db/database.service'
import type { TenantRow } from '../tenants/tenant-context.service'

/** PGlite 인메모리 DB + 부팅 마이그레이션을 적용한 가짜 DatabaseService. */
async function makeDb(): Promise<{ dbs: DatabaseService; service: ChangelogService }> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return { dbs, service: new ChangelogService(dbs) }
}

async function makeTenant(dbs: DatabaseService): Promise<TenantRow> {
  const rows = await dbs.db
    .insert(schema.tenants)
    .values({
      name: 'Acme',
      slug: 'acme',
      publishableKey: 'pk_test',
      secretKeyHash: hashSecretKey('sk_test'),
      corsOrigins: ['https://app.acme.com'],
      plan: 'free',
    })
    .returning()
  return rows[0]! as TenantRow
}

describe('ChangelogService (PGlite)', () => {
  let service: ChangelogService
  let dbs: DatabaseService
  let tenant: TenantRow

  beforeEach(async () => {
    ;({ service, dbs } = await makeDb())
    tenant = await makeTenant(dbs)
  })

  it('미게시 항목은 공개 목록에 안 나오고, 게시하면 나온다', async () => {
    const draft = await service.create(tenant, {
      title: 'Draft',
      bodyMarkdown: 'wip',
      tag: 'new',
      isPublished: false,
    })
    expect(draft.isPublished).toBe(false)
    expect(draft.publishedAt).toBeNull()

    let pub = await service.listPublic(tenant, {})
    expect(pub.total).toBe(0)

    await service.update(tenant, draft.id, { isPublished: true })
    pub = await service.listPublic(tenant, {})
    expect(pub.total).toBe(1)
    expect(pub.items[0]!.isPublished).toBe(true)
    expect(pub.items[0]!.publishedAt).not.toBeNull() // 게시 시 자동 채움
  })

  it('생성 시 isPublished=true 면 publishedAt 자동 채움 + bodyHtml 새니타이즈', async () => {
    const e = await service.create(tenant, {
      title: 'Released',
      bodyMarkdown: '<script>alert(1)</script> **bold**',
      tag: 'improved',
      isPublished: true,
    })
    expect(e.publishedAt).not.toBeNull()
    expect(e.bodyHtml).not.toContain('<script>')
    expect(e.bodyHtml).toContain('<strong>bold</strong>')
  })

  it('테넌트 격리 — 다른 테넌트 항목은 안 보인다', async () => {
    const other = await dbs.db
      .insert(schema.tenants)
      .values({
        name: 'Other',
        slug: 'other',
        publishableKey: 'pk_other',
        secretKeyHash: hashSecretKey('sk_other'),
        corsOrigins: ['*'],
      })
      .returning()
    const otherTenant = other[0]! as TenantRow

    await service.create(tenant, { title: 'A', bodyMarkdown: '', tag: 'new', isPublished: true })
    const pubOther = await service.listPublic(otherTenant, {})
    expect(pubOther.total).toBe(0)
  })

  it('unread-count — seen 기록 전/후', async () => {
    const e1 = await service.create(tenant, {
      title: 'one',
      bodyMarkdown: '',
      tag: 'new',
      isPublished: true,
    })
    await service.create(tenant, { title: 'two', bodyMarkdown: '', tag: 'new', isPublished: true })

    // 처음 방문(seen 없음) → 전부 미읽음
    let unread = await service.unreadCount(tenant, 'anon-1')
    expect(unread.unreadCount).toBe(2)
    expect(unread.latestEntryId).not.toBeNull()

    // e1 까지 봤다고 기록 → e1 보다 최신(두 번째) 1개만 미읽음
    await service.recordSeen(tenant, { anonId: 'anon-1', lastSeenEntryId: e1.id })
    unread = await service.unreadCount(tenant, 'anon-1')
    expect(unread.unreadCount).toBe(1)

    // 최신까지 봤다고 기록 → 0
    await service.recordSeen(tenant, {
      anonId: 'anon-1',
      lastSeenEntryId: unread.latestEntryId!,
    })
    unread = await service.unreadCount(tenant, 'anon-1')
    expect(unread.unreadCount).toBe(0)
  })

  it('seen 은 upsert — 같은 anonId 재기록 시 갱신', async () => {
    const e1 = await service.create(tenant, {
      title: 'one',
      bodyMarkdown: '',
      tag: 'new',
      isPublished: true,
    })
    await service.recordSeen(tenant, { anonId: 'a', lastSeenEntryId: e1.id })
    await service.recordSeen(tenant, { anonId: 'a', lastSeenEntryId: e1.id })
    const receipts = await dbs.db.select().from(schema.readReceipts)
    expect(receipts).toHaveLength(1)
  })

  it('since 증분 — 경계 이후 게시분만', async () => {
    const old = await service.create(tenant, {
      title: 'old',
      bodyMarkdown: '',
      tag: 'new',
      isPublished: true,
      publishedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    })
    await service.create(tenant, {
      title: 'new',
      bodyMarkdown: '',
      tag: 'new',
      isPublished: true,
      publishedAt: new Date('2026-06-01T00:00:00.000Z').toISOString(),
    })
    const since = await service.listPublic(tenant, { since: '2026-03-01T00:00:00.000Z' })
    expect(since.total).toBe(1)
    expect(since.items[0]!.title).toBe('new')
    expect(since.items.some((i) => i.id === old.id)).toBe(false)
  })

  it('삭제 — 항목 제거', async () => {
    const e = await service.create(tenant, {
      title: 'x',
      bodyMarkdown: '',
      tag: 'fixed',
      isPublished: true,
    })
    await service.remove(tenant, e.id)
    const pub = await service.listPublic(tenant, {})
    expect(pub.total).toBe(0)
  })
})
