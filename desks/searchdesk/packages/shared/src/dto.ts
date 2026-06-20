import type { Plan } from './constants'
import type { FacetCount } from './search'

/**
 * 가입 직후에만 반환되는 테넌트 표현 — secretKey 평문은 이때 한 번만 노출된다.
 * (이후 어떤 API 도 secretKey 평문을 돌려주지 않는다. 해시만 저장.)
 */
export interface TenantCredentialsDto {
  id: string
  name: string
  slug: string
  plan: Plan
  publishableKey: string
  /** 평문 secret 키 — 가입/rotate 응답에서만 1회 노출. 저장은 해시. */
  secretKey: string
  corsOrigins: string[]
  createdAt: string
}

/** 일반 테넌트 표현(secret 평문 제외) — 어드민 조회·갱신 응답. */
export interface TenantDto {
  id: string
  name: string
  slug: string
  plan: Plan
  publishableKey: string
  corsOrigins: string[]
  /** 누적 색인 문서 수(소프트 캡 판정). */
  docCount: number
  createdAt: string
}

/** 색인된 문서 표현(어드민 조회·색인 응답). */
export interface DocumentDto {
  id: string
  index: string
  title: string
  body: string
  url: string | null
  category: string | null
  tags: string[]
  attrs: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

/** 색인(upsert) 결과 — 색인된 문서 수 + 현재 누적 문서 수 + 캡 초과 여부. */
export interface IndexResultDto {
  /** 이번 요청으로 upsert 된 문서 수. */
  upserted: number
  /** 테넌트의 현재 누적 문서 수. */
  docCount: number
  /** free 플랜 캡 초과로 일부/전체가 거부되었는가. */
  capExceeded: boolean
}

/** 문서 삭제 결과. */
export interface DeleteResultDto {
  deleted: boolean
  docCount: number
}

/** 검색 단건 결과(랭킹·하이라이트 포함). */
export interface SearchHitDto {
  id: string
  index: string
  title: string
  /** 매치 하이라이트가 적용된 제목(<mark>). */
  titleHighlight: string
  url: string | null
  category: string | null
  tags: string[]
  attrs: Record<string, unknown> | null
  /** 본문 하이라이트 스니펫(<mark>), 없으면 null. */
  snippet: string | null
  /** 비음수 랭킹 점수. */
  score: number
}

/** 검색 응답 — hits + facets + 메타. */
export interface SearchResponseDto {
  query: string
  index: string
  /** 필터 적용 후 매치된 전체 건수(limit 적용 전). */
  total: number
  hits: SearchHitDto[]
  /** 필터 적용 후 후보군 기준 패싯 카운트. */
  facets: { category: FacetCount[]; tags: FacetCount[] }
  limit: number
  /** Postgres 'tsvector' 경로인지 PGlite 'fallback' 경로인지(디버그·검증용). */
  engine: 'postgres' | 'fallback'
}

/** 어드민 문서 목록(페이지네이션). */
export interface DocumentListDto {
  items: DocumentDto[]
  total: number
  offset: number
  limit: number
}

/**
 * 플랫폼 전체(운영자 관점) 현황 — 공개·무인증 `GET /api/stats`.
 * 테넌트별(per-tenant) 사용량(UsageDto)과 달리 단일 테넌트 secret 키에 교차 합계를 노출하지
 * 않도록 분리된 플랫폼 와이드 지표다.
 *  - signups(가입): tenants 테이블 실측 — 총 테넌트 수·오늘 가입 수.
 *  - traffic/visitors(트래픽·방문자): 신규 추적(visits 일별 버킷) — 비어 있다가 실 핑으로 누적.
 *    초기엔 작지만 모두 실측이며 절대 조작하지 않는다.
 */
export interface PlatformStatsDto {
  /** 누적 가입(테넌트) 수 — tenants COUNT(*). */
  totalSignups: number
  /** 오늘(서버 TZ) 가입 수 — created_at >= 오늘 0시. */
  todaySignups: number
  /** 누적 방문(페이지뷰) 수 — visits.total_visits 합. */
  totalTraffic: number
  /** 오늘(서버 TZ) 고유 방문자 수 — 오늘 버킷 unique_visitors. */
  todayVisitors: number
  /** 집계 기준 시각(ISO). */
  asOf: string
}

/** 사용량 요약(어드민). */
export interface UsageDto {
  tenantId: string
  plan: Plan
  /** 누적 색인 문서 수. */
  docCount: number
  /** free 플랜 캡(pro 는 null=무제한). */
  docCap: number | null
  /** 누적 검색 호출 수. */
  searchCount: number
}
