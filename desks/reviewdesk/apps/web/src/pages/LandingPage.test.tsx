import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import LandingPage from './LandingPage'

import { AuthProvider } from '@/lib/firebaseAuth'

// LandingPage 는 헤더의 MemberAuthControl 을 통해 useAuth() 를 호출하므로
// 반드시 <AuthProvider> 안에서 렌더해야 한다(밖이면 throw). Firebase 미설정 시
// AuthProvider 는 네트워크 호출 없이 loading=false 로 즉시 해제되어 테스트가 안정적이다.
function renderLanding() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('LandingPage', () => {
  it('히어로 제목과 핵심 가치 제안을 렌더한다', () => {
    renderLanding()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('고객의 별점과 후기를')
    expect(h1).toHaveTextContent('내 서비스 안에서')
  })

  it('주 CTA(무료로 시작하기)가 가입 라우트로 연결된다', () => {
    renderLanding()
    const cta = screen.getByRole('link', { name: /무료로 시작하기/ })
    expect(cta).toHaveAttribute('href', '/signup')
  })

  it('블랭크-온-노-JS 방지: 리빌 래퍼 콘텐츠가 처음부터 접근 가능하다', () => {
    renderLanding()
    // 스크롤 리빌은 CSS 기본값이 가시 상태이므로(관찰자/모션 미동작 시에도 CLS·블랭크 없음),
    // 후기 월·기능 그리드 제목이 즉시 트리에 존재해야 한다.
    expect(
      screen.getByRole('heading', { name: /이미 후기로 신뢰를 쌓는 팀들/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /리뷰 수집부터 노출까지/ })).toBeInTheDocument()
  })

  it('푸터 내비게이션의 모든 링크가 올바른 라우트를 가리킨다', () => {
    renderLanding()
    const footerNav = screen.getByRole('navigation', { name: '푸터' })
    expect(within(footerNav).getByRole('link', { name: '가입' })).toHaveAttribute('href', '/signup')
    expect(within(footerNav).getByRole('link', { name: '위젯 데모' })).toHaveAttribute(
      'href',
      '/demo'
    )
    expect(within(footerNav).getByRole('link', { name: '사이트맵' })).toHaveAttribute(
      'href',
      '/sitemap'
    )
  })
})
