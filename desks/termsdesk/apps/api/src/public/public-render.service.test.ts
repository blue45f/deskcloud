import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DatabaseService } from '../db/database.service'
import { organizations, policies, policyVersions } from '../db/schema'

import { PublicRenderService } from './public-render.service'

import type { AppConfig } from '../config'

describe('PublicRenderService 공개/비공개 필터 (pglite)', () => {
  let dir: string
  let dbs: DatabaseService
  let service: PublicRenderService
  let orgId: string
  let policyId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-render-'))
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
    service = new PublicRenderService(dbs)

    orgId = randomUUID()
    policyId = randomUUID()
    const versionId = randomUUID()
    await dbs.db.insert(organizations).values({ id: orgId, name: 'Acme', slug: 'acme' })
    await dbs.db
      .insert(policies)
      .values({ id: policyId, orgId, slug: 'terms-of-service', name: '이용약관' })
    await dbs.db.insert(policyVersions).values({
      id: versionId,
      orgId,
      policyId,
      versionNumber: 1,
      versionLabel: 'v1',
      title: '이용약관',
      body: '제1조 …',
      contentHash: 'frozen-hash-v1',
      status: 'published',
      publishedAt: new Date(),
    })
    await dbs.db
      .update(policies)
      .set({ currentVersionId: versionId })
      .where(eq(policies.id, policyId))
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('public 정책은 무인증 렌더·검증이 동작한다 (기본값)', async () => {
    const dto = await service.render('acme', 'terms-of-service', { vars: {} })
    expect(dto.policySlug).toBe('terms-of-service')
    expect(dto.contentHash).toBe('frozen-hash-v1')

    const verified = await service.verify('acme', 'terms-of-service', {})
    expect(verified.contentHash).toBe('frozen-hash-v1')
  })

  it('private 으로 전환하면 렌더·검증 모두 404 — 존재 여부도 드러내지 않는다', async () => {
    await dbs.db.update(policies).set({ visibility: 'private' }).where(eq(policies.id, policyId))

    await expect(service.render('acme', 'terms-of-service', { vars: {} })).rejects.toThrow(
      NotFoundException
    )
    await expect(service.verify('acme', 'terms-of-service', {})).rejects.toThrow(NotFoundException)
  })

  it('private 전환은 게시본·해시에 손대지 않는다 (노출 제어만)', async () => {
    await dbs.db.update(policies).set({ visibility: 'private' }).where(eq(policies.id, policyId))
    // 다시 공개로 — 동결 해시 그대로 렌더
    await dbs.db.update(policies).set({ visibility: 'public' }).where(eq(policies.id, policyId))

    const dto = await service.render('acme', 'terms-of-service', { vars: {} })
    expect(dto.contentHash).toBe('frozen-hash-v1')
    expect(dto.versionLabel).toBe('v1')
  })

  it('포트폴리오 하드코딩 카탈로그는 visibility 와 무관하게 항상 공개', async () => {
    const dto = await service.render('termsdesk', 'terms-of-service', { vars: {} })
    expect(dto.policySlug).toBe('terms-of-service')
    expect(dto.orgName).toBeTruthy()
  })
})
