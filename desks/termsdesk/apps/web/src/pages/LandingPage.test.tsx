// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import LandingPage from './LandingPage'

import type { SessionDto } from '@termsdesk/shared'

import { ThemeProvider } from '@/app/ThemeProvider'
import { api } from '@/services/api'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const mockApi = vi.mocked(api)

// vitest globals 미사용이라 @testing-library/react 의 자동 act 환경/cleanup 등록이 안 걸림 — 직접 설정.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

const demoSession = (): SessionDto => ({
  user: {
    id: 'u1',
    email: 'demo@termsdesk.app',
    name: '데모 게스트',
    role: 'viewer',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  org: {
    id: 'o1',
    name: '데모',
    slug: 'demo',
    logoUrl: null,
    plan: 'free',
    planChangedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  mode: 'saas',
})

function renderLanding() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app/guide" element={<p>연동 가이드 프로브</p>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('LandingPage 개발자 섹션 (약관을 코드처럼)', () => {
  it('실존 계약만 노출한다 — 공개 JSON·verify·embed.js 스니펫 (INTEGRATION.md 동일)', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 2, name: '약관을 코드처럼' })).toBeDefined()
    // 코드 카드: 공개 JSON + 해시 검증 + 팝업 위젯 — 문서화된 엔드포인트/속성 그대로.
    expect(screen.getByText(/curl \/api\/public\/acme\/policies\/terms-of-service/)).toBeDefined()
    expect(screen.getByText(/"verified": true/)).toBeDefined()
    expect(screen.getByText(/data-termsdesk-policy="terms-of-service"/)).toBeDefined()
    expect(screen.getByText(/\/api\/public\/embed\.js/)).toBeDefined()
    // 기존 히어로 데모 CTA 는 그대로 유지된다.
    expect(screen.getByRole('button', { name: '로그인 없이 둘러보기' })).toBeDefined()
  })

  it('CTA 가 데모 세션을 만들고 연동 가이드로 이동한다', async () => {
    mockApi.post.mockResolvedValueOnce(demoSession())
    renderLanding()

    fireEvent.click(screen.getByRole('button', { name: '데모로 연동 가이드 열기' }))

    expect(await screen.findByText('연동 가이드 프로브')).toBeDefined()
    expect(mockApi.post).toHaveBeenCalledWith('auth/demo')
  })
})

describe('LandingPage 푸터 (도그푸딩 링크)', () => {
  it('자사 약관·지원 보드(/p/termsdesk/* · /support/termsdesk)로 연결한다', () => {
    renderLanding()

    expect(screen.getByRole('link', { name: '이용약관' }).getAttribute('href')).toBe(
      '/p/termsdesk/terms-of-service'
    )
    expect(screen.getByRole('link', { name: '개인정보처리방침' }).getAttribute('href')).toBe(
      '/p/termsdesk/privacy-policy'
    )
    expect(screen.getByRole('link', { name: '지원 보드' }).getAttribute('href')).toBe(
      '/support/termsdesk'
    )
    expect(screen.getByText(/이 약관도 TermsDesk로 게시·검증됩니다/)).toBeDefined()
  })

  it('개발자 섹션의 라이브 예시도 자사 공개 약관을 가리킨다', () => {
    renderLanding()

    expect(
      screen.getByRole('link', { name: '라이브 예시 — 이 사이트의 이용약관' }).getAttribute('href')
    ).toBe('/p/termsdesk/terms-of-service')
  })
})
