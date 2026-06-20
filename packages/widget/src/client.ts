/**
 * ChangelogDesk 위젯 클라이언트 — 의존성 0(타입만 @changelogdesk/shared 에서).
 *
 * 세 개의 공개(퍼블리시 키) 엔드포인트만 감쌉니다. 인증은 퍼블리시 키(pk_…)를
 * `x-pk` 헤더로 싣고, 서버가 Origin 화이트리스트를 검사합니다(브라우저가 Origin 자동 첨부).
 *
 *   1) listEntries    — GET  {endpoint}/api/changelog?limit=&since=   → PublicChangelogDto (사용량 +1)
 *   2) getUnreadCount — GET  {endpoint}/api/changelog/unread-count?anonId=  → UnreadCountDto
 *   3) markSeen       — POST {endpoint}/api/changelog/seen  { anonId, lastSeenEntryId? } → OkDto
 *
 * 퍼블리시 키는 브라우저 노출이 안전한 읽기·읽음표시 전용 토큰입니다(CRUD 는 시크릿 키).
 */
import type {
  PublicChangelogDto,
  SeenInput,
  UnreadCountDto,
} from '@changelogdesk/shared'

export type { PublicChangelogDto, SeenInput, UnreadCountDto }

export interface ChangelogDeskClientOptions {
  /** 퍼블리시 키(pk_…) — 브라우저 노출 안전. 테넌트를 식별한다. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://changelog.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

export class ChangelogDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'ChangelogDeskError'
  }
}

export interface ListEntriesParams {
  /** 최대 항목 수(서버 기본 20, 최대 100). */
  limit?: number
  /** ISO 시각 — 이후 게시분만(증분 로드). */
  since?: string
}

export interface ChangelogDeskClient {
  listEntries(params?: ListEntriesParams, signal?: AbortSignal): Promise<PublicChangelogDto>
  getUnreadCount(anonId: string, signal?: AbortSignal): Promise<UnreadCountDto>
  markSeen(input: SeenInput, signal?: AbortSignal): Promise<void>
}

const WIDGET_VERSION = '0.1.0'

export function createChangelogDeskClient(
  options: ChangelogDeskClientOptions
): ChangelogDeskClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const pk = options.publishableKey
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new ChangelogDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }

  const headers = (): Record<string, string> => ({
    'content-type': 'application/json',
    'x-pk': pk,
    'x-changelogdesk-widget': WIDGET_VERSION,
  })

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    const json: unknown = text ? JSON.parse(text) : null
    if (!res.ok) {
      const rec = (json ?? {}) as Record<string, unknown>
      const raw = rec.message ?? rec.error ?? `ChangelogDesk 요청 실패 (${res.status})`
      const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
      throw new ChangelogDeskError(msg, res.status, json)
    }
    return json as T
  }

  return {
    async listEntries(params, signal) {
      const qs = new URLSearchParams()
      if (params?.limit != null) qs.set('limit', String(params.limit))
      if (params?.since) qs.set('since', params.since)
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      const res = await doFetch(`${base}/api/changelog${suffix}`, {
        method: 'GET',
        headers: headers(),
        signal,
      })
      return parse<PublicChangelogDto>(res)
    },

    async getUnreadCount(anonId, signal) {
      const qs = new URLSearchParams({ anonId })
      const res = await doFetch(`${base}/api/changelog/unread-count?${qs.toString()}`, {
        method: 'GET',
        headers: headers(),
        signal,
      })
      return parse<UnreadCountDto>(res)
    },

    async markSeen(input, signal) {
      const res = await doFetch(`${base}/api/changelog/seen`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(input),
        signal,
      })
      await parse<unknown>(res)
    },
  }
}
