import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  CreateTemplateInput,
  CreateTenantInput,
  NotifyInput,
  NotifyResultDto,
  SentLogDto,
  TemplateDto,
  TenantCredentialsDto,
  TenantDto,
  UpdateTemplateInput,
  UpdateTenantInput,
} from '@notifydesk/shared'

/* ──────────────────────────────────────────────────────────────────────────
   어드민(secret 키 sk_ 또는 ADMIN_TOKEN) 데이터 훅. 모든 요청은 api 클라이언트가
   세션 인증 헤더(+admin 토큰일 땐 ?tenantId)를 자동으로 싣는다(app/sessionStore).
   ────────────────────────────────────────────────────────────────────────── */

export const tenantKey = ['tenant'] as const
export const templatesKey = ['templates'] as const
export const sentKey = (offset: number, limit: number) => ['sent', offset, limit] as const

// ── 가입(공개) ────────────────────────────────────────────────────────────────

/** 테넌트 셀프 가입 — pk_/sk_ 키쌍 발급(secret 평문 1회 노출). */
export function signup(input: CreateTenantInput): Promise<TenantCredentialsDto> {
  return api.post<TenantCredentialsDto>('tenants', input)
}

// ── 테넌트 ────────────────────────────────────────────────────────────────────

/** 내 테넌트 조회(secret 평문 미포함). */
export function useTenant() {
  return useQuery({
    queryKey: tenantKey,
    queryFn: () => api.get<TenantDto>('admin/tenant'),
  })
}

/** 테넌트 설정 갱신(name·corsOrigins·plan). */
export function useUpdateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTenantInput) => api.put<TenantDto>('admin/tenant', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: tenantKey }),
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

// ── 템플릿 ────────────────────────────────────────────────────────────────────

/** 템플릿 목록(최신순). */
export function useTemplates() {
  return useQuery({
    queryKey: templatesKey,
    queryFn: () => api.get<TemplateDto[]>('admin/templates'),
  })
}

/** 템플릿 생성. */
export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => api.post<TemplateDto>('admin/templates', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: templatesKey }),
  })
}

/** 템플릿 수정(전체 교체). */
export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: UpdateTemplateInput }) =>
      api.put<TemplateDto>(`admin/templates/${encodeURIComponent(key)}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: templatesKey }),
  })
}

/** 템플릿 삭제. */
export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) =>
      api.delete<{ deleted: boolean }>(`admin/templates/${encodeURIComponent(key)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: templatesKey }),
  })
}

// ── 발송 ──────────────────────────────────────────────────────────────────────

export interface SentPage extends SentLogDto {
  totalCount: number | null
}

/** 발송 로그(테넌트 전체, 최신순, 페이지네이션). X-Total-Count 헤더도 함께 읽는다. */
export function useSentLog(offset: number, limit: number) {
  return useQuery({
    queryKey: sentKey(offset, limit),
    queryFn: async (): Promise<SentPage> => {
      const { data, totalCount } = await api.getWithHeaders<SentLogDto>('admin/sent', {
        offset,
        limit,
      })
      return { ...data, totalCount: totalCount ?? data.total }
    },
    placeholderData: (prev) => prev,
  })
}

/** 알림 발송(secret/admin) — 발송 후 발송 로그·테넌트(usage) 캐시 무효화. */
export function useSendNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NotifyInput) => api.post<NotifyResultDto>('notify', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sent'] })
      void qc.invalidateQueries({ queryKey: tenantKey })
    },
  })
}
