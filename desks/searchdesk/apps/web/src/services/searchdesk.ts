import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  CreateTenantInput,
  DeleteResultDto,
  DocumentListDto,
  IndexResultDto,
  PlatformStatsDto,
  SearchResponseDto,
  TenantCredentialsDto,
  TenantDto,
  UpdateTenantInput,
  UpsertDocumentsInput,
  UsageDto,
} from '@searchdesk/shared'

/* ──────────────────────────────────────────────────────────────────────────
   어드민 데이터 훅. 모든 요청은 api 클라이언트가 secret 키(Authorization) 또는
   ADMIN_TOKEN(+tenantId)을 자동으로 싣는다(app/authStore).
   ────────────────────────────────────────────────────────────────────────── */

export const tenantKey = ['admin', 'tenant'] as const
export const usageKey = ['admin', 'usage'] as const
export const docsKey = (index: string, offset: number, limit: number) =>
  ['admin', 'docs', index, offset, limit] as const

/** 내 테넌트 조회(secret 평문 미포함). */
export function useTenant() {
  return useQuery({
    queryKey: tenantKey,
    queryFn: () => api.get<TenantDto>('admin/tenant'),
  })
}

/** 사용량 — 누적 문서 수·검색 수·플랜 캡. */
export function useUsage() {
  return useQuery({
    queryKey: usageKey,
    queryFn: () => api.get<UsageDto>('admin/usage'),
  })
}

export interface DocsPage extends DocumentListDto {
  totalCount: number | null
}

/** 색인된 문서 목록(페이지네이션, index 한정 가능). X-Total-Count 헤더도 읽는다. */
export function useDocs(index: string, offset: number, limit: number) {
  return useQuery({
    queryKey: docsKey(index, offset, limit),
    queryFn: async (): Promise<DocsPage> => {
      const { data, totalCount } = await api.getWithHeaders<DocumentListDto>('admin/docs', {
        index: index || undefined,
        offset,
        limit,
      })
      return { ...data, totalCount: totalCount ?? data.total }
    },
    placeholderData: (prev) => prev,
  })
}

/** 문서 색인(upsert) — 단건/배치. free 플랜 문서 캡 적용. */
export function useUpsertDocs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertDocumentsInput) => api.post<IndexResultDto>('docs', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'docs'] })
      void qc.invalidateQueries({ queryKey: usageKey })
      void qc.invalidateQueries({ queryKey: tenantKey })
    },
  })
}

/** 문서 삭제(docId 기준, index 선택). */
export function useDeleteDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, index }: { id: string; index?: string }) =>
      api.delete<DeleteResultDto>(`docs/${encodeURIComponent(id)}`, { index }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'docs'] })
      void qc.invalidateQueries({ queryKey: usageKey })
      void qc.invalidateQueries({ queryKey: tenantKey })
    },
  })
}

/** 테넌트 설정 갱신(name·corsOrigins·plan). */
export function useUpdateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTenantInput) => api.put<TenantDto>('admin/tenant', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantKey })
      void qc.invalidateQueries({ queryKey: usageKey })
    },
  })
}

/** 키 로테이션 — 새 pk_/sk_ 발급(secret 평문 1회 노출). */
export function useRotateKeys() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<TenantCredentialsDto>('admin/tenant/rotate-keys'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: tenantKey }),
  })
}

/** 공개(무인증) 테넌트 셀프 가입. */
export function useSignup() {
  return useMutation({
    mutationFn: (input: CreateTenantInput) => api.signup<TenantCredentialsDto>('tenants', input),
  })
}

export const platformStatsKey = ['public', 'stats'] as const

/**
 * 플랫폼 현황(공개·무인증) — 오늘/총 방문자·가입. /api/stats 는 인증 헤더가 필요 없다.
 * 60초마다 가볍게 갱신.
 */
export function usePlatformStats() {
  return useQuery({
    queryKey: platformStatsKey,
    queryFn: () => api.getPublic<PlatformStatsDto>('stats'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

/** 공개 방문 핑 — 탭 세션당 1회만(서버 쿠키가 고유 판정). 비차단·에러 무시. */
export function trackPageVisit(): void {
  void api.trackVisit('stats/visit')
}

/**
 * 라이브 검색 테스터 — publishable 키로 GET /api/search 를 직접 호출한다.
 * (검색 경로는 PublishableKeyGuard 라 secret/admin 헤더가 아니라 pk_ 키 + Origin 을 쓴다.)
 */
export async function runSearch(params: {
  publishableKey: string
  endpoint: string
  q: string
  index?: string
  category?: string
  tags?: string[]
  limit?: number
  signal?: AbortSignal
}): Promise<SearchResponseDto> {
  const base = params.endpoint.replace(/\/+$/, '')
  const qs = new URLSearchParams()
  qs.set('q', params.q ?? '')
  if (params.index) qs.set('index', params.index)
  if (params.category) qs.set('category', params.category)
  if (params.tags && params.tags.length > 0) qs.set('tags', params.tags.join(','))
  if (params.limit != null) qs.set('limit', String(params.limit))

  const res = await fetch(`${base}/api/search?${qs.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${params.publishableKey}` },
    signal: params.signal,
  })
  const text = await res.text()
  const json: unknown = text ? JSON.parse(text) : null
  if (!res.ok) {
    const rec = (json ?? {}) as Record<string, unknown>
    const m = rec.message ?? rec.error ?? `검색 요청 실패 (${res.status})`
    throw new Error(Array.isArray(m) ? m.join(', ') : String(m))
  }
  return json as SearchResponseDto
}
