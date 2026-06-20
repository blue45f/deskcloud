import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AuditService } from '../common/audit.service'
import { hashPassword, randomUUID, verifyPassword } from '../common/crypto'
import { DatabaseService } from '../db/database.service'
import { auditEvents, organizations, users } from '../db/schema'

import { AuthService } from './auth.service'

import type { AuthUser } from '../common/request-context'
import type { AppConfig } from '../config'

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
})

describe('AuthService profile lifecycle', () => {
  let dir: string
  let dbs: DatabaseService
  let audit: AuditService
  let service: AuthService
  let orgId: string
  let ownerId: string
  let adminId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-auth-'))
    dbs = new DatabaseService(baseConfig(dir))
    await dbs.onModuleInit()
    audit = new AuditService(dbs)
    service = new AuthService(dbs, new JwtService({ secret: 'test' }), audit, baseConfig(dir))

    const [org] = await dbs.db
      .insert(organizations)
      .values({ name: '에이크미', slug: 'acme' })
      .returning()
    orgId = org!.id
    ownerId = randomUUID()
    adminId = randomUUID()
    await dbs.db.insert(users).values([
      {
        id: ownerId,
        orgId,
        email: 'owner@example.com',
        name: 'Owner',
        role: 'owner',
        passwordHash: hashPassword('old-password'),
      },
      {
        id: adminId,
        orgId,
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin',
        passwordHash: hashPassword('admin-password'),
      },
    ])
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('updates name/email/password and records an audit event', async () => {
    const session = await service.updateProfile(
      ownerId,
      {
        name: 'New Owner',
        email: 'NEW-OWNER@example.com',
        currentPassword: 'old-password',
        password: 'new-password',
      },
      '127.0.0.1'
    )

    expect(session.user.name).toBe('New Owner')
    expect(session.user.email).toBe('new-owner@example.com')

    const [row] = await dbs.db.select().from(users).where(eq(users.id, ownerId)).limit(1)
    expect(row!.name).toBe('New Owner')
    expect(row!.email).toBe('new-owner@example.com')
    expect(verifyPassword('new-password', row!.passwordHash!)).toBe(true)

    const events = await dbs.db.select().from(auditEvents)
    expect(events.find((event) => event.action === 'auth.profile_updated')).toMatchObject({
      actorName: 'New Owner',
      ip: '127.0.0.1',
    })
  })

  it('requires the current password for email or password changes', async () => {
    await expect(
      service.updateProfile(ownerId, { email: 'owner2@example.com' }, '127.0.0.1')
    ).rejects.toBeInstanceOf(UnauthorizedException)

    await expect(
      service.updateProfile(
        ownerId,
        { currentPassword: 'wrong-password', password: 'new-password' },
        '127.0.0.1'
      )
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects profile email changes that would make login ambiguous', async () => {
    await expect(
      service.updateProfile(
        ownerId,
        { email: 'admin@example.com', currentPassword: 'old-password' },
        '127.0.0.1'
      )
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('withdraws a non-last owner/admin account and clears future sessions', async () => {
    const actor: AuthUser = {
      userId: adminId,
      orgId,
      role: 'admin',
      name: 'Admin',
      email: 'admin@example.com',
    }

    await expect(
      service.withdrawAccount(actor, { currentPassword: 'admin-password' }, '127.0.0.1')
    ).resolves.toEqual({ ok: true })
    await expect(service.session(adminId)).rejects.toBeInstanceOf(UnauthorizedException)

    const events = await dbs.db.select().from(auditEvents)
    expect(events.find((event) => event.action === 'auth.account_withdrawn')).toMatchObject({
      actorName: 'Admin',
      targetId: adminId,
    })
  })

  it('blocks withdrawal of the last owner', async () => {
    await dbs.db.delete(users).where(eq(users.id, adminId))
    const actor: AuthUser = {
      userId: ownerId,
      orgId,
      role: 'owner',
      name: 'Owner',
      email: 'owner@example.com',
    }

    await expect(
      service.withdrawAccount(actor, { currentPassword: 'old-password' }, '127.0.0.1')
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.session(ownerId)).resolves.toMatchObject({
      user: { id: ownerId, role: 'owner' },
    })
  })
})
