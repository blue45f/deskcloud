/**
 * Origin allowlist 검사 — 공개(publishable) 위젯 경로의 테넌트별 CORS 게이트.
 *
 * 정확 매칭(대소문자 무시, 끝 슬래시 무시)만 허용한다. 와일드카드는 지원하지 않는다
 * (테넌트가 명시한 origin 만 신뢰 — 공개 키 + Origin 위조 방어의 한 겹).
 */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase()
}

export function isOriginAllowed(origin: string, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return false
  const o = normalizeOrigin(origin)
  return allowlist.some((a) => normalizeOrigin(a) === o)
}
