import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  CreateTenantInput,
  TenantCreatedDto,
  TenantDto,
  UpdateTenantInput,
} from '@reviewdesk/shared'

/* ──────────────────────────────────────────────────────────────────────────
   테넌트 — 셀프 가입(공개) · 설정 조회/수정 · 키 회전(어드민).
   어드민 요청은 api 클라이언트가 x-sk(또는 x-admin-token+x-tenant-id)를 자동으로 싣는다.
   ────────────────────────────────────────────────────────────────────────── */

export const tenantKey = ['tenant'] as const

/** 셀프 가입 — pk + sk(1회 노출) 발급. 공개 엔드포인트(auth 헤더 없음). */
export function useSignup() {
  return useMutation({
    mutationFn: (input: CreateTenantInput) =>
      api.postPublic<TenantCreatedDto>('tenants', input),
  })
}

/** 내 테넌트 설정·usage·키(공개 정보). */
export function useTenant(enabled = true) {
  return useQuery({
    queryKey: tenantKey,
    queryFn: () => api.get<TenantDto>('admin/tenant'),
    enabled,
    retry: false,
  })
}

/** 설정 수정(name·corsOrigins·autoApprove·plan). */
export function useUpdateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTenantInput) => api.put<TenantDto>('admin/tenant', input),
    onSuccess: (data) => {
      qc.setQueryData(tenantKey, data)
      void qc.invalidateQueries({ queryKey: tenantKey })
    },
  })
}

/** 키 회전 — 새 pk/sk(sk 1회 노출). 기존 키 즉시 무효. */
export function useRotateKeys() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<TenantCreatedDto>('admin/tenant/rotate-keys'),
    onSuccess: (data) => {
      qc.setQueryData(tenantKey, data.tenant)
      void qc.invalidateQueries({ queryKey: tenantKey })
    },
  })
}
