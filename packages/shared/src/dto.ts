import type { ConversationKind, Plan } from './constants'
import type { Attachment } from './schemas'

/** 테넌트의 사용량 카운터. */
export interface TenantUsage {
  /** 누적 발송 메시지 수. */
  messages: number
  /** 요금제 상한. */
  cap: { messages: number }
}

/**
 * 테넌트 트래픽/가입 분석(어드민 대시보드 상단 패널). 모두 req.tenant 범위로 집계한다.
 *
 * 정직성 규약:
 * - signups(가입)는 실측 — 이 테넌트에서 처음 등장한 distinct 멤버(대화 member_ids 의 first-seen)
 *   를 DB created_at 으로 집계한다(today = 오늘 처음 등장, total = 전체).
 * - traffic(방문)은 신규 추적 — 공개 ping(POST /tenants/:pk/visit)이 일별 버킷에 누적한 값.
 *   위젯을 임베드하기 전에는 0 이며, 이는 버그가 아니라 "아직 트래픽 없음"을 정직하게 뜻한다.
 *   절대 가짜 기준값을 만들지 않는다.
 */
export interface TenantAnalyticsDto {
  /** 오늘 방문자 수(고유) — tenant_visit_uniques 의 오늘 day 행 수. 추적값(위젯 임베드 후 집계). */
  todayVisitors: number
  /** 총 트래픽(누적 pageview) — tenant_visits.pageviews 합. 추적값. */
  totalTraffic: number
  /** 오늘 신규 가입자 수 — 오늘 처음 등장한 distinct 멤버. 실측(DB created_at). */
  todaySignups: number
  /** 총 가입 수 — 이 테넌트에서 등장한 distinct 멤버 수. 실측. */
  totalSignups: number
}

/** 공개 방문 ping 결과 — 집계 후 오늘 버킷의 누적값(fire-and-forget 라 보통 무시해도 됨). */
export interface VisitPingResultDto {
  /** 오늘(서버 TZ) 고유 방문자 수. */
  todayVisitors: number
  /** 오늘 누적 pageview. */
  todayPageviews: number
}

/**
 * 테넌트 공개 표현(어드민 대시보드·가입 응답) — secret 키 해시는 절대 노출하지 않는다.
 * publishableKey 는 평문 노출(브라우저용). createdAt 은 ISO.
 */
export interface TenantDto {
  id: string
  name: string
  publishableKey: string
  corsOrigins: string[]
  plan: Plan
  usage: TenantUsage
  createdAt: string
}

/**
 * 가입/키 회전 응답 — TenantDto 에 더해 **secret 키 평문을 1회만** 포함한다.
 * 이후에는 어디에서도 평문 sk 를 돌려주지 않는다(해시만 저장).
 */
export interface TenantWithSecretDto extends TenantDto {
  /** 평문 secret 키. 가입/회전 응답에서만 노출 — 안전하게 보관할 것. */
  secretKey: string
}

/** 단일 메시지 표현(히스토리·발송 결과·WS 페이로드). 삭제 시 body 는 비고 deleted=true. */
export interface MessageDto {
  id: string
  tenantId: string
  conversationId: string
  /** 보낸 멤버. 시스템 메시지는 null. */
  senderMemberId: string | null
  body: string
  attachments: Attachment[]
  /** 시스템 메시지(공지·자동화) 여부. */
  system: boolean
  /** 모더레이션으로 삭제된 메시지면 true(soft delete). */
  deleted: boolean
  createdAt: string
}

/** 대화 표현. */
export interface ConversationDto {
  id: string
  tenantId: string
  kind: ConversationKind
  title: string | null
  memberIds: string[]
  createdAt: string
}

/** 대화 목록 항목 — 대화 + 미리보기(마지막 메시지) + 내 unread. */
export interface ConversationListItemDto extends ConversationDto {
  /** 마지막 메시지(없으면 null). */
  lastMessage: MessageDto | null
  /** 요청 멤버 기준 안 읽은 메시지 수. */
  unreadCount: number
}

/** 내 대화 목록 응답. */
export interface MyConversationsDto {
  memberId: string
  items: ConversationListItemDto[]
  /** 모든 대화 unread 합. */
  totalUnread: number
}

/** 메시지 히스토리 응답(오래된→최신). */
export interface MessageHistoryDto {
  conversationId: string
  items: MessageDto[]
  /** 더 이전 페이지가 있는지(다음 before 커서로 items[0].id 사용). */
  hasMore: boolean
}

/** 발송 결과 — 영속화된 메시지 + 전달된 (소켓) 구독자 수. */
export interface SendResultDto {
  message: MessageDto
  /** 이 대화 룸으로 메시지를 받은 소켓 수. */
  delivered: number
}

/** 읽음 리시트 결과 — 갱신 후 내 unread. */
export interface ReadResultDto {
  conversationId: string
  memberId: string
  lastReadMessageId: string | null
  readAt: string
  unreadCount: number
}

/** 멤버 토큰 발급 결과. */
export interface MemberTokenDto {
  memberId: string
  token: string
  /** 만료(ISO). */
  expiresAt: string
}

/** presence 조회 결과 — 대화 온라인 멤버 수와 식별자 목록. */
export interface PresenceDto {
  conversationId: string
  count: number
  members: string[]
}

/** 모더레이션(삭제) 결과. */
export interface DeleteMessageResultDto {
  id: string
  deleted: boolean
}
