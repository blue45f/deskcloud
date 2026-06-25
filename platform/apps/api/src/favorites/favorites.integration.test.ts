import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { DrizzleFavoritesStore } from '../stores/drizzle-favorites.store'

import { FavoritesService } from './favorites.service'

import type { Database, DatabaseService } from '../db/database.service'

/** PGlite 인메모리 + 마이그레이션 → DrizzleFavoritesStore + FavoritesService 스택. */
async function makeService(): Promise<FavoritesService> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return new FavoritesService(new DrizzleFavoritesStore(dbs))
}

describe('FavoritesService (PGlite, Drizzle store)', () => {
  let service: FavoritesService

  beforeEach(async () => {
    service = await makeService()
  })

  it('빈 owner 는 빈 목록', async () => {
    const res = await service.list('aidigestdesk', 'anon:abc')
    expect(res.appId).toBe('aidigestdesk')
    expect(res.ownerKey).toBe('anon:abc')
    expect(res.items).toEqual([])
  })

  it('replace → list 영속(전체 교체)', async () => {
    await service.replace('aidigestdesk', 'anon:abc', [
      { id: 'model:gpt', type: 'model', title: 'GPT' },
      { id: 'manual:codex', type: 'manual', title: 'Codex' },
    ])
    const res = await service.list('aidigestdesk', 'anon:abc')
    expect(res.items.map((i) => i.id)).toEqual(['model:gpt', 'manual:codex'])

    // 다시 교체하면 통째로 대체된다.
    await service.replace('aidigestdesk', 'anon:abc', [
      { id: 'model:gpt', type: 'model', title: 'GPT' },
    ])
    const res2 = await service.list('aidigestdesk', 'anon:abc')
    expect(res2.items.map((i) => i.id)).toEqual(['model:gpt'])
  })

  it('owner 별 격리', async () => {
    await service.replace('aidigestdesk', 'anon:a', [{ id: 'x', title: 'X' }])
    await service.replace('aidigestdesk', 'anon:b', [{ id: 'y', title: 'Y' }])
    expect((await service.list('aidigestdesk', 'anon:a')).items.map((i) => i.id)).toEqual(['x'])
    expect((await service.list('aidigestdesk', 'anon:b')).items.map((i) => i.id)).toEqual(['y'])
  })

  it('appId 별 격리 + 정규화(대문자 소문자화)', async () => {
    await service.replace('AIDigestDesk', 'anon:a', [{ id: 'x', title: 'X' }])
    expect((await service.list('aidigestdesk', 'anon:a')).items.map((i) => i.id)).toEqual(['x'])
    expect((await service.list('toonspectrum', 'anon:a')).items).toEqual([])
  })

  it('잘못된 appId/ownerKey 거부', async () => {
    await expect(service.list('bad app!', 'anon:a')).rejects.toThrow()
    await expect(service.list('aidigestdesk', '')).rejects.toThrow()
    await expect(service.replace('aidigestdesk', undefined, [])).rejects.toThrow()
  })
})
