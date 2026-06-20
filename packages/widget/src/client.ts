/**
 * AdDesk 위젯/SDK 클라이언트 — 의존성 0(타입만 @addesk/shared 에서).
 *
 * publishable(`pk_`) 키로 호출하는 브라우저 안전 경로만 감쌉니다:
 *   serve(slot)              — GET  {endpoint}/api/ads/serve?slot=…  → ServeDto
 *   trackImpression(id)      — POST {endpoint}/api/ads/impression    → TrackReceiptDto
 *   trackClick(id)           — POST {endpoint}/api/ads/click          → TrackReceiptDto
 *
 * publishable 키는 브라우저 노출이 안전합니다(서빙·추적만 가능, CRUD/통계는 서버 secret 키).
 * 서버는 Origin 도 테넌트별로 검사합니다.
 */
import type { ServeDto, TrackReceiptDto } from '@addesk/shared'

export type { ServeDto, TrackReceiptDto }

const WIDGET_VERSION = '0.1.0'

export interface AdDeskClientOptions {
  /** publishable 키(`pk_…`). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://ads.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

/** AdDesk API 가 4xx/5xx 를 돌려줄 때 던지는 에러(원본 status·detail 보존). */
export class AdDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'AdDeskError'
  }
}

export interface AdDeskClient {
  /** 슬롯에 노출할 활성 크리에이티브 1개를 가중 선택해 받는다. */
  serve(slot: string, signal?: AbortSignal): Promise<ServeDto>
  /** 노출 추적(creativeId). */
  trackImpression(creativeId: string): Promise<TrackReceiptDto>
  /** 클릭 추적(creativeId). */
  trackClick(creativeId: string): Promise<TrackReceiptDto>
}

function messageFromBody(body: unknown, status: number): string {
  const rec = (body ?? {}) as Record<string, unknown>
  const raw = rec.message ?? rec.error ?? `AdDesk 요청 실패 (${status})`
  return Array.isArray(raw) ? raw.join(', ') : String(raw)
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function createAdDeskClient(options: AdDeskClientOptions): AdDeskClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch

  async function call<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: { body?: unknown; signal?: AbortSignal } = {}
  ): Promise<T> {
    if (!doFetch) {
      throw new AdDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${options.publishableKey}`,
      'x-pk': options.publishableKey,
      'x-addesk-widget': WIDGET_VERSION,
    }
    if (opts.body !== undefined) headers['content-type'] = 'application/json'

    const res = await doFetch(`${base}${path}`, {
      method,
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      signal: opts.signal,
    })
    const text = await res.text()
    const body: unknown = text ? safeJson(text) : null
    if (!res.ok) throw new AdDeskError(messageFromBody(body, res.status), res.status, body)
    return body as T
  }

  return {
    serve(slot, signal) {
      const q = encodeURIComponent(slot)
      return call<ServeDto>('GET', `/api/ads/serve?slot=${q}`, { signal })
    },
    trackImpression(creativeId) {
      return call<TrackReceiptDto>('POST', '/api/ads/impression', { body: { creativeId } })
    },
    trackClick(creativeId) {
      return call<TrackReceiptDto>('POST', '/api/ads/click', { body: { creativeId } })
    },
  }
}
