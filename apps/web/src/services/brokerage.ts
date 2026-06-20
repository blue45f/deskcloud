import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  AdminUpdateProviderInput,
  AdminUpdateRequestInput,
  BrokerageStatsDto,
  CreateMessageInput,
  CreateProposalInput,
  CreateReviewInput,
  CreateServiceRequestInput,
  FlagRequestInput,
  ImportToPolicyDto,
  ImportToPolicyInput,
  ProposalDto,
  ProviderReviewDto,
  ProviderProfileDto,
  ProviderProfileListDto,
  RequestAttachmentDto,
  RequestDetailDto,
  RequestMessageDto,
  RequestRevisionInput,
  ServiceRequestDto,
  ServiceRequestListDto,
  ServiceRequestStatus,
  ServiceRequestType,
  UpdateServiceRequestInput,
  UpsertProviderProfileInput,
} from '@termsdesk/shared'

/**
 * 약관 의뢰 중계(Brokerage) 클라이언트 — TanStack Query 훅 모음.
 * 엔드포인트 계약은 apps/api/src/brokerage/* 와 1:1 대응한다.
 */

export type RequestScope = 'mine' | 'assigned' | 'proposed'

export interface RequestFilter {
  scope?: RequestScope
  status?: ServiceRequestStatus
  type?: ServiceRequestType
}

export interface MarketFilter {
  type?: ServiceRequestType
  policyType?: string
}

export const brokerageKeys = {
  all: ['brokerage'] as const,
  requests: (filter: RequestFilter) => ['brokerage', 'requests', filter] as const,
  request: (id: string) => ['brokerage', 'request', id] as const,
  marketplace: (filter: MarketFilter) => ['brokerage', 'marketplace', filter] as const,
  myProvider: ['brokerage', 'provider', 'me'] as const,
  providers: (specialty?: string) => ['brokerage', 'providers', specialty ?? ''] as const,
  provider: (id: string) => ['brokerage', 'provider', id] as const,
  stats: ['brokerage', 'stats'] as const,
  adminRequests: (status?: string) => ['brokerage', 'admin', 'requests', status ?? ''] as const,
  adminProviders: ['brokerage', 'admin', 'providers'] as const,
  publicProviders: (specialty?: string) =>
    ['brokerage', 'public', 'providers', specialty ?? ''] as const,
  publicProvider: (id: string) => ['brokerage', 'public', 'provider', id] as const,
}

// ── 의뢰(의뢰자/전문가 개인 뷰) ──────────────────────────────────────────────────

export function useServiceRequests(filter: RequestFilter = {}) {
  return useQuery({
    queryKey: brokerageKeys.requests(filter),
    queryFn: () =>
      api.get<ServiceRequestListDto>('requests', {
        scope: filter.scope ?? 'mine',
        status: filter.status,
        type: filter.type,
      }),
  })
}

export function useServiceRequest(id: string | undefined) {
  return useQuery({
    queryKey: brokerageKeys.request(id ?? ''),
    queryFn: () => api.get<RequestDetailDto>(`requests/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateServiceRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateServiceRequestInput) =>
      api.post<ServiceRequestDto>('requests', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

export function useUpdateServiceRequest(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateServiceRequestInput) =>
      api.patch<ServiceRequestDto>(`requests/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

/** 의뢰 상태 전이 — cancel/complete/start. 단일 훅으로 묶어 캐시 무효화 일원화. */
export function useRequestAction(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (action: 'cancel' | 'complete' | 'start') =>
      api.post<ServiceRequestDto>(`requests/${id}/${action}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

export function useRequestRevision(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RequestRevisionInput) =>
      api.post<ServiceRequestDto>(`requests/${id}/request-revision`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

export function useFlagRequest(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagRequestInput) =>
      api.post<ServiceRequestDto>(`requests/${id}/flag`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

// ── 제안(전문가) ───────────────────────────────────────────────────────────────

export function useSubmitProposal(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProposalInput) =>
      api.post<ProposalDto>(`requests/${requestId}/proposals`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

export function useWithdrawProposal(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (proposalId: string) =>
      api.post<ProposalDto>(`requests/${requestId}/proposals/${proposalId}/withdraw`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

export function useAcceptProposal(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (proposalId: string) =>
      api.post<ServiceRequestDto>(`requests/${requestId}/proposals/${proposalId}/accept`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

// ── 스레드 ─────────────────────────────────────────────────────────────────────

export function usePostMessage(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMessageInput) =>
      api.post<RequestMessageDto>(`requests/${requestId}/messages`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.request(requestId) })
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

export function useUploadRequestAttachment(requestId: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return api.postForm<RequestAttachmentDto>(`requests/${requestId}/attachments`, body)
    },
  })
}

/** 완료 산출물 → 약관 초안 버전으로 가져오기. */
export function useImportToPolicy(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ImportToPolicyInput = {}) =>
      api.post<ImportToPolicyDto>(`requests/${requestId}/import-to-policy`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['policies'] })
    },
  })
}

/** 전문가 평가(완료 의뢰). */
export function useSubmitReview(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReviewInput) =>
      api.post<ProviderReviewDto>(`requests/${requestId}/review`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

// ── 마켓플레이스(전문가 탐색) ────────────────────────────────────────────────────

export function useMarketplace(filter: MarketFilter = {}) {
  return useQuery({
    queryKey: brokerageKeys.marketplace(filter),
    queryFn: () =>
      api.get<ServiceRequestListDto>('marketplace', {
        type: filter.type,
        policyType: filter.policyType,
      }),
  })
}

// ── 전문가 프로필 ──────────────────────────────────────────────────────────────

export function useMyProviderProfile() {
  return useQuery({
    queryKey: brokerageKeys.myProvider,
    queryFn: () => api.get<ProviderProfileDto | null>('providers/me'),
  })
}

export function useUpsertProviderProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertProviderProfileInput) =>
      api.put<ProviderProfileDto>('providers/me', input),
    onSuccess: (profile) => {
      qc.setQueryData(brokerageKeys.myProvider, profile)
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

export function useProviders(specialty?: string) {
  return useQuery({
    queryKey: brokerageKeys.providers(specialty),
    queryFn: () => api.get<ProviderProfileListDto>('providers', { specialty }),
  })
}

export function useProvider(id: string | undefined) {
  return useQuery({
    queryKey: brokerageKeys.provider(id ?? ''),
    queryFn: () => api.get<ProviderProfileDto>(`providers/${id}`),
    enabled: Boolean(id),
  })
}

export function usePublicProviders(specialty?: string) {
  return useQuery({
    queryKey: brokerageKeys.publicProviders(specialty),
    queryFn: () => api.get<ProviderProfileListDto>('public/providers', { specialty }),
  })
}

export function usePublicProvider(id: string | undefined) {
  return useQuery({
    queryKey: brokerageKeys.publicProvider(id ?? ''),
    queryFn: () => api.get<ProviderProfileDto>(`public/providers/${id}`),
    enabled: Boolean(id),
  })
}

// ── 통계 ───────────────────────────────────────────────────────────────────────

export function useBrokerageStats() {
  return useQuery({
    queryKey: brokerageKeys.stats,
    queryFn: () => api.get<BrokerageStatsDto>('brokerage/stats'),
    staleTime: 30_000,
  })
}

// ── 운영자 모더레이션 ────────────────────────────────────────────────────────────

export function useAdminRequests(status?: string, flagged?: boolean) {
  return useQuery({
    queryKey: [...brokerageKeys.adminRequests(status), flagged ?? 'all'] as const,
    queryFn: () =>
      api.get<ServiceRequestListDto>('brokerage/admin/requests', {
        status,
        flagged: flagged === undefined ? undefined : String(flagged),
      }),
  })
}

export function useAdminUpdateRequest(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminUpdateRequestInput) =>
      api.patch<ServiceRequestDto>(`brokerage/admin/requests/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}

export function useAdminProviders() {
  return useQuery({
    queryKey: brokerageKeys.adminProviders,
    queryFn: () => api.get<ProviderProfileListDto>('brokerage/admin/providers'),
  })
}

export function useAdminUpdateProvider(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminUpdateProviderInput) =>
      api.patch<ProviderProfileDto>(`brokerage/admin/providers/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brokerageKeys.all })
    },
  })
}
