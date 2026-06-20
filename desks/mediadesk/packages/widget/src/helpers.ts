/** 위젯 공용 순수 유틸 — 포맷·MIME 가드. SDK/네트워크 의존 없음. */

/** 바이트 → 사람이 읽는 크기 문자열. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

/** 기본 허용 MIME(이미지 + 일부 문서). MediaUploader accept prop 으로 덮어쓸 수 있음. */
export const DEFAULT_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
] as const

/**
 * accept 토큰(예: 'image/*', 'image/png', '.pdf')에 file 의 MIME/확장자가 맞는지.
 * accept 가 비어 있으면 모두 허용.
 */
export function isMimeAccepted(accept: readonly string[], file: { type: string; name: string }): boolean {
  if (accept.length === 0) return true
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  for (const tokenRaw of accept) {
    const token = tokenRaw.trim().toLowerCase()
    if (!token) continue
    if (token === '*' || token === '*/*') return true
    if (token.startsWith('.')) {
      if (name.endsWith(token)) return true
      continue
    }
    if (token.endsWith('/*')) {
      const prefix = token.slice(0, token.indexOf('/') + 1)
      if (type.startsWith(prefix)) return true
      continue
    }
    if (type === token) return true
  }
  return false
}

/** 이미지 MIME 인가(미리보기/썸네일 판단용). */
export function isImageMime(mime: string): boolean {
  return /^image\//i.test(mime)
}

/** 짧은 무작위 id(키 충돌·React key 용). crypto 있으면 사용, 없으면 폴백. */
export function shortId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().slice(0, 8)
  return Math.random().toString(36).slice(2, 10)
}
