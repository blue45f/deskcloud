import { createBrowserRouter } from 'react-router-dom'

import type { ComponentType } from 'react'

import RequireAuth from '@/app/RequireAuth'
import RootLayout from '@/app/RootLayout'
import Loading from '@/components/common/Loading'
import RouteError from '@/components/common/RouteError'
import AppLayout from '@/components/layout/AppLayout'

const CHUNK_RETRY_KEY = 'reviewdesk-chunk-retry'

/**
 * 라우트별 코드 분할 — 각 페이지를 별도 청크로. 배포 직후 stale 청크 404 는
 * 새로고침 1회로 자동 복구(sessionStorage 가드, 성공 로드 시에만 해제).
 */
const lazyRetry =
  <T extends ComponentType>(factory: () => Promise<{ default: T }>) =>
  async (): Promise<{ Component: T }> => {
    try {
      const mod = await factory()
      sessionStorage.removeItem(CHUNK_RETRY_KEY)
      return { Component: mod.default }
    } catch (err) {
      if (!sessionStorage.getItem(CHUNK_RETRY_KEY)) {
        sessionStorage.setItem(CHUNK_RETRY_KEY, '1')
        window.location.reload()
        return new Promise<never>(() => {})
      }
      throw err
    }
  }

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RouteError,
    HydrateFallback: Loading,
    children: [
      { index: true, lazy: lazyRetry(() => import('@/pages/LandingPage')) },
      // 라이브 디자인 시스템(스타일 가이드) — 공개.
      { path: 'design', lazy: lazyRetry(() => import('@/pages/DesignPage')) },
      { path: 'sitemap', lazy: lazyRetry(() => import('@/pages/SitemapPage')) },
      // 셀프 가입(외부 온보딩) — pk/sk 발급 + 임베드 스니펫.
      { path: 'signup', lazy: lazyRetry(() => import('@/pages/SignupPage')) },
      { path: 'login', lazy: lazyRetry(() => import('@/pages/LoginPage')) },
      // 공개 위젯 데모 — 실제 위젯을 띄워 제출·집계까지 체험.
      { path: 'demo', lazy: lazyRetry(() => import('@/pages/DemoPage')) },
      // 내부 문의 게시판 — desk-platform 공개 API로 등록·조회(전화·이메일 대체).
      { path: 'support', lazy: lazyRetry(() => import('@/pages/SupportPage')) },
      {
        path: 'app',
        Component: RequireAuth,
        children: [
          {
            Component: AppLayout,
            children: [
              { index: true, lazy: lazyRetry(() => import('@/pages/DashboardPage')) },
              {
                path: 'testimonials',
                lazy: lazyRetry(() => import('@/pages/TestimonialsPage')),
              },
              { path: 'settings', lazy: lazyRetry(() => import('@/pages/SettingsPage')) },
            ],
          },
        ],
      },
      { path: '*', lazy: lazyRetry(() => import('@/pages/NotFoundPage')) },
    ],
  },
])
