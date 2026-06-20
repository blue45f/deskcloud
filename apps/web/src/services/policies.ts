import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  CreatePolicyInput,
  CreateVersionInput,
  PolicyDto,
  PolicyVersionDetailDto,
  PolicyVersionSummaryDto,
  PublishVersionInput,
  UpdatePolicyInput,
  UpdateVersionInput,
} from '@termsdesk/shared'

export const policyKeys = {
  all: ['policies'] as const,
  one: (idOrSlug: string) => ['policy', idOrSlug] as const,
  versions: (policyId: string) => ['versions', policyId] as const,
  version: (versionId: string) => ['version', versionId] as const,
}

export function usePolicies() {
  return useQuery({ queryKey: policyKeys.all, queryFn: () => api.get<PolicyDto[]>('policies') })
}

export function usePolicy(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: policyKeys.one(idOrSlug ?? ''),
    queryFn: () => api.get<PolicyDto>(`policies/${idOrSlug}`),
    enabled: Boolean(idOrSlug),
  })
}

export function useVersions(policyId: string | undefined) {
  return useQuery({
    queryKey: policyKeys.versions(policyId ?? ''),
    queryFn: () => api.get<PolicyVersionSummaryDto[]>(`policies/${policyId}/versions`),
    enabled: Boolean(policyId),
  })
}

export function useVersion(versionId: string | undefined) {
  return useQuery({
    queryKey: policyKeys.version(versionId ?? ''),
    queryFn: () => api.get<PolicyVersionDetailDto>(`versions/${versionId}`),
    enabled: Boolean(versionId),
  })
}

export function useCreatePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePolicyInput) => api.post<PolicyDto>('policies', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: policyKeys.all }),
  })
}

export function useUpdatePolicy(idOrSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdatePolicyInput) => api.patch<PolicyDto>(`policies/${idOrSlug}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: policyKeys.all })
      void qc.invalidateQueries({ queryKey: policyKeys.one(idOrSlug) })
    },
  })
}

export function useArchivePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (idOrSlug: string) => api.delete(`policies/${idOrSlug}`),
    // 낙관적 갱신 — 보관은 목록에서 숨기는 가역 조작이라 즉시 제거. 실패 시 스냅샷 롤백.
    onMutate: async (idOrSlug) => {
      await qc.cancelQueries({ queryKey: policyKeys.all })
      const previous = qc.getQueryData<PolicyDto[]>(policyKeys.all)
      qc.setQueryData<PolicyDto[]>(policyKeys.all, (policies) =>
        policies?.filter((p) => p.id !== idOrSlug && p.slug !== idOrSlug)
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData<PolicyDto[]>(policyKeys.all, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: policyKeys.all }),
  })
}

// 버전 생성/수정·게시(publish)·동의 기록(consents.ts)은 의도적으로 비낙관(invalidate-only) 유지 —
// content_hash 동결·append-only 감사 기록은 서버가 진실원천이라 클라이언트 선반영이 부적합하다.
export function useCreateVersion(policyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVersionInput) =>
      api.post<PolicyVersionDetailDto>(`policies/${policyId}/versions`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: policyKeys.versions(policyId) })
      void qc.invalidateQueries({ queryKey: policyKeys.one(policyId) })
    },
  })
}

export function useUpdateVersion(versionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateVersionInput) =>
      api.patch<PolicyVersionDetailDto>(`versions/${versionId}`, input),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: policyKeys.version(versionId) })
      void qc.invalidateQueries({ queryKey: policyKeys.versions(v.policyId) })
    },
  })
}

export function usePublishVersion(versionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PublishVersionInput) =>
      api.post<PolicyVersionDetailDto>(`versions/${versionId}/publish`, input),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: policyKeys.version(versionId) })
      void qc.invalidateQueries({ queryKey: policyKeys.versions(v.policyId) })
      void qc.invalidateQueries({ queryKey: policyKeys.all })
      void qc.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}
