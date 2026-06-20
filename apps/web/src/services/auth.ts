import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  AuthConfigDto,
  GoogleAuthInput,
  LoginInput,
  RegisterInput,
  SessionDto,
} from '@termsdesk/shared'

export const sessionKey = ['session'] as const

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: () => api.get<SessionDto>('auth/session'),
    retry: false,
    staleTime: 60_000,
  })
}

/** 로그인/가입 화면에서 노출할 인증 방식. */
export function useAuthConfig() {
  return useQuery({
    queryKey: ['auth-config'],
    queryFn: () => api.get<AuthConfigDto>('auth/config'),
    staleTime: 5 * 60_000,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<SessionDto>('auth/login', input),
    onSuccess: (session) => qc.setQueryData(sessionKey, session),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<SessionDto>('auth/register', input),
    onSuccess: (session) => qc.setQueryData(sessionKey, session),
  })
}

export function useGoogleAuth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GoogleAuthInput) => api.post<SessionDto>('auth/google', input),
    onSuccess: (session) => qc.setQueryData(sessionKey, session),
  })
}

/** 로그인 없이 둘러보기 — 읽기전용 데모 게스트 세션. */
export function useDemoLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<SessionDto>('auth/demo'),
    onSuccess: (session) => qc.setQueryData(sessionKey, session),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('auth/logout'),
    onSuccess: () => qc.clear(),
  })
}
