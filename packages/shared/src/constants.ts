/** 테넌트 slug — 공개 URL·저장 경로의 테넌트 세그먼트. 소문자/숫자/하이픈, 1~64자. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 키 접두사 — publishable(브라우저 노출 가능) · secret(서버 전용, 해시 저장). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 키 본문(접두사 제외) 길이 — base62url 무작위. */
export const KEY_RANDOM_LEN = 32

/** 플랜 — free(소프트 캡 적용) · pro(캡 없음, 데모용). */
export const PLANS = ['free', 'pro'] as const
export type Plan = (typeof PLANS)[number]

/**
 * 업로드 허용 MIME — 이미지 위주(변환 대상)이되, 일반 파일도 일부 허용.
 * 와일드카드(`image/*`)를 별도로 처리하지 않고 명시 목록으로 통제(보안).
 */
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
] as const
export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number]

/** sharp 변환이 의미 있는(래스터) 이미지 MIME — 이 외에는 항상 원본 서빙. */
export const TRANSFORMABLE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
] as const

/** MIME → 확장자(저장 키 생성·Content-Type 추론에 사용). */
export const MIME_TO_EXT: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
}

/** 확장자 → MIME(서빙 시 Content-Type 보정). */
export const EXT_TO_MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
}

/** 변환 출력 포맷 — query ?format= 으로 지정 가능. */
export const TRANSFORM_FORMATS = ['jpeg', 'png', 'webp', 'avif'] as const
export type TransformFormat = (typeof TRANSFORM_FORMATS)[number]

/** 변환 파라미터 경계 — 과도한 리사이즈/품질 요청 방지. */
export const TRANSFORM_MAX_DIM = 4000
export const TRANSFORM_MIN_DIM = 1
export const TRANSFORM_QUALITY_MIN = 1
export const TRANSFORM_QUALITY_MAX = 100
export const TRANSFORM_QUALITY_DEFAULT = 80

/** 폴더(논리 그룹) — 키 접두 세그먼트. 비우면 루트. */
export const FOLDER_RE = /^[a-z0-9][a-z0-9/_-]{0,127}$/

/** 단일 업로드 기본 한도(바이트, 10MB). 환경변수로 덮어쓸 수 있음. */
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
