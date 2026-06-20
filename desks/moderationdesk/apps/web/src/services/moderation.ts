import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  AdminLogQuery,
  AdminReportQuery,
  CreateRuleInput,
  CreateTenantInput,
  LogListDto,
  ModerateInput,
  ModerateResultDto,
  ReportDto,
  ReportListDto,
  RuleDto,
  StatsDto,
  TenantCreatedDto,
  TenantDto,
  UpdateReportInput,
  UpdateRuleInput,
  UpdateTenantInput,
} from '@moderationdesk/shared'

/* ──────────────────────────────────────────────────────────────────────────
   어드민 데이터 훅. 모든 요청은 api 클라이언트가 인증 헤더(x-sk 또는 X-Admin-Token[+x-pk])를
   authStore 에서 자동으로 싣는다. 자격증명(테넌트)이 바뀌면 쿼리 키도 함께 무효화한다.
   credKey 는 캐시를 자격증명별로 분리하기 위한 보조 키다.
   ────────────────────────────────────────────────────────────────────────── */

export const tenantKey = (credKey: string) => ['tenant', credKey] as const
export const statsKey = (credKey: string) => ['stats', credKey] as const
export const rulesKey = (credKey: string) => ['rules', credKey] as const
export const reportsKey = (credKey: string, q: AdminReportQuery) => ['reports', credKey, q] as const
export const logsKey = (credKey: string, q: AdminLogQuery) => ['logs', credKey, q] as const

// ── 대시보드 통계 ──

/** 대시보드 트래픽/애널리틱스 요약(트래픽·오늘 방문자·가입). 자격증명 스코프에 따라 가입 범위가 달라진다. */
export function useStats(credKey: string, enabled = true) {
  return useQuery({
    queryKey: statsKey(credKey),
    queryFn: () => api.get<StatsDto>('admin/stats'),
    enabled,
    retry: false,
  })
}

// ── 가입(공개) ──

/** 테넌트 셀프 가입 — publishable + secret 키 발급(secret 1회 노출). */
export function useSignup() {
  return useMutation({
    mutationFn: (input: CreateTenantInput) => api.postPublic<TenantCreatedDto>('tenants', input),
  })
}

// ── 테넌트 설정 ──

/** 내 테넌트 설정·usage·키(공개 정보). */
export function useTenant(credKey: string, enabled = true) {
  return useQuery({
    queryKey: tenantKey(credKey),
    queryFn: () => api.get<TenantDto>('admin/tenant'),
    enabled,
    retry: false,
  })
}

export function useUpdateTenant(credKey: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTenantInput) => api.put<TenantDto>('admin/tenant', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: tenantKey(credKey) }),
  })
}

/** 키 회전 — 새 publishable/secret 발급(secret 1회 노출). 기존 키 즉시 무효. */
export function useRotateKeys(credKey: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<TenantCreatedDto>('admin/tenant/rotate-keys'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: tenantKey(credKey) }),
  })
}

// ── 금칙 규칙 CRUD ──

export function useRules(credKey: string, enabled = true) {
  return useQuery({
    queryKey: rulesKey(credKey),
    queryFn: () => api.get<RuleDto[]>('admin/rules'),
    enabled,
  })
}

export function useCreateRule(credKey: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRuleInput) => api.post<RuleDto>('admin/rules', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rulesKey(credKey) }),
  })
}

export function useUpdateRule(credKey: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRuleInput }) =>
      api.patch<RuleDto>(`admin/rules/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rulesKey(credKey) }),
  })
}

export function useDeleteRule(credKey: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`admin/rules/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rulesKey(credKey) }),
  })
}

// ── 신고 큐 ──

export interface ReportsPage extends ReportListDto {
  totalCount: number | null
}

export function useReports(credKey: string, query: AdminReportQuery, enabled = true) {
  return useQuery({
    queryKey: reportsKey(credKey, query),
    queryFn: async (): Promise<ReportsPage> => {
      const { data, totalCount } = await api.getWithHeaders<ReportListDto>('admin/reports', {
        status: query.status,
        subjectType: query.subjectType,
        offset: query.offset,
        limit: query.limit,
      })
      return { ...data, totalCount: totalCount ?? data.total }
    },
    enabled,
    placeholderData: (prev) => prev,
  })
}

export function useUpdateReport(credKey: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReportInput }) =>
      api.patch<ReportDto>(`admin/reports/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reports', credKey] }),
  })
}

// ── 모더레이션 로그 ──

export interface LogsPage extends LogListDto {
  totalCount: number | null
}

export function useLogs(credKey: string, query: AdminLogQuery, enabled = true) {
  return useQuery({
    queryKey: logsKey(credKey, query),
    queryFn: async (): Promise<LogsPage> => {
      const { data, totalCount } = await api.getWithHeaders<LogListDto>('admin/logs', {
        verdict: query.verdict,
        offset: query.offset,
        limit: query.limit,
      })
      return { ...data, totalCount: totalCount ?? data.total }
    },
    enabled,
    placeholderData: (prev) => prev,
  })
}

// ── 검사(moderate) — 어드민 테스트 콘솔(sk 또는 ADMIN_TOKEN+x-pk 로 호출) ──

export function useModerateCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ModerateInput) => api.post<ModerateResultDto>('moderate', input),
    onSuccess: () => {
      // 검사는 로그·usage·트래픽 통계를 늘리므로 관련 캐시를 새로고침.
      void qc.invalidateQueries({ queryKey: ['logs'] })
      void qc.invalidateQueries({ queryKey: ['tenant'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
