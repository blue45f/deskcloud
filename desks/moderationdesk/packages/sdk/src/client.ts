/**
 * ModerationDesk 서버 클라이언트 — secret 키(sk_)로 호출. 런타임 의존성 0.
 *
 * 감싸는 엔드포인트(모두 ModerationDesk API `/api` prefix):
 *   - moderate : POST /moderate            (x-sk) — 텍스트 검사(규칙 항상 + AI 선택)
 *   - report   : POST /reports             (서버에선 sk 불가 → pk 필요, 아래 주석 참고)
 *   - rules    : GET/POST/PATCH/DELETE /admin/rules     (x-sk)
 *   - reports  : GET /admin/reports, PATCH /admin/reports/:id (x-sk)
 *   - logs     : GET /admin/logs           (x-sk)
 *   - tenant   : GET /admin/tenant         (x-sk)
 *
 * 신고 제출(POST /reports)은 publishable 키 + Origin 가드라서 서버 sk 로는 못 부른다.
 * 서버에서 신고를 대신 적재하려면 어드민 경로를 쓰거나, 신고는 브라우저 위젯
 * (@moderationdesk/widget)에서 pk 로 보낸다. 그래서 이 SDK 는 신고 "조회/전이"만 노출.
 */
import type {
  AdminLogQuery,
  AdminReportQuery,
  CreateRuleInput,
  LogListDto,
  ModerateInput,
  ModerateMeta,
  ModerateResultDto,
  ReportDto,
  ReportListDto,
  RuleDto,
  TenantDto,
  UpdateReportInput,
  UpdateRuleInput,
  Verdict,
} from '@moderationdesk/shared'

export interface ModerationClientOptions {
  /** 서버 전용 secret 키(sk_...). 브라우저 번들에 넣지 마세요. */
  secretKey: string
  /** API 베이스 URL. 예: 'https://moderate.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(테스트/SSR/프록시). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

/** moderate 호출 옵션 — text 외 모든 컨텍스트(공유 ModerateInput 의 text 제외분). */
export interface ModerateOptions {
  /** AI 보조를 강제로 끄려면 false(키가 있어도 규칙만). 기본은 서버가 키 존재 시 사용. */
  useAi?: boolean
  /** 부가 컨텍스트(pageUrl·userId·source). 로그에 함께 적재된다. */
  meta?: ModerateMeta
  /** 요청 취소용. */
  signal?: AbortSignal
}

/** check() 의 단순화된 결과 — 통과 여부를 boolean 으로. */
export interface CheckResult {
  /** verdict 가 'block' 이 아니면 true(allow·flag 통과). 강제 차단만 막고 싶을 때. */
  allowed: boolean
  /** 'block' 이면 true — 콘텐츠를 거부해야 함. */
  blocked: boolean
  /** 'flag' 이상이면 true — 운영자 검토 대상으로 분류할 수 있음. */
  flagged: boolean
  /** 원본 판정. */
  verdict: Verdict
  /** 검사 전체 결과(규칙·AI 점수·logId). */
  result: ModerateResultDto
}

/** 비-2xx 응답 에러(검증·인증·서버). status 와 서버 detail 을 보존. */
export class ModerationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'ModerationError'
  }
}

/** 무료 플랜 소프트 한도 초과(HTTP 402) — 식별 가능한 전용 에러. */
export class PlanLimitError extends ModerationError {
  constructor(message: string, detail?: unknown) {
    super(message, 402, detail)
    this.name = 'PlanLimitError'
  }
}

export interface ModerationClient {
  /** 텍스트 검사 → 전체 결과(verdict·matchedRules·aiScore?·logId). */
  moderate(text: string, opts?: ModerateOptions): Promise<ModerateResultDto>
  /** moderate 의 편의 래퍼 — { allowed, blocked, flagged, verdict, result }. */
  check(text: string, opts?: ModerateOptions): Promise<CheckResult>

  /** 어드민: 금칙 규칙 목록(최신순). */
  listRules(signal?: AbortSignal): Promise<RuleDto[]>
  /** 어드민: 규칙 생성. */
  createRule(input: CreateRuleInput, signal?: AbortSignal): Promise<RuleDto>
  /** 어드민: 규칙 수정(부분 갱신). */
  updateRule(id: string, input: UpdateRuleInput, signal?: AbortSignal): Promise<RuleDto>
  /** 어드민: 규칙 삭제. */
  deleteRule(id: string, signal?: AbortSignal): Promise<void>

  /** 어드민: 신고 목록(필터·페이지네이션). total 은 응답 본문에서. */
  listReports(query?: AdminReportQuery, signal?: AbortSignal): Promise<ReportListDto>
  /** 어드민: 신고 상태 전이/메모. */
  updateReport(id: string, input: UpdateReportInput, signal?: AbortSignal): Promise<ReportDto>

  /** 어드민: 모더레이션 로그 목록(필터·페이지네이션). */
  listLogs(query?: AdminLogQuery, signal?: AbortSignal): Promise<LogListDto>

  /** 어드민: 내 테넌트 설정·usage(공개 정보). */
  getTenant(signal?: AbortSignal): Promise<TenantDto>
}

const SDK_VERSION = '0.1.0'

export function createModerationClient(options: ModerationClientOptions): ModerationClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new ModerationError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }
  if (!options.secretKey) {
    throw new ModerationError('secretKey 가 필요합니다 (sk_...).', 0)
  }

  const headers = (): Record<string, string> => ({
    'content-type': 'application/json',
    'x-sk': options.secretKey,
    'x-moderationdesk-sdk': SDK_VERSION,
  })

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    const json: unknown = text ? safeJson(text) : null
    if (!res.ok) {
      const rec = (json ?? {}) as Record<string, unknown>
      const raw = rec.message ?? rec.error ?? `ModerationDesk 요청 실패 (${res.status})`
      const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
      if (res.status === 402) throw new PlanLimitError(msg, json)
      throw new ModerationError(msg, res.status, json)
    }
    return json as T
  }

  async function send<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const res = await doFetch(`${base}/api${path}`, {
      method,
      headers: headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
    return parse<T>(res)
  }

  return {
    async moderate(text, opts) {
      const payload: ModerateInput = { text }
      if (opts?.useAi !== undefined) payload.useAi = opts.useAi
      if (opts?.meta) payload.meta = opts.meta
      return send<ModerateResultDto>('POST', '/moderate', payload, opts?.signal)
    },

    async check(text, opts) {
      const result = await this.moderate(text, opts)
      return {
        allowed: result.verdict !== 'block',
        blocked: result.verdict === 'block',
        flagged: result.verdict !== 'allow',
        verdict: result.verdict,
        result,
      }
    },

    listRules: (signal) => send<RuleDto[]>('GET', '/admin/rules', undefined, signal),
    createRule: (input, signal) => send<RuleDto>('POST', '/admin/rules', input, signal),
    updateRule: (id, input, signal) =>
      send<RuleDto>('PATCH', `/admin/rules/${encodeURIComponent(id)}`, input, signal),
    deleteRule: async (id, signal) => {
      await send<void>('DELETE', `/admin/rules/${encodeURIComponent(id)}`, undefined, signal)
    },

    listReports: (query, signal) =>
      send<ReportListDto>('GET', `/admin/reports${toQuery(query)}`, undefined, signal),
    updateReport: (id, input, signal) =>
      send<ReportDto>('PATCH', `/admin/reports/${encodeURIComponent(id)}`, input, signal),

    listLogs: (query, signal) =>
      send<LogListDto>('GET', `/admin/logs${toQuery(query)}`, undefined, signal),

    getTenant: (signal) => send<TenantDto>('GET', '/admin/tenant', undefined, signal),
  }
}

/** JSON.parse 를 안전하게 — 비-JSON 본문이면 원문 문자열을 그대로 반환(에러 메시지용). */
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** 쿼리 객체 → '?a=1&b=2'(빈 값/undefined 생략). 빈 객체면 ''. */
function toQuery(query?: Record<string, unknown>): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    params.set(k, String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}
