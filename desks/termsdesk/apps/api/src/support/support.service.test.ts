import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DatabaseService } from '../db/database.service'

import { SupportService } from './support.service'

import type { AppConfig } from '../config'

describe('SupportService', () => {
  let dir: string
  let dbs: DatabaseService
  let service: SupportService

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-support-'))
    dbs = new DatabaseService({
      mode: 'saas',
      port: 0,
      webOrigin: 'http://localhost',
      databaseUrl: null,
      pgliteDir: dir,
      jwtSecret: 'test',
      seedAdminEmail: 'admin@example.com',
      seedAdminPassword: 'password',
      publicCacheTtl: 60,
      allowSignup: true,
      googleClientId: null,
      allowDemo: false,
      inquiryAllowedOrigins: [],
    } satisfies AppConfig)
    await dbs.onModuleInit()
    service = new SupportService(dbs)
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates public support posts without exposing private contact details', async () => {
    const created = await service.create({
      projectSlug: 'PromptMarket',
      category: 'bug',
      name: 'Kim',
      contact: 'kim@example.com',
      title: '검색 필터 오류',
      body: '특정 필터를 켜면 검색 결과가 모두 사라집니다.',
    })

    expect(created.projectSlug).toBe('promptmarket')
    expect(created.category).toBe('bug')
    expect(created.authorName).toBe('Kim')
    expect(JSON.stringify(created)).not.toContain('kim@example.com')

    const listed = await service.list('promptmarket', { category: 'bug' })
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]?.id).toBe(created.id)
    expect(JSON.stringify(listed.items[0])).not.toContain('kim@example.com')
  })
})
