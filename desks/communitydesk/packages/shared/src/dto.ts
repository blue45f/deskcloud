import type { BoardKind, ContentStatus, Plan, ReactionKind } from './constants'

/** 반응 집계 — kind 별 카운트(예: { like: 3, love: 1 }). */
export type ReactionCounts = Partial<Record<ReactionKind, number>>

/** 테넌트 가입 응답 — secret 키는 이 응답에서 **단 한 번만** 평문 노출된다. */
export interface TenantCreatedDto {
  tenant: TenantDto
  /** 브라우저 안전(읽기 + 멤버 글/댓글/반응). */
  publishableKey: string
  /** 서버 전용(검수·CRUD·운영). 이 응답 이후로는 다시 볼 수 없다(해시만 저장). */
  secretKey: string
}

/** 테넌트 공개 표현(secret 해시는 절대 노출하지 않음). */
export interface TenantDto {
  id: string
  name: string
  slug: string
  publishableKey: string
  corsOrigins: string[]
  plan: Plan
  /** 누적 글 작성 수(무료 플랜 소프트 한도 검사용). */
  postsCount: number
  /** 누적 글 읽기 수. */
  readsCount: number
  createdAt: string
}

/** 게시판·카페. */
export interface BoardDto {
  id: string
  slug: string
  name: string
  description: string | null
  kind: BoardKind
  /** 노출(visible) 글 수. */
  postCount: number
  createdAt: string
}

/** 공개 글 목록 항목(요약 — 본문 HTML 미포함, 미리보기만). */
export interface PostSummaryDto {
  id: string
  boardSlug: string
  authorName: string
  title: string | null
  /** 일반 텍스트 미리보기(마크업 제거). */
  excerpt: string
  tags: string[]
  pinned: boolean
  locked: boolean
  reactions: ReactionCounts
  replyCount: number
  createdAt: string
}

/** 공개 글 상세(살균 HTML 본문 + 댓글 트리). */
export interface PostDetailDto {
  id: string
  boardSlug: string
  authorMemberId: string
  authorName: string
  title: string | null
  /** 서버에서 살균된 HTML. */
  bodyHtml: string
  /** 마크다운 원문(편집/재렌더용). */
  body: string
  tags: string[]
  pinned: boolean
  locked: boolean
  reactions: ReactionCounts
  replyCount: number
  createdAt: string
  comments: CommentNodeDto[]
}

/** 공개 댓글(트리 노드). */
export interface CommentNodeDto {
  id: string
  parentId: string | null
  authorName: string
  /** 서버에서 살균된 HTML. */
  bodyHtml: string
  reactions: ReactionCounts
  depth: number
  createdAt: string
  children: CommentNodeDto[]
}

/** 공개 글 목록(페이지네이션). */
export interface PostListDto {
  boardSlug: string
  items: PostSummaryDto[]
  total: number
  offset: number
  limit: number
}

/** 글 작성/댓글 작성 영수증. */
export interface PostReceiptDto {
  id: string
  status: ContentStatus
  createdAt: string
}

/** 반응 토글 결과 — 토글 후 상태와 갱신된 집계. */
export interface ReactionToggleDto {
  /** true 면 방금 추가, false 면 해제. */
  active: boolean
  reactions: ReactionCounts
}

// ── 어드민 DTO(전체 필드) ─────────────────────────────────────────────────────

/** 어드민 글(전체 필드 — authorMemberId·status 포함). */
export interface AdminPostDto {
  id: string
  tenantId: string
  boardId: string
  boardSlug: string
  authorMemberId: string
  authorName: string
  title: string | null
  body: string
  bodyHtml: string
  tags: string[]
  pinned: boolean
  locked: boolean
  status: ContentStatus
  reactions: ReactionCounts
  replyCount: number
  createdAt: string
}

/** 어드민 글 목록(페이지네이션). */
export interface AdminPostListDto {
  items: AdminPostDto[]
  total: number
  offset: number
  limit: number
}

// ── 트래픽/분석 대시보드 ──────────────────────────────────────────────────────

/**
 * 운영 대시보드 지표 — 테넌트 스코프(자기 테넌트만). 정직성 원칙:
 * - `totalTraffic`·멤버 수·글 수는 기존 컬럼/행에서 집계한 **실데이터**.
 * - `todayVisitors`·`todayTraffic` 는 이번 릴리스부터 추적되는 일별 버킷에서 파생되어,
 *   배포 이전 날짜는 정당하게 0 (백필하지 않음 — `trackedSince` 로 시작일 안내).
 * 멤버 = 글/댓글을 작성한 고유 author_member_id (별도 회원 테이블 없음).
 */
export interface AdminStatsDto {
  /** 오늘 고유 방문자 수(daily_visits.unique_visitors, tracked-new). */
  todayVisitors: number
  /** 오늘 트래픽(daily_visits.visits, tracked-new). */
  todayTraffic: number
  /** 누적 트래픽 = tenants.readsCount(누적 읽기, real). */
  totalTraffic: number
  /** 오늘 신규 가입(멤버) — 첫 작성이 오늘인 고유 멤버 수(real). */
  todayNewMembers: number
  /** 총 가입(멤버) — 글/댓글을 쓴 고유 멤버 수(real). */
  totalMembers: number
  /** 오늘 작성된 글 수(real). */
  todayPosts: number
  /** 누적 글 작성 수(tenants.postsCount, real). */
  totalPosts: number
  /** 일별 방문 추적 시작일(YYYY-MM-DD). 이 날짜 이전은 데이터 없음(0). */
  trackedSince: string | null
  /**
   * 플랫폼 전역 지표 — 글로벌 ADMIN_TOKEN 으로 인증한 셀프호스트 운영자에게만 노출.
   * 테넌트 운영자(x-sk)에게는 undefined (라벨 정직성 유지).
   */
  platform?: PlatformStatsDto
}

/** 플랫폼 전역 지표(셀프호스트 운영자 전용) — 테넌트(고객) 단위 집계. */
export interface PlatformStatsDto {
  /** 총 가입 테넌트 수 = COUNT(*) FROM tenants(real). */
  totalTenants: number
  /** 오늘 가입한 테넌트 수 — created_at 이 오늘(real). */
  todayNewTenants: number
}
