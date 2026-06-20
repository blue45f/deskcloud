/**
 * SurveyDesk 위젯 클라이언트 — 의존성 0(타입만 @surveydesk/shared 에서).
 *
 * 두 개의 공개(무인증) 엔드포인트만 감쌉니다:
 *   1) getActiveSurvey  — GET  {endpoint}/api/surveys/{appId}/active
 *   2) submitResponse   — POST {endpoint}/api/surveys/{appId}/responses
 *
 * apiToken 은 선택입니다. 공개 경로는 인증이 필요 없지만, 외부 게이트웨이가 토큰을
 * 요구하는 배포에서는 Authorization 헤더로 실어 보낼 수 있도록 받아 둡니다.
 */
import type { ResponseReceiptDto, SubmitResponseInput, SurveyDto } from '@surveydesk/shared'

export type { ResponseReceiptDto, SubmitResponseInput, SurveyDto }

export interface SurveyDeskClientOptions {
  /** 형제 앱 식별자(테넌트 키). 예: 'offhours', 'resume', 'demo'. */
  appId: string
  /** API 베이스 URL. 예: 'https://surveys.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 선택 — 게이트웨이가 토큰을 요구할 때 Authorization: Bearer 로 전송. */
  apiToken?: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

/** 활성 설문이 없을 때(404) 던지는 식별 가능한 에러 — 위젯은 이걸 '버튼 숨김'으로 처리. */
export class NoActiveSurveyError extends Error {
  constructor(public readonly appId: string) {
    super(`appId "${appId}" 에 활성 설문이 없습니다`)
    this.name = 'NoActiveSurveyError'
  }
}

export class SurveyDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'SurveyDeskError'
  }
}

export interface SurveyDeskClient {
  getActiveSurvey(signal?: AbortSignal): Promise<SurveyDto>
  submitResponse(input: SubmitResponseInput, signal?: AbortSignal): Promise<ResponseReceiptDto>
}

const WIDGET_VERSION = '0.1.0'

export function createSurveyDeskClient(options: SurveyDeskClientOptions): SurveyDeskClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const appId = encodeURIComponent(options.appId)
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new SurveyDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }

  const headers = (): Record<string, string> => {
    const h: Record<string, string> = {
      'content-type': 'application/json',
      'x-surveydesk-widget': WIDGET_VERSION,
    }
    if (options.apiToken) h.authorization = `Bearer ${options.apiToken}`
    return h
  }

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    const json: unknown = text ? JSON.parse(text) : null
    if (!res.ok) {
      const rec = (json ?? {}) as Record<string, unknown>
      const raw = rec.message ?? rec.error ?? `SurveyDesk 요청 실패 (${res.status})`
      const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
      throw new SurveyDeskError(msg, res.status, json)
    }
    return json as T
  }

  return {
    async getActiveSurvey(signal) {
      const res = await doFetch(`${base}/api/surveys/${appId}/active`, {
        method: 'GET',
        headers: headers(),
        signal,
      })
      if (res.status === 404) throw new NoActiveSurveyError(options.appId)
      return parse<SurveyDto>(res)
    },

    async submitResponse(input, signal) {
      const res = await doFetch(`${base}/api/surveys/${appId}/responses`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(input),
        signal,
      })
      return parse<ResponseReceiptDto>(res)
    },
  }
}
