// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import LandingPage from './LandingPage'

import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '@/lib/firebaseAuth'

/**
 * 랜딩 스모크 — 히어로/CTA 가 항상 보이는 상태로 렌더되는지 확인한다.
 *
 * TEST SAFETY: 헤더의 <MemberAuthControl> 이 useAuth() 를 호출하므로 <AuthProvider> 밖에서
 * 렌더하면 throw 한다. 그래서 렌더를 <AuthProvider>(+ ThemeProvider + Router)로 감싼다.
 * 환경변수 미설정이면 AuthProvider 는 Firebase 를 건드리지 않고 loading=false 로 즉시 해제한다.
 *
 * jsdom 엔 IntersectionObserver 가 없으므로 useReveal 은 일찍 반환한다 → 리빌 대상이
 * data-reveal 없이 "이미 보이는 기본" 상태로 남는다(blank-on-no-JS 없음). 이 테스트가 그 보증이다.
 */
function renderLanding() {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

afterEach(cleanup)

describe('LandingPage', () => {
  it('히어로 헤드라인과 핵심 CTA 가 렌더된다', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('제품 안의 채팅을')
    // 주 CTA(무료로 시작하기)가 가입 경로로 연결된다.
    const ctas = screen.getAllByRole('link', { name: /무료로 시작하기/ })
    expect(ctas.length).toBeGreaterThan(0)
    expect(ctas[0]).toHaveAttribute('href', '/signup')
  })

  it('리빌 대상은 data-reveal 속성 없이(=보이는 기본) 렌더된다', () => {
    const { container } = renderLanding()
    // useReveal 은 IntersectionObserver 미지원 환경에서 속성을 켜지 않는다 → 항상 보임.
    expect(container.querySelectorAll('[data-reveal]').length).toBe(0)
  })
})
