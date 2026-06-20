/**
 * ReviewDesk 위젯 클라이언트 — 의존성 0(타입만 @reviewdesk/shared 에서).
 *
 * 네 개의 공개(publishable) 엔드포인트를 감쌉니다. 인증은 publishable 키(pk_...)로,
 * 헤더 `x-pk` 로 실어 보냅니다(서버는 `?pk=` 쿼리도 받지만 위젯은 헤더만 사용).
 *
 *   1) getAggregate   — GET  {endpoint}/api/reviews/aggregate?subjectId=...
 *   2) getReviews     — GET  {endpoint}/api/reviews?subjectId=...&limit=...
 *   3) getWall        — GET  {endpoint}/api/reviews/wall?limit=...
 *   4) submitReview   — POST {endpoint}/api/reviews
 *
 * publishableKey 는 브라우저 안전(제출 + 승인본 읽기)합니다. secret 키는 절대 넣지 마세요.
 */
import type {
  PublicReviewsDto,
  ReviewAggregate,
  ReviewReceiptDto,
  ReviewWallDto,
  SubmitReviewInput,
} from '@reviewdesk/shared'

export type {
  PublicReviewsDto,
  ReviewAggregate,
  ReviewReceiptDto,
  ReviewWallDto,
  SubmitReviewInput,
}

export interface ReviewDeskClientOptions {
  /** publishable 키(pk_...). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://reviews.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

export class ReviewDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'ReviewDeskError'
  }
}

export interface ReviewDeskClient {
  getAggregate(subjectId: string, signal?: AbortSignal): Promise<ReviewAggregate>
  getReviews(subjectId: string, limit?: number, signal?: AbortSignal): Promise<PublicReviewsDto>
  getWall(limit?: number, signal?: AbortSignal): Promise<ReviewWallDto>
  submitReview(input: SubmitReviewInput, signal?: AbortSignal): Promise<ReviewReceiptDto>
}

const WIDGET_VERSION = '0.1.0'

export function createReviewDeskClient(options: ReviewDeskClientOptions): ReviewDeskClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new ReviewDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }
  if (!options.publishableKey) {
    throw new ReviewDeskError('publishableKey 가 필요합니다.', 0)
  }

  const headers = (json: boolean): Record<string, string> => {
    const h: Record<string, string> = {
      'x-pk': options.publishableKey,
      'x-reviewdesk-widget': WIDGET_VERSION,
    }
    if (json) h['content-type'] = 'application/json'
    return h
  }

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    const json: unknown = text ? JSON.parse(text) : null
    if (!res.ok) {
      const rec = (json ?? {}) as Record<string, unknown>
      const raw = rec.message ?? rec.error ?? `ReviewDesk 요청 실패 (${res.status})`
      const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
      throw new ReviewDeskError(msg, res.status, json)
    }
    return json as T
  }

  const qs = (params: Record<string, string | number | undefined>): string => {
    const search = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') search.set(k, String(v))
    }
    const s = search.toString()
    return s ? `?${s}` : ''
  }

  return {
    async getAggregate(subjectId, signal) {
      const res = await doFetch(`${base}/api/reviews/aggregate${qs({ subjectId })}`, {
        method: 'GET',
        headers: headers(false),
        signal,
      })
      return parse<ReviewAggregate>(res)
    },

    async getReviews(subjectId, limit, signal) {
      const res = await doFetch(`${base}/api/reviews${qs({ subjectId, limit })}`, {
        method: 'GET',
        headers: headers(false),
        signal,
      })
      return parse<PublicReviewsDto>(res)
    },

    async getWall(limit, signal) {
      const res = await doFetch(`${base}/api/reviews/wall${qs({ limit })}`, {
        method: 'GET',
        headers: headers(false),
        signal,
      })
      return parse<ReviewWallDto>(res)
    },

    async submitReview(input, signal) {
      const res = await doFetch(`${base}/api/reviews`, {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify(input),
        signal,
      })
      return parse<ReviewReceiptDto>(res)
    },
  }
}
