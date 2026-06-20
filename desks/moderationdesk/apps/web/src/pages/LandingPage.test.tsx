import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import LandingPage from './LandingPage'

import { AuthProvider } from '@/lib/firebaseAuth'

// 히어로 플레이그라운드(useModerationCheck)가 디바운스 후 fetch 를 시도하므로,
// 네트워크에 닿지 않도록 거부 스텁을 둔다. 훅은 실패를 안전하게 흡수(verdict=allow)한다.
vi.stubGlobal(
  'fetch',
  vi.fn(() => Promise.reject(new Error('network disabled in test')))
)

function renderLanding() {
  // LandingPage 의 Header 는 MemberAuthControl → useAuth 를 호출하므로 <AuthProvider> 필수.
  // Firebase env 미설정이라 Provider 는 즉시 loading=false 로 안정화된다.
  return render(
    <AuthProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('LandingPage', () => {
  it('히어로 헤드라인과 주요 CTA 를 렌더한다', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 1, name: /API 한 번/ })).toBeInTheDocument()

    // 키 발급(primary) CTA 는 /signup 으로 연결.
    const signupCta = screen.getByRole('link', { name: /키 발급받기/ })
    expect(signupCta).toHaveAttribute('href', '/signup')

    // 위젯 체험(secondary) CTA 는 /demo 로 연결.
    expect(screen.getByRole('link', { name: /위젯 체험하기/ })).toHaveAttribute('href', '/demo')
  })

  it('인터랙티브 플레이그라운드(검사할 텍스트 입력)를 노출한다', () => {
    renderLanding()
    expect(screen.getByLabelText('검사할 텍스트')).toBeInTheDocument()
  })

  it('주요 기능 섹션과 6개 기능 카드 제목을 렌더한다', () => {
    renderLanding()
    const features = screen.getByRole('region', { name: '주요 기능' })
    expect(within(features).getByText('규칙 기반은 항상')).toBeInTheDocument()
    expect(within(features).getByText('두 가지 키')).toBeInTheDocument()
    expect(within(features).getByText('SaaS · 셀프호스팅')).toBeInTheDocument()
  })

  it('푸터 내비게이션 링크를 렌더한다', () => {
    renderLanding()
    const footerNav = screen.getByRole('navigation', { name: '푸터' })
    expect(within(footerNav).getByRole('link', { name: '디자인 시스템' })).toHaveAttribute(
      'href',
      '/sitemap'
    )
  })
})
