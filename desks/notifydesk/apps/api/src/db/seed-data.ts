import { renderTemplate, type Channel } from '@notifydesk/shared'
import { sql } from 'drizzle-orm'

import { hashSecret, lookupHash } from '../common/secret'

import { DatabaseService } from './database.service'
import { notificationTemplates, notifications, tenants } from './schema'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)
const hoursAgo = (n: number): Date => new Date(Date.now() - n * 60 * 60 * 1000)

/** 데모 테넌트 — 고정 키(pk_demo/sk_demo)로 로컬 검증/문서가 바로 동작하도록. */
const DEMO = {
  name: 'Demo Co',
  slug: 'demo',
  publishableKey: 'pk_demo',
  secretKey: 'sk_demo',
  corsOrigins: ['*'],
  recipientId: 'user_demo',
} as const

interface DemoTemplate {
  key: string
  channels: Channel[]
  subject: string
  bodyTemplate: string
}

const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    key: 'order.shipped',
    channels: ['in_app', 'email'],
    subject: '주문 {{orderId}} 이(가) 발송되었습니다',
    bodyTemplate: '{{name}}님, 주문 {{orderId}} 이(가) {{carrier}} 로 발송되었어요. 곧 만나요!',
  },
  {
    key: 'comment.mention',
    channels: ['in_app', 'web_push'],
    subject: '{{actor}} 님이 회원님을 멘션했습니다',
    bodyTemplate: '{{actor}} 님이 "{{snippet}}" 에서 회원님을 멘션했습니다.',
  },
]

/** 인박스 시드 — mixed read/unread, 두 템플릿 + 애드혹 섞어 ~12건. */
interface DemoNotif {
  type: string
  templateKey?: string
  title: string
  body: string
  channels: Channel[]
  data?: Record<string, unknown>
  read: boolean
  ageHours: number
}

function buildDemoNotifications(): DemoNotif[] {
  const out: DemoNotif[] = []
  const shipTpl = DEMO_TEMPLATES[0]!
  const mentionTpl = DEMO_TEMPLATES[1]!

  const orders = [
    { orderId: 'A-1001', carrier: 'CJ대한통운' },
    { orderId: 'A-1002', carrier: '우체국' },
    { orderId: 'A-1003', carrier: '한진' },
  ]
  orders.forEach((o, i) => {
    const data = { name: '데모', ...o }
    out.push({
      type: 'order.shipped',
      templateKey: shipTpl.key,
      title: renderTemplate(shipTpl.subject, data),
      body: renderTemplate(shipTpl.bodyTemplate, data),
      channels: shipTpl.channels,
      data,
      read: i === 0,
      ageHours: 2 + i * 6,
    })
  })

  const mentions = [
    { actor: '지은', snippet: '오늘 회의 노트' },
    { actor: '현우', snippet: '디자인 리뷰' },
    { actor: '민지', snippet: '배포 체크리스트' },
  ]
  mentions.forEach((m, i) => {
    const data = m
    out.push({
      type: 'comment.mention',
      templateKey: mentionTpl.key,
      title: renderTemplate(mentionTpl.subject, data),
      body: renderTemplate(mentionTpl.bodyTemplate, data),
      channels: mentionTpl.channels,
      data,
      read: i < 1,
      ageHours: 10 + i * 8,
    })
  })

  // 애드혹(템플릿 없이 직접 title/body) 알림 몇 건.
  const adhoc: Array<{ title: string; body: string; type: string; read: boolean }> = [
    { type: 'system', title: '환영합니다 🎉', body: 'NotifyDesk 데모 인박스에 오신 것을 환영합니다.', read: true },
    { type: 'billing', title: '결제 영수증', body: '6월 구독 결제가 완료되었습니다.', read: false },
    { type: 'security', title: '새 기기 로그인', body: '새로운 기기에서 로그인이 감지되었습니다.', read: false },
    { type: 'product', title: '새 기능 출시', body: '웹 푸시 채널이 추가되었습니다.', read: false },
    { type: 'reminder', title: '리마인더', body: '프로필을 완성하면 더 나은 추천을 받을 수 있어요.', read: true },
    { type: 'social', title: '새 팔로워', body: '누군가 회원님을 팔로우하기 시작했습니다.', read: false },
  ]
  adhoc.forEach((a, i) => {
    out.push({
      type: a.type,
      title: a.title,
      body: a.body,
      channels: ['in_app'],
      read: a.read,
      ageHours: 1 + i * 3,
    })
  })

  return out
}

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 템플릿 + 인박스 알림을 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(dbs: DatabaseService, opts: { demo: boolean }): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  const tenantRows = await dbs.db
    .insert(tenants)
    .values({
      name: DEMO.name,
      slug: DEMO.slug,
      plan: 'free',
      publishableKey: DEMO.publishableKey,
      secretKeyHash: hashSecret(DEMO.secretKey),
      secretKeyLookup: lookupHash(DEMO.secretKey),
      corsOrigins: [...DEMO.corsOrigins],
      usageCount: 0,
    })
    .returning({ id: tenants.id })
  const tenantId = tenantRows[0]!.id

  for (const t of DEMO_TEMPLATES) {
    await dbs.db.insert(notificationTemplates).values({
      tenantId,
      key: t.key,
      channels: t.channels,
      subject: t.subject,
      bodyTemplate: t.bodyTemplate,
    })
  }

  const notifs = buildDemoNotifications()
  const rows = notifs.map((n) => ({
    tenantId,
    recipientId: DEMO.recipientId,
    type: n.type,
    channels: n.channels,
    title: n.title,
    body: n.body,
    data: n.data ?? null,
    status: n.read ? ('read' as const) : ('sent' as const),
    readAt: n.read ? hoursAgo(Math.max(0, n.ageHours - 1)) : null,
    createdAt: n.ageHours >= 24 ? daysAgo(Math.floor(n.ageHours / 24)) : hoursAgo(n.ageHours),
  }))
  await dbs.db.insert(notifications).values(rows)

  return { seeded: true }
}
