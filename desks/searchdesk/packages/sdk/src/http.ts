/**
 * SDK 공용 HTTP 코어 — 의존성 0(타입만 @searchdesk/shared 에서).
 *
 * 검색 클라이언트(pk_)·색인기(sk_) 가 공유하는 fetch 래퍼·에러·헤더 빌더.
 * 런타임 의존은 전역 fetch 뿐. SSR/테스트용으로 fetch 를 주입할 수 있다.
 */

/** SDK 버전 — 진단용 X-SearchDesk-SDK 헤더로 전송. */
export const SDK_VERSION = '0.1.0'

/** SearchDesk API 호출 실패 — HTTP 상태와 (가능하면) 서버 detail 을 보존한다. */
export class SearchDeskError extends Error {
  constructor(
    message: string,
    /** HTTP 상태(네트워크 실패 등 응답 전이면 0). */
    public readonly status: number,
    /** 서버가 돌려준 원본 에러 바디(있으면). */
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'SearchDeskError'
  }
}

/** 공통 클라이언트 옵션의 베이스. */
export interface BaseClientOptions {
  /** API 베이스 URL. 예: 'https://search.example.com'(끝 / 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

/** endpoint 정규화(끝 슬래시 제거). */
export function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '')
}

/** 주입 또는 전역 fetch 를 해소. 없으면 SearchDeskError(0). */
export function resolveFetch(custom?: typeof fetch): typeof fetch {
  const doFetch = custom ?? globalThis.fetch
  if (!doFetch) {
    throw new SearchDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }
  return doFetch
}

/**
 * Bearer 키 헤더 빌더. content-type 은 호출 측이 필요할 때만 더한다(GET 은 생략).
 * X-SearchDesk-SDK 로 SDK 버전을 함께 보낸다(진단).
 */
export function authHeaders(key: string, json: boolean): Record<string, string> {
  const h: Record<string, string> = {
    authorization: `Bearer ${key}`,
    'x-searchdesk-sdk': SDK_VERSION,
  }
  if (json) h['content-type'] = 'application/json'
  return h
}

/** 응답 파싱 — !ok 면 서버 message/error 를 풀어 SearchDeskError 로 던진다. */
export async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  const json: unknown = text ? safeJsonParse(text) : null
  if (!res.ok) {
    const rec = (json ?? {}) as Record<string, unknown>
    const raw = rec.message ?? rec.error ?? `SearchDesk 요청 실패 (${res.status})`
    const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
    throw new SearchDeskError(msg, res.status, json)
  }
  return json as T
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
