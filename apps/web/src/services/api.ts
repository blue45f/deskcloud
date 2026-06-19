import type {
  CheckoutInput,
  CheckoutResponseDto,
  CreateTenantInput,
  InquiryAdminDto,
  InquiryListDto,
  InquiryStatus,
  PlanSummaryDto,
  SubscriptionDto,
  TenantDto,
  TenantWithSecretDto,
  UpdateTenantInput,
  UsageSummaryDto,
} from '@desk/shared/browser'

import { getSessionToken, useSessionStore } from '@/app/sessionStore'

/** API 베이스 — Vite 빌드 타임 주입(VITE_API_BASE_URL). 비면 동일 출처(/api 프록시). */
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/** 콘솔 API 연결 여부 — VITE_API_BASE_URL 가 설정된 빌드에서만 콘솔(가입·로그인·대시보드)이 활성화. */
export const CONSOLE_API_READY = BASE.length > 0

/** 구조화된 API 에러 — status + 서버 메시지. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | undefined>
  /** secret 키(Bearer) 필요 여부. 기본 false(공개 경로). */
  auth?: boolean
  /** 어드민 토큰 — 지정 시 X-Admin-Token 헤더로 싣는다(어드민 경로). */
  adminToken?: string
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = false, adminToken } = opts
  const qs = query
    ? new URLSearchParams(
        Object.entries(query).filter((e): e is [string, string] => e[1] !== undefined)
      ).toString()
    : ''
  const url = `${BASE}/api/${path.replace(/^\//, '')}${qs ? `?${qs}` : ''}`

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (auth) {
    const token = getSessionToken()
    if (token) headers.authorization = `Bearer ${token}`
  }
  if (adminToken) headers['x-admin-token'] = adminToken

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (e) {
    throw new ApiError(
      `서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. (${(e as Error).message})`,
      0
    )
  }

  // 인증 실패 → 세션 정리(보호 경로에서만 의미 있음).
  if (auth && (res.status === 401 || res.status === 403)) {
    useSessionStore.getState().clear()
  }

  const text = await res.text()
  const data: unknown = text ? safeParse(text) : null
  if (!res.ok) {
    const msg = extractMessage(data) ?? `요청 실패 (${res.status} ${res.statusText})`
    throw new ApiError(msg, res.status, data)
  }
  return data as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractMessage(data: unknown): string | null {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message
    if (Array.isArray(m)) return m.join(', ')
    if (typeof m === 'string') return m
  }
  return null
}

// ── 공개 ──────────────────────────────────────────────────────────────────

/** 공개 가격표 — @desk/billing 단일 소스. */
export function fetchPlans(): Promise<PlanSummaryDto[]> {
  return request<PlanSummaryDto[]>('billing/plans')
}

/** 가입(테넌트 생성) — secret 키 평문은 이 응답에서 1회만. */
export function signup(input: CreateTenantInput): Promise<TenantWithSecretDto> {
  return request<TenantWithSecretDto>('tenants', { method: 'POST', body: input })
}

// ── 보호(secret 키 Bearer) ─────────────────────────────────────────────────

/** 내 테넌트 조회 — 로그인 검증에도 사용. */
export function fetchTenant(): Promise<TenantDto> {
  return request<TenantDto>('tenant', { auth: true })
}

/** 내 테넌트 수정(name·corsOrigins). */
export function updateTenant(input: UpdateTenantInput): Promise<TenantDto> {
  return request<TenantDto>('tenant', { method: 'PUT', body: input, auth: true })
}

/** 키 회전 — 새 secret 키 1회 반환(이전 키 즉시 무효). */
export function rotateKeys(): Promise<TenantWithSecretDto> {
  return request<TenantWithSecretDto>('tenant/rotate-keys', { method: 'POST', auth: true })
}

/** 사용량 — period='current'(기본) 또는 'YYYY-MM'. */
export function fetchUsage(period?: string): Promise<UsageSummaryDto> {
  return request<UsageSummaryDto>('usage', { auth: true, query: { period } })
}

/** 내 구독. */
export function fetchSubscription(): Promise<SubscriptionDto> {
  return request<SubscriptionDto>('billing/subscription', { auth: true })
}

/** 체크아웃 시작 — 스텁 checkoutUrl. 실제 청구 없음. */
export function startCheckout(input: CheckoutInput): Promise<CheckoutResponseDto> {
  return request<CheckoutResponseDto>('billing/checkout', {
    method: 'POST',
    body: input,
    auth: true,
  })
}

/** 구독 취소 → Free 복귀. */
export function cancelSubscription(): Promise<SubscriptionDto> {
  return request<SubscriptionDto>('billing/cancel', { method: 'POST', auth: true })
}

// ── 문의(어드민, X-Admin-Token) ────────────────────────────────────────────

/** 앱별 문의 목록(어드민) — 회신 이메일·출처 URL 포함. status 로 필터 가능. */
export function fetchInquiriesAdmin(
  appId: string,
  adminToken: string,
  params?: { status?: InquiryStatus; limit?: number; offset?: number }
): Promise<InquiryListDto<InquiryAdminDto>> {
  return request<InquiryListDto<InquiryAdminDto>>(
    `v1/apps/${encodeURIComponent(appId)}/inquiries/admin`,
    {
      adminToken,
      query: {
        status: params?.status,
        limit: params?.limit != null ? String(params.limit) : undefined,
        offset: params?.offset != null ? String(params.offset) : undefined,
      },
    }
  )
}

/** 문의 상태 변경(어드민) — new/in_progress/resolved/closed. */
export function updateInquiryStatus(
  appId: string,
  id: string,
  status: InquiryStatus,
  adminToken: string
): Promise<InquiryAdminDto> {
  return request<InquiryAdminDto>(
    `v1/apps/${encodeURIComponent(appId)}/inquiries/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: { status }, adminToken }
  )
}
