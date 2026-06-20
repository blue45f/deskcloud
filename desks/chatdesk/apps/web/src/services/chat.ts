import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, postPublic } from './api'

import type {
  ConversationDto,
  CreateTenantInput,
  MessageHistoryDto,
  SystemMessageInput,
  TenantAnalyticsDto,
  TenantDto,
  TenantUsage,
  TenantWithSecretDto,
  UpdateTenantSettingsInput,
} from '@chatdesk/shared'

// ── 쿼리 키 ──────────────────────────────────────────────────────────────────

export const tenantKey = ['admin', 'tenant'] as const
export const usageKey = ['admin', 'tenant', 'usage'] as const
export const analyticsKey = ['admin', 'tenant', 'analytics'] as const
export const conversationsKey = ['admin', 'conversations'] as const
export const messagesKey = (conversationId: string) =>
  ['admin', 'conversations', conversationId, 'messages'] as const

// ── 테넌트(가입은 공개, 나머지는 sk) ──────────────────────────────────────────

/** 공개 가입 — pk·sk 발급. secret 키 평문은 이 응답에서만. */
export function useSignup() {
  return useMutation({
    mutationFn: (input: CreateTenantInput) => postPublic<TenantWithSecretDto>('tenants', input),
  })
}

/** 내 테넌트(키·CORS·요금제·사용량). */
export function useTenant() {
  return useQuery({
    queryKey: tenantKey,
    queryFn: () => api.get<TenantDto>('admin/tenant'),
  })
}

/** 사용량(messages·cap) — 라이브 통계용으로 자주 갱신. */
export function useUsage(enabled = true) {
  return useQuery({
    queryKey: usageKey,
    queryFn: () => api.get<TenantUsage>('admin/tenant/usage'),
    enabled,
    refetchInterval: 10_000,
  })
}

/**
 * 트래픽·가입 분석(대시보드 상단 패널) — 오늘 방문자·총 트래픽(추적값) + 오늘/총 신규 가입(실측).
 * 라이브 갱신을 위해 짧게 폴링한다(useConversations 와 동일 주기).
 */
export function useAnalytics(enabled = true) {
  return useQuery({
    queryKey: analyticsKey,
    queryFn: () => api.get<TenantAnalyticsDto>('admin/tenant/analytics'),
    enabled,
    refetchInterval: 15_000,
  })
}

/** 테넌트 설정 수정(이름·CORS·요금제). 보낸 필드만 갱신. */
export function useUpdateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTenantSettingsInput) => api.put<TenantDto>('admin/tenant', input),
    onSuccess: (data) => {
      qc.setQueryData(tenantKey, data)
      void qc.invalidateQueries({ queryKey: usageKey })
    },
  })
}

/** 키 회전 — 새 pk·sk. sk 평문 1회 노출. */
export function useRotateKeys() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<TenantWithSecretDto>('admin/tenant/rotate-keys'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantKey })
    },
  })
}

// ── 대화·메시지(어드민) ───────────────────────────────────────────────────────

/** 테넌트의 모든 대화(최신순). */
export function useConversations() {
  return useQuery({
    queryKey: conversationsKey,
    queryFn: () => api.get<ConversationDto[]>('admin/conversations'),
    refetchInterval: 15_000,
  })
}

/**
 * 대화 메시지 히스토리(어드민 뷰어) — 전용 어드민 엔드포인트
 * `GET /admin/conversations/:id/messages` 를 sk(또는 X-Admin-Token)로 호출한다.
 * 멤버십·Origin 과 무관하게 운영자가 전체 메시지를 모니터하며, 삭제된 메시지도
 * deleted=true 로 포함된다(모더레이션 이력). 라이브 갱신을 위해 짧게 폴링한다.
 */
export function useMessages(conversationId: string | null) {
  const enabled = Boolean(conversationId)
  return useQuery({
    queryKey: messagesKey(conversationId ?? '_'),
    queryFn: () =>
      api.get<MessageHistoryDto>(`admin/conversations/${conversationId}/messages`, { limit: 100 }),
    enabled,
    refetchInterval: enabled ? 8_000 : false,
  })
}

/** 시스템(공지) 발송 — 발신자 없는 메시지. WS 브로드캐스트. */
export function useSystemSend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { conversationId: string; input: SystemMessageInput }) =>
      api.post(`admin/conversations/${vars.conversationId}/system-message`, vars.input),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: messagesKey(vars.conversationId) })
      void qc.invalidateQueries({ queryKey: conversationsKey })
      void qc.invalidateQueries({ queryKey: usageKey })
    },
  })
}

/** 모더레이션 — 메시지 soft delete. */
export function useDeleteMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { messageId: string; conversationId: string }) =>
      api.delete(`admin/messages/${vars.messageId}`),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: messagesKey(vars.conversationId) })
    },
  })
}

/** 모더레이션 취소 — soft delete 된 메시지 복원(본문 복구). */
export function useRestoreMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { messageId: string; conversationId: string }) =>
      api.post(`admin/messages/${vars.messageId}/restore`),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: messagesKey(vars.conversationId) })
    },
  })
}
