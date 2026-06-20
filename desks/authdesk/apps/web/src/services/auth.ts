import { api, ApiError } from './api'

import type {
  AuthStatsDto,
  CreateTenantInput,
  TenantDto,
  TenantWithSecretDto,
  TrackVisitResultDto,
  UsageSummaryDto,
  UserListDto,
} from '@authdesk/shared'

/** 공개 가입 — pk_/sk_ 키쌍 발급(인증 불요). slug·name 명시. */
export function signup(input: CreateTenantInput): Promise<TenantWithSecretDto> {
  return api.post<TenantWithSecretDto>('tenants', input, false)
}

/** 내 테넌트 조회(sk_) — 로그인 검증에 사용. */
export function getTenant(): Promise<TenantDto> {
  return api.get<TenantDto>('tenants/me')
}

/** end-user 목록(sk_) — 페이지네이션·이메일 검색. */
export function listUsers(query: {
  limit?: number
  offset?: number
  q?: string
}): Promise<UserListDto> {
  return api.get<UserListDto>('auth/users', query)
}

/** 사용자 통계(sk_). */
export function getStats(): Promise<AuthStatsDto> {
  return api.get<AuthStatsDto>('auth/stats')
}

/** 사용량 요약(sk_) — 메트릭별 used/limit/remaining(플랜 한도 대비 여유). */
export function getUsage(): Promise<UsageSummaryDto> {
  return api.get<UsageSummaryDto>('auth/usage')
}

/** end-user 삭제(sk_). */
export function deleteUser(id: string): Promise<{ deleted: boolean; id: string }> {
  return api.delete<{ deleted: boolean; id: string }>(`auth/users/${id}`)
}

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/**
 * 방문 핑(pk_) — POST /auth/visit. publishable 키 + 선택적 vid 로 트래픽/고유 방문자를 집계한다.
 *
 * 공개 위젯 경로와 동일한 헤더 계약(X-Authdesk-Key: pk_)이라 sk_ Bearer 를 쓰는 api 헬퍼 대신
 * 전용 fetch 로 보낸다. fire-and-forget — 실패해도 대시보드 동작에 영향 없게 호출부가 무시한다.
 */
export async function trackVisit(
  publishableKey: string,
  vid: string
): Promise<TrackVisitResultDto> {
  const url = `${BASE}/api/auth/visit`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-authdesk-key': publishableKey,
    },
    body: JSON.stringify({ vid }),
  })
  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!res.ok) {
    const m = (data as { message?: unknown } | null)?.message
    const message = Array.isArray(m)
      ? m.join(', ')
      : (m ?? `방문 집계에 실패했습니다 (${res.status})`)
    throw new ApiError(String(message), res.status, data)
  }
  return data as TrackVisitResultDto
}
