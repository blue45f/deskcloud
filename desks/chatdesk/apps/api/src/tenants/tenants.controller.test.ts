import { PGlite } from '@electric-sql/pglite'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { TenantsController } from './tenants.controller'
import { TenantsService } from './tenants.service'

import type { Database, DatabaseService } from '../db/database.service'

function cfg(): AppConfig {
  return {
    mode: 'self-hosted',
    port: 0,
    webOrigin: 'http://localhost',
    chatPath: '/chat',
    databaseUrl: null,
    pgliteDir: '.data/test',
    adminToken: 'test',
    memberTokenSecret: null,
  }
}

async function make(): Promise<{ controller: TenantsController; service: TenantsService }> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const service = new TenantsService(dbs, cfg())
  return { controller: new TenantsController(service), service }
}

describe('TenantsController.visit (공개 방문 ping)', () => {
  let controller: TenantsController
  let service: TenantsService

  beforeEach(async () => {
    ;({ controller, service } = await make())
  })

  it('pk·Origin 통과 — 일별 버킷에 누적하고 오늘 카운트 반환', async () => {
    const t = await service.create({ name: 'Acme', corsOrigins: ['https://app.acme.com'] })
    const r = await controller.visit(t.publishableKey, 'https://app.acme.com', {
      visitorId: 'v1',
    })
    expect(r.todayVisitors).toBe(1)
    expect(r.todayPageviews).toBe(1)
  })

  it('허용되지 않은 Origin 은 403(트래픽 미집계)', async () => {
    const t = await service.create({ name: 'Acme', corsOrigins: ['https://app.acme.com'] })
    await expect(
      controller.visit(t.publishableKey, 'https://evil.com', { visitorId: 'v1' })
    ).rejects.toBeInstanceOf(ForbiddenException)
    // 거부됐으므로 트래픽은 0 으로 남아야 한다.
    expect((await service.getAnalytics(t.id)).totalTraffic).toBe(0)
  })

  it('Origin 헤더 없음(서버-서버/동일 출처) 은 통과', async () => {
    const t = await service.create({ name: 'Acme', corsOrigins: ['https://app.acme.com'] })
    const r = await controller.visit(t.publishableKey, undefined, { visitorId: 'v1' })
    expect(r.todayPageviews).toBe(1)
  })

  it('알 수 없는 pk 는 404', async () => {
    await expect(
      controller.visit('pk_does_not_exist', 'https://app.acme.com', {})
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})
