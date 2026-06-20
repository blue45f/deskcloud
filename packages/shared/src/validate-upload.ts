import { ALLOWED_CONTENT_TYPES, DEFAULT_MAX_FILE_BYTES, FILENAME_MAX } from './constants'

/**
 * 업로드 검증 — 크기·MIME·파일명을 순수 함수로 판정한다(서버/클라이언트 공유).
 * NestJS 컨트롤러와 위젯/SDK 가 동일 규칙을 쓰도록 여기서 1차 진실을 둔다.
 */

/** MIME 타입 정규화 — 파라미터(`; charset=…`) 제거 + 소문자 + trim. */
export function normalizeContentType(raw: string | null | undefined): string {
  if (!raw) return ''
  const semi = raw.indexOf(';')
  const base = semi >= 0 ? raw.slice(0, semi) : raw
  return base.trim().toLowerCase()
}

/**
 * 허용 MIME 인지 — 화이트리스트와 정확 매칭하거나 `image/*` 같은 슬래시-스타
 * 접두사 패턴에 부합하면 true. 빈 문자열/미지정은 false.
 */
export function isAllowedContentType(
  contentType: string | null | undefined,
  allowed: readonly string[] = ALLOWED_CONTENT_TYPES
): boolean {
  const ct = normalizeContentType(contentType)
  if (!ct) return false
  for (const pattern of allowed) {
    if (pattern === ct) return true
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1) // 'image/*' → 'image/'
      if (ct.startsWith(prefix)) return true
    }
  }
  return false
}

export interface UploadCandidate {
  filename: string
  contentType: string
  sizeBytes: number
}

export interface UploadValidationOptions {
  maxBytes?: number
  allowedContentTypes?: readonly string[]
}

export type UploadValidationError =
  | 'filename-required'
  | 'filename-too-long'
  | 'content-type-required'
  | 'content-type-not-allowed'
  | 'size-invalid'
  | 'size-zero'
  | 'size-too-large'

export interface UploadValidationResult {
  ok: boolean
  errors: UploadValidationError[]
  /** 정규화된(파라미터 제거) MIME 타입. */
  contentType: string
}

/**
 * 업로드 후보를 검증한다. 위반 사유 코드를 모두 모아 반환(첫 실패에서 멈추지 않음).
 * 컨트롤러는 ok=false 면 400 으로, 코드별 한글 메시지를 매핑한다.
 */
export function validateUpload(
  candidate: UploadCandidate,
  options: UploadValidationOptions = {}
): UploadValidationResult {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_FILE_BYTES
  const errors: UploadValidationError[] = []

  const filename = candidate.filename?.trim() ?? ''
  if (!filename) errors.push('filename-required')
  else if (filename.length > FILENAME_MAX) errors.push('filename-too-long')

  const contentType = normalizeContentType(candidate.contentType)
  if (!contentType) errors.push('content-type-required')
  else if (!isAllowedContentType(contentType, options.allowedContentTypes)) {
    errors.push('content-type-not-allowed')
  }

  const size = candidate.sizeBytes
  if (typeof size !== 'number' || !Number.isFinite(size) || !Number.isInteger(size) || size < 0) {
    errors.push('size-invalid')
  } else if (size === 0) {
    errors.push('size-zero')
  } else if (size > maxBytes) {
    errors.push('size-too-large')
  }

  return { ok: errors.length === 0, errors, contentType }
}

/** 위반 코드 → 한글 메시지(컨트롤러/위젯 공용). */
export const UPLOAD_ERROR_MESSAGES: Record<UploadValidationError, string> = {
  'filename-required': '파일명이 필요합니다',
  'filename-too-long': `파일명이 너무 깁니다(최대 ${FILENAME_MAX}자)`,
  'content-type-required': 'contentType(MIME)이 필요합니다',
  'content-type-not-allowed': '허용되지 않는 파일 형식입니다',
  'size-invalid': '파일 크기가 올바르지 않습니다',
  'size-zero': '빈 파일은 업로드할 수 없습니다',
  'size-too-large': '파일이 최대 허용 크기를 초과했습니다',
}

/** 사람이 읽는 바이트 표기(어드민·위젯 공용). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[i]}`
}
