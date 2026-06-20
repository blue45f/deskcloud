import {
  EXT_TO_MIME,
  FOLDER_RE,
  MIME_TO_EXT,
  PUBLISHABLE_KEY_PREFIX,
  SECRET_KEY_PREFIX,
  SLUG_RE,
  TRANSFORMABLE_MIME_TYPES,
} from './constants'

/**
 * 순수(부수효과 없는) 키·경로·MIME 유틸 모음.
 *
 * 모든 함수는 결정적이며 파일시스템/DB/네트워크에 의존하지 않습니다 — api·web·sdk 가 공유하고
 * 단위 테스트가 쉽도록 격리했습니다. 무작위성이 필요한 곳은 주입(generator)으로 받습니다.
 */

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** 무작위 바이트 → base62 문자열. crypto 의존을 피하려 바이트 배열을 주입받습니다. */
export function bytesToBase62(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += BASE62[b % 62]
  return out
}

/** publishable 키 형식: `pk_<base62>`. */
export function formatPublishableKey(random: string): string {
  return `${PUBLISHABLE_KEY_PREFIX}${random}`
}

/** secret 키 형식: `sk_<base62>`. */
export function formatSecretKey(random: string): string {
  return `${SECRET_KEY_PREFIX}${random}`
}

export function isPublishableKey(value: string): boolean {
  return value.startsWith(PUBLISHABLE_KEY_PREFIX) && value.length > PUBLISHABLE_KEY_PREFIX.length
}

export function isSecretKey(value: string): boolean {
  return value.startsWith(SECRET_KEY_PREFIX) && value.length > SECRET_KEY_PREFIX.length
}

/** slug 유효성(공개 URL·저장 경로의 테넌트 세그먼트). */
export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 64 && SLUG_RE.test(slug)
}

/** 임의 이름 → slug(소문자화·비허용문자 하이픈화·중복 하이픈 축약·양끝 트림). */
export function slugify(input: string): string {
  const s = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64)
    .replace(/-+$/g, '')
  return s
}

/** MIME → 확장자(미지정 시 'bin'). */
export function extForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin'
}

/** 확장자 → MIME(미지정 시 'application/octet-stream'). 키 서빙 시 Content-Type 추론. */
export function mimeForExt(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? 'application/octet-stream'
}

/** 경로/파일명에서 확장자(소문자, 점 제외)만. 없으면 ''. */
export function extOf(pathOrName: string): string {
  const base = pathOrName.split('/').pop() ?? pathOrName
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

/** 래스터 이미지(변환 가능) MIME 인가. */
export function isTransformableMime(mime: string): boolean {
  return (TRANSFORMABLE_MIME_TYPES as readonly string[]).includes(mime)
}

/** 폴더 정규화 — 양끝 슬래시 제거·소문자화. 빈/'/' 는 undefined(루트). */
export function normalizeFolder(folder?: string | null): string | undefined {
  if (!folder) return undefined
  const f = folder
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
  return f.length > 0 ? f : undefined
}

export function isValidFolder(folder: string): boolean {
  return FOLDER_RE.test(folder)
}

/**
 * 파일명 → 안전한 base 세그먼트(경로 순회/숨김파일/특수문자 차단).
 * 확장자는 별도 처리하므로 여기서는 base 만 정제합니다.
 */
export function sanitizeFilename(filename: string): string {
  const base = (filename.split(/[/\\]/).pop() ?? filename).trim()
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const safe = stem
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
  return safe.length > 0 ? safe : 'file'
}

/**
 * 저장 키(테넌트 내부 상대 경로) 생성.
 *   [<folder>/]<random>-<safeName>.<ext>
 * - random: 충돌 회피용 무작위 세그먼트(주입; 빈 문자열이면 생략).
 * - mime 으로 확장자를 정하되, 원본 파일명에 확장자가 있으면 우선 신뢰하지 않고 mime 기준.
 */
export function buildAssetKey(opts: {
  filename: string
  mime: string
  random?: string
  folder?: string | null
}): string {
  const safe = sanitizeFilename(opts.filename)
  const ext = extForMime(opts.mime)
  const rand = opts.random ? `${opts.random}-` : ''
  const name = `${rand}${safe}.${ext}`
  const folder = normalizeFolder(opts.folder)
  return folder ? `${folder}/${name}` : name
}

/**
 * 키 안전성 검증 — 경로 순회(..)·절대경로·백슬래시·널바이트·이중슬래시 차단.
 * 디스크/URL 어디서나 신뢰 가능한 키만 통과시킵니다.
 */
export function isSafeKey(key: string): boolean {
  if (!key || key.length > 512) return false
  if (key.startsWith('/') || key.includes('\\')) return false
  if (key.includes('\0')) return false
  if (key.includes('//')) return false
  const segments = key.split('/')
  for (const seg of segments) {
    if (seg === '' || seg === '.' || seg === '..') return false
    if (seg.startsWith('.')) return false // 숨김파일 차단
  }
  return true
}

/** 공개 자산 URL 조합 — `<base>/file/<tenantSlug>/<key>`. base 의 끝 슬래시는 정리. */
export function publicAssetUrl(base: string, tenantSlug: string, key: string): string {
  const b = base.replace(/\/+$/g, '')
  return `${b}/file/${tenantSlug}/${key}`
}

/** Origin 헤더가 테넌트 CORS 허용목록에 포함되는지(와일드카드 '*' 지원). */
export function isOriginAllowed(allowlist: readonly string[], origin: string | undefined): boolean {
  if (allowlist.includes('*')) return true
  if (!origin) return false
  return allowlist.includes(origin)
}
