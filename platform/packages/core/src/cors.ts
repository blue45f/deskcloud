/**
 * CORS allowlist — 테넌트의 corsOrigins 에 대해 요청 origin 을 검사한다(프레임워크 무관).
 *
 * 규칙:
 * - 목록에 '*' 이 있으면 모든 origin 허용(개발/공개 위젯 편의).
 * - 정확 일치(대소문자 무시 host, scheme 보존)면 허용.
 * - origin 이 없는(서버-서버) 요청은 호출자 정책에 맡김 — 여기선 검사 대상 아님(null 반환).
 */

/** origin 정규화 — trailing slash 제거, 소문자화. */
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase()
}

/** 주어진 origin 이 allowlist 에 허용되는지. */
export function isOriginAllowed(origin: string | null | undefined, allowlist: string[]): boolean {
  if (allowlist.includes('*')) return true
  if (!origin) return false
  const norm = normalizeOrigin(origin)
  return allowlist.some((a) => normalizeOrigin(a) === norm)
}

/**
 * Express/CORS 미들웨어용 origin 콜백 형태를 만든다(테넌트 해석은 호출자 몫).
 * 정적 allowlist 에 대해 동작하는 단순 헬퍼.
 */
export function corsOriginCallback(allowlist: string[]) {
  return (
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void
  ): void => {
    // origin 없는 동일출처/서버 요청은 통과(브라우저가 아닌 호출).
    if (!origin) return cb(null, true)
    cb(null, isOriginAllowed(origin, allowlist))
  }
}
