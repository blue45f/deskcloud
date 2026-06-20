import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'
import { sessionKey } from './auth'

import type {
  ApiKeyCreatedDto,
  ApiKeyDto,
  AuditEventDto,
  CreateApiKeyInput,
  InviteMemberInput,
  MemberDto,
  OrgDto,
  PlanId,
  PlanUsageDto,
  SessionDto,
  UpdateMemberInput,
  UpdateOrgInput,
} from '@termsdesk/shared'

export function useAudit(limit = 100) {
  return useQuery({
    queryKey: ['audit', limit],
    queryFn: () => api.get<AuditEventDto[]>('audit', { limit }),
  })
}

export function useApiKeys() {
  return useQuery({ queryKey: ['apikeys'], queryFn: () => api.get<ApiKeyDto[]>('apikeys') })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => api.post<ApiKeyCreatedDto>('apikeys', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apikeys'] }),
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`apikeys/${id}`),
    // 낙관적 갱신 — 폐기는 목록의 '폐기됨' 표시만 바꾸는 저위험 조작. 실패 시 스냅샷 롤백.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['apikeys'] })
      const previous = qc.getQueryData<ApiKeyDto[]>(['apikeys'])
      qc.setQueryData<ApiKeyDto[]>(['apikeys'], (keys) =>
        keys?.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k))
      )
      return { previous }
    },
    onError: (_e, _id, ctx) => qc.setQueryData<ApiKeyDto[]>(['apikeys'], ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ['apikeys'] }),
  })
}

export function useMembers() {
  return useQuery({ queryKey: ['members'], queryFn: () => api.get<MemberDto[]>('members') })
}

export function useInviteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InviteMemberInput) => api.post<MemberDto>('members', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })
}

export function useUpdateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOrgInput) => api.patch<OrgDto>('org', input),
    // 낙관적 갱신 — 조직명·로고를 세션 캐시(사이드바·설정)에 즉시 반영. 실패 시 스냅샷 롤백.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: sessionKey })
      const previous = qc.getQueryData<SessionDto>(sessionKey)
      qc.setQueryData<SessionDto>(sessionKey, (s) =>
        s
          ? {
              ...s,
              org: {
                ...s.org,
                name: input.name ?? s.org.name,
                logoUrl: input.logoUrl !== undefined ? input.logoUrl : s.org.logoUrl,
              },
            }
          : s
      )
      return { previous }
    },
    onError: (_e, _input, ctx) => qc.setQueryData<SessionDto>(sessionKey, ctx?.previous),
    // 세션(조직명 포함) 무효화 → 서버 값과 재동기화
    onSettled: () => qc.invalidateQueries({ queryKey: sessionKey }),
  })
}

export const planUsageKey = ['plan-usage'] as const

/** 현재 플랜·한도·사용량 — 설정 플랜 카드와 대시보드 API 호출 미터 카드가 공유. */
export function usePlanUsage() {
  return useQuery({
    queryKey: planUsageKey,
    queryFn: () => api.get<PlanUsageDto>('org/usage'),
  })
}

/** 플랜 변경(mock 청구) — 결정 기록만 남고 실제 결제는 없다. */
export function useChangePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (plan: PlanId) => api.patch<OrgDto>('org/plan', { plan }),
    onSuccess: () => {
      // 한도·사용량과 세션(org.plan) 모두 서버 값으로 재동기화
      void qc.invalidateQueries({ queryKey: planUsageKey })
      void qc.invalidateQueries({ queryKey: sessionKey })
    },
  })
}

export function useUpdateMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UpdateMemberInput['role'] }) =>
      api.patch<MemberDto>(`members/${id}`, { role }),
    // 낙관적 갱신 — 역할 변경은 가역적이라 목록에 즉시 반영. 실패 시 스냅샷 롤백.
    onMutate: async ({ id, role }) => {
      await qc.cancelQueries({ queryKey: ['members'] })
      const previous = qc.getQueryData<MemberDto[]>(['members'])
      qc.setQueryData<MemberDto[]>(['members'], (members) =>
        members?.map((m) => (m.id === id ? { ...m, role } : m))
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData<MemberDto[]>(['members'], ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`members/${id}`),
    // 낙관적 갱신 — 목록에서 즉시 제거. 실패 시 스냅샷 롤백.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['members'] })
      const previous = qc.getQueryData<MemberDto[]>(['members'])
      qc.setQueryData<MemberDto[]>(['members'], (members) => members?.filter((m) => m.id !== id))
      return { previous }
    },
    onError: (_e, _id, ctx) => qc.setQueryData<MemberDto[]>(['members'], ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })
}
