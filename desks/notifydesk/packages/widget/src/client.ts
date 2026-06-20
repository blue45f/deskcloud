/**
 * NotifyDesk 위젯 클라이언트 — 의존성 0(타입만 @notifydesk/shared 에서).
 *
 * publishable(`pk_`) 키로 호출하는 브라우저 안전 경로만 감쌉니다:
 *   1) getInbox       — GET  {endpoint}/api/inbox?recipientId=…&limit=…
 *   2) getUnreadCount — GET  {endpoint}/api/inbox/unread-count?recipientId=…
 *   3) markRead       — POST {endpoint}/api/inbox/read   { recipientId, ids?|all? }
 *
 * publishable 키는 브라우저 노출이 안전합니다(자기 인박스 읽기·읽음 처리만 가능). 발송·어드민은
 * 서버에서 secret(`sk_`) 키 + @notifydesk/sdk 를 씁니다. 서버는 Origin 도 테넌트별로 검사합니다.
 */
import type { InboxDto, MarkReadResultDto, NotificationDto, UnreadCountDto } from '@notifydesk/shared'

export type { InboxDto, MarkReadResultDto, NotificationDto, UnreadCountDto }

const WIDGET_VERSION = '0.1.0'

export interface NotifyDeskWidgetClientOptions {
  /** 알림을 받을 사용자(테넌트 측 식별자). 예: 'user_42'. */
  recipientId: string
  /** publishable 키(`pk_…`). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://notify.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

/** NotifyDesk API 가 4xx/5xx 를 돌려줄 때 던지는 에러(원본 status·detail 보존). */
export class NotifyDeskWidgetError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'NotifyDeskWidgetError'
  }
}

export interface NotifyDeskWidgetClient {
  getInbox(limit?: number, signal?: AbortSignal): Promise<InboxDto>
  getUnreadCount(signal?: AbortSignal): Promise<UnreadCountDto>
  markRead(ids: string[], signal?: AbortSignal): Promise<MarkReadResultDto>
  markAllRead(signal?: AbortSignal): Promise<MarkReadResultDto>
}

export function createNotifyDeskWidgetClient(
  options: NotifyDeskWidgetClientOptions
): NotifyDeskWidgetClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const recipientId = options.recipientId
  const rid = encodeURIComponent(recipientId)
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new NotifyDeskWidgetError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }

  const headers = (json = false): Record<string, string> => {
    const h: Record<string, string> = {
      authorization: `Bearer ${options.publishableKey}`,
      'x-notifydesk-widget': WIDGET_VERSION,
    }
    if (json) h['content-type'] = 'application/json'
    return h
  }

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    const json: unknown = text ? safeParse(text) : null
    if (!res.ok) {
      const rec = (json ?? {}) as Record<string, unknown>
      const raw = rec.message ?? rec.error ?? `NotifyDesk 요청 실패 (${res.status})`
      const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
      throw new NotifyDeskWidgetError(msg, res.status, json)
    }
    return json as T
  }

  return {
    async getInbox(limit, signal) {
      const qs = new URLSearchParams({ recipientId })
      if (limit != null) qs.set('limit', String(limit))
      const res = await doFetch(`${base}/api/inbox?${qs.toString()}`, {
        method: 'GET',
        headers: headers(),
        signal,
      })
      return parse<InboxDto>(res)
    },

    async getUnreadCount(signal) {
      const res = await doFetch(`${base}/api/inbox/unread-count?recipientId=${rid}`, {
        method: 'GET',
        headers: headers(),
        signal,
      })
      return parse<UnreadCountDto>(res)
    },

    async markRead(ids, signal) {
      const res = await doFetch(`${base}/api/inbox/read`, {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ recipientId, ids }),
        signal,
      })
      return parse<MarkReadResultDto>(res)
    },

    async markAllRead(signal) {
      const res = await doFetch(`${base}/api/inbox/read`, {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ recipientId, all: true }),
        signal,
      })
      return parse<MarkReadResultDto>(res)
    },
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
