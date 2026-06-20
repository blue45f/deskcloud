import { dmKey, hashSecret, PUBLISHABLE_KEY_PREFIX, SECRET_KEY_PREFIX } from '@chatdesk/shared'
import { eq, sql } from 'drizzle-orm'

import { DatabaseService } from './database.service'
import { conversations, messages, receipts, tenants } from './schema'

/**
 * 데모 테넌트 — self-hosted 첫 부팅 시 시드. 고정 키(pk_demo / sk_demo)로 손쉽게 데모/검증.
 * corsOrigins ['*'] 라 어떤 Origin 에서도 핸드셰이크가 통과한다(데모 전용).
 */
export const DEMO_TENANT = {
  name: 'Demo Tenant',
  publishableKey: `${PUBLISHABLE_KEY_PREFIX}demo`,
  secretKey: `${SECRET_KEY_PREFIX}demo`,
  corsOrigins: ['*'] as string[],
}

/** 데모 멤버 — 호스트 앱의 사용자 id 라고 가정. */
const ALICE = 'alice'
const BOB = 'bob'
const CAROL = 'carol'

/** DM 대화의 샘플 대화(시간순). null sender = 시스템. */
const DM_SCRIPT: { from: string | null; body: string }[] = [
  { from: null, body: 'alice 님과 bob 님의 1:1 대화가 시작되었습니다.' },
  { from: ALICE, body: '안녕 bob! 어제 보낸 자료 확인했어?' },
  { from: BOB, body: '응 방금 봤어. 디자인 깔끔하더라 👍' },
  { from: ALICE, body: '고마워. 피드백 있으면 편하게 말해줘.' },
  { from: BOB, body: '두 번째 화면 여백만 조금 줄이면 완벽할 듯!' },
  { from: ALICE, body: '오케이, 반영해서 다시 공유할게.' },
]

/** 그룹 대화의 샘플 대화(시간순). */
const GROUP_SCRIPT: { from: string | null; body: string }[] = [
  { from: null, body: '“프로젝트 라운지” 그룹이 생성되었습니다.' },
  { from: ALICE, body: '다들 안녕하세요! 여기서 진행 상황 공유해요.' },
  { from: BOB, body: '좋아요. 저는 API 쪽 마무리 중입니다.' },
  { from: CAROL, body: '저는 위젯 UI 작업하고 있어요. 곧 데모 올릴게요.' },
  { from: ALICE, body: '완벽하네요. 금요일 데모 데이 목표로 가시죠 🚀' },
  { from: BOB, body: '👍' },
]

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + DM·그룹 대화 + 메시지/리시트를 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(dbs: DatabaseService, opts: { demo: boolean }): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  const insertedTenant = await dbs.db
    .insert(tenants)
    .values({
      name: DEMO_TENANT.name,
      publishableKey: DEMO_TENANT.publishableKey,
      secretKeyHash: hashSecret(DEMO_TENANT.secretKey),
      corsOrigins: DEMO_TENANT.corsOrigins,
      plan: 'free',
    })
    .returning()
  const tenant = insertedTenant[0]!

  // ── DM 대화(alice ↔ bob) ──────────────────────────────────────────────────
  const dm = (
    await dbs.db
      .insert(conversations)
      .values({
        tenantId: tenant.id,
        kind: 'dm',
        title: null,
        memberIds: [ALICE, BOB],
        dmKey: dmKey([ALICE, BOB]),
      })
      .returning()
  )[0]!

  // ── 그룹 대화(alice, bob, carol) ──────────────────────────────────────────
  const group = (
    await dbs.db
      .insert(conversations)
      .values({
        tenantId: tenant.id,
        kind: 'group',
        title: '프로젝트 라운지',
        memberIds: [ALICE, BOB, CAROL],
        dmKey: null,
      })
      .returning()
  )[0]!

  // 메시지 시간순 삽입(간격 1분). 총 12건(DM 6 + 그룹 6).
  const base = Date.now() - 60 * 60 * 1000 // 1시간 전부터
  let tick = 0
  const insertScript = async (
    conversationId: string,
    script: { from: string | null; body: string }[]
  ): Promise<string | null> => {
    let lastId: string | null = null
    for (const line of script) {
      const createdAt = new Date(base + tick * 60_000)
      tick += 1
      const row = (
        await dbs.db
          .insert(messages)
          .values({
            tenantId: tenant.id,
            conversationId,
            senderMemberId: line.from,
            body: line.body,
            attachments: null,
            system: line.from === null,
          })
          .returning()
      )[0]!
      // createdAt 을 스크립트 시간으로 보정(영속 정렬 안정화).
      await dbs.db.update(messages).set({ createdAt }).where(eq(messages.id, row.id))
      lastId = row.id
    }
    return lastId
  }

  const dmLast = await insertScript(dm.id, DM_SCRIPT)
  const groupLast = await insertScript(group.id, GROUP_SCRIPT)

  // ── 리시트 — alice 는 양쪽 모두 끝까지 읽음(unread 0), bob/carol 은 일부만 읽어 unread 가 보이게.
  const now = new Date()
  // alice: DM·그룹 마지막까지 읽음.
  await dbs.db.insert(receipts).values([
    {
      conversationId: dm.id,
      memberId: ALICE,
      lastReadMessageId: dmLast,
      lastReadAt: now,
      readAt: now,
    },
    {
      conversationId: group.id,
      memberId: ALICE,
      lastReadMessageId: groupLast,
      lastReadAt: now,
      readAt: now,
    },
  ])
  // bob: DM 은 첫 메시지(시스템)까지만 읽음 → DM 에 unread 가 보임. 그룹은 미읽음(리시트 없음).
  const dmFirst = (
    await dbs.db
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.conversationId, dm.id))
      .orderBy(messages.createdAt)
      .limit(1)
  )[0]
  if (dmFirst) {
    await dbs.db.insert(receipts).values({
      conversationId: dm.id,
      memberId: BOB,
      lastReadMessageId: dmFirst.id,
      lastReadAt: dmFirst.createdAt,
      readAt: now,
    })
  }

  return { seeded: true }
}

/** 데모 테넌트가 있는지(테스트·헬스 용). */
export async function hasDemoTenant(dbs: DatabaseService): Promise<boolean> {
  const r = await dbs.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.publishableKey, DEMO_TENANT.publishableKey))
    .limit(1)
  return r.length > 0
}
