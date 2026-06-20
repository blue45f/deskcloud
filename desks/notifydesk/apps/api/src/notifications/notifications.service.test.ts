import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { ChannelsService } from '../channels/channels.service'
import { EmailAdapter } from '../channels/email.adapter'
import { WebPushAdapter } from '../channels/web-push.adapter'
import { loadConfig, type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { InboxService } from '../inbox/inbox.service'
import { PreferencesService } from '../preferences/preferences.service'
import { TenantsService } from '../tenants/tenants.service'

import { NotificationsService } from './notifications.service'
import { TemplatesService } from './templates.service'

import type { Database, DatabaseService } from '../db/database.service'
import type { TenantRow } from '../tenants/tenant-context'

interface Harness {
  dbs: DatabaseService
  cfg: AppConfig
  tenants: TenantsService
  templates: TemplatesService
  preferences: PreferencesService
  inbox: InboxService
  notifications: NotificationsService
}

async function makeHarness(overrides: Partial<AppConfig> = {}): Promise<Harness> {
  const client = await PGlite.create() // 인메모리
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService

  const cfg: AppConfig = { ...loadConfig(), freePlanCap: 1000, ...overrides }
  const channels = new ChannelsService(new EmailAdapter(cfg), new WebPushAdapter(cfg))
  const tenants = new TenantsService(dbs)
  const templates = new TemplatesService(dbs)
  const preferences = new PreferencesService(dbs)
  const inbox = new InboxService(dbs)
  const notifications = new NotificationsService(dbs, channels, tenants)
  return { dbs, cfg, tenants, templates, preferences, inbox, notifications }
}

async function signupTenant(h: Harness, plan: 'free' | 'pro' = 'free'): Promise<TenantRow> {
  const creds = await h.tenants.signup({ name: 'Acme', plan, corsOrigins: ['*'] })
  // 가입 후 행을 다시 읽어 TenantRow 확보(가드가 부착하는 형태와 동일).
  const row = await h.tenants.findByPublishableKey(creds.publishableKey)
  return row!
}

describe('NotificationsService 발송 파이프라인 (PGlite)', () => {
  let h: Harness

  beforeEach(async () => {
    h = await makeHarness()
  })

  it('애드혹 발송 → in-app 인박스에 저장되고 미읽음 +1', async () => {
    const tenant = await signupTenant(h)
    const result = await h.notifications.notify(
      tenant,
      { recipientId: 'u1', type: 'system', title: '안녕', body: '환영합니다' },
      h.cfg
    )
    expect(result.notificationId).toBeTruthy()
    expect(result.capExceeded).toBe(false)
    expect(result.deliveries.map((d) => d.channel)).toContain('in_app')

    const inbox = await h.inbox.list(tenant.id, 'u1')
    expect(inbox.items).toHaveLength(1)
    expect(inbox.items[0]!.title).toBe('안녕')
    expect(inbox.unreadCount).toBe(1)
  })

  it('템플릿 발송 시 {{변수}} 가 렌더된다', async () => {
    const tenant = await signupTenant(h)
    await h.templates.create(tenant.id, {
      key: 'order.shipped',
      channels: ['in_app', 'email'],
      subject: '주문 {{orderId}} 발송',
      bodyTemplate: '{{name}}님 주문 {{orderId}} 발송됨',
    })
    const result = await h.notifications.notify(
      tenant,
      {
        recipientId: 'u1',
        type: 'order.shipped',
        templateKey: 'order.shipped',
        data: { name: '희준', orderId: 'A-1' },
        email: 'u1@example.com',
      },
      h.cfg
    )
    const inbox = await h.inbox.list(tenant.id, 'u1')
    expect(inbox.items[0]!.title).toBe('주문 A-1 발송')
    expect(inbox.items[0]!.body).toBe('희준님 주문 A-1 발송됨')
    // email 채널이 콘솔 어댑터로 delivered.
    const email = result.deliveries.find((d) => d.channel === 'email')
    expect(email?.status).toBe('delivered')
  })

  it('선호(enabled=false)가 email 채널을 억제한다 (in_app 은 유지)', async () => {
    const tenant = await signupTenant(h)
    await h.preferences.update(tenant.id, {
      recipientId: 'u1',
      preferences: [{ type: 'marketing', channel: 'email', enabled: false }],
    })
    const result = await h.notifications.notify(
      tenant,
      {
        recipientId: 'u1',
        type: 'marketing',
        channels: ['in_app', 'email'],
        body: '프로모션',
        email: 'u1@example.com',
      },
      h.cfg
    )
    expect(result.suppressed).toContain('email')
    expect(result.deliveries.map((d) => d.channel)).not.toContain('email')
    // in_app 은 여전히 저장됨.
    expect(result.notificationId).toBeTruthy()
  })

  it('web-push 는 VAPID 미설정 시 skipped(vapid-unset)', async () => {
    const tenant = await signupTenant(h)
    const result = await h.notifications.notify(
      tenant,
      { recipientId: 'u1', type: 'social', channels: ['in_app', 'web_push'], body: '알림' },
      h.cfg
    )
    const wp = result.deliveries.find((d) => d.channel === 'web_push')
    expect(wp?.status).toBe('skipped')
    expect(wp?.detail).toBe('vapid-unset')
  })

  it('free 플랜 소프트 캡 초과 시 발송 거부(capExceeded) + 인박스 비저장', async () => {
    const h2 = await makeHarness({ freePlanCap: 1 })
    const tenant = await signupTenant(h2, 'free')
    // 1건은 통과
    const ok = await h2.notifications.notify(
      tenant,
      { recipientId: 'u1', type: 'system', body: 'first' },
      h2.cfg
    )
    expect(ok.capExceeded).toBe(false)
    // 2건째는 캡 초과
    const over = await h2.notifications.notify(
      tenant,
      { recipientId: 'u1', type: 'system', body: 'second' },
      h2.cfg
    )
    expect(over.capExceeded).toBe(true)
    expect(over.notificationId).toBeNull()

    const inbox = await h2.inbox.list(tenant.id, 'u1')
    expect(inbox.items).toHaveLength(1) // 두 번째는 저장 안 됨
  })

  it('pro 플랜은 캡을 무시한다', async () => {
    const h2 = await makeHarness({ freePlanCap: 1 })
    const tenant = await signupTenant(h2, 'pro')
    await h2.notifications.notify(tenant, { recipientId: 'u1', type: 'system', body: 'a' }, h2.cfg)
    const second = await h2.notifications.notify(
      tenant,
      { recipientId: 'u1', type: 'system', body: 'b' },
      h2.cfg
    )
    expect(second.capExceeded).toBe(false)
  })

  it('읽음 처리 후 미읽음 카운트가 갱신된다', async () => {
    const tenant = await signupTenant(h)
    const r1 = await h.notifications.notify(
      tenant,
      { recipientId: 'u1', type: 'system', body: 'a' },
      h.cfg
    )
    await h.notifications.notify(tenant, { recipientId: 'u1', type: 'system', body: 'b' }, h.cfg)
    expect((await h.inbox.unreadCount(tenant.id, 'u1')).unreadCount).toBe(2)

    const marked = await h.inbox.markRead(tenant.id, {
      recipientId: 'u1',
      ids: [r1.notificationId!],
    })
    expect(marked.updated).toBe(1)
    expect(marked.unreadCount).toBe(1)

    const all = await h.inbox.markRead(tenant.id, { recipientId: 'u1', all: true })
    expect(all.unreadCount).toBe(0)
  })

  it('인박스는 테넌트·recipient 별로 격리된다', async () => {
    const a = await signupTenant(h)
    const b = await signupTenant(h)
    await h.notifications.notify(a, { recipientId: 'u1', type: 'system', body: 'A' }, h.cfg)
    await h.notifications.notify(b, { recipientId: 'u1', type: 'system', body: 'B' }, h.cfg)

    const inboxA = await h.inbox.list(a.id, 'u1')
    expect(inboxA.items).toHaveLength(1)
    expect(inboxA.items[0]!.body).toBe('A')
    // 다른 recipient 는 비어 있음
    expect((await h.inbox.list(a.id, 'u2')).items).toHaveLength(0)
  })
})
