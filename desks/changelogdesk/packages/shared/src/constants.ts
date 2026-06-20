/** 체인지로그 항목 태그 — 위젯 배지 색·필터·아이콘의 기준. */
export const ENTRY_TAGS = [
  'new', // 신규 기능
  'improved', // 개선
  'fixed', // 버그 수정
  'announcement', // 공지
] as const
export type EntryTag = (typeof ENTRY_TAGS)[number]

/** 테넌트 요금제. free 는 월간 소프트 한도가 걸린다. */
export const PLANS = ['free', 'pro'] as const
export type Plan = (typeof PLANS)[number]

/** 키 프리픽스 — 퍼블리시(브라우저 노출 안전) vs 시크릿(서버/어드민 전용). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 키 본문(프리픽스 제외) 길이 — base62 무작위. */
export const KEY_BODY_LENGTH = 32

/** 테넌트 slug — 소문자/숫자/하이픈, 1~64자(공개 URL·식별자). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 익명 식별자(미읽음 배지용) — 위젯이 생성·저장하는 디바이스 로컬 ID. */
export const ANON_ID_MAX = 128

/** 본문 마크다운 최대 길이. */
export const BODY_MAX = 20_000

/** 제목 최대 길이. */
export const TITLE_MAX = 200

/** 버전 라벨 최대 길이(예: "2.1.0", "2026.06"). */
export const VERSION_MAX = 40

/** 카테고리(선택) 최대 길이. */
export const CATEGORY_MAX = 80

/** 공개 위젯 목록 기본/최대 페이지 크기. */
export const DEFAULT_ENTRY_LIMIT = 20
export const MAX_ENTRY_LIMIT = 100

/** free 플랜 월간 공개 호출 소프트 한도 기본값(.env FREE_PLAN_MONTHLY_LIMIT 로 덮어씀). */
export const DEFAULT_FREE_MONTHLY_LIMIT = 10_000

/** corsOrigins 에 이 값이 있으면 모든 Origin 허용(로컬·데모 전용 — 운영 비권장). */
export const WILDCARD_ORIGIN = '*'
