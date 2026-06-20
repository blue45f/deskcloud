import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  AssetListDto,
  OverviewDto,
  RotateKeysResultDto,
  SignupInput,
  SignupResultDto,
  StorageInfoDto,
  TenantDto,
  UpdateTenantInput,
} from '@mediadesk/shared'

import { useSessionStore } from '@/app/sessionStore'

/* ──────────────────────────────────────────────────────────────────────────
   어드민 데이터 훅. 모든 요청은 api 클라이언트가 X-Sk(또는 X-Admin-Token)를 자동으로 싣는다.
   ────────────────────────────────────────────────────────────────────────── */

export const meKey = ['me'] as const
export const overviewKey = ['overview'] as const
export const storageKey = ['storage'] as const
export const foldersKey = ['folders'] as const
export const assetsKey = (folder: string, offset: number, limit: number) =>
  ['assets', folder, offset, limit] as const

/**
 * 운영 지표(가입 실데이터 + 방문/트래픽 신규 집계). 마스터 토큰 세션에서만 활성화한다
 * (테넌트 secret 키 세션은 403 → 호출하지 않음). 60초마다 가볍게 갱신.
 */
export function useOverview() {
  const adminToken = useSessionStore((s) => s.adminToken)
  return useQuery({
    queryKey: overviewKey,
    queryFn: () => api.get<OverviewDto>('admin/overview'),
    enabled: adminToken.length > 0,
    refetchInterval: 60_000,
    retry: false,
  })
}

/** 현재 인증된 테넌트(사용량 포함). */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => api.get<TenantDto>('admin/me'),
    retry: false,
  })
}

/** 스토리지 어댑터 정보 + 변환(sharp) 가용성. */
export function useStorageInfo() {
  return useQuery({
    queryKey: storageKey,
    queryFn: () => api.get<StorageInfoDto>('admin/storage'),
    staleTime: 5 * 60_000,
  })
}

/** 테넌트의 폴더(논리 그룹) 목록. */
export function useFolders() {
  return useQuery({
    queryKey: foldersKey,
    queryFn: () => api.get<string[]>('admin/folders'),
  })
}

/** 자산 목록(폴더 필터·페이지네이션). folder='' 면 전체. */
export function useAssets(folder: string, offset: number, limit: number) {
  return useQuery({
    queryKey: assetsKey(folder, offset, limit),
    queryFn: () =>
      api.get<AssetListDto>('admin/assets', {
        folder: folder || undefined,
        offset,
        limit,
      }),
    placeholderData: (prev) => prev,
  })
}

/** 가입(self-register) — pk_/sk_ 발급. 성공 시 세션을 채운다. */
export function useSignup() {
  const setTenant = useSessionStore((s) => s.setTenant)
  const loginWithSecret = useSessionStore((s) => s.loginWithSecret)
  return useMutation({
    mutationFn: (input: SignupInput) => api.post<SignupResultDto>('tenants/signup', input),
    onSuccess: (res) => {
      loginWithSecret(res.secretKey)
      setTenant({
        publishableKey: res.tenant.publishableKey,
        tenantSlug: res.tenant.slug,
      })
    },
  })
}

/** 테넌트 설정 변경(이름·플랜·CORS). */
export function useUpdateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTenantInput) => api.patch<TenantDto>('admin/tenant', input),
    onSuccess: (tenant) => {
      qc.setQueryData(meKey, tenant)
      void qc.invalidateQueries({ queryKey: meKey })
    },
  })
}

/** 키 회전 — 새 pk_/sk_ 발급. 성공 시 세션 키를 교체한다. */
export function useRotateKeys() {
  const qc = useQueryClient()
  const loginWithSecret = useSessionStore((s) => s.loginWithSecret)
  const setTenant = useSessionStore((s) => s.setTenant)
  const adminToken = useSessionStore((s) => s.adminToken)
  return useMutation({
    mutationFn: () => api.post<RotateKeysResultDto>('admin/tenant/rotate-keys'),
    onSuccess: (res) => {
      // 마스터 토큰 세션이면 sk 로 전환하지 않고 토큰 유지(테넌트 publishable 만 갱신).
      if (!adminToken) loginWithSecret(res.secretKey)
      setTenant({ publishableKey: res.publishableKey })
      void qc.invalidateQueries({ queryKey: meKey })
    },
  })
}

/** 자산 삭제(키로). */
export function useDeleteAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) =>
      api.delete<{ deleted: true; key: string }>(
        `admin/assets/${key.split('/').map(encodeURIComponent).join('/')}`
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assets'] })
      void qc.invalidateQueries({ queryKey: foldersKey })
      void qc.invalidateQueries({ queryKey: meKey })
    },
  })
}
