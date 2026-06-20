import type { CampaignStatus, Plan } from './constants'
import type { CampaignStat, StatsTotals } from './serve'

/** 테넌트 가입 응답 — secret 키는 이 응답에서 **단 한 번만** 평문 노출된다. */
export interface TenantCreatedDto {
  tenant: TenantDto
  /** 브라우저 안전(서빙 + 노출/클릭 추적). */
  publishableKey: string
  /** 서버 전용(캠페인·크리에이티브·슬롯 CRUD·통계). 이 응답 이후로는 다시 볼 수 없다(해시만 저장). */
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
  /** 누적 광고 서빙 수(무료 플랜 소프트 한도 검사용). */
  usageCount: number
  createdAt: string
}

/** 어드민 캠페인 표현. */
export interface CampaignDto {
  id: string
  tenantId: string
  name: string
  status: CampaignStatus
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}

/** 어드민 크리에이티브 표현(전체 필드). */
export interface CreativeDto {
  id: string
  tenantId: string
  campaignId: string
  slotKey: string
  imageUrl: string
  linkUrl: string
  alt: string
  weight: number
  /** 누적 노출/클릭(이 크리에이티브). */
  impressions: number
  clicks: number
  createdAt: string
  updatedAt: string
}

/** 어드민 슬롯 표현. */
export interface SlotDto {
  id: string
  tenantId: string
  key: string
  label: string | null
  sizes: string[]
  createdAt: string
  updatedAt: string
}

/**
 * 공개 서빙 응답 — 위젯이 렌더할 최소 정보.
 * 적합한 활성 크리에이티브가 없으면 served:false(위젯은 아무것도 그리지 않는다).
 */
export interface ServeDto {
  served: boolean
  creativeId: string | null
  imageUrl: string | null
  linkUrl: string | null
  alt: string | null
  /** 권장 렌더 사이즈(슬롯의 첫 사이즈, 있으면). 위젯 레이아웃 안정화용. */
  size: string | null
}

/** 노출/클릭 추적 영수증. */
export interface TrackReceiptDto {
  ok: true
  /** 갱신된 누적 값(노출 또는 클릭). */
  count: number
}

/**
 * 어드민 이미지 업로드 결과 — AdDesk 가 호스팅하는 절대 https URL.
 * 이 url 을 그대로 크리에이티브의 imageUrl 로 쓰면 위젯이 바로 로드한다.
 */
export interface UploadResultDto {
  id: string
  /** AdDesk 가 호스팅하는 절대 URL(GET /api/ads/uploads/:id). */
  url: string
  contentType: string
  /** 디코딩된 이미지 바이트 수. */
  bytes: number
}

/** 어드민 통계 — 캠페인별 노출/클릭/CTR + 합계. */
export interface StatsDto {
  campaigns: CampaignStat[]
  totals: StatsTotals
}
