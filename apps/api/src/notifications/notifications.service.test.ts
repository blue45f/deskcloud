import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { randomUUID } from '../common/crypto'
import { DatabaseService } from '../db/database.service'
import { organizations, users } from '../db/schema'
import { RealtimeGateway } from '../realtime/realtime.gateway'

import { NotificationsService } from './notifications.service'

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
  attachmentStorage: {
    bucket: null,
    region: 'ap-northeast-2',
    endpoint: null,
    forcePathStyle: false,
    maxBytes: 10 * 1024 * 1024,
  },
  realtimeOrigin: null,
})

describe('NotificationsService realtime integration', () => {
  let dir: string
  let dbs: DatabaseService
  let realtime: Pick<RealtimeGateway, 'emitNotification' | 'emitUnreadCount'>
  let service: NotificationsService

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-notifications-'))
    dbs = new DatabaseService(baseConfig(dir))
    await dbs.onModuleInit()
    realtime = {
      emitNotification: vi.fn(),
      emitUnreadCount: vi.fn(),
    }
    service = new NotificationsService(dbs, realtime as RealtimeGateway)
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('notify emits created notification and unread count', async () => {
    const [org] = await dbs.db
      .insert(organizations)
      .values({ name: 'Acme', slug: 'acme' })
      .returning()
    const userId = randomUUID()
    await dbs.db.insert(users).values({
      id: userId,
      orgId: org!.id,
      email: 'user@example.com',
      name: '사용자',
      role: 'admin',
    })

    await service.notify({
      userId,
      orgId: org!.id,
      type: 'message_received',
      title: '새 메시지',
      body: '메시지가 도착했습니다.',
    })

    expect(realtime.emitNotification).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ title: '새 메시지', readAt: null }),
      1
    )
  })

  it('markRead emits updated unread count', async () => {
    const [org] = await dbs.db
      .insert(organizations)
      .values({ name: 'Acme', slug: 'acme' })
      .returning()
    const userId = randomUUID()
    const user: AuthUser = {
      userId,
      orgId: org!.id,
      role: 'admin',
      name: '사용자',
      email: 'user@example.com',
    }
    await dbs.db.insert(users).values({
      id: userId,
      orgId: org!.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
    await service.notify({
      userId,
      orgId: org!.id,
      type: 'message_received',
      title: '새 메시지',
      body: '메시지가 도착했습니다.',
    })
    const list = await service.list(user)

    await service.markRead(user, list.items[0]!.id)

    expect(realtime.emitUnreadCount).toHaveBeenLastCalledWith(userId, 0)
  })
})
