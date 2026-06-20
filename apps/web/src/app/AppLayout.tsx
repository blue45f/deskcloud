import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { RouteAnnouncer } from './RouteAnnouncer'
import { sessionStore } from './sessionStore'
import { useSecretKey } from './useSession'

import type { ReactElement } from 'react'

import { MemberAuthControl } from '@/components/layout/MemberAuthControl'

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'ax-nav-link ax-active' : 'ax-nav-link'
}

/** 앱 셸 — 상단 내비 + 라우트 아웃렛 + 라우트 전환 시 포커스/타이틀 갱신. */
export function AppLayout(): ReactElement {
  const secretKey = useSecretKey()
  const navigate = useNavigate()
  const location = useLocation()

  // 라우트 변경 시 메인으로 포커스 이동(스크린리더 a11y) + 스크롤 톱.
  useEffect(() => {
    const main = document.getElementById('main')
    main?.focus()
    window.scrollTo(0, 0)
  }, [location.pathname])

  const logout = (): void => {
    sessionStore.clear()
    navigate('/login')
  }

  return (
    <div className="ax-shell">
      <a className="ax-skip" href="#main">
        본문으로 건너뛰기
      </a>
      <nav className="ax-nav" aria-label="주요">
        <NavLink to="/" className="ax-brand">
          <span className="ax-brand-mark" aria-hidden="true">
            A
          </span>
          AdDesk
          <span className="ax-beta-badge">BETA</span>
        </NavLink>
        <span className="ax-nav-spacer" />
        <div className="ax-nav-links">
          <NavLink to="/" end className={navClass}>
            소개
          </NavLink>
          <NavLink to="/pricing" className={navClass}>
            요금제
          </NavLink>
          <NavLink to="/support" className={navClass}>
            문의
          </NavLink>
          {secretKey ? (
            <>
              <NavLink to="/dashboard" className={navClass}>
                대시보드
              </NavLink>
              <button type="button" className="ax-btn ax-btn-sm" onClick={logout}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                어드민
              </NavLink>
              <NavLink to="/signup" className="ax-btn ax-btn-primary ax-btn-sm">
                가입
              </NavLink>
            </>
          )}
          {/* 회원 로그인(Firebase 통합 로그인) — 어드민 콘솔 로그인과 별개로 공존한다. */}
          <MemberAuthControl />
        </div>
      </nav>
      <main id="main" className="ax-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="ax-footer">
        <div className="ax-footer-inner">
          <Link to="/" className="ax-brand">
            <span className="ax-brand-mark" aria-hidden="true">
              A
            </span>
            AdDesk
          </Link>
          <span className="ax-footer-copy">
            한 줄 임베드 · 가중치 서빙 · CTR 통계 · 멀티테넌트 키
          </span>
          <nav className="ax-footer-links" aria-label="푸터">
            <NavLink to="/pricing">요금제</NavLink>
            <NavLink to="/support">문의</NavLink>
            <NavLink to="/sitemap">사이트맵</NavLink>
            <NavLink to="/login">어드민</NavLink>
          </nav>
        </div>
      </footer>
      <RouteAnnouncer />
    </div>
  )
}
