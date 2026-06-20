/**
 * @notifydesk/sdk — 서버 사이드 클라이언트.
 *
 * 외부 백엔드(테넌트의 서버)가 secret(`sk_`) 키로 NotifyDesk 에 알림을 보낼 때 쓴다.
 * 의존성 0(타입만 @notifydesk/shared). 런타임은 전역 fetch 만 사용 — Node 18+ · 엣지
 * 런타임(Vercel/CF Workers) · Deno · 테스트 모두 동작한다.
 *
 *   import { createNotifyDeskClient } from '@notifydesk/sdk'
 *
 *   const notify = createNotifyDeskClient({
 *     secretKey: process.env.NOTIFYDESK_SECRET_KEY!,   // sk_…
 *     endpoint: 'https://notify.example.com',
 *   })
 *
 *   // 템플릿 발송
 *   await notify.notify('user_42', {
 *     type: 'order.shipped',
 *     templateKey: 'order.shipped',
 *     data: { orderId: 'A-1024', tracking: 'KR123' },
 *     email: 'user@example.com',
 *   })
 *
 *   // 애드혹(템플릿 없이) 발송
 *   await notify.notify('user_42', { type: 'system', title: '환영합니다', body: '가입을 축하해요!' })
 *
 * secret 키는 절대 브라우저에 노출하지 말 것 — 브라우저(인박스 읽기)는 publishable(`pk_`)
 * 키와 @notifydesk/widget 을 사용한다.
 */
import { isSecretKey } from '@notifydesk/shared'

import type {
  Channel,
  CreateTemplateInput,
  NotifyResultDto,
  SentLogDto,
  TemplateDto,
  TenantDto,
  UpdateTemplateInput,
} from '@notifydesk/shared'

export type {
  Channel,
  CreateTemplateInput,
  NotifyResultDto,
  SentLogDto,
  TemplateDto,
  TenantDto,
  UpdateTemplateInput,
}

/** SDK 식별 헤더 값(서버 로그·디버깅용). */
const SDK_VERSION = '0.1.0'

export interface NotifyDeskClientOptions {
  /** secret 키(`sk_…`). 서버 환경 변수에서 주입 — 브라우저 노출 금지. */
  secretKey: string
  /** API 베이스 URL. 예: 'https://notify.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 선택 — 커스텀 fetch(테스트·프록시·SSR). 기본은 전역 fetch. */
  fetch?: typeof fetch
  /** 선택 — 요청 타임아웃(ms). 기본 없음(호출자 AbortSignal 우선). */
  timeoutMs?: number
}

/**
 * 발송 옵션 — recipientId 는 notify(recipientId, …) 의 첫 인자로 받으므로 여기엔 없다.
 * `templateKey` 또는 `body` 중 하나는 반드시 있어야 한다(서버가 2차 검증).
 */
export interface SendOptions {
  /** 알림 종류(분류 + 선호 설정 키). 예: 'order.shipped', 'system'. */
  type: string
  /** 사용할 템플릿 key(선택). 주면 템플릿의 channels/subject/body 를 렌더한다. */
  templateKey?: string
  /** 보낼 채널(선택). 미지정 시 템플릿 channels, 그것도 없으면 ['in_app']. */
  channels?: Channel[]
  /** 애드혹 제목(선택, 템플릿 subject 보다 우선). */
  title?: string
  /** 애드혹 본문(선택, 템플릿 body 보다 우선). 템플릿이 없으면 필수. */
  body?: string
  /** 템플릿 렌더 변수 + 인박스에 함께 저장할 구조화 데이터. */
  data?: Record<string, unknown>
  /** 이메일 채널 수신 주소(선택). */
  email?: string
  /** 호출별 취소 신호(선택). */
  signal?: AbortSignal
}

export interface NotifyDeskClient {
  /** 수신자에게 알림 발송(secret 키). 선호·소프트 캡·템플릿이 서버에서 적용된다. */
  notify(recipientId: string, options: SendOptions): Promise<NotifyResultDto>
  /** 내 테넌트 조회(secret 평문 미포함). */
  getTenant(signal?: AbortSignal): Promise<TenantDto>
  /** 템플릿 목록(최신순). */
  listTemplates(signal?: AbortSignal): Promise<TemplateDto[]>
  /** 템플릿 단건. */
  getTemplate(key: string, signal?: AbortSignal): Promise<TemplateDto>
  /** 템플릿 생성. */
  createTemplate(input: CreateTemplateInput, signal?: AbortSignal): Promise<TemplateDto>
  /** 템플릿 수정(전체 교체). */
  updateTemplate(
    key: string,
    input: UpdateTemplateInput,
    signal?: AbortSignal
  ): Promise<TemplateDto>
  /** 템플릿 삭제. */
  deleteTemplate(key: string, signal?: AbortSignal): Promise<{ deleted: boolean }>
  /** 발송 로그(테넌트 전체, 최신순, 페이지네이션). */
  sentLog(paging?: { offset?: number; limit?: number }, signal?: AbortSignal): Promise<SentLogDto>
}

/** NotifyDesk API 가 4xx/5xx 를 돌려줄 때 던지는 에러(원본 status·detail 보존). */
export class NotifyDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'NotifyDeskError'
  }
}

/** 서버 사이드 발송 클라이언트를 만든다. secretKey 가 sk_ 형식이 아니면 즉시 throw. */
export function createNotifyDeskClient(options: NotifyDeskClientOptions): NotifyDeskClient {
  if (!options.secretKey) {
    throw new NotifyDeskError('secretKey 가 필요합니다 (sk_…)', 0)
  }
  if (!isSecretKey(options.secretKey)) {
    throw new NotifyDeskError(
      'secretKey 는 sk_ 로 시작해야 합니다. 브라우저에는 publishable(pk_) 키를 쓰세요.',
      0
    )
  }

  const base = options.endpoint.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new NotifyDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }

  const headers = (): Record<string, string> => ({
    'content-type': 'application/json',
    authorization: `Bearer ${options.secretKey}`,
    'x-notifydesk-sdk': SDK_VERSION,
  })

  /** 호출별 signal 과 timeout 을 합쳐 하나의 signal 로 만든다(없으면 undefined). */
  function withTimeout(signal?: AbortSignal): {
    signal: AbortSignal | undefined
    cancel: () => void
  } {
    if (!options.timeoutMs) return { signal, cancel: () => undefined }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), options.timeoutMs)
    if (signal) {
      if (signal.aborted) ctrl.abort()
      else signal.addEventListener('abort', () => ctrl.abort(), { once: true })
    }
    return { signal: ctrl.signal, cancel: () => clearTimeout(timer) }
  }

  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const { signal: merged, cancel } = withTimeout(signal)
    let res: Response
    try {
      res = await doFetch(`${base}/api${path}`, {
        method,
        headers: headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: merged,
      })
    } catch (err) {
      throw new NotifyDeskError(
        err instanceof Error ? err.message : 'NotifyDesk 요청 실패(네트워크)',
        0,
        err
      )
    } finally {
      cancel()
    }

    const text = await res.text()
    const json: unknown = text ? safeParse(text) : null
    if (!res.ok) {
      const rec = (json ?? {}) as Record<string, unknown>
      const raw = rec.message ?? rec.error ?? `NotifyDesk 요청 실패 (${res.status})`
      const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
      throw new NotifyDeskError(msg, res.status, json)
    }
    return json as T
  }

  return {
    notify(recipientId, opts) {
      const { signal, ...rest } = opts
      return request<NotifyResultDto>('POST', '/notify', { recipientId, ...rest }, signal)
    },
    getTenant(signal) {
      return request<TenantDto>('GET', '/admin/tenant', undefined, signal)
    },
    listTemplates(signal) {
      return request<TemplateDto[]>('GET', '/admin/templates', undefined, signal)
    },
    getTemplate(key, signal) {
      return request<TemplateDto>(
        'GET',
        `/admin/templates/${encodeURIComponent(key)}`,
        undefined,
        signal
      )
    },
    createTemplate(input, signal) {
      return request<TemplateDto>('POST', '/admin/templates', input, signal)
    },
    updateTemplate(key, input, signal) {
      return request<TemplateDto>(
        'PUT',
        `/admin/templates/${encodeURIComponent(key)}`,
        input,
        signal
      )
    },
    deleteTemplate(key, signal) {
      return request<{ deleted: boolean }>(
        'DELETE',
        `/admin/templates/${encodeURIComponent(key)}`,
        undefined,
        signal
      )
    },
    sentLog(paging, signal) {
      const qs = new URLSearchParams()
      if (paging?.offset != null) qs.set('offset', String(paging.offset))
      if (paging?.limit != null) qs.set('limit', String(paging.limit))
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      return request<SentLogDto>('GET', `/admin/sent${suffix}`, undefined, signal)
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
