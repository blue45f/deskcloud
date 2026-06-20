// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from './api'
import { inquiryKeys, useUpdateInquiry } from './inquiries'

import type { InquiryDto, InquiryListDto } from '@termsdesk/shared'
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

const inquiry = (over?: Partial<InquiryDto>): InquiryDto => ({
  id: 'q1',
  siteSlug: 'pettography',
  orgId: null,
  category: 'contact',
  status: 'new',
  title: '입점 문의드립니다',
  body: '병원 정보 등록 절차가 궁금합니다.',
  contactEmail: 'kim@example.com',
  originUrl: null,
  userAgent: null,
  ip: '1.1.1.1',
  adminNote: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('useUpdateInquiry (낙관적 갱신)', () => {
  it('응답 전에 목록·상세 캐시에 상태/메모를 반영하고, 실패하면 스냅샷으로 롤백한다', async () => {
    const qc = new QueryClient()
    const listKey = inquiryKeys.list({})
    const initialList: InquiryListDto = {
      items: [inquiry(), inquiry({ id: 'q2', title: '버그 신고합니다', category: 'bug' })],
      total: 2,
    }
    qc.setQueryData<InquiryListDto>(listKey, initialList)
    qc.setQueryData<InquiryDto>(inquiryKeys.one('q2'), initialList.items[1])
    const d = deferred<InquiryDto>()
    mockApi.patch.mockReturnValueOnce(d.promise)

    const { result } = renderWithClient(qc, () => useUpdateInquiry('q2'))
    act(() => result.current.mutate({ status: 'in_progress', adminNote: '확인 중' }))

    await waitFor(() => {
      const listed = qc.getQueryData<InquiryListDto>(listKey)?.items.find((q) => q.id === 'q2')
      expect(listed?.status).toBe('in_progress')
      expect(listed?.adminNote).toBe('확인 중')
    })
    expect(qc.getQueryData<InquiryDto>(inquiryKeys.one('q2'))?.status).toBe('in_progress')
    // 다른 행은 건드리지 않는다
    expect(qc.getQueryData<InquiryListDto>(listKey)?.items[0]).toEqual(initialList.items[0])
    expect(result.current.isPending).toBe(true) // 서버 응답 전 즉시 반영

    d.reject(new Error('서버 오류'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<InquiryListDto>(listKey)).toEqual(initialList)
    expect(qc.getQueryData<InquiryDto>(inquiryKeys.one('q2'))).toEqual(initialList.items[1])
    // onSettled — 실패해도 서버 상태와 재동기화하도록 무효화
    expect(qc.getQueryState(listKey)?.isInvalidated).toBe(true)
  })

  it('성공 시 반영을 유지하고 무효화로 재동기화한다 (adminNote=null 은 메모 제거)', async () => {
    const qc = new QueryClient()
    const listKey = inquiryKeys.list({})
    qc.setQueryData<InquiryListDto>(listKey, {
      items: [inquiry({ adminNote: '예전 메모' })],
      total: 1,
    })
    mockApi.patch.mockResolvedValueOnce(inquiry({ status: 'closed', adminNote: null }))

    const { result } = renderWithClient(qc, () => useUpdateInquiry('q1'))
    act(() => result.current.mutate({ status: 'closed', adminNote: null }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const listed = qc.getQueryData<InquiryListDto>(listKey)?.items[0]
    expect(listed?.status).toBe('closed')
    expect(listed?.adminNote).toBeNull()
    expect(qc.getQueryState(listKey)?.isInvalidated).toBe(true)
  })
})
