import { WILDCARD_ORIGIN } from './constants'

/** origin 끝의 슬래시 제거 등 정규화(비교용). */
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase()
}

/**
 * 테넌트 corsOrigins 허용 목록에 대해 요청 Origin 이 허용되는지 판정(순수 함수).
 * - 목록에 '*' 가 있으면 모든 Origin 허용(로컬·데모용).
 * - Origin 헤더가 없으면(서버-서버 호출 등) 차단하지 않는다(브라우저만 Origin 을 보냄).
 *   → 위젯은 브라우저에서만 호출하므로 Origin 부재는 호출측 책임으로 본다.
 */
export function isOriginAllowed(
  requestOrigin: string | undefined | null,
  allowList: readonly string[]
): boolean {
  if (allowList.includes(WILDCARD_ORIGIN)) return true
  if (!requestOrigin) return false
  const normalized = normalizeOrigin(requestOrigin)
  return allowList.some((o) => normalizeOrigin(o) === normalized)
}
