import { PLAN_CAPS, type ConversationDto, type MessageDto, type TenantDto } from '@chatdesk/shared'

import type { conversations, messages, tenants } from '../db/schema'

type TenantRow = typeof tenants.$inferSelect
type ConversationRow = typeof conversations.$inferSelect
type MessageRow = typeof messages.$inferSelect

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString()

/** 테넌트 행 → 공개 DTO. secret 키 해시는 절대 포함하지 않는다. */
export function toTenantDto(row: TenantRow): TenantDto {
  const caps = PLAN_CAPS[row.plan]
  return {
    id: row.id,
    name: row.name,
    publishableKey: row.publishableKey,
    corsOrigins: row.corsOrigins,
    plan: row.plan,
    usage: { messages: row.usageMessages, cap: { messages: caps.messages } },
    createdAt: iso(row.createdAt),
  }
}

/** 대화 행 → DTO. */
export function toConversationDto(row: ConversationRow): ConversationDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    kind: row.kind,
    title: row.title ?? null,
    memberIds: row.memberIds,
    createdAt: iso(row.createdAt),
  }
}

/**
 * 메시지 행 → DTO. soft delete 된 메시지는 기본적으로 본문·첨부를 비우고 deleted=true 로
 * 직렬화한다(멤버용 redaction).
 *
 * `includeDeletedBody` 가 true 면(모더레이터 전용 어드민 경로) 삭제된 메시지여도 원문 본문과
 * 첨부를 그대로 노출한다 — 운영자가 무엇이 삭제됐는지 검토할 수 있게 한다. deleted 플래그는
 * 항상 실제 삭제 여부를 반영한다.
 */
export function toMessageDto(row: MessageRow, includeDeletedBody = false): MessageDto {
  const deleted = row.deletedAt != null
  const redact = deleted && !includeDeletedBody
  return {
    id: row.id,
    tenantId: row.tenantId,
    conversationId: row.conversationId,
    senderMemberId: row.senderMemberId ?? null,
    body: redact ? '' : row.body,
    attachments: redact ? [] : (row.attachments ?? []),
    system: row.system,
    deleted,
    createdAt: iso(row.createdAt),
  }
}
