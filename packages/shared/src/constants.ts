/** 캠페인 상태 — active(서빙 대상) | paused(서빙 제외). */
export const CAMPAIGN_STATUSES = ['active', 'paused'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

/** 요금제 — free 는 서빙(ad_serves) 소프트 한도가 적용된다. */
export const PLANS = ['free', 'pro', 'scale'] as const
export type Plan = (typeof PLANS)[number]

/**
 * 무료 플랜 기본 소프트 한도(누적 광고 서빙 수, ad_serves).
 * 초과 시 공개 서빙(GET /api/ads/serve)이 402 로 거절된다. env(FREE_PLAN_LIMIT)로 덮어쓸 수 있음.
 */
export const FREE_PLAN_LIMIT = 50_000

/** 슬롯 key — 지면 식별자(예: 'sidebar', 'feed'). 소문자·숫자·하이픈, 1~64자. */
export const SLOT_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 테넌트 slug — 소문자·숫자·하이픈, 1~64자. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 발급 키 접두사 — publishable(브라우저 안전) / secret(서버 전용). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 크리에이티브 가중치 — 가중 랜덤 선택의 상대 비중. 정수 1~1000. */
export const WEIGHT_MIN = 1
export const WEIGHT_MAX = 1000
export const WEIGHT_DEFAULT = 1

/** 이름/대체텍스트/슬롯 라벨 길이 한도. */
export const CAMPAIGN_NAME_MAX = 120
export const CREATIVE_ALT_MAX = 200
export const SLOT_LABEL_MAX = 120

/**
 * 슬롯 표준 사이즈(IAB 류) — 슬롯이 명시하는 권장 배너 크기 목록.
 * 자유 입력도 허용하지만(WxH), UI 셀렉트/검증 힌트에 사용한다.
 */
export const STANDARD_SIZES = [
  '300x250', // medium rectangle
  '728x90', // leaderboard
  '160x600', // wide skyscraper
  '300x600', // half page
  '320x50', // mobile banner
  '970x250', // billboard
] as const

/** 배너 사이즈 형식 — "<width>x<height>" (px). 1~4096. */
export const SIZE_RE = /^([1-9]\d{0,3})x([1-9]\d{0,3})$/
export const SIZE_DIMENSION_MAX = 4096

/**
 * 크리에이티브 이미지 업로드 제약(어드민 업로드/검증용).
 * 위젯은 imageUrl(원격 호스팅)을 렌더하지만, 어드민이 이미지를 직접 검증/업로드하는 경우의
 * 안전 한도를 공유 상수로 둔다(파일 크기/타입 검증 — shared 의 순수 유틸이 사용).
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MiB
export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]
