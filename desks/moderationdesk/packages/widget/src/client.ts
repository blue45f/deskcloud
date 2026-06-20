/**
 * ModerationDesk 위젯 클라이언트 — 브라우저 안전(publishable 키 pk_). 의존성 0(타입만 shared).
 *
 * 두 개의 publishable(브라우저) 엔드포인트만 감쌉니다:
 *   1) submitReport — POST {endpoint}/api/reports   (x-pk, Origin 검사)
 *   2) check        — POST {endpoint}/api/moderate   (x-pk, 클라이언트 사전검사)
 *
 * publishable 키는 브라우저 노출이 의도된 키입니다(차단은 서버 secret 권한). 클라이언트
 * 사전검사(check)는 UX 힌트일 뿐 — 최종 게이트는 서버(@moderationdesk/sdk)가 해야 합니다.
 */
import type {
  ModerateMeta,
  ModerateResultDto,
  ReportReceiptDto,
  SubmitReportInput,
} from '@moderationdesk/shared'

export type { ModerateResultDto, ReportReceiptDto, SubmitReportInput }

export interface ModerationDeskClientOptions {
  /** 발급받은 publishable 키(pk_...). 브라우저 노출 OK. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://moderate.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

/** 클라이언트 사전검사 입력 — text 외 컨텍스트. */
export interface CheckOptions {
  meta?: ModerateMeta
  signal?: AbortSignal
}

export class ModerationDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'ModerationDeskError'
  }
}

export interface ModerationDeskClient {
  /** 콘텐츠 신고 → 영수증(id·status). status 는 open 으로 시작. */
  submitReport(input: SubmitReportInput, signal?: AbortSignal): Promise<ReportReceiptDto>
  /** 클라이언트 사전검사(pk) — UX 힌트용. 서버가 최종 게이트. */
  check(text: string, opts?: CheckOptions): Promise<ModerateResultDto>
}

const WIDGET_VERSION = '0.1.0'

export function createModerationDeskClient(
  options: ModerationDeskClientOptions
): ModerationDeskClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new ModerationDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }
  if (!options.publishableKey) {
    throw new ModerationDeskError('publishableKey 가 필요합니다 (pk_...).', 0)
  }

  const headers = (): Record<string, string> => ({
    'content-type': 'application/json',
    'x-pk': options.publishableKey,
    'x-moderationdesk-widget': WIDGET_VERSION,
  })

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    let json: unknown = null
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = text
      }
    }
    if (!res.ok) {
      const rec = (json ?? {}) as Record<string, unknown>
      const raw = rec.message ?? rec.error ?? `ModerationDesk 요청 실패 (${res.status})`
      const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
      throw new ModerationDeskError(msg, res.status, json)
    }
    return json as T
  }

  return {
    async submitReport(input, signal) {
      const res = await doFetch(`${base}/api/reports`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(input),
        signal,
      })
      return parse<ReportReceiptDto>(res)
    },

    async check(text, opts) {
      const body: Record<string, unknown> = { text }
      if (opts?.meta) body.meta = opts.meta
      const res = await doFetch(`${base}/api/moderate`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal: opts?.signal,
      })
      return parse<ModerateResultDto>(res)
    },
  }
}
