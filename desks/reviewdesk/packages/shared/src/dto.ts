import type { ReviewAggregate } from './aggregate'
import type { Plan, ReviewStatus } from './constants'
import type { ReviewMeta } from './schemas'

/** 테넌트 가입 응답 — secret 키는 이 응답에서 **단 한 번만** 평문 노출된다. */
export interface TenantCreatedDto {
  tenant: TenantDto
  /** 브라우저 안전(제출 + 승인본 읽기). */
  publishableKey: string
  /** 서버 전용(검수·CRUD). 이 응답 이후로는 다시 볼 수 없다(해시만 저장). */
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
  autoApprove: boolean
  usageCount: number
  createdAt: string
}

/** 공개(위젯)에 노출되는 리뷰 — authorEmail·meta 등 비공개 필드 제외. */
export interface PublicReviewDto {
  id: string
  subjectId: string
  subjectLabel: string | null
  rating: number
  title: string | null
  body: string
  authorName: string
  featured: boolean
  /** 운영자 답글(있으면). */
  reply: string | null
  createdAt: string
}

/** 공개 리뷰 목록 + 집계(표시 위젯용). */
export interface PublicReviewsDto {
  subjectId: string
  items: PublicReviewDto[]
  aggregate: ReviewAggregate
}

/** 후기 월(wall) — 승인+추천 리뷰 모음. */
export interface ReviewWallDto {
  items: PublicReviewDto[]
}

/** 리뷰 제출 영수증 — 제출자에게 돌려주는 최소 정보. */
export interface ReviewReceiptDto {
  id: string
  subjectId: string
  status: ReviewStatus
  createdAt: string
}

/** 어드민 리뷰(전체 필드 — authorEmail·meta 포함). */
export interface AdminReviewDto {
  id: string
  tenantId: string
  subjectId: string
  subjectLabel: string | null
  rating: number
  title: string | null
  body: string
  authorName: string
  authorEmail: string | null
  status: ReviewStatus
  featured: boolean
  reply: string | null
  source: string | null
  meta: ReviewMeta | null
  createdAt: string
}

/** 어드민 리뷰 목록(페이지네이션). */
export interface AdminReviewListDto {
  items: AdminReviewDto[]
  /** 같은 필터의 전체 건수(X-Total-Count 헤더와 동일 값). */
  total: number
  offset: number
  limit: number
}
