/**
 * @termsdesk/sdk — 임베드 클라이언트 (의존성 0).
 *
 * 두 가지 일만 합니다:
 *   1) getCurrentPolicy — 현재 "게시된" 약관 버전 + content_hash 를 가져온다.
 *   2) recordConsent — "누가/어떤 버전(해시)에/언제/어떻게" 동의했는지 변조 방지 영수증으로 남긴다.
 *
 * TermsDesk 는 약관을 작성하지 않습니다. 고객사가 보관·게시한 문안을 그대로 전달하고,
 * 동의 사실을 사후 증명 가능한 형태로 기록할 뿐입니다. 원본 PII 는 받지 않으며,
 * subjectRef 는 고객사가 부여하는 불투명 식별자입니다.
 */

export type ConsentDecision = 'accepted' | 'declined' | 'withdrawn'
export type ConsentMethod = 'checkbox_clickwrap' | 'api' | 'import' | 'sso'

export interface PublicPolicy {
  policySlug: string
  name: string
  type: string
  locale: string
  versionId: string
  versionLabel: string
  contentHash: string
  body: string
  effectiveAt: string | null
  publishedAt: string | null
  changeSummary: string | null
  /** subjectRef 를 함께 보냈을 때만 채워짐 — 이 대상에게 (재)동의가 필요한지 */
  reconsentRequired?: boolean
}

export interface ConsentReceiptCreated {
  receiptId: string
  policySlug: string
  versionLabel: string
  contentHash: string
  decision: ConsentDecision
  createdAt: string
}

export interface TermsDeskClientOptions {
  /** 예: 'https://api.termsdesk.com' 또는 self-hosted 'https://terms.acme.com' */
  baseUrl: string
  /** scope 가 read:current / write:consent 인 API 키 */
  apiKey: string
  /** 커스텀 fetch (SSR/테스트). 기본은 전역 fetch */
  fetch?: typeof fetch
}

export interface GetCurrentParams {
  policySlug: string
  locale?: string
  /** 이 대상의 (재)동의 필요 여부를 함께 계산하려면 전달 */
  subjectRef?: string
}

export interface RecordConsentParams {
  subjectRef: string
  policySlug: string
  decision?: ConsentDecision
  method?: ConsentMethod
  locale?: string
  /** 동의한 버전 해시(보유 시). 누락하면 서버가 현재 게시본으로 채움 */
  contentHash?: string
  evidence?: Record<string, unknown>
}

export class TermsDeskError extends Error {
  readonly status: number
  readonly detail: unknown
  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.name = 'TermsDeskError'
    this.status = status
    this.detail = detail
  }
}

export interface TermsDeskClient {
  getCurrentPolicy(params: GetCurrentParams): Promise<PublicPolicy>
  recordConsent(params: RecordConsentParams): Promise<ConsentReceiptCreated>
}

const SDK_VERSION = '0.1.0'

export function createTermsDeskClient(options: TermsDeskClientOptions): TermsDeskClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new TermsDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }

  const headers = (): Record<string, string> => ({
    'content-type': 'application/json',
    authorization: `Bearer ${options.apiKey}`,
    'x-termsdesk-sdk': SDK_VERSION,
  })

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    const json = text ? JSON.parse(text) : null
    if (!res.ok) {
      const msg = (json && (json.message || json.error)) || `TermsDesk 요청 실패 (${res.status})`
      throw new TermsDeskError(Array.isArray(msg) ? msg.join(', ') : String(msg), res.status, json)
    }
    return json as T
  }

  return {
    async getCurrentPolicy(params) {
      const q = new URLSearchParams()
      if (params.locale) q.set('locale', params.locale)
      if (params.subjectRef) q.set('subjectRef', params.subjectRef)
      const qs = q.toString()
      const url = `${baseUrl}/api/v1/policies/${encodeURIComponent(params.policySlug)}/current${
        qs ? `?${qs}` : ''
      }`
      const res = await doFetch(url, { method: 'GET', headers: headers() })
      return parse<PublicPolicy>(res)
    },

    async recordConsent(params) {
      const res = await doFetch(`${baseUrl}/api/v1/consents`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          subjectRef: params.subjectRef,
          policySlug: params.policySlug,
          decision: params.decision ?? 'accepted',
          method: params.method ?? 'api',
          locale: params.locale,
          contentHash: params.contentHash,
          evidence: params.evidence,
        }),
      })
      return parse<ConsentReceiptCreated>(res)
    },
  }
}
