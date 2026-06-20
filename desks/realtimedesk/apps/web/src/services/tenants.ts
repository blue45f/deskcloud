import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  CreateTenantInput,
  HistoryDto,
  PublishInput,
  PublishResultDto,
  TenantDto,
  TenantUsage,
  TenantWithSecretDto,
  UpdateTenantSettingsInput,
} from '@realtimedesk/shared'

import { useAuthStore } from '@/app/authStore'

/* ──────────────────────────────────────────────────────────────────────────
   테넌트 self-service · publish · history 데이터 훅.
   가입을 제외한 모든 요청은 api 클라이언트가 X-Realtime-Key: sk_… 를 자동으로 싣는다.
   ────────────────────────────────────────────────────────────────────────── */

export const tenantKey = ['tenant'] as const
export const usageKey = ['tenant', 'usage'] as const
export const historyKey = (channel: string) => ['history', channel] as const

/** 공개 가입 — pk·sk 발급(sk 평문 1회). 인증 헤더 없이 호출. */
export function useSignup() {
  return useMutation({
    mutationFn: (input: CreateTenantInput) =>
      api.postAnonymous<TenantWithSecretDto>('tenants', input),
  })
}

/** 내 테넌트(키·CORS·플랜·사용량). sk 로 식별. */
export function useTenant() {
  const isAuthed = useAuthStore((s) => s.isAuthed)
  const setPublishableKey = useAuthStore((s) => s.setPublishableKey)
  return useQuery({
    queryKey: tenantKey,
    queryFn: async () => {
      const t = await api.get<TenantDto>('admin/tenant')
      // 라이브 모니터(WS)용으로 pk 를 store 에 동기화.
      if (t.publishableKey) setPublishableKey(t.publishableKey)
      return t
    },
    enabled: isAuthed,
    retry: false,
  })
}

/** 사용량(messages·connections·cap). 라이브 모니터가 주기 폴링. */
export function useUsage(options?: { refetchInterval?: number }) {
  const isAuthed = useAuthStore((s) => s.isAuthed)
  return useQuery({
    queryKey: usageKey,
    queryFn: () => api.get<TenantUsage>('admin/tenant/usage'),
    enabled: isAuthed,
    retry: false,
    refetchInterval: options?.refetchInterval,
  })
}

/** 테넌트 설정 수정(이름·허용 Origin·요금제). 보낸 필드만 갱신. */
export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTenantSettingsInput) => api.patch<TenantDto>('admin/tenant', input),
    onSuccess: (next) => {
      qc.setQueryData(tenantKey, next)
      void qc.invalidateQueries({ queryKey: tenantKey })
      void qc.invalidateQueries({ queryKey: usageKey })
    },
  })
}

/** 키 회전 — 새 pk·sk 발급(이전 키 즉시 무효). sk 평문 1회 반환. */
export function useRotateKeys() {
  const qc = useQueryClient()
  const setKeys = useAuthStore((s) => s.setKeys)
  return useMutation({
    mutationFn: () => api.post<TenantWithSecretDto>('admin/tenant/rotate-keys'),
    onSuccess: (next) => {
      // 새 키로 즉시 세션 갱신(이후 요청이 새 sk 로 나가도록).
      setKeys(next.secretKey, next.publishableKey)
      void qc.invalidateQueries({ queryKey: tenantKey })
      void qc.invalidateQueries({ queryKey: usageKey })
    },
  })
}

/** 서버 publish(sk) — 채널로 이벤트 브로드캐스트 + history 영속화. */
export function usePublish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PublishInput) => api.post<PublishResultDto>('publish', input),
    onSuccess: (_res, input) => {
      void qc.invalidateQueries({ queryKey: historyKey(input.channel) })
      void qc.invalidateQueries({ queryKey: usageKey })
    },
  })
}

/**
 * 채널 history(pk) — 브라우저가 publishable 키 + Origin 으로 최근 N개를 읽는다.
 * 이 엔드포인트는 sk 가 아니라 **pk** 로 인증하므로, 직접 fetch 한다(api 클라이언트는 sk 를 싣는다).
 */
export function useHistory(channel: string, opts?: { enabled?: boolean; limit?: number }) {
  const pk = useAuthStore((s) => s.publishableKey)
  const enabled = (opts?.enabled ?? true) && channel.length > 0 && pk.startsWith('pk_')
  return useQuery({
    queryKey: historyKey(channel),
    queryFn: async (): Promise<HistoryDto> => {
      const base =
        (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
      const limit = opts?.limit
      const url =
        `${base}/api/channels/${encodeURIComponent(channel)}/history` +
        (limit ? `?limit=${limit}` : '')
      const res = await fetch(url, { headers: { 'X-Realtime-Key': pk } })
      const text = await res.text()
      const data: unknown = text ? JSON.parse(text) : null
      if (!res.ok) {
        const m = (data as { message?: unknown })?.message
        throw new Error(
          Array.isArray(m) ? m.join(', ') : String(m ?? `history 조회 실패 (${res.status})`)
        )
      }
      return data as HistoryDto
    },
    enabled,
    retry: false,
  })
}
