import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { RouteAnnouncer } from './RouteAnnouncer'
import { sessionStore } from './sessionStore'
import { useSecretKey } from './useSession'

import type { ReactElement } from 'react'

import { MemberAuthControl } from '@/components/layout/MemberAuthControl'

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'ad-nav-link ad-active' : 'ad-nav-link'
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
    <div className="ad-shell">
      <a className="ad-skip" href="#main">
        본문으로 건너뛰기
      </a>
      <nav className="ad-nav" aria-label="주요">
        <NavLink to="/" className="ad-brand">
          <span className="ad-brand-mark" aria-hidden="true">
            A
          </span>
          AuthDesk
          <span className="ad-beta-badge">BETA</span>
        </NavLink>
        <span className="ad-nav-spacer" />
        <div className="ad-nav-links">
          <NavLink to="/" end className={navClass}>
            소개
          </NavLink>
          <NavLink to="/pricing" className={navClass}>
            요금제
          </NavLink>
          <NavLink to="/support" className={navClass}>
            문의
          </NavLink>
          <NavLink to="/sitemap" className={navClass}>
            사이트맵
          </NavLink>
          {secretKey ? (
            <>
              <NavLink to="/dashboard" className={navClass}>
                대시보드
              </NavLink>
              <button type="button" className="ad-btn ad-btn-sm" onClick={logout}>
                콘솔 로그아웃
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                콘솔
              </NavLink>
              <NavLink to="/signup" className="ad-btn ad-btn-primary ad-btn-sm">
                가입
              </NavLink>
            </>
          )}
          {/* 통합 회원 로그인(Firebase Auth) — 운영자 콘솔(secret 키)과 별개의 진입점. */}
          <MemberAuthControl />
        </div>
      </nav>
      <main id="main" className="ad-main" tabIndex={-1}>
        <Outlet />
      </main>
      <RouteAnnouncer />
    </div>
  )
}
