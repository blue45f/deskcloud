import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JwtService } from '@nestjs/jwt'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { randomUUID } from '../common/crypto'
import { DatabaseService } from '../db/database.service'
import { organizations, requestProposals, serviceRequests, users } from '../db/schema'

import { RealtimeAuthService } from './realtime-auth.service'

import type { AuthUser } from '../common/request-context'
import type { AppConfig } from '../config'
import type { Role } from '@termsdesk/shared'

const baseConfig = (dir: string): AppConfig => ({
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
  attachmentStorage: {
    bucket: null,
    region: 'ap-northeast-2',
    endpoint: null,
    forcePathStyle: false,
    maxBytes: 10 * 1024 * 1024,
  },
  realtimeOrigin: null,
})

describe('RealtimeAuthService', () => {
  let dir: string
  let dbs: DatabaseService
  let service: RealtimeAuthService
  let firstOrgId: string
  let requestOrgId: string
  let requestId: string

  const insertUser = async (orgId: string, role: Role = 'admin'): Promise<AuthUser> => {
    const userId = randomUUID()
    const user = {
      userId,
      orgId,
      role,
      name: `${role}-${userId.slice(0, 4)}`,
      email: `${userId}@example.com`,
    }
    await dbs.db.insert(users).values({
      id: userId,
      orgId,
      role,
      name: user.name,
      email: user.email,
    })
    return user
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-realtime-'))
    dbs = new DatabaseService(baseConfig(dir))
    await dbs.onModuleInit()
    service = new RealtimeAuthService(new JwtService({ secret: 'test' }), dbs, baseConfig(dir))

    const [firstOrg] = await dbs.db
      .insert(organizations)
      .values({ name: 'Operator', slug: 'operator', createdAt: new Date('2026-01-01T00:00:00Z') })
      .returning()
    const [requestOrg] = await dbs.db
      .insert(organizations)
      .values({ name: 'Requester', slug: 'requester', createdAt: new Date('2026-01-02T00:00:00Z') })
      .returning()
    firstOrgId = firstOrg!.id
    requestOrgId = requestOrg!.id

    const requester = await insertUser(requestOrgId, 'admin')
    requestId = randomUUID()
    await dbs.db.insert(serviceRequests).values({
      id: requestId,
      requesterOrgId: requestOrgId,
      requesterUserId: requester.userId,
      requesterName: requester.name,
      title: '약관 검토 의뢰',
      description: '실시간 방 접근 검증용 의뢰입니다.',
      serviceType: 'review',
      policyType: 'terms',
    })
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('issues short-lived token and authenticates it back to AuthUser', async () => {
    const user = await insertUser(requestOrgId, 'admin')

    const issued = await service.issueToken(user)
    const authenticated = await service.authenticateToken(issued.token)

    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(authenticated).toMatchObject({
      userId: user.userId,
      orgId: user.orgId,
      role: user.role,
    })
  })

  it('allows request participants, proposed providers, and platform admins to join', async () => {
    const requester = await insertUser(requestOrgId, 'admin')
    const [providerOrg] = await dbs.db
      .insert(organizations)
      .values({ name: 'Provider', slug: 'provider' })
      .returning()
    const provider = await insertUser(providerOrg!.id, 'admin')
    const admin = await insertUser(firstOrgId, 'owner')
    const [strangerOrg] = await dbs.db
      .insert(organizations)
      .values({ name: 'Stranger', slug: 'stranger' })
      .returning()
    const stranger = await insertUser(strangerOrg!.id, 'admin')

    await dbs.db.insert(requestProposals).values({
      requestId,
      providerUserId: provider.userId,
      providerOrgId: provider.orgId,
      providerName: provider.name,
      message: '제안합니다.',
    })
    const [request] = await dbs.db
      .select({ requesterOrgId: serviceRequests.requesterOrgId })
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .limit(1)

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(request?.requesterOrgId).toBe(requester.orgId)
    expect(await service.canJoinRequest(requester, requestId)).toBe(true)
    expect(await service.canJoinRequest(provider, requestId)).toBe(true)
    expect(await service.canJoinRequest(admin, requestId)).toBe(true)
    expect(await service.canJoinRequest(stranger, requestId)).toBe(false)
  })
})
