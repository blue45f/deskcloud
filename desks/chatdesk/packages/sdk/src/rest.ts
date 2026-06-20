/**
 * ChatDesk REST 얇은 래퍼 — 브라우저(pk)와 서버(sk) 양쪽이 공유하는 fetch 헬퍼.
 * 키는 `X-Chat-Key` 헤더로 보낸다(pk_… 또는 sk_…). endpoint 끝의 `/` 는 무시.
 */

/** SDK 호출 실패 시 던지는 식별 가능한 에러(HTTP 상태 + 서버 detail). */
export class ChatDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'ChatDeskError'
  }
}

export const SDK_VERSION = '0.1.0'

export interface RestOptions {
  /** API 베이스 URL. 예: 'https://chat.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 인증 키 — pk_…(브라우저) 또는 sk_…(서버). */
  key: string
  /** 커스텀 fetch(SSR/Node<18/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

/** REST 호출기 — `X-Chat-Key` 를 붙여 JSON 을 주고받는다. */
export function createRest(options: RestOptions) {
  const base = options.endpoint.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new ChatDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }

  const headers = (): Record<string, string> => ({
    'content-type': 'application/json',
    'x-chat-key': options.key,
    'x-chatdesk-sdk': SDK_VERSION,
  })

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    const json: unknown = text ? (JSON.parse(text) as unknown) : null
    if (!res.ok) {
      const rec = (json ?? {}) as Record<string, unknown>
      const raw = rec.message ?? rec.error ?? `ChatDesk 요청 실패 (${res.status})`
      const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
      throw new ChatDeskError(msg, res.status, json)
    }
    return json as T
  }

  return {
    base,
    async get<T>(path: string, signal?: AbortSignal): Promise<T> {
      const res = await doFetch(`${base}${path}`, { method: 'GET', headers: headers(), signal })
      return parse<T>(res)
    },
    async post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
      const res = await doFetch(`${base}${path}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal,
      })
      return parse<T>(res)
    },
    async del<T>(path: string, signal?: AbortSignal): Promise<T> {
      const res = await doFetch(`${base}${path}`, { method: 'DELETE', headers: headers(), signal })
      return parse<T>(res)
    },
  }
}

export type Rest = ReturnType<typeof createRest>

/** 쿼리스트링 빌더 — undefined 값은 생략. */
export function qs(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}
