// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useRemoveMember, useRevokeApiKey, useUpdateMemberRole, useUpdateOrg } from './admin'
import { api } from './api'
import { sessionKey } from './auth'

import type { ApiKeyDto, MemberDto, SessionDto } from '@termsdesk/shared'
import type { ReactNode } from 'react'

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const mockApi = vi.mocked(api)

// vitest globals 미사용이라 @testing-library/react 의 자동 act 환경/cleanup 등록이 안 걸림 — 직접 설정.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

/** 응답 시점을 테스트가 직접 제어하는 promise — 낙관 반영(응답 전)과 롤백(거부 후)을 분리 검증한다. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderWithClient<T>(qc: QueryClient, hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  })
}

const member = (over?: Partial<MemberDto>): MemberDto => ({
  id: 'm1',
  email: 'owner@example.com',
  name: '김약관',
  role: 'viewer',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const apiKey = (over?: Partial<ApiKeyDto>): ApiKeyDto => ({
  id: 'k1',
  name: '프로덕션 키',
  keyPrefix: 'td_pk_abc123',
  scopes: ['read:current'],
  lastUsedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  revokedAt: null,
  ...over,
})

const session = (): SessionDto => ({
  user: member({ role: 'owner' }),
  org: {
    id: 'o1',
    name: '에이크미',
    slug: 'acme',
    logoUrl: null,
    plan: 'free',
    planChangedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  mode: 'self-hosted',
})

describe('useUpdateMemberRole (낙관적 갱신)', () => {
  it('응답 전에 역할을 캐시에 반영하고, 실패하면 스냅샷으로 롤백한다', async () => {
    const qc = new QueryClient()
    const initial = [member(), member({ id: 'm2', email: 'editor@example.com', name: '이감사' })]
    qc.setQueryData<MemberDto[]>(['members'], initial)
    const d = deferred<MemberDto>()
    mockApi.patch.mockReturnValueOnce(d.promise)

    const { result } = renderWithClient(qc, () => useUpdateMemberRole())
    act(() => result.current.mutate({ id: 'm2', role: 'admin' }))

    await waitFor(() =>
      expect(qc.getQueryData<MemberDto[]>(['members'])?.find((m) => m.id === 'm2')?.role).toBe(
        'admin'
      )
    )
    expect(result.current.isPending).toBe(true) // 서버 응답 전 즉시 반영

    d.reject(new Error('서버 오류'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<MemberDto[]>(['members'])).toEqual(initial)
    // onSettled — 실패해도 서버 상태와 재동기화하도록 무효화
    expect(qc.getQueryState(['members'])?.isInvalidated).toBe(true)
  })
})

describe('useRemoveMember (낙관적 갱신)', () => {
  it('목록에서 즉시 제거하고, 실패하면 스냅샷으로 롤백한다', async () => {
    const qc = new QueryClient()
    const initial = [member(), member({ id: 'm2', email: 'editor@example.com', name: '이감사' })]
    qc.setQueryData<MemberDto[]>(['members'], initial)
    const d = deferred<unknown>()
    mockApi.delete.mockReturnValueOnce(d.promise)

    const { result } = renderWithClient(qc, () => useRemoveMember())
    act(() => result.current.mutate('m2'))

    await waitFor(() =>
      expect(qc.getQueryData<MemberDto[]>(['members'])?.map((m) => m.id)).toEqual(['m1'])
    )

    d.reject(new Error('서버 오류'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<MemberDto[]>(['members'])).toEqual(initial)
  })

  it('성공 시 제거를 유지하고 무효화로 재동기화한다', async () => {
    const qc = new QueryClient()
    qc.setQueryData<MemberDto[]>(['members'], [member(), member({ id: 'm2' })])
    mockApi.delete.mockResolvedValueOnce(null)

    const { result } = renderWithClient(qc, () => useRemoveMember())
    act(() => result.current.mutate('m2'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(qc.getQueryData<MemberDto[]>(['members'])?.map((m) => m.id)).toEqual(['m1'])
    expect(qc.getQueryState(['members'])?.isInvalidated).toBe(true)
  })
})

describe('useRevokeApiKey (낙관적 갱신)', () => {
  it("응답 전에 '폐기됨'(revokedAt)을 표시하고, 실패하면 스냅샷으로 롤백한다", async () => {
    const qc = new QueryClient()
    const initial = [apiKey(), apiKey({ id: 'k2', name: '스테이징 키' })]
    qc.setQueryData<ApiKeyDto[]>(['apikeys'], initial)
    const d = deferred<unknown>()
    mockApi.delete.mockReturnValueOnce(d.promise)

    const { result } = renderWithClient(qc, () => useRevokeApiKey())
    act(() => result.current.mutate('k2'))

    await waitFor(() =>
      expect(
        qc.getQueryData<ApiKeyDto[]>(['apikeys'])?.find((k) => k.id === 'k2')?.revokedAt
      ).not.toBeNull()
    )
    // 다른 키는 건드리지 않는다
    expect(qc.getQueryData<ApiKeyDto[]>(['apikeys'])?.find((k) => k.id === 'k1')?.revokedAt).toBe(
      null
    )

    d.reject(new Error('서버 오류'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<ApiKeyDto[]>(['apikeys'])).toEqual(initial)
    expect(qc.getQueryState(['apikeys'])?.isInvalidated).toBe(true)
  })
})

describe('useUpdateOrg (낙관적 갱신)', () => {
  it('세션 캐시의 조직명을 즉시 반영하고, 실패하면 스냅샷으로 롤백한다', async () => {
    const qc = new QueryClient()
    const initial = session()
    qc.setQueryData<SessionDto>(sessionKey, initial)
    const d = deferred<unknown>()
    mockApi.patch.mockReturnValueOnce(d.promise)

    const { result } = renderWithClient(qc, () => useUpdateOrg())
    act(() => result.current.mutate({ name: '에이크미 주식회사' }))

    await waitFor(() =>
      expect(qc.getQueryData<SessionDto>(sessionKey)?.org.name).toBe('에이크미 주식회사')
    )
    expect(qc.getQueryData<SessionDto>(sessionKey)?.user).toEqual(initial.user)

    d.reject(new Error('서버 오류'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<SessionDto>(sessionKey)).toEqual(initial)
    expect(qc.getQueryState(sessionKey)?.isInvalidated).toBe(true)
  })
})
