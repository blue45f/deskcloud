/**
 * content-hash — 제품의 핵심 불변식.
 *
 * 버전이 게시되는 순간 본문을 동결하고 SHA-256 해시를 박습니다. 동의 영수증은 이
 * 해시를 가리키므로 "그 사용자가 정확히 어떤 문안에 동의했는지"를 사후에 증명/재현할
 * 수 있습니다. 게시된 본문이 한 글자라도 다르게 렌더되면 이 해시가 깨지고 모든 증거가
 * 무효가 되므로 — 게시본은 절대 변형 없이 그대로 보관/제공합니다.
 *
 * Web Crypto(Node 22 · 브라우저 공통)를 사용해 서버·클라이언트 어디서든 동일 결과.
 */

/** 본문 정규화: 줄바꿈만 LF로 통일(가시적 변형 없이 플랫폼 차이만 제거). */
export function canonicalizeBody(body: string): string {
  return body.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** 정규화된 본문의 SHA-256 16진 해시. */
export async function computeContentHash(body: string): Promise<string> {
  const canonical = canonicalizeBody(body)
  const data = new TextEncoder().encode(canonical)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 표시용 짧은 해시(앞 12자). */
export function shortHash(hash: string): string {
  return hash.slice(0, 12)
}
