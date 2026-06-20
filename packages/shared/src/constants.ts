/** 파일 가시성 — public(누구나 URL 로 접근) · private(sk_ 또는 서명 토큰 필요). */
export const VISIBILITIES = ['public', 'private'] as const
export type Visibility = (typeof VISIBILITIES)[number]

/** 스토리지 드라이버 — postgres(bytea, v1 기본) · s3(프로덕션 스왑). */
export const STORAGE_DRIVERS = ['postgres', 's3'] as const
export type StorageDriver = (typeof STORAGE_DRIVERS)[number]

/** 요금제 — free 는 누적 파일 수 소프트 캡 적용, pro 는 무제한. */
export const PLANS = ['free', 'pro'] as const
export type Plan = (typeof PLANS)[number]

/** 사용량 메트릭 — 파일 개수 · 총 저장 바이트. */
export const USAGE_METRICS = ['files', 'storage_bytes'] as const
export type UsageMetric = (typeof USAGE_METRICS)[number]

/** 무료 플랜 기본 파일 수 소프트 캡(env FREE_PLAN_FILE_CAP 로 override). */
export const DEFAULT_FREE_PLAN_FILE_CAP = 100

/** 업로드 최대 바이트(어댑터 공통 안전 한도). 기본 5MB. env MAX_FILE_BYTES 로 override. */
export const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024

/** 절대 상한 — env 로도 이 이상은 허용하지 않는다(bytea 인라인 저장 보호). */
export const HARD_MAX_FILE_BYTES = 25 * 1024 * 1024

/**
 * 허용 MIME 타입 화이트리스트(접두사 매칭 포함). 이미지·문서·텍스트·압축의 일반 형식.
 * `image/*` 처럼 슬래시-스타 패턴은 접두사 매칭으로 처리한다(isAllowedContentType).
 */
export const ALLOWED_CONTENT_TYPES: readonly string[] = [
  'image/*',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]

/** 테넌트 slug — 소문자/숫자/하이픈, 1~64자. URL·식별자로 사용. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 파일 객체 key — 불투명 식별자(서빙 URL 의 경로). 영숫자·._- 허용, 1~128자. */
export const FILE_KEY_RE = /^[A-Za-z0-9._-]+$/

/** 키 접두사 — publishable(브라우저 노출 가능) · secret(서버 전용, 해시 저장). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 키 본문(접두사 뒤) 길이 — base62 무작위. */
export const KEY_BODY_LENGTH = 32

/** 파일 객체 key 본문 길이 — base62 무작위. */
export const FILE_KEY_LENGTH = 24

/** 파일명 최대 길이(저장 안전 한도). */
export const FILENAME_MAX = 255

/** MIME 타입 문자열 최대 길이. */
export const CONTENT_TYPE_MAX = 255

/** 서명 토큰 기본 만료(초) — private 파일 한시 접근. */
export const DEFAULT_SIGNED_URL_TTL_SEC = 300
