import type { Plan } from './constants'

/** 테넌트의 사용량 카운터. */
export interface TenantUsage {
  /** 누적 publish 메시지 수. */
  messages: number
  /** 누적 연결 수(핸드셰이크 성공 기준). */
  connections: number
  /** 요금제 상한. */
  cap: { messages: number; connections: number }
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

/** 단일 메시지 표현(history·publish 결과·WS 페이로드). */
export interface MessageDto {
  id: string
  tenantId: string
  channel: string
  event: string
  data: unknown
  publishedAt: string
}

/** publish 결과 — 전달된 구독자 수 + 영속화된 메시지(영속화 비활성 시 message=null). */
export interface PublishResultDto {
  /** 이 채널로 이벤트를 받은 (소켓) 구독자 수. */
  delivered: number
  /** 영속화된 메시지(REALTIME_HISTORY_LIMIT=0 이면 null). */
  message: MessageDto | null
}

/** 채널 history 응답. */
export interface HistoryDto {
  channel: string
  items: MessageDto[]
}

/** presence 조회 결과 — 채널 참여자 수와 (있으면) 식별자 목록. */
export interface PresenceDto {
  channel: string
  count: number
  /** 참여 소켓/멤버 식별자(연결 시 부여). */
  members: string[]
}

/**
 * 운영 현황 지표(어드민) — 플랫폼 전역 관점.
 *
 * - `signups` 는 tenants 테이블에서 **실집계**(REAL): total=COUNT(*), today=오늘 가입 수.
 * - `traffic` 은 visits 일자 버킷에서 집계되는 **추적 누적**(tracked-new): 추적 시작 이후만
 *   카운트된다. 가짜 숫자를 실데이터로 표기하지 않기 위해 출처를 라벨로 구분한다.
 *
 * 오늘 경계는 서버가 KST(Asia/Seoul) 자정 기준으로 일관 계산한다(클라이언트 시계 불신).
 */
export interface AdminStatsDto {
  /** 가입(real) — tenants.created_at 집계. */
  signups: {
    /** 오늘(KST) 가입한 테넌트 수. */
    today: number
    /** 총 테넌트 수. */
    total: number
  }
  /** 트래픽(tracked-new) — visits 일자 버킷 집계. 추적 시작 이후 누적. */
  traffic: {
    /** 오늘(KST) 고유 방문자 수(세션 첫 방문 기준). */
    todayVisitors: number
    /** 총 고유 방문자 수(추적 이후 누적). */
    totalVisitors: number
    /** 오늘(KST) 총 조회(hit) 수. */
    todayHits: number
    /** 총 조회(hit) 수(추적 이후 누적). */
    totalHits: number
  }
}
