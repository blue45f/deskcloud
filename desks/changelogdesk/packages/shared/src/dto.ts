import type { EntryTag, Plan } from './constants'

/**
 * 어드민에 노출되는 테넌트 표현(서버 직렬화). 시크릿 키 원문은 절대 포함하지 않는다
 * (발급/회전 시점에만 1회 노출 — TenantWithKeysDto).
 */
export interface TenantDto {
  id: string
  name: string
  slug: string
  publishableKey: string
  corsOrigins: string[]
  plan: Plan
  usageCount: number
  /** free 플랜 월간 소프트 한도(usageCount 가 넘으면 overLimit). */
  monthlyLimit: number
  overLimit: boolean
  createdAt: string
}

/**
 * 가입·키 회전 응답 — 시크릿 키 원문을 단 한 번만 돌려준다(이후 해시만 저장).
 * publishableKey 는 항상 조회 가능하지만 secretKey 는 여기서만 볼 수 있다.
 */
export interface TenantWithKeysDto {
  tenant: TenantDto
  publishableKey: string
  /** 평문 시크릿 키 — 이 응답에서만 노출. 분실 시 rotate-keys 로 재발급. */
  secretKey: string
}

/** 공개 위젯·어드민에 노출되는 체인지로그 항목. */
export interface ChangelogEntryDto {
  id: string
  tenantId: string
  title: string
  bodyMarkdown: string
  /** 위젯이 바로 렌더할 수 있는 새니타이즈된 HTML(서버 변환). */
  bodyHtml: string
  tag: EntryTag
  version: string | null
  category: string | null
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
}

/** 공개 위젯 목록 응답 — 게시된 항목만(최신순). */
export interface PublicChangelogDto {
  tenant: { name: string; slug: string }
  items: ChangelogEntryDto[]
  /** 같은 필터의 전체 게시 항목 수. */
  total: number
}

/** 어드민 항목 목록(게시·미게시 모두). */
export interface AdminEntryListDto {
  items: ChangelogEntryDto[]
  total: number
}

/** 미읽음 카운트 응답 — 위젯 배지용. */
export interface UnreadCountDto {
  /** anonId 가 마지막으로 본 이후 게시된 항목 수. */
  unreadCount: number
  /** 현재 최신 게시 항목 id(위젯이 다음 seen 으로 기록할 값). */
  latestEntryId: string | null
}

/** 단순 영수증/확인 응답. */
export interface OkDto {
  ok: true
}
