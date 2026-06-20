import { FREE_MESSAGE_CAP } from '@chatdesk/shared'
import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import { messages, tenants } from '../db/schema'
import * as schema from '../db/schema'
import { TenantsService } from '../tenants/tenants.service'

import { ConversationsService, type ChatBroadcaster } from './conversations.service'

import type { Database, DatabaseService } from '../db/database.service'

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const TENANT_B = '22222222-2222-2222-2222-222222222222'

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

async function makeService(): Promise<{
  dbs: DatabaseService
  svc: ConversationsService
  tenants: TenantsService
}> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  // 테스트 테넌트(고정 id)를 미리 심어 사용량/상한 강제를 검증할 수 있게 한다.
  await db.insert(tenants).values([
    {
      id: TENANT_A,
      name: 'A',
      publishableKey: 'pk_a',
      secretKeyHash: 'ha',
      corsOrigins: ['*'],
      plan: 'free',
    },
    {
      id: TENANT_B,
      name: 'B',
      publishableKey: 'pk_b',
      secretKeyHash: 'hb',
      corsOrigins: ['*'],
      plan: 'free',
    },
  ])
  const tenantsSvc = new TenantsService(dbs, cfg())
  return { dbs, svc: new ConversationsService(dbs, tenantsSvc), tenants: tenantsSvc }
}

function spyBroadcaster(): ChatBroadcaster {
  return {
    message: vi.fn().mockReturnValue(2),
    messageDeleted: vi.fn(),
    messageRestored: vi.fn(),
    read: vi.fn(),
  }
}

describe('ConversationsService (PGlite)', () => {
  let svc: ConversationsService
  let dbs: DatabaseService
  let tenantsSvc: TenantsService

  beforeEach(async () => {
    ;({ svc, dbs, tenants: tenantsSvc } = await makeService())
  })

  it('DM dedupe — 같은 멤버쌍으로 두 번 만들면 같은 대화', async () => {
    const a = await svc.create(TENANT_A, { kind: 'dm', memberIds: ['alice', 'bob'] })
    const b = await svc.create(TENANT_A, { kind: 'dm', memberIds: ['bob', 'alice'] })
    expect(a.id).toBe(b.id)
    expect(a.kind).toBe('dm')

    // 다른 테넌트의 같은 쌍은 별개 대화(테넌트 격리)
    const c = await svc.create(TENANT_B, { kind: 'dm', memberIds: ['alice', 'bob'] })
    expect(c.id).not.toBe(a.id)
  })

  it('group 대화는 매번 새로 생성되고 제목/멤버를 보존', async () => {
    const g1 = await svc.create(TENANT_A, {
      kind: 'group',
      title: '팀',
      memberIds: ['a', 'b', 'c'],
    })
    const g2 = await svc.create(TENANT_A, {
      kind: 'group',
      title: '팀',
      memberIds: ['a', 'b', 'c'],
    })
    expect(g1.id).not.toBe(g2.id)
    expect(g1.title).toBe('팀')
    expect(g1.memberIds).toEqual(['a', 'b', 'c'])
  })

  it('발송 — 멤버만 가능, 영속화 + 브로드캐스트 + 발송자 unread 0', async () => {
    const b = spyBroadcaster()
    svc.setBroadcaster(b)
    const conv = await svc.create(TENANT_A, { kind: 'dm', memberIds: ['alice', 'bob'] })

    const { message, delivered } = await svc.send(TENANT_A, conv.id, {
      senderMemberId: 'alice',
      body: '안녕!',
    })
    expect(message.body).toBe('안녕!')
    expect(message.senderMemberId).toBe('alice')
    expect(delivered).toBe(2)
    expect(b.message).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ body: '안녕!' }))

    // 영속화 확인 — bob 의 히스토리에 보임
    const hist = await svc.history(TENANT_A, conv.id, { memberId: 'bob' })
    expect(hist.items).toHaveLength(1)
    expect(hist.items[0]!.body).toBe('안녕!')

    // 발송자(alice)는 자기 메시지를 읽은 것 → unread 0, 수신자(bob)는 unread 1
    const aliceList = await svc.myConversations(TENANT_A, 'alice')
    expect(aliceList.items[0]!.unreadCount).toBe(0)
    const bobList = await svc.myConversations(TENANT_A, 'bob')
    expect(bobList.items[0]!.unreadCount).toBe(1)
    expect(bobList.totalUnread).toBe(1)
  })

  it('멤버십 범위 — 비멤버는 발송·히스토리·읽음 모두 거부(403)', async () => {
    const conv = await svc.create(TENANT_A, { kind: 'dm', memberIds: ['alice', 'bob'] })
    await expect(
      svc.send(TENANT_A, conv.id, { senderMemberId: 'mallory', body: 'hi' })
    ).rejects.toThrow()
    await expect(svc.history(TENANT_A, conv.id, { memberId: 'mallory' })).rejects.toThrow()
    await expect(svc.read(TENANT_A, conv.id, 'mallory')).rejects.toThrow()
  })

  it('읽음 리시트 — 최신까지 읽으면 unread 0, 새 메시지 오면 다시 증가', async () => {
    const b = spyBroadcaster()
    svc.setBroadcaster(b)
    const conv = await svc.create(TENANT_A, { kind: 'group', memberIds: ['alice', 'bob'] })

    await svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: 'm1' })
    await svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: 'm2' })

    // bob 은 2건 unread
    let bobList = await svc.myConversations(TENANT_A, 'bob')
    expect(bobList.items[0]!.unreadCount).toBe(2)

    // bob 이 최신까지 읽음 → unread 0, read 브로드캐스트 발생
    const res = await svc.read(TENANT_A, conv.id, 'bob')
    expect(res.unreadCount).toBe(0)
    expect(b.read).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ memberId: 'bob' }))

    bobList = await svc.myConversations(TENANT_A, 'bob')
    expect(bobList.items[0]!.unreadCount).toBe(0)

    // 새 메시지 → bob unread 1
    await svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: 'm3' })
    bobList = await svc.myConversations(TENANT_A, 'bob')
    expect(bobList.items[0]!.unreadCount).toBe(1)
  })

  it('히스토리 페이지네이션 — before 커서로 더 오래된 페이지', async () => {
    const conv = await svc.create(TENANT_A, { kind: 'group', memberIds: ['alice'] })
    for (let i = 0; i < 5; i += 1) {
      await svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: `m${i}` })
    }
    const page1 = await svc.history(TENANT_A, conv.id, { memberId: 'alice', limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.hasMore).toBe(true)
    // 오래된→최신 순이므로 page1 은 가장 최신 2건의 오름차순
    const firstId = page1.items[0]!.id
    const older = await svc.history(TENANT_A, conv.id, {
      memberId: 'alice',
      before: firstId,
      limit: 2,
    })
    expect(older.items).toHaveLength(2)
    // 더 오래된 메시지 — page1 첫 항목보다 createdAt 이 작아야
    expect(older.items[older.items.length - 1]!.createdAt < page1.items[0]!.createdAt).toBe(true)
  })

  it('시스템 발송 — sender 없는 system 메시지, 브로드캐스트', async () => {
    const b = spyBroadcaster()
    svc.setBroadcaster(b)
    const conv = await svc.create(TENANT_A, { kind: 'group', memberIds: ['alice', 'bob'] })
    const { message } = await svc.systemSend(TENANT_A, conv.id, { body: '공지입니다' })
    expect(message.system).toBe(true)
    expect(message.senderMemberId).toBeNull()
    expect(b.message).toHaveBeenCalled()
  })

  it('모더레이션 — soft delete 후 본문 비고 deleted=true, unread 에서 제외', async () => {
    const b = spyBroadcaster()
    svc.setBroadcaster(b)
    const conv = await svc.create(TENANT_A, { kind: 'group', memberIds: ['alice', 'bob'] })
    const { message } = await svc.send(TENANT_A, conv.id, {
      senderMemberId: 'alice',
      body: '나쁜 말',
    })

    const del = await svc.deleteMessage(TENANT_A, message.id)
    expect(del.deleted).toBe(true)
    expect(b.messageDeleted).toHaveBeenCalledWith(TENANT_A, conv.id, message.id)

    const hist = await svc.history(TENANT_A, conv.id, { memberId: 'bob' })
    expect(hist.items[0]!.deleted).toBe(true)
    expect(hist.items[0]!.body).toBe('')

    // 삭제된 메시지는 unread 에서 제외
    const bobList = await svc.myConversations(TENANT_A, 'bob')
    expect(bobList.items[0]!.unreadCount).toBe(0)
  })

  it('어드민 목록 — 테넌트의 모든 대화(최신순)', async () => {
    await svc.create(TENANT_A, { kind: 'dm', memberIds: ['a', 'b'] })
    await svc.create(TENANT_A, { kind: 'group', title: 'g', memberIds: ['a', 'b'] })
    await svc.create(TENANT_B, { kind: 'dm', memberIds: ['x', 'y'] })
    const list = await svc.listAll(TENANT_A)
    expect(list).toHaveLength(2) // 테넌트 격리
  })

  it('어드민 히스토리 — 멤버십 무관으로 모니터, 삭제 메시지도 deleted=true 로 포함', async () => {
    const conv = await svc.create(TENANT_A, { kind: 'dm', memberIds: ['alice', 'bob'] })
    await svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: '첫 메시지' })
    const second = await svc.send(TENANT_A, conv.id, { senderMemberId: 'bob', body: '두 번째' })
    await svc.deleteMessage(TENANT_A, second.message.id)

    // 운영자(비멤버 mallory 자격이라도)는 adminHistory 로 전체를 본다.
    // 모더레이터 경로(includeDeletedBody)는 삭제 메시지여도 원문을 노출한다(아래 별도 테스트와 일치).
    const hist = await svc.adminHistory(TENANT_A, conv.id, {})
    expect(hist.items).toHaveLength(2)
    expect(hist.items[0]!.body).toBe('첫 메시지')
    expect(hist.items[1]!.deleted).toBe(true)
    expect(hist.items[1]!.body).toBe('두 번째')

    // 다른 테넌트의 대화는 404
    await expect(svc.adminHistory(TENANT_B, conv.id, {})).rejects.toThrow()
  })

  it('발송 — 사용량(usage_messages) 누적 + 시스템 발송도 집계', async () => {
    const conv = await svc.create(TENANT_A, { kind: 'group', memberIds: ['alice', 'bob'] })
    await svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: '1' })
    await svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: '2' })
    await svc.systemSend(TENANT_A, conv.id, { body: '공지' })

    // 대시보드가 읽는 usage.messages 가 실제로 3 으로 증가해야 한다(전엔 항상 0).
    const usage = await tenantsSvc.getUsage(TENANT_A)
    expect(usage.messages).toBe(3)
    // 테넌트 격리 — 다른 테넌트 사용량은 그대로 0.
    expect((await tenantsSvc.getUsage(TENANT_B)).messages).toBe(0)
  })

  it('발송 — 요금제 메시지 상한 초과 시 거부(403)', async () => {
    const conv = await svc.create(TENANT_A, { kind: 'group', memberIds: ['alice'] })
    // 상한 직전까지 사용량을 미리 채운다.
    await dbs.db
      .update(tenants)
      .set({ usageMessages: FREE_MESSAGE_CAP - 1 })
      .where(eq(tenants.id, TENANT_A))

    // 한 건은 통과(상한 도달).
    await svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: 'last' })
    // 다음 건은 상한 초과로 거부 + 메시지가 영속화되지 않아야 한다.
    await expect(
      svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: 'over' })
    ).rejects.toThrow()
    const hist = await svc.history(TENANT_A, conv.id, { memberId: 'alice', limit: 100 })
    expect(hist.items).toHaveLength(1)
  })

  it('동일 created_at 경합 — 커서 페이지네이션이 누락/중복 없이 (created_at, id) 로 안정 정렬', async () => {
    const conv = await svc.create(TENANT_A, { kind: 'group', memberIds: ['alice'] })
    // 5 개 메시지를 모두 같은 created_at 으로 강제(빠른/동시 발송 재현).
    const tie = new Date('2026-01-01T00:00:00.000Z')
    for (let i = 0; i < 5; i += 1) {
      await svc.send(TENANT_A, conv.id, { senderMemberId: 'alice', body: `m${i}` })
    }
    await dbs.db
      .update(messages)
      .set({ createdAt: tie })
      .where(eq(messages.conversationId, conv.id))

    // 2 개씩 페이지네이션하며 모든 id 를 수집 — 누락/중복이 없어야 한다.
    const collected: string[] = []
    let before: string | undefined
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await svc.history(TENANT_A, conv.id, { memberId: 'alice', before, limit: 2 })
      collected.unshift(...page.items.map((m) => m.id))
      if (!page.hasMore || page.items.length === 0) break
      before = page.items[0]!.id
    }
    const unique = new Set(collected)
    expect(unique.size).toBe(5)
    expect(collected).toHaveLength(5)
  })

  it('어드민 히스토리 — 삭제된 메시지의 원문을 모더레이터에게 노출(멤버 경로는 redact 유지)', async () => {
    const conv = await svc.create(TENANT_A, { kind: 'group', memberIds: ['alice', 'bob'] })
    const { message } = await svc.send(TENANT_A, conv.id, {
      senderMemberId: 'alice',
      body: '나쁜 말',
    })
    await svc.deleteMessage(TENANT_A, message.id)

    // 어드민(모더레이터)은 원문을 본다.
    const admin = await svc.adminHistory(TENANT_A, conv.id, {})
    expect(admin.items[0]!.deleted).toBe(true)
    expect(admin.items[0]!.body).toBe('나쁜 말')

    // 멤버(pk) 경로는 여전히 본문이 비워진다(redaction).
    const member = await svc.history(TENANT_A, conv.id, { memberId: 'bob' })
    expect(member.items[0]!.deleted).toBe(true)
    expect(member.items[0]!.body).toBe('')
  })

  it('복원 — soft delete 된 메시지를 되살리고 본문 복구 + WS 통지', async () => {
    const b = spyBroadcaster()
    svc.setBroadcaster(b)
    const conv = await svc.create(TENANT_A, { kind: 'group', memberIds: ['alice', 'bob'] })
    const { message } = await svc.send(TENANT_A, conv.id, {
      senderMemberId: 'alice',
      body: '되돌려',
    })
    await svc.deleteMessage(TENANT_A, message.id)

    const res = await svc.restoreMessage(TENANT_A, message.id)
    expect(res.deleted).toBe(false)
    expect(b.messageRestored).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ id: message.id, deleted: false, body: '되돌려' })
    )

    // 멤버 히스토리에서도 본문이 복구되고 deleted=false.
    const hist = await svc.history(TENANT_A, conv.id, { memberId: 'bob' })
    expect(hist.items[0]!.deleted).toBe(false)
    expect(hist.items[0]!.body).toBe('되돌려')

    // 살아 있는 메시지를 복원 호출하면 멱등(deleted=false) — 통지 추가 없음.
    const again = await svc.restoreMessage(TENANT_A, message.id)
    expect(again.deleted).toBe(false)
  })
})
