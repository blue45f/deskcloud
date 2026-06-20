// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from './api'
import { policyKeys, useArchivePolicy } from './policies'

import type { PolicyDto } from '@termsdesk/shared'
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

const policy = (over?: Partial<PolicyDto>): PolicyDto => ({
  id: 'p1',
  slug: 'terms-of-service',
  name: '이용약관',
  type: 'terms',
  jurisdiction: 'KR',
  description: null,
  visibility: 'public',
  currentVersionId: null,
  currentVersionLabel: null,
  versionCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('useArchivePolicy (낙관적 갱신)', () => {
  it('slug 로 보관하면 목록에서 즉시 제거하고, 실패하면 스냅샷으로 롤백한다', async () => {
    const qc = new QueryClient()
    const initial = [policy(), policy({ id: 'p2', slug: 'privacy-policy', name: '개인정보' })]
    qc.setQueryData<PolicyDto[]>(policyKeys.all, initial)
    const d = deferred<unknown>()
    mockApi.delete.mockReturnValueOnce(d.promise)

    const { result } = renderWithClient(qc, () => useArchivePolicy())
    act(() => result.current.mutate('privacy-policy'))

    await waitFor(() =>
      expect(qc.getQueryData<PolicyDto[]>(policyKeys.all)?.map((p) => p.slug)).toEqual([
        'terms-of-service',
      ])
    )
    expect(result.current.isPending).toBe(true) // 서버 응답 전 즉시 반영

    d.reject(new Error('서버 오류'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<PolicyDto[]>(policyKeys.all)).toEqual(initial)
    // onSettled — 실패해도 서버 상태와 재동기화하도록 무효화
    expect(qc.getQueryState(policyKeys.all)?.isInvalidated).toBe(true)
  })

  it('성공 시 제거를 유지하고 무효화로 재동기화한다', async () => {
    const qc = new QueryClient()
    qc.setQueryData<PolicyDto[]>(policyKeys.all, [policy(), policy({ id: 'p2', slug: 'pp' })])
    mockApi.delete.mockResolvedValueOnce(null)

    const { result } = renderWithClient(qc, () => useArchivePolicy())
    act(() => result.current.mutate('pp'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(qc.getQueryData<PolicyDto[]>(policyKeys.all)?.map((p) => p.id)).toEqual(['p1'])
    expect(qc.getQueryState(policyKeys.all)?.isInvalidated).toBe(true)
  })
})
