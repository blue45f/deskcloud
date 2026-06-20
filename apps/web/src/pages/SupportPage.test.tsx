// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SupportPage from './SupportPage'

import { api } from '@/services/api'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const mockApi = vi.mocked(api)

// vitest globals 미사용이라 @testing-library/react 의 자동 act 환경/cleanup 등록이 안 걸림 — 직접 설정.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

function renderSupport() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/support/termsdesk']}>
        <Routes>
          <Route path="/support/:projectSlug" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function metaContent(attr: 'name' | 'property', key: string): string | null {
  return (
    document.head
      .querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
      ?.getAttribute('content') ?? null
  )
}

function canonicalHref(): string | null {
  return (
    document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href') ??
    null
  )
}

describe('SupportPage 메타 (공개 공유 라우트)', () => {
  it('usePageMeta 로 title·OG·canonical 을 프로젝트 라우트 값으로 설정한다', async () => {
    mockApi.get.mockResolvedValue({ items: [] })
    renderSupport()

    expect(await screen.findByText('접수된 글이 없습니다')).toBeDefined()
    expect(document.title).toBe('Termsdesk 지원 보드 · TermsDesk')
    expect(metaContent('property', 'og:title')).toBe('Termsdesk 지원 보드 · TermsDesk')
    expect(metaContent('property', 'og:description')).toBe(
      'Termsdesk 사이트 문의·제휴·버그 신고를 접수하고 처리 현황을 확인합니다.'
    )
    expect(metaContent('property', 'og:url')).toBe('https://termsdesk.vercel.app/support/termsdesk')
    expect(canonicalHref()).toBe('https://termsdesk.vercel.app/support/termsdesk')
  })

  it('언마운트 시 정적 기본값으로 복원해 다음 라우트로 메타가 새지 않는다', async () => {
    mockApi.get.mockResolvedValue({ items: [] })
    const { unmount } = renderSupport()
    expect(await screen.findByText('접수된 글이 없습니다')).toBeDefined()

    unmount()

    expect(document.title).toBe('TermsDesk')
    expect(metaContent('property', 'og:url')).toBe('https://termsdesk.vercel.app/')
    expect(canonicalHref()).toBe('https://termsdesk.vercel.app/')
  })
})
