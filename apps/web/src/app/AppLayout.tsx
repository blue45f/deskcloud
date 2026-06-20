import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { RouteAnnouncer } from './RouteAnnouncer'
import { sessionStore } from './sessionStore'
import { useScrolled } from './useScrolled'
import { useSecretKey } from './useSession'

import type { ReactElement } from 'react'

import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { SiteFooter } from '@/components/layout/SiteFooter'

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'fd-nav-link fd-active' : 'fd-nav-link'
}

/** 앱 셸 — 상단 내비 + 라우트 아웃렛 + 푸터 + 라우트 전환 시 포커스/타이틀 갱신. */
export function AppLayout(): ReactElement {
  const secretKey = useSecretKey()
  const navigate = useNavigate()
  const location = useLocation()
  const scrolled = useScrolled()

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
    <div className="fd-shell">
      <a className="fd-skip" href="#main">
        본문으로 건너뛰기
      </a>
      <nav className={scrolled ? 'fd-nav fd-nav-scrolled' : 'fd-nav'} aria-label="주요">
        <NavLink to="/" className="fd-brand">
          <span className="fd-brand-mark" aria-hidden="true">
            F
          </span>
          FileDesk
          <span className="fd-beta-badge">BETA</span>
        </NavLink>
        <span className="fd-nav-spacer" />
        <div className="fd-nav-links">
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
              <button type="button" className="fd-btn fd-btn-sm" onClick={logout}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                어드민
              </NavLink>
              <NavLink to="/signup" className="fd-btn fd-btn-primary fd-btn-sm">
                가입
              </NavLink>
            </>
          )}
          {/* 통합 회원 로그인(Firebase 이메일/게스트) — 기존 어드민 sk_ 콘솔 로그인과 별개의 추가 옵션. */}
          <MemberAuthControl />
        </div>
      </nav>
      <main id="main" className="fd-main" tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
      <RouteAnnouncer />
    </div>
  )
}
