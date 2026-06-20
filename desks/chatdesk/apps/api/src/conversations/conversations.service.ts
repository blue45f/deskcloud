import {
  DEFAULT_MESSAGE_LIMIT,
  dmKey as computeDmKey,
  MAX_MESSAGE_LIMIT,
  type ConversationDto,
  type ConversationListItemDto,
  type CreateConversationInput,
  type DeleteMessageResultDto,
  type MessageDto,
  type MessageHistoryDto,
  type MyConversationsDto,
  type ReadResultDto,
  type SendMessageInput,
  type SystemMessageInput,
} from '@chatdesk/shared'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'

import { toConversationDto, toMessageDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { conversations, messages, receipts } from '../db/schema'
import { TenantsService } from '../tenants/tenants.service'

/**
 * 브로드캐스터 — 게이트웨이가 등록하는 전달 콜백 묶음. 대화 룸 구독자에게 이벤트를 push 한다.
 * 게이트웨이가 없으면(REST-only 테스트) 전달 수 0.
 */
export interface ChatBroadcaster {
  /** 새 메시지 전달. 전달된 소켓 수 반환. */
  message(tenantId: string, message: MessageDto): number
  /** 메시지 삭제(모더레이션) 통지. */
  messageDeleted(tenantId: string, conversationId: string, messageId: string): void
  /** 메시지 복원(모더레이션 취소) 통지 — 복원된 메시지 본문을 다시 노출. */
  messageRestored(tenantId: string, message: MessageDto): void
  /** 읽음 리시트 갱신 통지. */
  read(tenantId: string, payload: ReadResultDto): void
}

type ConversationRow = typeof conversations.$inferSelect
type MessageRow = typeof messages.$inferSelect

@Injectable()
export class ConversationsService {
  private broadcaster: ChatBroadcaster | null = null

  constructor(
    private readonly dbs: DatabaseService,
    private readonly tenants: TenantsService
  ) {}

  /** 게이트웨이가 부팅 시 전달 콜백을 등록한다(순환 의존 회피). */
  setBroadcaster(b: ChatBroadcaster): void {
    this.broadcaster = b
  }

  // ── 대화 생성 ───────────────────────────────────────────────────────────────

  /**
   * 대화 생성. DM 은 정렬된 멤버쌍 dmKey 로 dedupe(이미 있으면 기존 대화 반환).
   * group 은 항상 새 대화. memberIds 는 중복 제거.
   */
  async create(tenantId: string, input: CreateConversationInput): Promise<ConversationDto> {
    const memberIds = [...new Set(input.memberIds)]
    if (memberIds.length === 0) throw new BadRequestException('멤버가 하나 이상 필요합니다')

    if (input.kind === 'dm') {
      if (memberIds.length > 2) throw new BadRequestException('DM 은 최대 2명입니다')
      const key = computeDmKey(memberIds)
      // 기존 DM 이 있으면 재사용(dedupe).
      const existing = await this.dbs.db
        .select()
        .from(conversations)
        .where(and(eq(conversations.tenantId, tenantId), eq(conversations.dmKey, key)))
        .limit(1)
      if (existing[0]) return toConversationDto(existing[0])

      const inserted = await this.dbs.db
        .insert(conversations)
        .values({ tenantId, kind: 'dm', title: input.title ?? null, memberIds, dmKey: key })
        .returning()
      return toConversationDto(inserted[0]!)
    }

    const inserted = await this.dbs.db
      .insert(conversations)
      .values({ tenantId, kind: 'group', title: input.title ?? null, memberIds, dmKey: null })
      .returning()
    return toConversationDto(inserted[0]!)
  }

  // ── 조회 ────────────────────────────────────────────────────────────────────

  /** 테넌트 범위 대화 단건. 없으면 404. */
  async getConversation(tenantId: string, id: string): Promise<ConversationRow> {
    const rows = await this.dbs.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException('대화를 찾을 수 없습니다')
    return rows[0]
  }

  /** 멤버가 대화 멤버인지 강제(아니면 403). */
  private assertMember(conv: ConversationRow, memberId: string): void {
    if (!conv.memberIds.includes(memberId)) {
      throw new ForbiddenException('이 대화의 멤버가 아닙니다')
    }
  }

  /**
   * 내 대화 목록(최신 활동순) + 각 대화의 마지막 메시지·unread.
   * unread = 내 receipt(last_read_at) 이후의 (삭제되지 않은) 메시지 수. receipt 없으면 전부.
   */
  async myConversations(tenantId: string, memberId: string): Promise<MyConversationsDto> {
    // memberIds(jsonb) 안에 memberId 가 포함된 대화. PGlite/pg 공통으로 동작하도록
    // 후보를 가져와 앱에서 필터(테넌트당 대화 수가 데모 규모라 충분).
    const rows = await this.dbs.db
      .select()
      .from(conversations)
      .where(eq(conversations.tenantId, tenantId))
      .orderBy(desc(conversations.createdAt))
    const mine = rows.filter((c) => c.memberIds.includes(memberId))

    const items: ConversationListItemDto[] = []
    let totalUnread = 0
    for (const conv of mine) {
      const last = await this.lastMessage(conv.id)
      const unreadCount = await this.unreadCount(conv.id, memberId)
      totalUnread += unreadCount
      items.push({
        ...toConversationDto(conv),
        lastMessage: last ? toMessageDto(last) : null,
        unreadCount,
      })
    }

    // 마지막 메시지 시각 기준 최신순으로 재정렬(없으면 생성 시각).
    items.sort((a, b) => {
      const at = a.lastMessage?.createdAt ?? a.createdAt
      const bt = b.lastMessage?.createdAt ?? b.createdAt
      return bt.localeCompare(at)
    })

    return { memberId, items, totalUnread }
  }

  /**
   * 대화의 마지막(최신) 살아있는 메시지(삭제 포함 — 미리보기엔 deleted 표기).
   * 동일 created_at 의 경합을 안정적으로 깨기 위해 `(created_at, id)` 내림차순으로 정렬한다.
   */
  private async lastMessage(conversationId: string): Promise<MessageRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(1)
    return rows[0] ?? null
  }

  /**
   * unread 수 — 내 receipt 가 가리키는 마지막 읽은 메시지 이후에 생성된, 삭제되지 않은
   * 메시지 수. receipt 가 없으면 대화의 모든 (삭제 안 된) 메시지가 unread.
   *
   * 동일 created_at 경합 안정화: 단순 `created_at > lastReadAt` 은 같은 tick 에 들어온
   * 메시지를 과소 집계할 수 있으므로 `(created_at, id)` 튜플로 비교한다 —
   * `created_at > lastReadAt OR (created_at = lastReadAt AND id > lastReadMessageId)`.
   */
  private async unreadCount(conversationId: string, memberId: string): Promise<number> {
    const rcpt = await this.dbs.db
      .select({
        lastReadAt: receipts.lastReadAt,
        lastReadMessageId: receipts.lastReadMessageId,
      })
      .from(receipts)
      .where(and(eq(receipts.conversationId, conversationId), eq(receipts.memberId, memberId)))
      .limit(1)
    const lastReadAt = rcpt[0]?.lastReadAt ?? null
    const lastReadMessageId = rcpt[0]?.lastReadMessageId ?? null

    const conds = [eq(messages.conversationId, conversationId), isNull(messages.deletedAt)]
    if (lastReadAt) conds.push(this.afterCursor(lastReadAt, lastReadMessageId))
    const res = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(...conds))
    return Number(res[0]?.c ?? 0)
  }

  /**
   * `(created_at, id)` 튜플이 커서보다 **뒤**(더 새로움)인 메시지 조건.
   * cursorId 가 없으면(레거시 리시트) created_at 단독 비교로 폴백한다.
   */
  private afterCursor(cursorAt: Date, cursorId: string | null) {
    if (!cursorId) return gt(messages.createdAt, cursorAt)
    return or(
      gt(messages.createdAt, cursorAt),
      and(eq(messages.createdAt, cursorAt), gt(messages.id, cursorId))
    )!
  }

  /**
   * `(created_at, id)` 튜플이 커서보다 **앞**(더 오래됨)인 메시지 조건 — before 페이지네이션용.
   */
  private beforeCursor(cursorAt: Date, cursorId: string) {
    return or(
      lt(messages.createdAt, cursorAt),
      and(eq(messages.createdAt, cursorAt), lt(messages.id, cursorId))
    )!
  }

  /**
   * 메시지 히스토리(멤버 범위) — before 커서 이전(더 오래된)부터 limit 개, 오래된→최신 순.
   * 멤버가 아니면 403.
   */
  async history(
    tenantId: string,
    conversationId: string,
    query: { memberId: string; before?: string; limit?: number }
  ): Promise<MessageHistoryDto> {
    const conv = await this.getConversation(tenantId, conversationId)
    this.assertMember(conv, query.memberId)

    const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_MESSAGE_LIMIT), MAX_MESSAGE_LIMIT)

    const conds = [eq(messages.conversationId, conversationId)]
    const cursor = await this.resolveCursor(conversationId, query.before)
    if (cursor) conds.push(this.beforeCursor(cursor.createdAt, cursor.id))

    // 최신순으로 limit+1 개 가져와 hasMore 판단 후, 오래된→최신으로 뒤집어 반환.
    // `(created_at, id)` 로 정렬해 동일 created_at 메시지가 페이지 경계에서 누락/중복되지 않게 한다.
    const rows = await this.dbs.db
      .select()
      .from(messages)
      .where(and(...conds))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const page = rows.slice(0, limit).reverse()
    return { conversationId, items: page.map((r) => toMessageDto(r)), hasMore }
  }

  /**
   * before 커서(메시지 id)를 `(created_at, id)` 튜플로 해석한다. id 가 없거나 그 메시지가
   * 대화에 없으면 null(처음부터).
   */
  private async resolveCursor(
    conversationId: string,
    before: string | undefined
  ): Promise<{ createdAt: Date; id: string } | null> {
    if (!before) return null
    const rows = await this.dbs.db
      .select({ createdAt: messages.createdAt, id: messages.id })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.id, before)))
      .limit(1)
    return rows[0] ?? null
  }

  /**
   * 어드민 메시지 히스토리(테넌트 범위, 멤버십 무관) — 운영자가 대화를 모니터한다.
   * 멤버 범위 history() 와 같은 커서·정렬 규칙(`(created_at, id)`)이지만 assertMember 를
   * 하지 않는다. 삭제된 메시지는 deleted=true 로 직렬화하되, **모더레이터에게는 원문 본문을
   * 그대로 노출**(includeDeletedBody)하여 무엇이 삭제됐는지 검토할 수 있게 한다.
   */
  async adminHistory(
    tenantId: string,
    conversationId: string,
    query: { before?: string; limit?: number }
  ): Promise<MessageHistoryDto> {
    await this.getConversation(tenantId, conversationId)

    const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_MESSAGE_LIMIT), MAX_MESSAGE_LIMIT)

    const conds = [eq(messages.conversationId, conversationId)]
    const cursor = await this.resolveCursor(conversationId, query.before)
    if (cursor) conds.push(this.beforeCursor(cursor.createdAt, cursor.id))

    const rows = await this.dbs.db
      .select()
      .from(messages)
      .where(and(...conds))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const page = rows.slice(0, limit).reverse()
    return { conversationId, items: page.map((r) => toMessageDto(r, true)), hasMore }
  }

  // ── 발송 ────────────────────────────────────────────────────────────────────

  /**
   * 메시지 발송(pk, senderMemberId). 멤버가 아니면 403. 영속화 후 WS 로 브로드캐스트.
   * 발송자는 자신의 메시지를 읽은 것으로 처리(unread 0 유지).
   */
  async send(
    tenantId: string,
    conversationId: string,
    input: SendMessageInput
  ): Promise<{ message: MessageDto; delivered: number }> {
    const conv = await this.getConversation(tenantId, conversationId)
    this.assertMember(conv, input.senderMemberId)

    // 요금제 메시지 사용량 집계 + 상한 강제(영속화 전). 초과 시 발송 거부.
    await this.consumeMessageQuota(tenantId)

    const inserted = await this.dbs.db
      .insert(messages)
      .values({
        tenantId,
        conversationId,
        senderMemberId: input.senderMemberId,
        body: input.body,
        attachments: input.attachments ?? null,
        system: false,
      })
      .returning()
    const row = inserted[0]!
    const dto = toMessageDto(row)

    // 발송자 본인 리시트를 이 메시지까지 올림(자기 메시지는 unread 가 아님).
    await this.upsertReceipt(conversationId, input.senderMemberId, row.id, row.createdAt)

    const delivered = this.broadcaster?.message(tenantId, dto) ?? 0
    return { message: dto, delivered }
  }

  /** 어드민 시스템 발송 — 발신자 없는 시스템 메시지. 영속화 + 브로드캐스트. */
  async systemSend(
    tenantId: string,
    conversationId: string,
    input: SystemMessageInput
  ): Promise<{ message: MessageDto; delivered: number }> {
    await this.getConversation(tenantId, conversationId)

    // 시스템(공지) 발송도 메시지 사용량으로 집계 + 상한 강제. 초과 시 거부.
    await this.consumeMessageQuota(tenantId)

    const inserted = await this.dbs.db
      .insert(messages)
      .values({
        tenantId,
        conversationId,
        senderMemberId: null,
        body: input.body,
        attachments: input.attachments ?? null,
        system: true,
      })
      .returning()
    const dto = toMessageDto(inserted[0]!)
    const delivered = this.broadcaster?.message(tenantId, dto) ?? 0
    return { message: dto, delivered }
  }

  /**
   * 메시지 사용량 +1 + 요금제 상한 강제. 상한 초과 시 ForbiddenException(403) 으로 발송을 막는다.
   * usage_messages 가 증가하므로 대시보드의 '누적 메시지'·'요금제 사용률' 이 실제로 반영된다.
   */
  private async consumeMessageQuota(tenantId: string): Promise<void> {
    const ok = await this.tenants.tryConsumeMessage(tenantId, 1)
    if (!ok) {
      throw new ForbiddenException('요금제 메시지 한도를 초과했습니다. 요금제를 업그레이드하세요.')
    }
  }

  // ── 읽음 리시트 ──────────────────────────────────────────────────────────────

  /**
   * 읽음 리시트 — 멤버가 대화를 어디까지 읽었는지. lastReadMessageId 생략 시 최신까지.
   * 갱신 후 그 멤버의 unread(0 이어야 정상)를 반환하고 WS 로 통지.
   */
  async read(
    tenantId: string,
    conversationId: string,
    memberId: string,
    lastReadMessageId?: string
  ): Promise<ReadResultDto> {
    const conv = await this.getConversation(tenantId, conversationId)
    this.assertMember(conv, memberId)

    // 기준 메시지 결정: 명시 id 또는 대화 최신 메시지.
    let target: MessageRow | null
    if (lastReadMessageId) {
      const rows = await this.dbs.db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.id, lastReadMessageId)))
        .limit(1)
      if (!rows[0]) throw new NotFoundException('지정한 메시지를 찾을 수 없습니다')
      target = rows[0]
    } else {
      target = await this.lastMessage(conversationId)
    }

    const readAt = await this.upsertReceipt(
      conversationId,
      memberId,
      target?.id ?? null,
      target?.createdAt ?? null
    )
    const unreadCount = await this.unreadCount(conversationId, memberId)

    const result: ReadResultDto = {
      conversationId,
      memberId,
      lastReadMessageId: target?.id ?? null,
      readAt: readAt.toISOString(),
      unreadCount,
    }
    this.broadcaster?.read(tenantId, result)
    return result
  }

  /** 리시트 upsert(대화×멤버 PK). lastReadAt 은 unread 비교 기준. 반환: readAt. */
  private async upsertReceipt(
    conversationId: string,
    memberId: string,
    lastReadMessageId: string | null,
    lastReadAt: Date | null
  ): Promise<Date> {
    const readAt = new Date()
    await this.dbs.db
      .insert(receipts)
      .values({ conversationId, memberId, lastReadMessageId, lastReadAt, readAt })
      .onConflictDoUpdate({
        target: [receipts.conversationId, receipts.memberId],
        set: { lastReadMessageId, lastReadAt, readAt },
      })
    return readAt
  }

  // ── 어드민: 목록·모더레이션 ──────────────────────────────────────────────────

  /** 테넌트의 모든 대화(최신순) — 어드민 대시보드용. */
  async listAll(tenantId: string): Promise<ConversationDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(conversations)
      .where(eq(conversations.tenantId, tenantId))
      .orderBy(desc(conversations.createdAt))
    return rows.map(toConversationDto)
  }

  /** 모더레이션 — 메시지 soft delete. 이미 삭제됐으면 그대로 멱등 반환. WS 통지. */
  async deleteMessage(tenantId: string, messageId: string): Promise<DeleteMessageResultDto> {
    const rows = await this.dbs.db
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.id, messageId)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException('메시지를 찾을 수 없습니다')
    if (row.deletedAt) return { id: row.id, deleted: true }

    await this.dbs.db
      .update(messages)
      .set({ deletedAt: new Date() })
      .where(eq(messages.id, messageId))

    this.broadcaster?.messageDeleted(tenantId, row.conversationId, row.id)
    return { id: row.id, deleted: true }
  }

  /**
   * 모더레이션 취소 — soft delete 된 메시지를 복원(deletedAt = null). deleteMessage 의 역연산.
   * 이미 살아 있으면 그대로 멱등 반환. 복원된 메시지를 본문과 함께 WS 로 다시 통지하여
   * 구독자가 원문을 복구하게 한다.
   */
  async restoreMessage(tenantId: string, messageId: string): Promise<DeleteMessageResultDto> {
    const rows = await this.dbs.db
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.id, messageId)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException('메시지를 찾을 수 없습니다')
    if (!row.deletedAt) return { id: row.id, deleted: false }

    const updated = await this.dbs.db
      .update(messages)
      .set({ deletedAt: null })
      .where(eq(messages.id, messageId))
      .returning()
    const restored = updated[0] ?? { ...row, deletedAt: null }

    this.broadcaster?.messageRestored(tenantId, toMessageDto(restored))
    return { id: row.id, deleted: false }
  }
}
